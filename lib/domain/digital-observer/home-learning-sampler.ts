import { getStreamActivityInsight } from "@/lib/domain/video-gateway-client";

type SupabaseLike = any;

type ActivityInsight = {
  motion_score: number;
  luminance_score: number;
  sampled_at: string;
  sample_frames: number;
  raw_frames_returned: false;
};

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function boundedScore(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0;
}

function rollingAverage(previous: number, count: number, next: number) {
  return Number((((previous * count) + next) / (count + 1)).toFixed(4));
}

export async function sampleConsentedHomeLearning(supabase: SupabaseLike) {
  const { data: sites, error: siteError } = await supabase
    .from("observer_sites")
    .select("id,metadata,monitoring_enabled,observer_runtime_status")
    .eq("monitoring_enabled", true)
    .limit(50);
  if (siteError) throw new Error(siteError.message);

  const results = [];
  for (const site of sites ?? []) {
    const siteMetadata = objectValue(site.metadata);
    if (siteMetadata.observer_monitoring_consent !== true) continue;

    const { data: sources, error: sourceError } = await supabase
      .from("digital_observer_camera_sources")
      .select("id,status,health_status,metadata")
      .eq("observer_site_id", site.id)
      .in("status", ["connected", "active", "ready"])
      .limit(64);
    if (sourceError) throw new Error(sourceError.message);

    const sampled = await Promise.all((sources ?? []).map(async (source: Record<string, any>) => {
      const metadata = objectValue(source.metadata);
      const streamId = String(metadata.gateway_stream_id ?? "").trim();
      if (!streamId) return null;
      const response = await getStreamActivityInsight(streamId);
      const data = objectValue(response.data);
      const insight = objectValue(data.insight) as Partial<ActivityInsight>;
      if (response.status !== "healthy" || data.local_processing !== true || data.no_raw_video_returned !== true) return null;
      if (typeof insight.motion_score !== "number" || typeof insight.luminance_score !== "number") return null;
      return {
        source,
        insight: {
          motion_score: boundedScore(insight.motion_score),
          luminance_score: boundedScore(insight.luminance_score),
          sampled_at: String(insight.sampled_at ?? new Date().toISOString()),
          sample_frames: Math.max(1, Number(insight.sample_frames ?? 1)),
          raw_frames_returned: false as const
        }
      };
    }));

    const liveSamples = sampled.filter(Boolean) as Array<{ source: Record<string, any>; insight: ActivityInsight }>;
    if (!liveSamples.length) {
      results.push({ observer_site_id: site.id, sampled: 0, skipped: (sources ?? []).length });
      continue;
    }

    const now = new Date().toISOString();
    const motion = liveSamples.reduce((sum, item) => sum + item.insight.motion_score, 0) / liveSamples.length;
    const luminance = liveSamples.reduce((sum, item) => sum + item.insight.luminance_score, 0) / liveSamples.length;
    const { data: existing } = await supabase
      .from("site_behavior_baselines")
      .select("id,baseline_value,confidence_level,metadata")
      .eq("observer_site_id", site.id)
      .eq("baseline_type", "normal_camera_activity")
      .maybeSingle();
    const prior = objectValue(existing?.baseline_value);
    const sampleCount = Math.max(0, Number(prior.sample_count ?? 0));
    const nextCount = sampleCount + 1;
    const confidence = Math.min(1, Number((nextCount / 288).toFixed(4)));
    const baselineValue = {
      status: nextCount >= 288 ? "baseline_ready" : "collecting",
      sample_count: nextCount,
      average_motion_score: rollingAverage(boundedScore(prior.average_motion_score), sampleCount, motion),
      average_luminance_score: rollingAverage(boundedScore(prior.average_luminance_score), sampleCount, luminance),
      last_active_camera_count: liveSamples.length,
      hour_of_day: new Date().getHours(),
      last_sampled_at: now
    };
    const baselineRow = {
      observer_site_id: site.id,
      baseline_type: "normal_camera_activity",
      baseline_value: baselineValue,
      confidence_level: confidence,
      learning_maturity: nextCount >= 288 ? "calibrated" : "learning",
      anomaly_readiness_score: nextCount >= 288 ? confidence : 0,
      source_summary: {
        source: "local_gateway_activity_metrics",
        active_camera_count: liveSamples.length,
        raw_video_received_by_cloud: false
      },
      metadata: {
        ...objectValue(existing?.metadata),
        consent_version: "deidentified-insights-v1",
        local_pixel_processing: true,
        raw_video_stored: false,
        identity_analysis: false
      },
      last_calibrated_at: nextCount >= 288 ? now : null,
      updated_at: now
    };
    if (existing?.id) await supabase.from("site_behavior_baselines").update(baselineRow).eq("id", existing.id);
    else await supabase.from("site_behavior_baselines").insert(baselineRow);

    await supabase.from("observer_site_learning_profiles").upsert({
      observer_site_id: site.id,
      learning_status: nextCount >= 288 ? "baseline_ready" : "collecting_baseline",
      learning_maturity: nextCount >= 288 ? "calibrated" : "learning",
      baseline_version: "v2_local_activity_metrics",
      confidence_level: confidence,
      anomaly_readiness_score: nextCount >= 288 ? confidence : 0,
      routine_confidence: { normal_camera_activity: confidence },
      metadata: {
        human_review_required: true,
        no_raw_video_in_profile: true,
        model_improvement_consent: siteMetadata.model_improvement_consent === true,
        model_improvement_scope: "deidentified_insights_only"
      },
      updated_at: now
    }, { onConflict: "observer_site_id" });
    await supabase.from("observer_sites").update({ observer_runtime_status: nextCount >= 288 ? "learning_shadow" : "learning_readiness", updated_at: now }).eq("id", site.id);
    results.push({ observer_site_id: site.id, sampled: liveSamples.length, skipped: (sources ?? []).length - liveSamples.length, confidence });
  }
  return results;
}
