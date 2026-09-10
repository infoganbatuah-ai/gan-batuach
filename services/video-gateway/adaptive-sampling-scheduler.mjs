import { createHash } from "node:crypto";

export const ADAPTIVE_SAMPLING_CONTRACT = "observer-adaptive-sampling-v1";
export const SAMPLING_PURPOSES = Object.freeze(["REALTIME_DETECTION", "TRACKING_CONTINUITY", "SITE_LEARNING", "HEALTH_FRESHNESS", "INVESTIGATION"]);
export const SAMPLING_PRIORITIES = Object.freeze(["CRITICAL", "HIGH", "NORMAL", "LOW", "LEARNING"]);
const PRIORITY_WEIGHT = Object.freeze({ CRITICAL: 5, HIGH: 4, NORMAL: 3, LOW: 2, LEARNING: 1 });
const bounded = (value, fallback, minimum, maximum) => Number.isFinite(Number(value))
  ? Math.min(maximum, Math.max(minimum, Number(value))) : fallback;

function empty(camera) {
  const assignment = String(camera.channel_assignment ?? "ASSIGNED");
  return assignment === "CHANNEL_EMPTY" || assignment === "UNASSIGNED" || camera.physical_camera_attached === false;
}

function digest(value) { return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 24); }

export function createAdaptiveSamplingScheduler(options = {}) {
  const now = typeof options.now === "function" ? options.now : () => Date.now();
  const intervals = {
    critical: bounded(options.criticalIntervalMs, 500, 100, 5_000),
    high: bounded(options.highIntervalMs, 1_000, 250, 10_000),
    normal: bounded(options.normalIntervalMs, 2_000, 500, 30_000),
    quiet: bounded(options.quietIntervalMs, 10_000, 1_000, 120_000),
    floor: bounded(options.neverBlindFloorMs, 30_000, 5_000, 300_000),
    learning: bounded(options.learningIntervalMs, 5 * 60_000, 10_000, 24 * 60 * 60_000)
  };
  const state = new Map();
  const candidateWindows = new Map();
  const metrics = { decisions: 0, samples_requested: 0, samples_suppressed: 0, candidates_created: 0,
    candidates_deduplicated: 0, candidates_expired: 0, empty_channel_work: 0, resource_pressure_suppressed: 0,
    fairness_floor_samples: 0, learning_samples_requested: 0, by_priority: {}, by_purpose: {}, by_camera: {} };

  function cameraState(id) {
    if (!state.has(id)) state.set(id, { lastSampleAt: 0, lastActivityAt: 0, quietStreak: 0, lastLearningAt: 0 });
    return state.get(id);
  }

  function classify(camera, at) {
    const s = cameraState(camera.camera_id);
    const health = String(camera.health?.summary ?? camera.status ?? "ONLINE").toUpperCase();
    if (["OFFLINE", "FAILED", "STALE", "UNREACHABLE"].includes(health) || camera.health?.frame_fresh === false) {
      return { purpose: "HEALTH_FRESHNESS", priority: "HIGH", interval: intervals.high, reason: "SOURCE_HEALTH_REQUIRES_RECHECK", eligibleForAi: false };
    }
    if (camera.recovering === true || health === "RECOVERING") return { purpose: "HEALTH_FRESHNESS", priority: "HIGH", interval: intervals.high, reason: "SOURCE_RECOVERING", eligibleForAi: true };
    if (camera.active_incident === true) return { purpose: "REALTIME_DETECTION", priority: "CRITICAL", interval: intervals.critical, reason: "ACTIVE_INCIDENT", eligibleForAi: true };
    if (camera.active_track === true) return { purpose: "TRACKING_CONTINUITY", priority: "HIGH", interval: intervals.high, reason: "ACTIVE_TRACK", eligibleForAi: true };
    if (camera.active_watch_rule === true) return { purpose: "REALTIME_DETECTION", priority: "HIGH", interval: intervals.high, reason: "ACTIVE_WATCH_RULE", eligibleForAi: true };
    if (camera.critical_policy === true) return { purpose: "REALTIME_DETECTION", priority: "HIGH", interval: intervals.high, reason: "CRITICAL_CAMERA_FLOOR", eligibleForAi: true };
    if (camera.candidate_activity === true || at - s.lastActivityAt < bounded(camera.activity_boost_ms, 5_000, 500, 60_000)
      || Number(camera.motion_score) >= bounded(camera.motion_threshold, 0.025, 0, 1)) {
      s.lastActivityAt = at; s.quietStreak = 0;
      return { purpose: "REALTIME_DETECTION", priority: "HIGH", interval: intervals.high, reason: "PREPROCESSING_ACTIVITY", eligibleForAi: true };
    }
    if (camera.learning_under_covered === true && at - s.lastLearningAt >= intervals.learning) {
      return { purpose: "SITE_LEARNING", priority: "LEARNING", interval: intervals.learning, reason: "CAMERA_UNDER_COVERED", eligibleForAi: false };
    }
    const interval = Math.min(intervals.floor, intervals.normal * 2 ** Math.min(4, s.quietStreak));
    return { purpose: "REALTIME_DETECTION", priority: interval >= intervals.floor ? "LOW" : "NORMAL", interval, reason: interval >= intervals.floor ? "QUIET_SCENE_FRESHNESS_FLOOR" : "QUIET_SCENE_DECAY", eligibleForAi: true };
  }

  function createCandidate(camera, decision, at) {
    if (!camera.candidate_activity || !decision.request_sample) return null;
    const windowMs = bounded(camera.candidate_window_ms, 5_000, 250, 60_000);
    const bucket = Math.floor(at / windowMs);
    const key = `${camera.camera_id}:${decision.reason}`;
    const previous = candidateWindows.get(key);
    if (previous != null && at - previous < windowMs) { metrics.candidates_deduplicated++; return null; }
    candidateWindows.set(key, at);
    for (const [id, seenAt] of candidateWindows) if (at - seenAt > windowMs * 2) candidateWindows.delete(id);
    metrics.candidates_created++;
    return Object.freeze({ contract: "observer-ai-candidate-v2", candidate_id: `cand_${digest([camera.site_id, camera.camera_id, bucket, decision.reason])}`,
      site_id: camera.site_id, source_id: camera.camera_id, observed_at: new Date(at).toISOString(), reason: decision.reason,
      priority: decision.priority, purpose: decision.purpose, preprocessing_provenance: camera.preprocessing_provenance ?? "LOCAL_FRAME_DIFF",
      zone: camera.zone ?? null, sampling_policy_version: ADAPTIVE_SAMPLING_CONTRACT,
      expires_at: new Date(at + bounded(camera.candidate_ttl_ms, 30_000, 1_000, 5 * 60_000)).toISOString(), canonical_event: false });
  }

  function plan(cameras, input = {}) {
    const at = Number.isFinite(input.now) ? input.now : now();
    const pressure = ["NORMAL", "CONSTRAINED", "CRITICAL"].includes(input.resourcePressure) ? input.resourcePressure : "NORMAL";
    const budget = Math.max(0, Math.floor(bounded(input.budget, cameras.length, 0, 100_000)));
    const classified = cameras.map((camera, index) => {
      const id = String(camera.camera_id ?? "");
      if (!id) throw new Error("SAMPLING_CAMERA_ID_REQUIRED");
      if (empty(camera)) return { camera, index, empty: true };
      const s = cameraState(id);
      const policy = input.purpose === "SITE_LEARNING"
        ? { purpose: "SITE_LEARNING", priority: "LEARNING", interval: intervals.learning, reason: camera.learning_under_covered === false ? "LEARNING_REFRESH" : "CAMERA_UNDER_COVERED", eligibleForAi: false }
        : classify(camera, at);
      const overdue = at - s.lastSampleAt >= intervals.floor;
      const due = s.lastSampleAt === 0 || at - s.lastSampleAt >= policy.interval;
      const pressureAllowed = pressure === "NORMAL" || policy.priority === "CRITICAL" || policy.priority === "HIGH"
        || (pressure === "CONSTRAINED" && policy.priority === "NORMAL") || overdue;
      return { camera, index, empty: false, policy, state: s, overdue, due, pressureAllowed };
    });
    const eligible = classified.filter(item => !item.empty && item.due && item.pressureAllowed)
      .sort((a, b) => Number(b.overdue) - Number(a.overdue) || PRIORITY_WEIGHT[b.policy.priority] - PRIORITY_WEIGHT[a.policy.priority]
        || a.state.lastSampleAt - b.state.lastSampleAt || a.index - b.index);
    const selected = new Set(eligible.slice(0, budget).map(item => item.camera.camera_id));
    const decisions = classified.map(item => {
      metrics.decisions++;
      if (item.empty) return { contract: ADAPTIVE_SAMPLING_CONTRACT, camera_id: item.camera.camera_id, request_sample: false,
        purpose: "HEALTH_FRESHNESS", priority: "LOW", reason: "CHANNEL_EMPTY", target_interval_ms: null,
        next_evaluation_at: null, expires_at: null, eligible_for_ai: false, candidate: null };
      const request = selected.has(item.camera.camera_id);
      const reason = !item.due ? "NOT_DUE" : !item.pressureAllowed ? "RESOURCE_PRESSURE_DEFERRED" : request ? item.policy.reason : "FAIRNESS_BUDGET_DEFERRED";
      if (request) {
        item.state.lastSampleAt = at;
        item.state.quietStreak = item.policy.reason.startsWith("QUIET_") ? item.state.quietStreak + 1 : 0;
        if (item.policy.purpose === "SITE_LEARNING") item.state.lastLearningAt = at;
        metrics.samples_requested++; if (item.overdue) metrics.fairness_floor_samples++;
        if (item.policy.purpose === "SITE_LEARNING") metrics.learning_samples_requested++;
      } else {
        metrics.samples_suppressed++; if (reason === "RESOURCE_PRESSURE_DEFERRED") metrics.resource_pressure_suppressed++;
      }
      const decision = { contract: ADAPTIVE_SAMPLING_CONTRACT, camera_id: item.camera.camera_id, request_sample: request,
        purpose: item.policy.purpose, priority: item.policy.priority, reason, target_interval_ms: item.policy.interval,
        next_evaluation_at: new Date(at + item.policy.interval).toISOString(), expires_at: new Date(at + item.policy.interval).toISOString(),
        eligible_for_ai: item.policy.eligibleForAi, candidate: null };
      decision.candidate = createCandidate(item.camera, decision, at);
      metrics.by_priority[decision.priority] = (metrics.by_priority[decision.priority] ?? 0) + Number(request);
      metrics.by_purpose[decision.purpose] = (metrics.by_purpose[decision.purpose] ?? 0) + Number(request);
      const perCamera = metrics.by_camera[item.camera.camera_id] ?? { samples: 0, learning_samples: 0, priorities: {}, reasons: {} };
      perCamera.samples += Number(request); perCamera.learning_samples += Number(request && decision.purpose === "SITE_LEARNING");
      perCamera.priorities[decision.priority] = (perCamera.priorities[decision.priority] ?? 0) + Number(request);
      perCamera.reasons[reason] = (perCamera.reasons[reason] ?? 0) + 1; metrics.by_camera[item.camera.camera_id] = perCamera;
      return decision;
    });
    return { contract: ADAPTIVE_SAMPLING_CONTRACT, policy_version: ADAPTIVE_SAMPLING_CONTRACT, generated_at: new Date(at).toISOString(),
      resource_pressure: pressure, budget, decisions };
  }

  function candidateIsFresh(candidate, at = now()) {
    const fresh = candidate?.contract === "observer-ai-candidate-v2" && candidate.canonical_event === false && Date.parse(candidate.expires_at) > at;
    if (!fresh) metrics.candidates_expired++;
    return fresh;
  }

  function recordActivity(cameraId, motionScore, threshold = 0.025, at = now()) {
    const s = cameraState(String(cameraId));
    if (Number.isFinite(Number(motionScore)) && Number(motionScore) >= bounded(threshold, 0.025, 0, 1)) {
      s.lastActivityAt = at; s.quietStreak = 0; return true;
    }
    return false;
  }

  return { plan, recordActivity, candidateIsFresh, snapshot: () => ({ contract: ADAPTIVE_SAMPLING_CONTRACT, ...metrics, intervals: { ...intervals } }) };
}
