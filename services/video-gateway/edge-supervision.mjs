const FAILURE = Object.freeze({
  PROCESS_EXITED: "PROCESS_EXITED", PROCESS_CRASH_LOOP: "PROCESS_CRASH_LOOP", HEARTBEAT_STALE: "HEARTBEAT_STALE",
  CLOUD_DISCONNECTED: "CLOUD_DISCONNECTED", AUTHENTICATION_FAILURE: "AUTHENTICATION_FAILURE", RELAY_STOPPED: "RELAY_STOPPED",
  STALE_STREAM: "STALE_STREAM", DVR_SESSION_LOST: "DVR_SESSION_LOST", CAMERA_SOURCE_UNAVAILABLE: "CAMERA_SOURCE_UNAVAILABLE",
  INFERENCE_WORKER_STALLED: "INFERENCE_WORKER_STALLED", TRANSPORT_ERROR_REPEATED: "TRANSPORT_ERROR_REPEATED",
  CONFIGURATION_INVALID: "CONFIGURATION_INVALID"
});

const ACTION = Object.freeze({
  RETRY_REQUEST: "RETRY_REQUEST", RECONNECT_SOURCE: "RECONNECT_SOURCE", RESTART_RELAY: "RESTART_RELAY",
  RENEW_DVR_SESSION: "RENEW_DVR_SESSION", RESTART_WORKER: "RESTART_WORKER", RESTART_MANAGED_SERVICE: "RESTART_MANAGED_SERVICE",
  SIGNAL_OTA_HEALTH: "SIGNAL_OTA_HEALTH", ESCALATE: "ESCALATE"
});

const RECOVERY = Object.freeze({
  [FAILURE.PROCESS_EXITED]: [ACTION.RESTART_MANAGED_SERVICE],
  [FAILURE.PROCESS_CRASH_LOOP]: [ACTION.SIGNAL_OTA_HEALTH, ACTION.ESCALATE],
  [FAILURE.HEARTBEAT_STALE]: [ACTION.RETRY_REQUEST, ACTION.RESTART_MANAGED_SERVICE],
  [FAILURE.CLOUD_DISCONNECTED]: [ACTION.RETRY_REQUEST],
  [FAILURE.AUTHENTICATION_FAILURE]: [ACTION.ESCALATE],
  [FAILURE.RELAY_STOPPED]: [ACTION.RESTART_RELAY],
  [FAILURE.STALE_STREAM]: [ACTION.RECONNECT_SOURCE, ACTION.RESTART_RELAY, ACTION.RENEW_DVR_SESSION],
  [FAILURE.DVR_SESSION_LOST]: [ACTION.RENEW_DVR_SESSION],
  [FAILURE.CAMERA_SOURCE_UNAVAILABLE]: [ACTION.RECONNECT_SOURCE],
  [FAILURE.INFERENCE_WORKER_STALLED]: [ACTION.RESTART_WORKER],
  [FAILURE.TRANSPORT_ERROR_REPEATED]: [ACTION.RECONNECT_SOURCE, ACTION.RESTART_RELAY],
  [FAILURE.CONFIGURATION_INVALID]: [ACTION.ESCALATE]
});

function boundedNumber(value, fallback, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback;
}

function clean(value, depth = 0) {
  if (depth > 3) return "[bounded]";
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => clean(item, depth + 1));
  if (!value || typeof value !== "object") {
    if (typeof value !== "string") return value;
    return value.replace(/(?:https?|rtsp):\/\/\S+/gi, "[private-source]")
      .replace(/(?:password|token|secret|private[_ -]?key)\s*[=:]\s*\S+/gi, "$1=[redacted]").slice(0, 240);
  }
  return Object.fromEntries(Object.entries(value).filter(([key]) => !/(password|secret|token|private.?key|credential|stream.?url)/i.test(key))
    .slice(0, 30).map(([key, item]) => [key, clean(item, depth + 1)]));
}

