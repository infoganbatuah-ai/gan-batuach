import "server-only";
import { createHash } from "node:crypto";
import { getStreamActivityInsight } from "@/lib/domain/video-gateway-client";
import { behaviorBaselineSchema, detectBehaviorAnomaly, learningObservationSchema, observationHour, updateBehaviorBaseline, type BehaviorBaseline } from "./learning-engine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- this project uses dynamic Supabase tables without generated database types.
type SupabaseLike = any;
type ActivitySample = { stream_id?: string; motion_score: number; luminance_score: number; sampled_at: string };
type RealEventRow = {
  id?: unknown;
  source_type?: unknown;
  created_at?: unknown;
  confidence?: unknown;
  metadata?: unknown;
};
type CameraSourceRow = {
  id?: unknown;
  status?: unknown;
  location_label?: unknown;
  stream_protocol?: unknown;
  metadata?: unknown;
};
type LearningScheduleRow = {
  status?: unknown;
  schedule_mode?: unknown;
  timezone?: unknown;
  active_days?: unknown;
  active_hours?: unknown;
  schedule?: unknown;
};
type LearningUpdate = {
  patternKey: string; eventType: string; confidence: number; recommendedAction: string;
  metadata: Record<string, unknown>; severity?: "info" | "low" | "medium"; cameraSourceId?: string | null;
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export const REAL_EVENT_CONTEXT_BASELINE_VERSION = "v1_real_camera_event_context";

type ContextMaturity = "NO_DATA" | "LEARNING" | "LOW_CONFIDENCE" | "ESTABLISHED" | "STALE";
type LocalEventTime = { local_date: string; local_hour: number; local_day_of_week: string };
type ExpectedHours = { configured: boolean; within_expected_hours: boolean | null; source: "none" | "schedule" };
type CanonicalRealEvent = {
  id: string;
  camera_source_id: string;
  stream_id: string | null;
  event_type: string;
  timestamp: string;
  confidence: number | null;
  track_id: string | null;
  zone: string | null;
  evidence_status: string | null;
  recording_required: boolean | null;
  model_provenance: Record<string, unknown> | null;
  local: LocalEventTime;
  expected_hours: ExpectedHours;
};

function valueObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function localEventTime(timestamp: string, timeZone: string): LocalEventTime {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) throw new Error("REAL_EVENT_CONTEXT_TIMESTAMP_INVALID");
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      hourCycle: "h23"
    }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
    const hour = Number(part("hour"));
    const year = part("year");
    const month = part("month");
    const day = part("day");
    const weekday = part("weekday").toLowerCase();
    if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !/^\d{4}$/.test(year) || !/^\d{2}$/.test(month) || !/^\d{2}$/.test(day) || !weekday) {
      throw new Error("REAL_EVENT_CONTEXT_TIMEZONE_INVALID");
    }
    return { local_date: `${year}-${month}-${day}`, local_hour: hour, local_day_of_week: weekday };
  } catch {
    throw new Error("REAL_EVENT_CONTEXT_TIMEZONE_INVALID");
  }
}

function minutes(value: unknown) {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [hours, mins] = value.split(":").map(Number);
  return hours * 60 + mins;
}

function localMinutes(timestamp: string, timeZone: string) {
  const date = new Date(timestamp);
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  return Number.isInteger(hour) && Number.isInteger(minute) ? hour * 60 + minute : null;
}

function activeOnLocalDay(activeDays: unknown, localDay: string) {
  if (!Array.isArray(activeDays) || !activeDays.length) return true;
  const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const index = dayNames.indexOf(localDay.slice(0, 3));
  return activeDays.some((value) => value === index || String(value).toLowerCase().slice(0, 3) === localDay.slice(0, 3));
}

/**
 * An operating schedule is context, never a threat classification. Only an
 * active 24/7, business-hours or custom range can yield a boolean; all other
 * modes deliberately remain unknown instead of treating missing hours as odd.
 */
export function expectedHoursAt(schedule: LearningScheduleRow | null | undefined, timestamp: string, timeZone: string): ExpectedHours {
  if (!schedule || schedule.status !== "active") return { configured: false, within_expected_hours: null, source: "none" };
  const mode = String(schedule.schedule_mode ?? valueObject(schedule.schedule).mode ?? "");
  if (mode === "24_7") return { configured: true, within_expected_hours: true, source: "schedule" };
  if (!(["business_hours", "custom_schedule"].includes(mode))) return { configured: false, within_expected_hours: null, source: "none" };
  const scheduleValue = valueObject(schedule.schedule);
  const hourRange = valueObject(scheduleValue.hours);
  const fallbackRange = valueObject(schedule.active_hours);
  const start = minutes(hourRange.start ?? fallbackRange.start);
  const end = minutes(hourRange.end ?? fallbackRange.end);
  const local = localEventTime(timestamp, timeZone);
  const now = localMinutes(timestamp, timeZone);
  if (start === null || end === null || start === end || now === null) return { configured: false, within_expected_hours: null, source: "none" };
  const inRange = start < end ? now >= start && now < end : now >= start || now < end;
  return { configured: true, within_expected_hours: activeOnLocalDay(schedule.active_days, local.local_day_of_week) && inRange, source: "schedule" };
}

