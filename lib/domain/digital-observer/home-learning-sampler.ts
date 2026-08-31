import "server-only";
import { createHash } from "node:crypto";
import { getStreamActivityInsight } from "@/lib/domain/video-gateway-client";
import { behaviorBaselineSchema, detectBehaviorAnomaly, learningObservationSchema, observationHour, updateBehaviorBaseline, type BehaviorBaseline } from "./learning-engine";

type SupabaseLike = any;
type ActivitySample = { stream_id?: string; motion_score: number; luminance_score: number; sampled_at: string };
type LearningUpdate = {
  patternKey: string; eventType: string; confidence: number; recommendedAction: string;
  metadata: Record<string, unknown>; severity?: "info" | "low" | "medium"; cameraSourceId?: string | null;
};

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function eventId(siteId: string, patternKey: string) {
  const digest = createHash("sha256").update(JSON.stringify(["guard-learning-v1", siteId, patternKey])).digest("hex");
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

async function recordLearningUpdate(supabase: SupabaseLike, observerSiteId: string, input: LearningUpdate) {
  const result = await supabase.from("observer_intelligence_signals").insert({
    id: eventId(observerSiteId, input.patternKey),
    signal_type: "pattern", source_type: "system", observer_site_id: observerSiteId,
    severity: input.severity ?? "info", confidence: input.confidence, review_status: "needs_review",
    recommended_action: input.recommendedAction,
    risk_score: input.severity === "medium" ? 35 : input.severity === "low" ? 18 : 5,
    pattern_key: input.patternKey, human_review_required: true, parent_visible: false,
    metadata: { ...input.metadata, event_type: input.eventType, local_metrics_only: true,
      no_raw_video_received: true, camera_source_id: input.cameraSourceId ?? null, no_automatic_physical_action: true }
  });
  // Stable primary key makes retrying the persisted outbox safe.
  if (result.error && result.error.code !== "23505") throw new Error(result.error.message);
}

async function updateLearningProjection(supabase: SupabaseLike, observerSiteId: string, siteMetadata: Record<string, any>, baseline: Record<string, any>, updatedAt: string) {
  const ready = baseline.status === "baseline_ready";
  const confidence = Number(baseline.confidence ?? 0);
  const profileResult = await supabase.from("observer_site_learning_profiles").upsert({
    observer_site_id: observerSiteId, learning_status: ready ? "baseline_ready" : "collecting_baseline",
    learning_maturity: ready ? "calibrated" : "learning", baseline_version: "v3_per_camera_metrics",
    confidence_level: confidence, anomaly_readiness_score: ready ? confidence : 0, routine_confidence: { normal_camera_activity: confidence },
    metadata: { human_review_required: true, no_raw_video_in_profile: true,
      model_improvement_consent: siteMetadata.model_improvement_consent === true, model_improvement_scope: "deidentified_insights_only" },
    updated_at: updatedAt
  }, { onConflict: "observer_site_id" });
  if (profileResult.error) throw new Error(profileResult.error.message);
  const siteResult = await supabase.from("observer_sites")
    .update({ observer_runtime_status: ready ? "learning_shadow" : "learning_readiness", updated_at: updatedAt }).eq("id", observerSiteId);
  if (siteResult.error) throw new Error(siteResult.error.message);
}

async function recordMetricsAttempt(supabase: SupabaseLike, observerSiteId: string, samples: ActivitySample[]) {
  const { data: site, error: siteError } = await supabase.from("observer_sites")
    .select("id,metadata,monitoring_enabled,timezone").eq("id", observerSiteId).single();
  if (siteError || !site) throw new Error(siteError?.message ?? "Observer site not found");
  const siteMetadata = objectValue(site.metadata);
  if (site.monitoring_enabled !== true || siteMetadata.observer_monitoring_consent !== true) throw new Error("Observer monitoring consent is required");
  const timeZone = typeof site.timezone === "string" ? site.timezone : "Asia/Jerusalem";
  observationHour(new Date().toISOString(), timeZone); // Reject invalid tenant configuration before writes.
  if (samples.length > 64) throw new Error("LEARNING_BATCH_TOO_LARGE");
  const { data: sources, error: sourceError } = await supabase.from("digital_observer_camera_sources")
    .select("id,display_name,location_label,status,metadata").eq("observer_site_id", observerSiteId);
  if (sourceError) throw new Error(sourceError.message);
  const cameraByStream = new Map<string, Record<string, any>>();
  for (const source of sources ?? []) {
    if (source.status === "disabled") continue;
    const streamId = String(objectValue(source.metadata).gateway_stream_id ?? "").trim();
    if (!streamId) continue;
    if (cameraByStream.has(streamId)) throw new Error("LEARNING_AMBIGUOUS_CAMERA_MAPPING");
    cameraByStream.set(streamId, source);
  }
  const observations = samples.map((sample) => {
    const source = cameraByStream.get(String(sample.stream_id ?? "").trim());
    if (!source) throw new Error("LEARNING_CAMERA_OUTSIDE_SITE");
    const observation = learningObservationSchema.parse({
      cameraId: source.id, zoneName: source.location_label || source.display_name || "אזור ללא שם",
      observedAt: sample.sampled_at, motionLevel: sample.motion_score, lightLevel: sample.luminance_score
    });
    const age = Date.now() - Date.parse(observation.observedAt);
    if (age < -5_000 || age > 5 * 60_000) throw new Error("LEARNING_SAMPLE_EXPIRED");
    return observation;
  }).sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));

  const { data: existing, error: baselineError } = await supabase.from("site_behavior_baselines")
    .select("id,baseline_value,metadata,updated_at").eq("observer_site_id", observerSiteId)
    .eq("baseline_type", "normal_camera_activity").maybeSingle();
  if (baselineError) throw new Error(baselineError.message);
  const prior = objectValue(existing?.baseline_value);
  const cameraBaselines: Record<string, BehaviorBaseline> = {};
  const currentCameraIds = new Set((sources ?? []).filter((source: any) => source.status !== "disabled").map((source: any) => source.id));
  for (const [id, value] of Object.entries(objectValue(prior.camera_baselines))) {
    if (!currentCameraIds.has(id)) continue;
    const parsed = behaviorBaselineSchema.safeParse(value);
    if (!parsed.success || parsed.data.cameraId !== id) throw new Error("LEARNING_BASELINE_INVALID");
    // A timezone change starts a fresh baseline; hours from different zones cannot be merged.
    if (parsed.data.timeZone === timeZone) cameraBaselines[id] = parsed.data;
  }
  const pending: LearningUpdate[] = Array.isArray(prior.pending_learning_events) ? [...prior.pending_learning_events] : [];
  const accepted = [];
  const restrictedHours = Array.isArray(siteMetadata.restricted_hours)
    ? siteMetadata.restricted_hours.filter((hour: unknown) => Number.isInteger(hour) && Number(hour) >= 0 && Number(hour) <= 23) as number[] : [];
  for (const observation of observations) {
    const baseline = cameraBaselines[observation.cameraId] ?? null;
    if (baseline && Date.parse(observation.observedAt) <= Date.parse(baseline.lastObservedAt)) continue;
    if (baseline) {
      const anomaly = detectBehaviorAnomaly(observation, baseline, restrictedHours);
      if (anomaly.isAnomaly) {
        pending.push({
          patternKey: `home_activity_change:${observerSiteId}:${observation.cameraId}:${observation.observedAt.slice(0, 13)}`,
          eventType: "home_activity_change", confidence: baseline.confidence, severity: "low",
          cameraSourceId: observation.cameraId,
          recommendedAction: `${anomaly.reason}. מומלץ לבדוק את המצלמה; אין כאן קביעה על סכנה או זהות.`,
          metadata: { camera_zone_name: observation.zoneName, observed_at: observation.observedAt,
            anomaly_score: anomaly.score, reasons: anomaly.reasons, sample_count: baseline.samples,
            review_only: true, time_zone: timeZone }
        });
      }
    }
    cameraBaselines[observation.cameraId] = updateBehaviorBaseline(baseline, observation, timeZone);
    accepted.push(observation);
  }
  // Also retry pending event writes after a previous partial failure, without counting samples again.
  if (!accepted.length) {
    for (const update of pending) await recordLearningUpdate(supabase, observerSiteId, update);
    // A prior request may have committed its baseline but failed to update the
    // dashboard projection. Retrying identical samples must repair that state,
    // even when there was no journal event in the batch.
    if (existing?.id && Object.keys(cameraBaselines).length) {
      await updateLearningProjection(supabase, observerSiteId, siteMetadata, prior, existing.updated_at);
    }
    if (pending.length && existing?.id) {
      const drained = await supabase.from("site_behavior_baselines")
        .update({ baseline_value: { ...prior, pending_learning_events: [] } })
        .eq("id", existing.id).eq("updated_at", existing.updated_at);
      if (drained.error) throw new Error(drained.error.message);
    }
    return { observer_site_id: observerSiteId, sampled: 0, confidence: Number(prior.confidence ?? 0), sample_count: Number(prior.sample_count ?? 0) };
  }
  const nextCount = Math.max(0, Number(prior.sample_count ?? 0)) + 1;
  const baselines = Object.values(cameraBaselines);
  const confidence = Math.min(...baselines.map((baseline) => baseline.confidence));
  const ready = baselines.every((baseline) => baseline.samples >= 288);
  const primary = accepted[0];
  for (const milestone of [1, 12, 72, 144, 288].filter((value) => value === nextCount)) {
    pending.push({ patternKey: `home_learning_progress:${observerSiteId}:${milestone}`,
      eventType: milestone === 1 ? "home_learning_started" : "home_learning_progress",
      confidence, cameraSourceId: primary.cameraId,
      recommendedAction: "נאספו מדדי פעילות מקומיים. התובנות מיועדות לבדיקה אנושית ואינן אישור ליכולת זיהוי סכנה.",
      metadata: { sample_count: nextCount, camera_count: baselines.length, baseline_status: ready ? "baseline_ready" : "collecting" } });
  }
  const outbox = [...new Map(pending.map((event) => [event.patternKey, event])).values()];
  if (outbox.length > 256) throw new Error("LEARNING_EVENT_BACKLOG_FULL");
  const now = new Date(Math.max(Date.now(), Date.parse(existing?.updated_at ?? "") + 1 || 0)).toISOString();
  const motionCount = baselines.reduce((sum, item) => sum + item.metricSamples.motion, 0);
  const lightCount = baselines.reduce((sum, item) => sum + item.metricSamples.light, 0);
  const motion = baselines.reduce((sum, item) => sum + (item.averageMotionLevel ?? 0) * item.metricSamples.motion, 0) / Math.max(1, motionCount);
  const luminance = baselines.reduce((sum, item) => sum + (item.averageLightLevel ?? 0) * item.metricSamples.light, 0) / Math.max(1, lightCount);
  const baselineRow = {
    observer_site_id: observerSiteId, baseline_type: "normal_camera_activity",
    baseline_value: {
      status: ready ? "baseline_ready" : "collecting", sample_count: nextCount, confidence,
      average_motion_score: motion, average_luminance_score: luminance,
      last_active_camera_count: new Set(accepted.map((item) => item.cameraId)).size,
      hour_of_day: observationHour(primary.observedAt, timeZone), last_sampled_at: accepted.at(-1)!.observedAt,
      camera_baselines: cameraBaselines, pending_learning_events: outbox
    },
    confidence_level: confidence, learning_maturity: ready ? "calibrated" : "learning",
    anomaly_readiness_score: ready ? confidence : 0,
    source_summary: { source: "local_gateway_activity_metrics", active_camera_count: baselines.length, raw_video_received_by_cloud: false },
    metadata: { ...objectValue(existing?.metadata), consent_version: "deidentified-insights-v1", local_pixel_processing: true,
      raw_video_stored: false, identity_analysis: false, baseline_version: "v3_per_camera_metrics" },
    last_calibrated_at: ready ? now : null, updated_at: now
  };
  const saved = existing?.id
    ? await supabase.from("site_behavior_baselines").update(baselineRow).eq("id", existing.id).eq("updated_at", existing.updated_at).select("id,updated_at").maybeSingle()
    : await supabase.from("site_behavior_baselines").insert(baselineRow).select("id,updated_at").single();
  if (saved.error?.code === "23505" || (!saved.error && !saved.data)) throw new Error("LEARNING_WRITE_CONFLICT");
  if (saved.error) throw new Error(saved.error.message);
  // Durable outbox survives a journal failure; the next sampler run will retry it.
  for (const update of outbox) await recordLearningUpdate(supabase, observerSiteId, update);
  await updateLearningProjection(supabase, observerSiteId, siteMetadata, baselineRow.baseline_value, saved.data.updated_at);
  const drained = await supabase.from("site_behavior_baselines")
    .update({ baseline_value: { ...baselineRow.baseline_value, pending_learning_events: [] } })
    .eq("id", saved.data.id).eq("updated_at", saved.data.updated_at);
  if (drained.error) throw new Error(drained.error.message);

  return { observer_site_id: observerSiteId, sampled: accepted.length, confidence, sample_count: nextCount };
}

