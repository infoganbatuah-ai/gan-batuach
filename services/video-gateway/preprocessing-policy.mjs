import { createHash } from "node:crypto";

export const PREPROCESSING_CONTRACT = "observer-preprocessing-v1";
export const PREPROCESSING_POLICIES = Object.freeze(["ALWAYS_ANALYZE", "CANDIDATE_DRIVEN", "ADAPTIVE"]);
export const NATIVE_SIGNAL_TYPES = Object.freeze(["NATIVE_MOTION", "NATIVE_PERSON_EVENT", "NATIVE_VEHICLE_EVENT", "SCENE_CHANGE", "LOCAL_FRAME_DIFF", "NONE"]);
const TRUST_LEVELS = new Set(["VERIFIED_REAL", "VERIFIED_VENDOR_DOCUMENTATION", "INTEGRATION_TESTED", "INFERRED", "UNKNOWN"]);

const bounded = (value, fallback, minimum, maximum) => Number.isFinite(Number(value))
  ? Math.min(maximum, Math.max(minimum, Number(value))) : fallback;

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function normalizePreprocessingSignal(input, scope, now = Date.now()) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("PREPROCESSING_SIGNAL_INVALID");
  const type = NATIVE_SIGNAL_TYPES.includes(input.type) ? input.type : null;
  const observedAt = Date.parse(input.observed_at);
  if (!type || type === "NONE" || !Number.isFinite(observedAt) || Math.abs(now - observedAt) > 5 * 60_000) throw new Error("PREPROCESSING_SIGNAL_INVALID");
  if (input.site_id !== scope.siteId || input.source_id !== scope.sourceId) throw new Error("PREPROCESSING_SIGNAL_SCOPE_DENIED");
  const trust = TRUST_LEVELS.has(input.trust) ? input.trust : "UNKNOWN";
  const confidence = Number.isFinite(input.confidence) ? Math.min(1, Math.max(0, input.confidence)) : null;
  const signal = {
    contract: PREPROCESSING_CONTRACT,
    signal_id: typeof input.signal_id === "string" && input.signal_id.length >= 8 && input.signal_id.length <= 160
      ? input.signal_id : `sig_${digest([scope.siteId, scope.sourceId, type, input.observed_at]).slice(0, 24)}`,
    site_id: scope.siteId,
    source_id: scope.sourceId,
    vendor: typeof input.vendor === "string" ? input.vendor.slice(0, 80) : "unknown",
    type,
    observed_at: new Date(observedAt).toISOString(),
    confidence,
    trust,
    verification_status: "CANDIDATE_ONLY"
  };
  return Object.freeze(signal);
}