export function canonicalRealEventContext(event: RealEventRow, timeZone: string, schedule?: LearningScheduleRow | null): CanonicalRealEvent | null {
  const metadata = valueObject(event.metadata);
  const cameraSourceId = typeof metadata.camera_source_id === "string" ? metadata.camera_source_id : "";
  const eventType = typeof metadata.event_type === "string" ? metadata.event_type : "";
  const timestamp = typeof event.created_at === "string" ? event.created_at : "";
  if (event.source_type !== "system" || metadata.observation_provenance !== "REAL_CAMERA_AI" || metadata.validated_event !== true
    || !cameraSourceId || !eventType || !timestamp || !event.id) return null;
  const local = localEventTime(timestamp, timeZone);
  const confidence = typeof event.confidence === "number" && Number.isFinite(event.confidence) ? event.confidence : null;
  return {
    id: String(event.id), camera_source_id: cameraSourceId,
    stream_id: typeof metadata.stream_id === "string" ? metadata.stream_id : null,
    event_type: eventType, timestamp: new Date(timestamp).toISOString(), confidence,
    track_id: typeof metadata.track_id === "string" ? metadata.track_id : null,
    zone: typeof metadata.zone_id === "string" ? metadata.zone_id : typeof metadata.zone_type === "string" ? metadata.zone_type : null,
    evidence_status: typeof metadata.media_status === "string" ? metadata.media_status : null,
    recording_required: typeof metadata.recording_required === "boolean" ? metadata.recording_required : null,
    model_provenance: valueObject(metadata.model_provenance),
    local,
    expected_hours: expectedHoursAt(schedule, timestamp, timeZone)
  };
}

export function realEventCameraConfigurationFingerprint(source: CameraSourceRow) {
  const metadata = valueObject(source.metadata);
  const safeConfiguration = {
    camera_source_id: String(source.id ?? ""),
    gateway_stream_id: typeof metadata.gateway_stream_id === "string" ? metadata.gateway_stream_id : null,
    zone_type: typeof metadata.zone_type === "string" ? metadata.zone_type : null,
    crossing_line: metadata.crossing_line ?? null,
    location_label: typeof source.location_label === "string" ? source.location_label : null,
    stream_protocol: typeof source.stream_protocol === "string" ? source.stream_protocol : null
  };
  return createHash("sha256").update(JSON.stringify(safeConfiguration)).digest("hex");
}

function contextMaturity(eventCount: number, dayCount: number, firstAt: string | null, lastAt: string | null, configurationChanged: boolean): ContextMaturity {
  if (configurationChanged) return "STALE";
  if (!eventCount || !firstAt || !lastAt) return "NO_DATA";
  const windowDays = Math.max(0, (Date.parse(lastAt) - Date.parse(firstAt)) / 86_400_000);
  if (eventCount < 12 || windowDays < 7) return "LEARNING";
  if (eventCount < 48 || dayCount < 5 || windowDays < 21) return "LOW_CONFIDENCE";
  return "ESTABLISHED";
}

function contextConfidence(maturity: ContextMaturity, eventCount: number) {
  if (maturity === "ESTABLISHED") return Math.min(0.9, 0.7 + Math.min(0.2, eventCount / 1_000));
  if (maturity === "LOW_CONFIDENCE") return Math.min(0.69, 0.35 + eventCount / 200);
  if (maturity === "LEARNING") return Math.min(0.34, eventCount / 36);
  return 0;
}

function increment(target: Record<string, number>, key: string | null) {
  if (!key) return;
  target[key] = (target[key] ?? 0) + 1;
}

function trackedDurationSeconds(events: CanonicalRealEvent[]) {
  const pendingEntries = new Map<string, CanonicalRealEvent>();
  const durations: number[] = [];
  for (const event of events) {
    if (!event.track_id) continue;
    if (event.event_type === "person_entered") pendingEntries.set(event.track_id, event);
    if (event.event_type === "person_exited") {
      const entry = pendingEntries.get(event.track_id);
      const duration = entry ? Date.parse(event.timestamp) - Date.parse(entry.timestamp) : NaN;
      if (Number.isFinite(duration) && duration >= 0 && duration <= 30 * 60_000) durations.push(Math.round(duration / 1_000));
      pendingEntries.delete(event.track_id);
    }
  }
  return { sample_count: durations.length, average_seconds: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null };
}

