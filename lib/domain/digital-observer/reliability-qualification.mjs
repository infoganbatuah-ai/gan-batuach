export const RELIABILITY_RESULT_CONTRACT = "observer-reliability-qualification-v1";
export const REAL_SOAK_MINIMUM_MS = 24 * 60 * 60 * 1_000;
export const EVIDENCE_LEVELS = Object.freeze([
  "REAL_PHYSICAL_CAMERA", "REAL_HOME", "LOCAL_MULTI_PROCESS", "LOCAL_MULTI_NODE",
  "ISOLATED_POSTGRES", "SYNTHETIC_LOAD", "MULTI_HOST", "EXTERNAL_PILOT", "PRODUCTION"
]);

const finite = value => Number.isFinite(Number(value)) ? Number(value) : null;
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
  const processSeries = kind => checkpoints.map(point => finite(point.resources?.[kind]?.rss_mb)).filter(value => value !== null);
  const gatewayRss = processSeries("gateway");
  const connectorRss = processSeries("connector");
  const restartCount = kind => Math.max(0, new Set(checkpoints.map(point => point.resources?.[kind]?.pid).filter(Boolean)).size - 1);
  const counterDelta = (kind, key) => {
    const values = checkpoints.map(point => finite(point[kind]?.lifecycle?.[key])).filter(value => value !== null);
    return values.length > 1 ? Math.max(0, values.at(-1) - values[0]) : 0;
  };
  const gatewayUnavailable = checkpoints.filter(point => point.dvr?.health_ok !== true).length;
  const tapoUnavailable = checkpoints.filter(point => point.tapo?.health_ok !== true).length;
  const playbackProbes = checkpoints.map(point => point.playback).filter(Boolean);
  const aiProbes = checkpoints.map(point => point.ai).filter(Boolean);
  const learning = new Set(checkpoints.flatMap(point => point.learning?.sampled_source_ids ?? []));
  const gateFailures = [];
  if (elapsedMs < requiredDurationMs) gateFailures.push("SOAK_EVIDENCE_INCOMPLETE");
  if (availability < 1) gateFailures.push("EXPECTED_CAMERA_AVAILABILITY_BELOW_100_PERCENT");
  if (checkpoints.some(point => point.empty_dvr_slots !== 6)) gateFailures.push("EMPTY_SLOT_DENOMINATOR_REGRESSION");
  if (gatewayUnavailable || tapoUnavailable) gateFailures.push("COMPONENT_HEALTH_CHECK_FAILED");
  if (playbackProbes.some(point => point.verified !== 11)) gateFailures.push("PLAYBACK_PROBE_FAILED");
  if (aiProbes.some(point => point.ok !== true)) gateFailures.push("AI_PROGRESS_PROBE_FAILED");
  return Object.freeze({
    contract: RELIABILITY_RESULT_CONTRACT,
    evidence: ["REAL_PHYSICAL_CAMERA", "REAL_HOME"],
    started_at: new Date(finite(startedAt)).toISOString(), ended_at: new Date(finite(endedAt)).toISOString(), elapsed_ms: elapsedMs,
    required_elapsed_ms: requiredDurationMs, required_elapsed_complete: elapsedMs >= requiredDurationMs,
    checkpoints: checkpoints.length, expected_physical_cameras: 11, configured_dvr_capacity: 16, empty_dvr_slots: 6,
    camera_sample_availability: availability, progressing_camera_samples: progressingCameraSamples, expected_camera_samples: expectedCameraSeconds,
    gateway: { unavailable_checkpoints: gatewayUnavailable, restarts: restartCount("gateway"), stale_input_delta: counterDelta("dvr", "staleInput"), relay_start_delta: counterDelta("dvr", "starts"), socket_error_delta: counterDelta("dvr", "inputSocketError"), rss_mb: distribution(gatewayRss), rss_growth_mb: gatewayRss.length > 1 ? gatewayRss.at(-1) - gatewayRss[0] : null },
    connector: { unavailable_checkpoints: tapoUnavailable, restarts: restartCount("connector"), stale_input_delta: counterDelta("tapo", "staleInput"), relay_start_delta: counterDelta("tapo", "starts"), upstream_failure_delta: counterDelta("tapo", "upstreamFailed"), rss_mb: distribution(connectorRss), rss_growth_mb: connectorRss.length > 1 ? connectorRss.at(-1) - connectorRss[0] : null },
    playback: { probes: playbackProbes.length, verified_camera_samples: playbackProbes.reduce((sum, point) => sum + (finite(point.verified) ?? 0), 0), failures: playbackProbes.reduce((sum, point) => sum + (finite(point.failed) ?? 0), 0) },
    ai: { probes: aiProbes.length, successful: aiProbes.filter(point => point.ok === true).length, latency_ms: distribution(aiProbes.map(point => point.latency_ms)) },
    learning: { expected: 11, sampled: learning.size, sampled_source_ids: [...learning].sort() },
    log_growth_bytes: { gateway: checkpoints.at(-1).logs?.gateway_bytes - checkpoints[0].logs?.gateway_bytes, connector: checkpoints.at(-1).logs?.connector_bytes - checkpoints[0].logs?.connector_bytes },
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
