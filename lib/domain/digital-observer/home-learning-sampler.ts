import { observerAnalysisRoundPolicy } from "@/lib/domain/digital-observer/analysis-round-policy";

type Row = Record<string, any>;
type ActivitySample = { stream_id?: string; motion_score: number; luminance_score: number; sampled_at: string; sample_frames?: number };
type SourceMetrics = { sample_count: number; average_motion_score: number; average_luminance_score: number; last_sampled_at: string };
const METRIC_VERSION = "per_source_activity_v1";

function objectValue(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
}

function validScore(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function priorSourceMetrics(value: unknown, now: number): SourceMetrics | null {
  const row = objectValue(value);
  const timestamp = Date.parse(String(row.last_sampled_at ?? ""));
  if (!Number.isSafeInteger(row.sample_count) || row.sample_count < 1 || row.sample_count >= 1_000_000
    || !validScore(row.average_motion_score) || !validScore(row.average_luminance_score)
    || !Number.isFinite(timestamp) || timestamp > now) return null;
  return { sample_count: row.sample_count, average_motion_score: row.average_motion_score,
    average_luminance_score: row.average_luminance_score, last_sampled_at: new Date(timestamp).toISOString() };
}

function legacyActivitySnapshot(value: unknown) {
  const row = objectValue(value);
  if (!Number.isSafeInteger(row.sample_count) || row.sample_count < 0) return null;
  return { sample_count: row.sample_count,
    average_motion_score: validScore(row.average_motion_score) ? row.average_motion_score : null,
    average_luminance_score: validScore(row.average_luminance_score) ? row.average_luminance_score : null,
    source_attribution_verified: false, calibration_verified: false };
}

export async function recordHomeActivityMetrics(supabase: any, observerSiteId: string, samples: ActivitySample[], gatewayId: string, now = Date.now()) {
  if (!gatewayId || !Number.isFinite(now)) throw new Error("Invalid metric authorization context");
  if (!Array.isArray(samples) || samples.length > 64) throw new Error("Invalid metric batch");
  const streamIds = new Set<string>();
  for (const sample of samples) {
    const timestamp = Date.parse(sample.sampled_at);
    if (!sample.stream_id || streamIds.has(sample.stream_id) || !validScore(sample.motion_score) || !validScore(sample.luminance_score)
      || !Number.isFinite(timestamp) || timestamp > now || now - timestamp > 5 * 60 * 1000
      || (sample.sample_frames !== undefined && (!Number.isInteger(sample.sample_frames) || sample.sample_frames < 1 || sample.sample_frames > 2))) throw new Error("Invalid or stale source metrics");
    streamIds.add(sample.stream_id);
  }

  const site = await supabase.from("observer_sites")
    .select("id,active,metadata,monitoring_enabled,vision_privacy_mode,business_handles_children").eq("id", observerSiteId).single();
  const schedule = await supabase.from("observer_monitoring_schedules")
    .select("observer_site_id,schedule_mode,status").eq("observer_site_id", observerSiteId).maybeSingle();
  const sources = await supabase.from("digital_observer_camera_sources")
    .select("id,observer_site_id,status,health_status,metadata").eq("observer_site_id", observerSiteId).limit(129);
  if (site.error || schedule.error || sources.error || !site.data) throw new Error("Metric authorization verification unavailable");
  if ((sources.data ?? []).length > 128) throw new Error("Source metric budget exceeded");

  const byStream = new Map<string, Row>();
  const ambiguous = new Set<string>();
  const currentSourceIds = new Set<string>();
  for (const source of sources.data ?? []) {
    if (source.observer_site_id !== observerSiteId) continue;
    currentSourceIds.add(source.id);
    if (source.metadata?.gateway_id !== gatewayId) continue;
    const stream = source.metadata?.gateway_stream_id;
    if (typeof stream !== "string" || !streamIds.has(stream)) continue;
    if (byStream.has(stream)) ambiguous.add(stream);
    byStream.set(stream, source);
  }
  if ([...streamIds].some(id => !byStream.has(id) || ambiguous.has(id))) throw new Error("Metric source mapping is not verified");
  const requestedSources = [...byStream.values()].map(source => source.id);
  const policy = observerAnalysisRoundPolicy(site.data, schedule.data, [...byStream.values()], gatewayId, requestedSources, "metric-ingestion", now);
  if (!policy.consentVerified) throw new Error("Source metric consent or policy unavailable");
  const eligible = samples.filter(sample => policy.sourceIds.includes(byStream.get(sample.stream_id!)!.id));
  if (!eligible.length) return { observer_site_id: observerSiteId, sampled: 0, skipped: samples.length, confidence: 0, calibration_verified: false };

  const existing = await supabase.from("site_behavior_baselines").select("id,baseline_value,metadata,source_summary,confidence_level,updated_at")
    .eq("observer_site_id", observerSiteId).eq("baseline_type", "normal_camera_activity").maybeSingle();
  if (existing.error) throw new Error("Stored source metrics unavailable");
  const prior = objectValue(existing.data?.baseline_value);
  const owned = prior.version === METRIC_VERSION || existing.data?.metadata?.local_pixel_processing === true
    || existing.data?.source_summary?.source === "local_gateway_activity_metrics";
  const emptySeed = Object.keys(prior).every(key => key === "status")
    && ["collecting", "camera_health_needed"].includes(prior.status) && Number(existing.data?.confidence_level ?? 0) === 0;
  if (existing.data && !owned && !emptySeed) throw new Error("Camera baseline belongs to another learning workflow");
  const sourceMetrics: Record<string, SourceMetrics> = {};
  // Legacy site-wide averages have no defensible per-camera attribution.
  // Never distribute their count or values to a source.
  if (prior.version === METRIC_VERSION) {
    for (const [id, value] of Object.entries(objectValue(prior.source_metrics))) {
      const validated = priorSourceMetrics(value, now);
      if (currentSourceIds.has(id) && validated) sourceMetrics[id] = validated;
    }
  }
  let accepted = 0;
  for (const sample of eligible) {
    const id = byStream.get(sample.stream_id!)!.id;
    const old = sourceMetrics[id];
    if (old && Date.parse(sample.sampled_at) <= Date.parse(old.last_sampled_at)) continue;
    const count = old?.sample_count ?? 0;
    sourceMetrics[id] = {
      sample_count: count + 1,
      average_motion_score: Number((((old?.average_motion_score ?? 0) * count + sample.motion_score) / (count + 1)).toFixed(4)),
      average_luminance_score: Number((((old?.average_luminance_score ?? 0) * count + sample.luminance_score) / (count + 1)).toFixed(4)),
      last_sampled_at: new Date(sample.sampled_at).toISOString()
    };
    accepted++;
  }
  if (!accepted) return { observer_site_id: observerSiteId, sampled: 0, skipped: samples.length, confidence: 0, calibration_verified: false };

  const priorUpdatedAt = existing.data ? Date.parse(existing.data.updated_at) : 0;
  if (!Number.isFinite(priorUpdatedAt)) throw new Error("Metric version unavailable");
  const updatedAt = new Date(Math.max(now, priorUpdatedAt + 1)).toISOString();
  const values = Object.values(sourceMetrics);
  const row = {
    observer_site_id: observerSiteId, baseline_type: "normal_camera_activity",
    baseline_value: { version: METRIC_VERSION, status: "collecting", sample_count: values.reduce((sum, value) => sum + value.sample_count, 0),
      source_metrics: sourceMetrics, source_count: values.length, last_active_camera_count: accepted,
      legacy_unattributed_metrics: legacyActivitySnapshot(prior.version === METRIC_VERSION ? prior.legacy_unattributed_metrics : prior),
      last_sampled_at: values.map(value => value.last_sampled_at).sort().at(-1), calibration_verified: false },
    confidence_level: 0, learning_maturity: "learning", anomaly_readiness_score: 0, last_calibrated_at: null,
    source_summary: { source: "local_gateway_activity_metrics", aggregation: "per_source_only", active_camera_count: accepted, raw_video_received_by_cloud: false },
    metadata: { ...objectValue(existing.data?.metadata), consent_version: "deidentified-insights-v1", local_pixel_processing: true,
      raw_video_stored: false, identity_analysis: false, calibration_verified: false, descriptive_metrics_only: true },
    updated_at: updatedAt
  };
  // Optimistic locking prevents concurrent Gateways from silently overwriting
  // each other's source metrics. The caller must report a conflicting round.
  const saved = existing.data
    ? await supabase.from("site_behavior_baselines").update(row).eq("id", existing.data.id).eq("observer_site_id", observerSiteId)
      .eq("updated_at", existing.data.updated_at).select("id").maybeSingle()
    : await supabase.from("site_behavior_baselines").insert(row).select("id").single();
  if (saved.error || !saved.data?.id) throw new Error(saved.error?.code === "23505" || !saved.error ? "Source metrics changed concurrently; round not saved" : "Unable to store source metrics");
  // Raw activity values do not establish a routine, anomaly, identity or event.
  // Do not write reviewable signals, site AI state or global learning maturity.
  return { observer_site_id: observerSiteId, sampled: accepted, skipped: samples.length - accepted,
    source_count: values.length, sample_count: row.baseline_value.sample_count, confidence: 0, calibration_verified: false };
}

export async function sampleConsentedHomeLearning(_supabase: any): Promise<never> {
  throw new Error("Server-initiated sampling is disabled; use an authenticated local analysis round");
}