/**
 * Deterministic, site- and camera-scoped projection of canonical real events.
 * It intentionally records context and confidence only; it never assigns risk,
 * threat labels or autonomous actions.
 */
export function buildRealEventContextBaseline(input: {
  observerSiteId: string;
  timeZone: string;
  events: RealEventRow[];
  sources: CameraSourceRow[];
  schedule?: LearningScheduleRow | null;
  previous?: Record<string, unknown> | null;
  generatedAt?: string;
}) {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const sources = new Map(input.sources.filter((source) => typeof source.id === "string").map((source) => [String(source.id), source]));
  const events = input.events.map((event) => canonicalRealEventContext(event, input.timeZone, input.schedule))
    .filter((event): event is CanonicalRealEvent => Boolean(event && sources.has(event.camera_source_id)))
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  const previous = valueObject(input.previous);
  const previousCameras = valueObject(previous.cameras);
  const cameras: Record<string, Record<string, unknown>> = {};

  for (const [cameraId, source] of sources) {
    const prior = valueObject(previousCameras[cameraId]);
    const configurationFingerprint = realEventCameraConfigurationFingerprint(source);
    const configurationChanged = typeof prior.configuration_fingerprint === "string" && prior.configuration_fingerprint !== configurationFingerprint;
    const sourceEvents = events.filter((event) => event.camera_source_id === cameraId);
    const latest = sourceEvents.at(-1) ?? null;
    const baselineStartedAt = configurationChanged
      ? latest?.timestamp ?? generatedAt
      : typeof prior.baseline_started_at === "string" ? prior.baseline_started_at : sourceEvents[0]?.timestamp ?? null;
    const eligible = sourceEvents.filter((event) => !baselineStartedAt || Date.parse(event.timestamp) >= Date.parse(baselineStartedAt));
    const eventTypes: Record<string, number> = {};
    const hours: Record<string, number> = {};
    const days: Record<string, number> = {};
    const zones: Record<string, number> = {};
    const directions: Record<string, number> = {};
    const evidence: Record<string, number> = {};
    const expectedHours = { configured_events: 0, within_expected_hours: 0, outside_expected_hours: 0, unknown: 0 };
    for (const event of eligible) {
      increment(eventTypes, event.event_type);
      increment(hours, String(event.local.local_hour));
      increment(days, event.local.local_date);
      increment(zones, event.zone);
      increment(evidence, event.evidence_status ?? (event.recording_required === false ? "not_required" : null));
      if (event.event_type === "person_entered") increment(directions, "entry");
      if (event.event_type === "person_exited") increment(directions, "exit");
      if (!event.expected_hours.configured || event.expected_hours.within_expected_hours === null) expectedHours.unknown += 1;
      else {
        expectedHours.configured_events += 1;
        if (event.expected_hours.within_expected_hours) expectedHours.within_expected_hours += 1;
        else expectedHours.outside_expected_hours += 1;
      }
    }
    const firstAt = eligible[0]?.timestamp ?? null;
    const lastAt = eligible.at(-1)?.timestamp ?? null;
    const maturity = contextMaturity(eligible.length, Object.keys(days).length, firstAt, lastAt, configurationChanged);
    cameras[cameraId] = {
      configuration_fingerprint: configurationFingerprint,
      baseline_started_at: baselineStartedAt,
      baseline_invalidated_at: configurationChanged ? generatedAt : prior.baseline_invalidated_at ?? null,
      invalidation_reason: configurationChanged ? "CAMERA_OR_ZONE_CONFIGURATION_CHANGED" : prior.invalidation_reason ?? null,
      maturity,
      confidence: contextConfidence(maturity, eligible.length),
      event_count: eligible.length,
      distinct_local_days: Object.keys(days).length,
      first_event_at: firstAt,
      last_event_at: lastAt,
      event_types: eventTypes,
      activity_by_local_hour: hours,
      activity_by_local_date: days,
      zone_activity: zones,
      direction_counts: directions,
      evidence_availability: evidence,
      tracked_duration: trackedDurationSeconds(eligible),
      unique_track_count: new Set(eligible.map((event) => event.track_id).filter(Boolean)).size,
      expected_hours: expectedHours,
      provenance: "REAL_CAMERA_AI",
      mock_or_shadow_events_included: false
    };
  }

  const maturityOrder: ContextMaturity[] = ["NO_DATA", "STALE", "LEARNING", "LOW_CONFIDENCE", "ESTABLISHED"];
  // Site-level presentation is derived only from cameras with real history.
  // A newly added empty camera must not erase another camera's established
  // baseline, and its own NO_DATA state remains explicit in `cameras`.
  const states = Object.values(cameras)
    .filter((camera) => Number(camera.event_count ?? 0) > 0)
    .map((camera) => String(camera.maturity) as ContextMaturity);
  const overallMaturity = states.length ? states.sort((left, right) => maturityOrder.indexOf(left) - maturityOrder.indexOf(right))[0] : "NO_DATA";
  const realEventCount = Object.values(cameras).reduce((sum, camera) => sum + Number(camera.event_count ?? 0), 0);
  return {
    version: REAL_EVENT_CONTEXT_BASELINE_VERSION,
    observer_site_id: input.observerSiteId,
    time_zone: input.timeZone,
    generated_at: generatedAt,
    source: "canonical_real_camera_ai_events",
    real_data_only: true,
    baseline_maturity: overallMaturity,
    confidence: contextConfidence(overallMaturity, realEventCount),
    real_event_count: realEventCount,
    cameras,
    deviation_policy: {
      enabled: overallMaturity === "ESTABLISHED",
      insufficient_data_signal: overallMaturity !== "ESTABLISHED" ? "BASELINE_CONFIDENCE_INSUFFICIENT" : null,
      risk_or_threat_classification: false
    }
  };
}