export function createPreprocessingEngine(options = {}) {
  const now = typeof options.now === "function" ? options.now : () => Date.now();
  const defaults = {
    motionThreshold: bounded(options.motionThreshold, 0.025, 0, 1),
    coalesceWindowMs: bounded(options.coalesceWindowMs, 5_000, 250, 60_000),
    dedupeWindowMs: bounded(options.dedupeWindowMs, 30_000, 500, 300_000),
    maxQuietIntervalMs: bounded(options.maxQuietIntervalMs, 30_000, 5_000, 300_000)
  };
  const lastAnalyzed = new Map();
  const lastCandidate = new Map();
  const seenSignals = new Map();
  const metrics = { frames_available: 0, frames_cheaply_evaluated: 0, native_signals_received: 0, candidates_produced: 0,
    duplicate_candidates_suppressed: 0, coalesced_candidates: 0, expensive_ai_jobs_requested: 0, expensive_ai_jobs_avoided: 0,
    fallback_events: 0, canonical_events_produced: 0, preprocessing_errors: 0, preprocessing_latency_ms_total: 0, evaluations: 0 };

  function evaluate(input) {
    const started = now();
    const finish = decision => {
      metrics.preprocessing_latency_ms_total += Math.max(0, now() - started);
      return decision;
    };
    const cameraId = String(input.camera?.camera_id ?? "");
    if (!cameraId) throw new Error("PREPROCESSING_CAMERA_REQUIRED");
    const assignment = String(input.camera?.channel_assignment ?? "ASSIGNED");
    if (assignment === "CHANNEL_EMPTY" || assignment === "UNASSIGNED" || input.camera?.physical_camera_attached === false) {
      return finish({ contract: PREPROCESSING_CONTRACT, decision: "SKIP_EMPTY", request_ai: false, candidate: null, reason: "CHANNEL_EMPTY", fallback: false });
    }
    metrics.evaluations++;
    const policy = PREPROCESSING_POLICIES.includes(input.policy) ? input.policy : "ALWAYS_ANALYZE";
    const health = input.health ?? {};
    if (["OFFLINE", "FAILED", "STALE", "UNREACHABLE"].includes(String(health.source)) || health.frame_fresh === false) {
      metrics.preprocessing_errors++;
      return finish({ contract: PREPROCESSING_CONTRACT, decision: "HEALTH_UNAVAILABLE", request_ai: false, candidate: null, reason: "SOURCE_HEALTH_NOT_QUIET", fallback: false });
    }
    metrics.frames_available++;
    if (policy === "ALWAYS_ANALYZE" || input.active_watch_rule === true || input.critical_policy === true || input.incident_elevated === true) {
      metrics.expensive_ai_jobs_requested++;
      lastAnalyzed.set(cameraId, started);
      return finish({ contract: PREPROCESSING_CONTRACT, decision: "ANALYZE", request_ai: true, candidate: null,
        reason: input.active_watch_rule ? "WATCH_RULE_PRIORITY" : input.critical_policy ? "CRITICAL_POLICY" : input.incident_elevated ? "INCIDENT_PRIORITY" : "ALWAYS_ANALYZE", fallback: false });
    }
    // Missing or malformed cheap metadata must increase work, never suppress it.
    // This is deliberately evaluated after source health so an outage is not
    // mislabeled as a quiet scene or turned into an inference restart loop.
    if (input.metadata_available === false) {
      metrics.preprocessing_errors++;
      metrics.fallback_events++;
      metrics.expensive_ai_jobs_requested++;
      lastAnalyzed.set(cameraId, started);
      return finish({ contract: PREPROCESSING_CONTRACT, decision: "ANALYZE", request_ai: true, candidate: null,
        reason: "SIGNAL_UNAVAILABLE_FALLBACK", fallback: true });
    }
    let candidate = null;
    if (input.signal) {
      try {
        candidate = normalizePreprocessingSignal(input.signal, { siteId: input.camera.site_id, sourceId: cameraId }, started);
        metrics.frames_cheaply_evaluated++;
        if (candidate.type !== "LOCAL_FRAME_DIFF") metrics.native_signals_received++;
      } catch {
        metrics.preprocessing_errors++;
      }
    }
    if (!candidate && Number.isFinite(input.motion_score)) {
      metrics.frames_cheaply_evaluated++;
      if (input.motion_score >= bounded(input.motion_threshold, defaults.motionThreshold, 0, 1)) {
        candidate = normalizePreprocessingSignal({ type: "LOCAL_FRAME_DIFF", site_id: input.camera.site_id, source_id: cameraId,
          observed_at: input.observed_at ?? new Date(started).toISOString(), confidence: Math.min(1, input.motion_score), trust: "INTEGRATION_TESTED",
          vendor: input.camera.vendor ?? "local" }, { siteId: input.camera.site_id, sourceId: cameraId }, started);
      }
    }
    if (candidate) {
      const previousSignalAt = seenSignals.get(candidate.signal_id);
      seenSignals.set(candidate.signal_id, started);
      for (const [id, at] of seenSignals) if (started - at > defaults.dedupeWindowMs) seenSignals.delete(id);
      if (previousSignalAt != null && started - previousSignalAt <= defaults.dedupeWindowMs) {
        metrics.duplicate_candidates_suppressed++; metrics.expensive_ai_jobs_avoided++;
        return finish({ contract: PREPROCESSING_CONTRACT, decision: "SUPPRESS_DUPLICATE", request_ai: false, candidate, reason: "DUPLICATE_SIGNAL", fallback: false });
      }
      const previousCandidateAt = lastCandidate.get(cameraId) ?? 0;
      if (started - previousCandidateAt < bounded(input.coalesce_window_ms, defaults.coalesceWindowMs, 250, 60_000)) {
        metrics.coalesced_candidates++; metrics.expensive_ai_jobs_avoided++;
        return finish({ contract: PREPROCESSING_CONTRACT, decision: "COALESCE", request_ai: false, candidate, reason: "ACTIVE_CANDIDATE_WINDOW", fallback: false });
      }
      lastCandidate.set(cameraId, started); lastAnalyzed.set(cameraId, started);
      metrics.candidates_produced++; metrics.expensive_ai_jobs_requested++;
      return finish({ contract: PREPROCESSING_CONTRACT, decision: "ANALYZE", request_ai: true, candidate, reason: candidate.type, fallback: false });
    }
    const quietFor = started - (lastAnalyzed.get(cameraId) ?? 0);
    const fallbackDue = quietFor >= bounded(input.max_quiet_interval_ms, defaults.maxQuietIntervalMs, 5_000, 300_000);
    if (fallbackDue) {
      metrics.fallback_events++; metrics.expensive_ai_jobs_requested++; lastAnalyzed.set(cameraId, started);
      return finish({ contract: PREPROCESSING_CONTRACT, decision: "ANALYZE", request_ai: true, candidate: null, reason: "PERIODIC_NEVER_BLIND_FALLBACK", fallback: true });
    }
    metrics.expensive_ai_jobs_avoided++;
    return finish({ contract: PREPROCESSING_CONTRACT, decision: "SKIP_QUIET", request_ai: false, candidate: null, reason: "NO_CANDIDATE", fallback: false });
  }

  return {
    evaluate,
    recordCanonicalEvents(count) { metrics.canonical_events_produced += Math.max(0, Number(count) || 0); },
    snapshot() {
      const denominator = metrics.expensive_ai_jobs_requested + metrics.expensive_ai_jobs_avoided;
      return { contract: PREPROCESSING_CONTRACT, ...metrics,
        ai_work_reduction: denominator ? metrics.expensive_ai_jobs_avoided / denominator : null,
        ai_work_denominator: denominator,
        mean_preprocessing_latency_ms: metrics.evaluations ? metrics.preprocessing_latency_ms_total / metrics.evaluations : null };
    }
  };
}