export async function recordHomeActivityMetrics(supabase: SupabaseLike, observerSiteId: string, samples: ActivitySample[]) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await recordMetricsAttempt(supabase, observerSiteId, samples); }
    catch (error) { if (!(error instanceof Error) || error.message !== "LEARNING_WRITE_CONFLICT" || attempt === 2) throw error; }
  }
  throw new Error("LEARNING_WRITE_CONFLICT");
}

export async function sampleConsentedHomeLearning(supabase: SupabaseLike) {
  const { data: sites, error: siteError } = await supabase.from("observer_sites")
    .select("id,metadata,monitoring_enabled").eq("monitoring_enabled", true).limit(50);
  if (siteError) throw new Error(siteError.message);
  const results = [];
  for (const site of sites ?? []) {
    if (objectValue(site.metadata).observer_monitoring_consent !== true) continue;
    const { data: sources, error: sourceError } = await supabase.from("digital_observer_camera_sources")
      .select("id,status,health_status,metadata").eq("observer_site_id", site.id).in("status", ["connected", "active", "ready"]).limit(64);
    if (sourceError) throw new Error(sourceError.message);
    const sampled = await Promise.allSettled((sources ?? []).map(async (source: Record<string, any>): Promise<ActivitySample | null> => {
      const streamId = String(objectValue(source.metadata).gateway_stream_id ?? "").trim();
      if (!streamId) return null;
      const response = await getStreamActivityInsight(streamId);
      const data = objectValue(response.data);
      const insight = objectValue(data.insight);
      if (response.status !== "healthy" || data.local_processing !== true || data.no_raw_video_returned !== true) return null;
      return { stream_id: streamId, motion_score: insight.motion_score, luminance_score: insight.luminance_score, sampled_at: insight.sampled_at };
    }));
    const valid: ActivitySample[] = [];
    for (const result of sampled) {
      if (result.status === "rejected" || !result.value) continue;
      const item = result.value;
      if (!Number.isFinite(item.motion_score) || item.motion_score < 0 || item.motion_score > 1
        || !Number.isFinite(item.luminance_score) || item.luminance_score < 0 || item.luminance_score > 1
        || !Number.isFinite(Date.parse(item.sampled_at))) continue;
      valid.push(item);
    }
    results.push({ ...await recordHomeActivityMetrics(supabase, site.id, valid), skipped: (sources ?? []).length - valid.length });
  }
  return results;
}