/** Factual context only. A missing or immature baseline can never become an anomaly claim. */
export function evaluateRealEventContext(event: CanonicalRealEvent, cameraBaseline: Record<string, unknown> | null | undefined) {
  const baseline = valueObject(cameraBaseline);
  if (baseline.maturity !== "ESTABLISHED") {
    return {
      baseline_confidence_insufficient: true,
      expected_pattern_signals: [],
      deviation_signals: [],
      reason: "BASELINE_CONFIDENCE_INSUFFICIENT"
    };
  }
  const hourly = valueObject(baseline.activity_by_local_hour);
  const eventTypes = valueObject(baseline.event_types);
  const directions = valueObject(baseline.direction_counts);
  const total = Math.max(1, Number(baseline.event_count ?? 0));
  const hourCount = Number(hourly[String(event.local.local_hour)] ?? 0);
  const typeCount = Number(eventTypes[event.event_type] ?? 0);
  const direction = event.event_type === "person_entered" ? "entry" : event.event_type === "person_exited" ? "exit" : null;
  const directionCount = direction ? Number(directions[direction] ?? 0) : null;
  const expected_pattern_signals = [
    { key: "time_of_day_common", value: hourCount >= Math.max(3, Math.ceil(total * 0.05)), observed_count: hourCount },
    { key: "event_pattern_common", value: typeCount >= Math.max(3, Math.ceil(total * 0.05)), observed_count: typeCount },
    ...(direction ? [{ key: "direction_common", value: (directionCount ?? 0) >= 3, observed_count: directionCount ?? 0 }] : [])
  ];
  const deviation_signals = expected_pattern_signals.filter((signal) => signal.value === false).map((signal) => ({
    key: signal.key === "time_of_day_common" ? "unusual_time_of_day" : signal.key === "direction_common" ? "uncommon_direction" : "uncommon_event_pattern",
    reason: `${signal.key}: insufficient historical frequency for this camera`,
    observed_count: signal.observed_count
  }));
  return { baseline_confidence_insufficient: false, expected_pattern_signals, deviation_signals, reason: null };
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

async function updateLearningProjection(supabase: SupabaseLike, observerSiteId: string, siteMetadata: Record<string, unknown>, baseline: Record<string, unknown>, updatedAt: string) {
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
  const cameraByStream = new Map<string, Record<string, unknown>>();
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
  const currentCameraIds = new Set((sources ?? []).filter((source: Record<string, unknown>) => source.status !== "disabled").map((source: Record<string, unknown>) => source.id));
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

/**
 * Rebuild the contextual baseline from authenticated, validated REAL_CAMERA_AI
 * events. This deliberately lives beside the existing local-metrics sampler:
 * it writes the existing `normal_movement_patterns` projection and never
 * mixes synthetic, shadow or unvalidated records into a real site's history.
 */
export async function refreshRealEventContextBaseline(supabase: SupabaseLike, observerSiteId: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const [siteResult, sourcesResult, scheduleResult, eventsResult, baselineResult] = await Promise.all([
      supabase.from("observer_sites").select("id,timezone").eq("id", observerSiteId).single(),
      supabase.from("digital_observer_camera_sources").select("id,status,location_label,stream_protocol,metadata").eq("observer_site_id", observerSiteId),
      supabase.from("observer_monitoring_schedules").select("status,schedule_mode,timezone,active_days,active_hours,schedule").eq("observer_site_id", observerSiteId).maybeSingle(),
      supabase.from("observer_intelligence_signals").select("id,source_type,created_at,confidence,metadata").eq("observer_site_id", observerSiteId).eq("source_type", "system").order("created_at", { ascending: true }).limit(2_000),
      supabase.from("site_behavior_baselines").select("id,baseline_value,metadata,updated_at").eq("observer_site_id", observerSiteId).eq("baseline_type", "normal_movement_patterns").maybeSingle()
    ]);
    if (siteResult.error || !siteResult.data) throw new Error("REAL_EVENT_CONTEXT_SITE_UNAVAILABLE");
    if (sourcesResult.error || eventsResult.error || scheduleResult.error || baselineResult.error) throw new Error("REAL_EVENT_CONTEXT_READ_UNAVAILABLE");
    const timeZone = typeof siteResult.data.timezone === "string" ? siteResult.data.timezone : "Asia/Jerusalem";
    // Validate the configured IANA timezone before making a baseline write.
    localEventTime(new Date().toISOString(), timeZone);
    const previousValue = valueObject(baselineResult.data?.baseline_value);
    const previousContext = valueObject(previousValue.real_event_context);
    const nextContext = buildRealEventContextBaseline({
      observerSiteId,
      timeZone,
      events: (eventsResult.data ?? []) as RealEventRow[],
      sources: (sourcesResult.data ?? []) as CameraSourceRow[],
      schedule: scheduleResult.data as LearningScheduleRow | null,
      previous: previousContext
    });
    const maturity = String(nextContext.baseline_maturity);
    const row = {
      observer_site_id: observerSiteId,
      baseline_type: "normal_movement_patterns",
      // `normal_movement_patterns` is the canonical real-event projection.
      // Do not retain a legacy/demo payload in this row and accidentally make
      // a real baseline appear to have synthetic source history.
      baseline_value: { real_event_context: nextContext },
      confidence_level: nextContext.confidence,
      learning_maturity: maturity === "ESTABLISHED" ? "calibrated" : maturity === "NO_DATA" ? "new" : "learning",
      anomaly_readiness_score: 0,
      source_summary: {
        source: "canonical_real_camera_ai_events",
        real_event_count: nextContext.real_event_count,
        raw_video_received_by_cloud: false,
        mock_or_shadow_events_included: false
      },
      metadata: {
        baseline_version: REAL_EVENT_CONTEXT_BASELINE_VERSION,
        real_data_only: true,
        no_automatic_risk_decision: true,
        baseline_maturity: maturity
      },
      last_calibrated_at: maturity === "ESTABLISHED" ? nextContext.generated_at : null,
      updated_at: nextContext.generated_at
    };
    const write = baselineResult.data?.id
      ? await supabase.from("site_behavior_baselines").update(row).eq("id", baselineResult.data.id).eq("updated_at", baselineResult.data.updated_at).select("id,updated_at").maybeSingle()
      : await supabase.from("site_behavior_baselines").insert(row).select("id,updated_at").single();
    if (write.error) {
      if (write.error.code === "23505" || write.error.code === "PGRST116") continue;
      throw new Error("REAL_EVENT_CONTEXT_WRITE_FAILED");
    }
    if (!write.data) continue;
    return { observer_site_id: observerSiteId, real_event_count: nextContext.real_event_count, baseline_maturity: nextContext.baseline_maturity, confidence: nextContext.confidence };
  }
  throw new Error("REAL_EVENT_CONTEXT_WRITE_CONFLICT");
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
    const sampled = await Promise.allSettled((sources ?? []).map(async (source: Record<string, unknown>): Promise<ActivitySample | null> => {
      const streamId = String(objectValue(source.metadata).gateway_stream_id ?? "").trim();
      if (!streamId) return null;
      const response = await getStreamActivityInsight(streamId);
      const data = objectValue(response.data);
      const insight = objectValue(data.insight);
      if (response.status !== "healthy" || data.local_processing !== true || data.no_raw_video_returned !== true) return null;
      const motionScore = typeof insight.motion_score === "number" ? insight.motion_score : NaN;
      const luminanceScore = typeof insight.luminance_score === "number" ? insight.luminance_score : NaN;
      const sampledAt = typeof insight.sampled_at === "string" ? insight.sampled_at : "";
      return { stream_id: streamId, motion_score: motionScore, luminance_score: luminanceScore, sampled_at: sampledAt };
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