export function createEdgeSupervisor({ now = Date.now, random = Math.random, adapters = {}, config = {} } = {}) {
  const policy = Object.freeze({
    staleMs: boundedNumber(config.staleMs, 30_000, 1_000, 300_000),
    baseBackoffMs: boundedNumber(config.baseBackoffMs, 2_000, 100, 60_000),
    maxBackoffMs: boundedNumber(config.maxBackoffMs, 120_000, 1_000, 900_000),
    maxAttempts: Math.floor(boundedNumber(config.maxAttempts, 4, 1, 10)),
    crashWindowMs: boundedNumber(config.crashWindowMs, 300_000, 10_000, 3_600_000),
    maxCrashes: Math.floor(boundedNumber(config.maxCrashes, 3, 2, 10)),
    eventLimit: Math.floor(boundedNumber(config.eventLimit, 200, 20, 1000))
  });
  const resources = new Map(), crashes = [], events = [];
  const metrics = { failures_detected: 0, recovery_attempts: 0, recoveries_succeeded: 0, recoveries_failed: 0,
    stale_streams: 0, crash_loops: 0, user_interventions: 0, recovery_duration_ms: [] };

  function audit(type, fields = {}) {
    events.push(clean({ at: new Date(now()).toISOString(), type, ...fields }));
    if (events.length > policy.eventLimit) events.splice(0, events.length - policy.eventLimit);
  }
  function delay(attempt) {
    const base = Math.min(policy.maxBackoffMs, policy.baseBackoffMs * (2 ** Math.max(0, attempt - 1)));
    return Math.min(policy.maxBackoffMs, Math.round(base * (1 + Math.max(0, Math.min(1, random())) * 0.2)));
  }
  function observe(input) {
    const id = String(input?.resourceId || "").slice(0, 160);
    if (!id) throw new Error("supervision_resource_required");
    if (input.assignment === "CHANNEL_EMPTY" || input.assignment === "UNASSIGNED") {
      resources.set(id, { id, assignment: "CHANNEL_EMPTY", state: "HEALTHY", failure: null, expected: false, updatedAt: now() });
      return resources.get(id);
    }
    const previous = resources.get(id), at = now();
    let failure = null;
    if (input.configurationValid === false) failure = FAILURE.CONFIGURATION_INVALID;
    else if (input.auth === "INVALID" || input.auth === "REVOKED") failure = FAILURE.AUTHENTICATION_FAILURE;
    else if (input.processRunning === false) failure = FAILURE.PROCESS_EXITED;
    else if (input.cloudConnected === false) failure = FAILURE.CLOUD_DISCONNECTED;
    else if (input.dvrSession === "LOST") failure = FAILURE.DVR_SESSION_LOST;
    else if (input.sourceAvailable === false) failure = FAILURE.CAMERA_SOURCE_UNAVAILABLE;
    else if (input.relayRunning === false) failure = FAILURE.RELAY_STOPPED;
    else if (input.inferenceProgressing === false) failure = FAILURE.INFERENCE_WORKER_STALLED;
    else if (input.frameProgressing === false || Number.isFinite(input.lastFrameAt) && at - input.lastFrameAt > policy.staleMs) failure = FAILURE.STALE_STREAM;
    if (failure === FAILURE.PROCESS_EXITED) {
      crashes.push(at);
      while (crashes.length && at - crashes[0] > policy.crashWindowMs) crashes.shift();
      if (crashes.length >= policy.maxCrashes) { failure = FAILURE.PROCESS_CRASH_LOOP; metrics.crash_loops += 1; }
    }
    if (failure && failure !== previous?.failure) {
      metrics.failures_detected += 1;
      if (failure === FAILURE.STALE_STREAM) metrics.stale_streams += 1;
      audit("FAILURE_DETECTED", { resource_id: id, failure, dimension: input.dimension || "source" });
    }
    const record = { ...previous, id, assignment: "ASSIGNED", expected: true, failure,
      state: failure ? failure === FAILURE.AUTHENTICATION_FAILURE || failure === FAILURE.CONFIGURATION_INVALID || failure === FAILURE.PROCESS_CRASH_LOOP ? "NEEDS_ATTENTION" : "RECOVERING" : "HEALTHY",
      updatedAt: at, attempts: failure === previous?.failure ? previous?.attempts || 0 : 0, nextAttemptAt: failure === previous?.failure ? previous?.nextAttemptAt || 0 : 0 };
    resources.set(id, record);
    return record;
  }
  async function recover(resourceId) {
    const record = resources.get(resourceId);
    if (!record?.failure) return { status: "HEALTHY", action: null };
    if (now() < record.nextAttemptAt) return { status: "BACKOFF", retry_at: new Date(record.nextAttemptAt).toISOString() };
    const ladder = RECOVERY[record.failure] || [ACTION.ESCALATE];
    if (record.attempts >= policy.maxAttempts) {
      record.state = "NEEDS_ATTENTION"; metrics.user_interventions += 1;
      audit("RECOVERY_ESCALATED", { resource_id: resourceId, failure: record.failure, attempts: record.attempts });
      return { status: "ESCALATED", action: ACTION.ESCALATE };
    }
    const action = ladder[Math.min(record.attempts, ladder.length - 1)];
    record.attempts += 1; record.nextAttemptAt = now() + delay(record.attempts);
    metrics.recovery_attempts += 1; const started = now();
    audit("RECOVERY_STARTED", { resource_id: resourceId, failure: record.failure, action, attempt: record.attempts });
    try {
      const handler = adapters[action];
      if (typeof handler !== "function") throw new Error("recovery_action_unavailable");
      const result = await handler({ resourceId, failure: record.failure, attempt: record.attempts });
      if (result?.healthy === false) throw new Error("recovery_health_gate_failed");
      record.failure = null; record.state = "HEALTHY"; record.nextAttemptAt = 0;
      metrics.recoveries_succeeded += 1; metrics.recovery_duration_ms.push(Math.max(0, now() - started));
      if (metrics.recovery_duration_ms.length > 100) metrics.recovery_duration_ms.shift();
      audit("RECOVERY_SUCCEEDED", { resource_id: resourceId, action, attempt: record.attempts, duration_ms: Math.max(0, now() - started) });
      return { status: "RECOVERED", action };
    } catch (error) {
      metrics.recoveries_failed += 1;
      audit("RECOVERY_FAILED", { resource_id: resourceId, action, attempt: record.attempts, error: error instanceof Error ? error.message : "recovery_failed" });
      return { status: "FAILED", action };
    }
  }
  function snapshot() {
    const values = [...resources.values()], durations = [...metrics.recovery_duration_ms].sort((a, b) => a - b);
    return clean({ contract: "observer-edge-supervision-v1", state: values.some((item) => item.state === "NEEDS_ATTENTION") ? "NEEDS_ATTENTION" : values.some((item) => item.state === "RECOVERING") ? "RECOVERING" : "HEALTHY",
      expected_resources: values.filter((item) => item.expected).length, healthy_resources: values.filter((item) => item.expected && item.state === "HEALTHY").length,
      empty_unassigned: values.filter((item) => !item.expected).length, failures: values.filter((item) => item.failure).map((item) => ({ resource_id: item.id, category: item.failure, attempts: item.attempts })),
      metrics: { ...metrics, recovery_duration_ms: undefined, median_recovery_ms: durations.length ? durations[Math.floor(durations.length / 2)] : null, longest_recovery_ms: durations.length ? durations.at(-1) : null }, events });
  }
  return { observe, recover, snapshot, failures: FAILURE, actions: ACTION, policy };
}

export { FAILURE as EDGE_FAILURE_CATEGORY, ACTION as EDGE_RECOVERY_ACTION };
