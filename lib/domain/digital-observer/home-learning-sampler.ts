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

async function recordLearningUpdate(supabase: SupabaseLike, observerSiteId: string, input: {
  patternKey: string;
  eventType: string;
  confidence: number;
  recommendedAction: string;
  metadata: Record<string, unknown>;
  severity?: "info" | "low" | "medium";
}) {
  const existing = await supabase
    .from("observer_intelligence_signals")
    .select("id")
    .eq("observer_site_id", observerSiteId)
    .eq("pattern_key", input.patternKey)
    .maybeSingle();
  if (existing.data?.id) return;
  const result = await supabase.from("observer_intelligence_signals").insert({
    signal_type: "pattern",
    source_type: "system",
    observer_site_id: observerSiteId,
    severity: input.severity ?? "info",
    confidence: boundedScore(input.confidence),
    review_status: "needs_review",
    recommended_action: input.recommendedAction,
    risk_score: input.severity === "medium" ? 35 : input.severity === "low" ? 18 : 5,
    pattern_key: input.patternKey,
    human_review_required: true,
    parent_visible: false,
    metadata: {
      event_type: input.eventType,
      local_metrics_only: true,
      no_raw_video_received: true,
      no_automatic_physical_action: true,
      ...input.metadata
    }
  });
  if (result.error) throw new Error(result.error.message);
}

export async function recordHomeActivityMetrics(supabase: SupabaseLike, observerSiteId: string, samples: Array<{ motion_score: number; luminance_score: number; sampled_at: string }>) {
  const { data: site, error: siteError } = await supabase
    .from("observer_sites")
    .select("id,metadata,monitoring_enabled")
    .eq("id", observerSiteId)
    .single();
  if (siteError || !site) throw new Error(siteError?.message ?? "Observer site not found");
  const siteMetadata = objectValue(site.metadata);
  if (site.monitoring_enabled !== true || siteMetadata.observer_monitoring_consent !== true) throw new Error("Observer monitoring consent is required");
  if (!samples.length) return { observer_site_id: observerSiteId, sampled: 0, confidence: 0 };

  const motion = samples.reduce((sum, item) => sum + boundedScore(item.motion_score), 0) / samples.length;
  const luminance = samples.reduce((sum, item) => sum + boundedScore(item.luminance_score), 0) / samples.length;
  const { data: existing } = await supabase
    .from("site_behavior_baselines")
    .select("id,baseline_value,metadata")
    .eq("observer_site_id", observerSiteId)
    .eq("baseline_type", "normal_camera_activity")
    .maybeSingle();
  const prior = objectValue(existing?.baseline_value);
  const sampleCount = Math.max(0, Number(prior.sample_count ?? 0));
  const nextCount = sampleCount + 1;
  const confidence = Math.min(1, Number((nextCount / 288).toFixed(4)));
  const now = new Date().toISOString();
  const baselineRow = {
    observer_site_id: observerSiteId,
    baseline_type: "normal_camera_activity",
    baseline_value: {
      status: nextCount >= 288 ? "baseline_ready" : "collecting",
      sample_count: nextCount,
      average_motion_score: rollingAverage(boundedScore(prior.average_motion_score), sampleCount, motion),
      average_luminance_score: rollingAverage(boundedScore(prior.average_luminance_score), sampleCount, luminance),
      last_active_camera_count: samples.length,
      hour_of_day: new Date().getHours(),
      last_sampled_at: now
    },
    confidence_level: confidence,
    learning_maturity: nextCount >= 288 ? "calibrated" : "learning",
    anomaly_readiness_score: nextCount >= 288 ? confidence : 0,
    source_summary: { source: "local_gateway_activity_metrics", active_camera_count: samples.length, raw_video_received_by_cloud: false },
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
  const baselineResult = existing?.id
    ? await supabase.from("site_behavior_baselines").update(baselineRow).eq("id", existing.id)
    : await supabase.from("site_behavior_baselines").insert(baselineRow);
  if (baselineResult.error) throw new Error(baselineResult.error.message);

  const profileResult = await supabase.from("observer_site_learning_profiles").upsert({
    observer_site_id: observerSiteId,
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
  if (profileResult.error) throw new Error(profileResult.error.message);
  await supabase.from("observer_sites").update({ observer_runtime_status: nextCount >= 288 ? "learning_shadow" : "learning_readiness", updated_at: now }).eq("id", observerSiteId);

  const milestone = [1, 12, 72, 144, 288].includes(nextCount) ? nextCount : null;
  if (milestone) {
    await recordLearningUpdate(supabase, observerSiteId, {
      patternKey: `home_learning_progress:${observerSiteId}:${milestone}`,
      eventType: milestone === 1 ? "home_learning_started" : "home_learning_progress",
      confidence,
      recommendedAction: milestone === 288
        ? "קו הבסיס הראשוני הושלם. מומלץ לעבור על התובנות ולאשר שהן מתאימות לשגרת הבית."
        : "אין צורך בפעולה. התצפיתן ממשיך לאסוף מדדי פעילות מקומיים לבניית שגרת הבית.",
      metadata: { sample_count: nextCount, active_camera_count: samples.length, baseline_status: nextCount >= 288 ? "baseline_ready" : "collecting" }
    });
  }

  const priorMotion = boundedScore(prior.average_motion_score);
  const priorLuminance = boundedScore(prior.average_luminance_score);
  const motionDeviation = Math.abs(motion - priorMotion);
  const luminanceDeviation = Math.abs(luminance - priorLuminance);
  if (sampleCount >= 24 && (motionDeviation >= 0.35 || luminanceDeviation >= 0.45)) {
    const hourKey = now.slice(0, 13);
    await recordLearningUpdate(supabase, observerSiteId, {
      patternKey: `home_activity_change:${observerSiteId}:${hourKey}`,
      eventType: "home_activity_change",
      confidence: Math.max(motionDeviation, luminanceDeviation),
      severity: motionDeviation >= 0.55 || luminanceDeviation >= 0.65 ? "medium" : "low",
      recommendedAction: "נמדד שינוי ביחס לשגרה שנאספה. מומלץ לבדוק את המצלמות הפעילות לפני כל פעולה נוספת.",
      metadata: {
        sample_count: nextCount,
        active_camera_count: samples.length,
        motion_deviation: Number(motionDeviation.toFixed(4)),
        luminance_deviation: Number(luminanceDeviation.toFixed(4))
      }
    });
  }
  return { observer_site_id: observerSiteId, sampled: samples.length, confidence, sample_count: nextCount };
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
