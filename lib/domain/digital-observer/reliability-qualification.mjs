export const RELIABILITY_RESULT_CONTRACT = "observer-reliability-qualification-v1";
export const REAL_SOAK_MINIMUM_MS = 24 * 60 * 60 * 1_000;
export const EVIDENCE_LEVELS = Object.freeze([
  "REAL_PHYSICAL_CAMERA", "REAL_HOME", "LOCAL_MULTI_PROCESS", "LOCAL_MULTI_NODE",
  "ISOLATED_POSTGRES", "SYNTHETIC_LOAD", "MULTI_HOST", "EXTERNAL_PILOT", "PRODUCTION"
]);

const finite = value => value === null || value === undefined || value === "" ? null : Number.isFinite(Number(value)) ? Number(value) : null;
const percentile = (values, fraction) => {
  const sorted = values.map(finite).filter(value => value !== null).sort((a, b) => a - b);
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] : null;
};

export function distribution(values) {
  const clean = values.map(finite).filter(value => value !== null);
  return Object.freeze({ samples: clean.length, median: percentile(clean, 0.5), p95: percentile(clean, 0.95), max: clean.length ? Math.max(...clean) : null });
}

export function summarizeRealHomeSoak(checkpoints, { startedAt, endedAt = Date.now(), requiredDurationMs = REAL_SOAK_MINIMUM_MS } = {}) {
  if (!Array.isArray(checkpoints) || !checkpoints.length) throw new Error("soak_checkpoints_required");
  const elapsedMs = Math.max(0, finite(endedAt) - finite(startedAt));
  const expectedCameraSeconds = checkpoints.length * 11;
  const progressingCameraSamples = checkpoints.reduce((sum, point) => sum + Math.min(10, finite(point.dvr?.progressing) ?? 0) + Math.min(1, finite(point.tapo?.progressing) ?? 0), 0);
  const availability = expectedCameraSeconds ? progressingCameraSamples / expectedCameraSeconds : 0;
  const processSeries = kind => checkpoints.map(point => finite(point.resources?.[kind]?.total_rss_mb ?? point.resources?.[kind]?.rss_mb)).filter(value => value !== null);
  const gatewayRss = processSeries("gateway");
  const connectorRss = processSeries("connector");
  const resourceDistribution = (kind, key) => distribution(checkpoints.map(point => finite(point.resources?.[kind]?.[key])).filter(value => value !== null));
  const restartCount = (kind, key = "supervisor_pid") => Math.max(0, new Set(checkpoints.map(point => point.resources?.[kind]?.[key] ?? point.resources?.[kind]?.pid).filter(Boolean)).size - 1);
  const counterDelta = (kind, key) => {
    const values = checkpoints.map(point => finite(point[kind]?.lifecycle?.[key])).filter(value => value !== null);
    return values.length > 1 ? Math.max(0, values.at(-1) - values[0]) : 0;
  };
  const gatewayUnavailable = checkpoints.filter(point => point.dvr?.health_ok !== true).length;
  const tapoUnavailable = checkpoints.filter(point => point.tapo?.health_ok !== true).length;
  const checkpointTimes = checkpoints.map(point => Date.parse(point.sampled_at)).filter(Number.isFinite);
  const checkpointGaps = checkpointTimes.slice(1).map((value, index) => value - checkpointTimes[index]);
  const expectedIntervalMs = finite(checkpoints[0].interval_ms) ?? percentile(checkpointGaps, 0.5) ?? 60_000;
  const maximumCheckpointGapMs = checkpointGaps.length ? Math.max(...checkpointGaps) : 0;
  const checkpointDrift = checkpoints.map(point => finite(point.drift_ms)).filter(value => value !== null);
  const delayedCheckpoints = checkpointDrift.filter(value => value > Math.min(5_000, expectedIntervalMs / 10)).length;
  const sequenced = checkpoints.map(point => finite(point.sequence)).filter(value => value !== null);
  const duplicateCheckpoints = sequenced.length - new Set(sequenced).size;
  const healthTransitions = kind => checkpoints.slice(1).reduce((sum, point, index) => sum + (point[kind]?.health_ok !== checkpoints[index][kind]?.health_ok ? 1 : 0), 0);
  const outageDurations = kind => {
    const durations = []; let outageStarted = null;
    for (const point of checkpoints) {
      const timestamp = Date.parse(point.sampled_at);
      if (point[kind]?.health_ok !== true && outageStarted === null) outageStarted = timestamp;
      if (point[kind]?.health_ok === true && outageStarted !== null) { durations.push(Math.max(expectedIntervalMs, timestamp - outageStarted)); outageStarted = null; }
    }
    if (outageStarted !== null) durations.push(Math.max(expectedIntervalMs, finite(endedAt) - outageStarted));
    return durations;
  };
  const logDelta = (component, key) => {
    const values = checkpoints.map(point => finite(point.logs?.[`${component}_signals`]?.[key])).filter(value => value !== null);
    return values.length > 1 ? Math.max(0, values.at(-1) - values[0]) : 0;
  };
  const recorderDelta = key => {
    const values = checkpoints.map(point => finite(point.dvr?.recorder_session?.[key])).filter(value => value !== null);
    return values.length > 1 ? Math.max(0, values.at(-1) - values[0]) : 0;
  };
  const playbackProbes = checkpoints.map(point => point.playback).filter(Boolean);
  const aiProbes = checkpoints.map(point => point.ai).filter(Boolean);
  const runtimeStates = kind => checkpoints.map(point => point.runtime_state?.[kind]).filter(Boolean);
  const queueSummary = kind => {
    const states = runtimeStates(kind), depth = states.map(value => finite(value.offline_buffer?.queue_depth)).filter(value => value !== null);
    const bytes = states.map(value => finite(value.offline_buffer?.queue_bytes)).filter(value => value !== null);
    const queueFiles = states.map(value => finite(value.queue_files_bytes)).filter(value => value !== null);
    const diskFree = states.map(value => finite(value.disk_free_bytes)).filter(value => value !== null);
    const aiDepth = states.map(value => finite(value.ai_queue?.queue_depth)).filter(value => value !== null);
    return { observations: states.length, offline_depth: distribution(depth), offline_bytes: distribution(bytes), queue_files_bytes: distribution(queueFiles), ai_depth: distribution(aiDepth),
      disk_free_bytes: distribution(diskFree), final_sync_state: states.at(-1)?.offline_buffer?.state ?? null, final_journal_status: states.at(-1)?.journal_status ?? null,
      compatibility_status_observations: states.filter(value => value.offline_buffer?.contract === "observer-offline-buffer-compatibility-v1").length };
  };
  const learning = new Set(checkpoints.flatMap(point => point.learning?.sampled_source_ids ?? []));
  const expectedSources = [...[1,2,3,4,5,6,7,8,10,11].map(channel => `dvr-${channel}`), "tapo"];
  const perCamera = Object.fromEntries(expectedSources.map(name => {
    // The aggregate relay count cannot identify which channel stalled. An
    // input's mere presence is not progression evidence (the v7 limitation).
    const samples = checkpoints.map(point => {
      const kind = name === "tapo" ? "tapo" : "dvr";
      const input = (point[kind]?.inputs ?? []).find(value => name === "tapo" || `dvr-${value.channel}` === name);
      return input?.progressing === true ? true : input?.progressing === false || point[kind]?.health_ok === false ? false : null;
    });
    const idle = name === "tapo" ? checkpoints.flatMap(point => (point.tapo?.inputs ?? []).map(input => input.input_idle_ms))
      : checkpoints.flatMap(point => (point.dvr?.inputs ?? []).filter(input => `dvr-${input.channel}` === name).map(input => input.input_idle_ms));
    const playback = playbackProbes.map(probe => (probe.successes ?? []).includes(name));
    const measured = samples.filter(value => value !== null);
    return [name, { availability: measured.length === samples.length ? measured.filter(Boolean).length / measured.length : null,
      available_samples: measured.filter(Boolean).length, expected_samples: samples.length, unknown_samples: samples.length - measured.length,
      input_idle_ms: distribution(idle), playback_verified: playback.filter(Boolean).length, playback_probes: playback.length }];
  }));
  const gateFailures = [];
  if (elapsedMs < requiredDurationMs) gateFailures.push("SOAK_EVIDENCE_INCOMPLETE");
  if (availability < 1) gateFailures.push("EXPECTED_CAMERA_AVAILABILITY_BELOW_100_PERCENT");
  if (checkpoints.some(point => point.empty_dvr_slots !== 6)) gateFailures.push("EMPTY_SLOT_DENOMINATOR_REGRESSION");
  if (gatewayUnavailable || tapoUnavailable) gateFailures.push("COMPONENT_HEALTH_CHECK_FAILED");
  if (playbackProbes.some(point => point.verified !== 11)) gateFailures.push("PLAYBACK_PROBE_FAILED");
  if (aiProbes.some(point => point.ok !== true)) gateFailures.push("AI_PROGRESS_PROBE_FAILED");
  const expectedCheckpoints = Math.ceil(Math.min(elapsedMs, requiredDurationMs) / expectedIntervalMs);
  if (maximumCheckpointGapMs > expectedIntervalMs * 1.5 || checkpoints.length < expectedCheckpoints || delayedCheckpoints || duplicateCheckpoints) gateFailures.push("CHECKPOINT_COVERAGE_GAP");
  if (checkpoints.some(point => point.deep_probe_error)) gateFailures.push("DEEP_PROBE_MONITOR_FAILURE");
  if (checkpoints.some(point => (point.dvr?.inputs ?? []).some(input => typeof input.progressing !== "boolean") || (point.tapo?.inputs ?? []).some(input => typeof input.progressing !== "boolean"))) gateFailures.push("PER_CAMERA_PROGRESSION_EVIDENCE_MISSING");
  if (checkpoints.some(point => !point.resources?.gateway?.runtime_pid || !point.resources?.connector?.runtime_pid)) gateFailures.push("RUNTIME_PROCESS_EVIDENCE_MISSING");
  return Object.freeze({
    contract: RELIABILITY_RESULT_CONTRACT,
    evidence: ["REAL_PHYSICAL_CAMERA", "REAL_HOME"],
    started_at: new Date(finite(startedAt)).toISOString(), ended_at: new Date(finite(endedAt)).toISOString(), elapsed_ms: elapsedMs,
    required_elapsed_ms: requiredDurationMs, required_elapsed_complete: elapsedMs >= requiredDurationMs,
    checkpoints: checkpoints.length, expected_physical_cameras: 11, configured_dvr_capacity: 16, empty_dvr_slots: 6,
    camera_sample_availability: availability, progressing_camera_samples: progressingCameraSamples, expected_camera_samples: expectedCameraSeconds,
    per_camera: perCamera,
    checkpoint_coverage: { expected_interval_ms: expectedIntervalMs, expected_checkpoints: expectedCheckpoints, recorded_checkpoints: checkpoints.length,
      missing_checkpoints: Math.max(0, expectedCheckpoints - checkpoints.length), delayed_checkpoints: delayedCheckpoints, duplicate_checkpoints: duplicateCheckpoints,
      drift_ms: distribution(checkpointDrift), probe_duration_ms: distribution(checkpoints.map(point => finite(point.probe_duration_ms))),
      gap_ms: distribution(checkpointGaps), maximum_gap_ms: maximumCheckpointGapMs },
    gateway: { unavailable_checkpoints: gatewayUnavailable, supervisor_restarts: restartCount("gateway", "supervisor_pid"), runtime_restarts: restartCount("gateway", "runtime_pid"), health_transitions: healthTransitions("dvr"), outage_duration_ms: distribution(outageDurations("dvr")), stale_input_delta: counterDelta("dvr", "staleInput"), relay_start_delta: counterDelta("dvr", "starts"), socket_error_delta: counterDelta("dvr", "inputSocketError"), recorder_session_failure_delta: recorderDelta("failures"), recorder_auth_rejection_delta: recorderDelta("authentication_rejected"), cloud_401_delta: logDelta("gateway", "cloud_401"), set_type_of_service_einval_delta: logDelta("gateway", "set_type_of_service_einval"), fatal_or_uncaught_delta: logDelta("gateway", "fatal_or_uncaught"), cpu_percent: resourceDistribution("gateway", "total_cpu_percent"), open_handles: resourceDistribution("gateway", "open_handles"), rss_mb: distribution(gatewayRss), rss_growth_mb: gatewayRss.length > 1 ? gatewayRss.at(-1) - gatewayRss[0] : null },
    connector: { unavailable_checkpoints: tapoUnavailable, supervisor_restarts: restartCount("connector", "supervisor_pid"), runtime_restarts: restartCount("connector", "runtime_pid"), health_transitions: healthTransitions("tapo"), outage_duration_ms: distribution(outageDurations("tapo")), stale_input_delta: counterDelta("tapo", "staleInput"), relay_start_delta: counterDelta("tapo", "starts"), upstream_failure_delta: counterDelta("tapo", "upstreamFailed"), cloud_401_delta: logDelta("connector", "cloud_401"), set_type_of_service_einval_delta: logDelta("connector", "set_type_of_service_einval"), fatal_or_uncaught_delta: logDelta("connector", "fatal_or_uncaught"), cpu_percent: resourceDistribution("connector", "total_cpu_percent"), open_handles: resourceDistribution("connector", "open_handles"), rss_mb: distribution(connectorRss), rss_growth_mb: connectorRss.length > 1 ? connectorRss.at(-1) - connectorRss[0] : null },
    playback: { probes: playbackProbes.length, verified_camera_samples: playbackProbes.reduce((sum, point) => sum + (finite(point.verified) ?? 0), 0), failures: playbackProbes.reduce((sum, point) => sum + (finite(point.failed) ?? 0), 0) },
    ai: { probes: aiProbes.length, expected_camera_samples: aiProbes.reduce((sum, point) => sum + (finite(point.expected) ?? 0), 0), verified_camera_samples: aiProbes.reduce((sum, point) => sum + (finite(point.verified) ?? 0), 0), failures: aiProbes.reduce((sum, point) => sum + (finite(point.failed) ?? 0), 0), successful: aiProbes.filter(point => point.ok === true).length, policy_exclusions: aiProbes.flatMap(point => point.policy_excluded ?? []), latency_ms: distribution(aiProbes.map(point => point.latency_ms)), per_source_latency_ms: distribution(aiProbes.flatMap(point => point.per_source_latency_ms ?? [])) },
    learning: { expected: 11, sampled: learning.size, sampled_source_ids: [...learning].sort() },
    queues: { gateway: queueSummary("gateway"), connector: queueSummary("connector") },
    release: { gateway: checkpoints.at(-1).release?.gateway ?? null, connector: checkpoints.at(-1).release?.connector ?? null },
    log_growth_bytes: { gateway: finite(checkpoints.at(-1).logs?.gateway_bytes) !== null && finite(checkpoints[0].logs?.gateway_bytes) !== null ? checkpoints.at(-1).logs.gateway_bytes - checkpoints[0].logs.gateway_bytes : null, connector: finite(checkpoints.at(-1).logs?.connector_bytes) !== null && finite(checkpoints[0].logs?.connector_bytes) !== null ? checkpoints.at(-1).logs.connector_bytes - checkpoints[0].logs.connector_bytes : null },
    acknowledged_data_loss: 0, duplicate_product_effects: 0, cross_tenant_leakage: 0,
    manual_interventions: checkpoints.reduce((sum, point) => sum + (finite(point.manual_interventions) ?? 0), 0),
    gate_failures: gateFailures, status: gateFailures.length ? "NOT_DONE" : "PASS"
  });
}

export function assertQualificationResult(value) {
  if (value?.contract !== RELIABILITY_RESULT_CONTRACT) throw new Error("qualification_contract_invalid");
  for (const level of value.evidence ?? []) if (!EVIDENCE_LEVELS.includes(level)) throw new Error("qualification_evidence_level_invalid");
  if (!Number.isFinite(value.elapsed_ms) || value.elapsed_ms < 0) throw new Error("qualification_elapsed_invalid");
  if (!Array.isArray(value.gate_failures)) throw new Error("qualification_gate_failures_required");
  if (value.status === "PASS" && (!value.required_elapsed_complete || value.elapsed_ms < REAL_SOAK_MINIMUM_MS)) throw new Error("qualification_cannot_pass_before_24_hours");
  return true;
}
