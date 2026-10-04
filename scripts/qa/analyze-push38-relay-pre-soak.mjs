import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const option = name => process.argv.find(value => value.startsWith(`--${name}=`))
  ?.slice(name.length + 3);
const checkpointsPath = resolve(option("checkpoints") || "");
const resultPath = resolve(option("result") || "");
const outputPath = resolve(option("output") || "");
if (![checkpointsPath, resultPath].every(existsSync) || !option("output") || existsSync(outputPath)) {
  throw new Error("push38_relay_analysis_paths_invalid");
}

const sha256 = value => createHash("sha256").update(value).digest("hex");
const checkpointsBytes = readFileSync(checkpointsPath);
const resultBytes = readFileSync(resultPath);
const checkpoints = checkpointsBytes.toString("utf8").trim().split("\n")
  .filter(Boolean).map(line => JSON.parse(line));
const result = JSON.parse(resultBytes.toString("utf8"));
const first = checkpoints[0], last = checkpoints.at(-1);
const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const delta = (before, after, key) => Math.max(0,
  finite(after?.dvr?.lifecycle?.[key]) - finite(before?.dvr?.lifecycle?.[key]));

const previousDiagnostics = new Map();
const timeline = checkpoints.map(point => {
  const channelStarts = [];
  for (const diagnostic of point.dvr?.relay_diagnostics ?? []) {
    const before = previousDiagnostics.get(diagnostic.channel);
    const starts = Math.max(0, finite(diagnostic.starts) - finite(before?.starts));
    const exits = Math.max(0, finite(diagnostic.exits) - finite(before?.exits));
    if (starts || exits || diagnostic.last_failure_at !== before?.last_failure_at) {
      channelStarts.push({ channel: diagnostic.channel, starts, exits,
        last_start_reason: diagnostic.last_start_reason ?? null,
        last_handoff_mode: diagnostic.last_handoff_mode ?? null,
        last_failure_reason: diagnostic.last_failure_reason ?? null,
        last_failure_at: diagnostic.last_failure_at ?? null,
        retry_failures: diagnostic.retry_failures ?? 0 });
    }
    previousDiagnostics.set(diagnostic.channel, diagnostic);
  }
  const inputs = point.dvr?.inputs ?? [];
  const present = new Set(inputs.map(value => Number(value.channel)));
  const qualified = [1, 2, 3, 4, 5, 6, 7, 10, 11];
  return {
    sequence: point.sequence,
    sampled_at: point.sampled_at,
    gateway_liveness: point.dvr?.liveness?.ok === true,
    source_classification: point.dvr?.classification ?? null,
    progressing: point.dvr?.progressing ?? null,
    nonprogressing_channels: inputs.filter(value => value.progressing !== true)
      .map(value => ({ channel: value.channel, relay_age_ms: value.relay_age_ms,
        input_idle_ms: value.input_idle_ms, output_idle_ms: value.output_idle_ms,
        encoder: value.encoder })),
    missing_channels: qualified.filter(channel => !present.has(channel)),
    relay_processes: point.dvr?.relay_processes ?? null,
    lifecycle: point.dvr?.lifecycle ?? null,
    channel_activity: channelStarts,
    playback_failures: point.playback?.failures ?? [],
    ai_ok: point.ai?.ok ?? null,
    runtime_process_evidence: point.resources?.gateway?.inspection_ok === true,
    runtime_pid: point.resources?.gateway?.runtime_pid ?? null,
    cpu_percent: point.resources?.gateway?.total_cpu_percent ?? null,
    rss_mb: point.resources?.gateway?.total_rss_mb ?? null,
    open_handles: point.resources?.gateway?.open_handles ?? null,
    event_loop: point.dvr?.event_loop ?? null
  };
});

function windowsFor(predicate) {
  const windows = [];
  let active = null;
  for (const point of timeline) {
    const failed = predicate(point);
    if (failed && !active) active = { started_at: point.sampled_at,
      start_sequence: point.sequence, checkpoints: [],
      classifications: [] };
    if (failed) {
      active.checkpoints.push(point.sequence);
      active.classifications.push(point.source_classification);
    }
    if (!failed && active) {
      active.ended_at = point.sampled_at;
      active.duration_ms = Date.parse(point.sampled_at) - Date.parse(active.started_at);
      active.classifications = [...new Set(active.classifications)];
      windows.push(active); active = null;
    }
  }
  if (active) {
    active.ended_at = result.ended_at;
    active.duration_ms = Date.parse(result.ended_at) - Date.parse(active.started_at);
    active.classifications = [...new Set(active.classifications)];
    windows.push(active);
  }
  return windows;
}
const failureWindows = windowsFor(point => point.source_classification !== "PASS");
const sourceFailureWindows = windowsFor(point =>
  point.source_classification === "PRODUCT_FAILURE");
const monitorFailureWindows = windowsFor(point =>
  point.source_classification === "MONITOR_FAILURE");

const relayStarts = delta(first, last, "starts");
const warmSuccess = delta(first, last, "warmHandoffs");
const warmFailure = delta(first, last, "warmHandoffFailures");
const classifiedWarmStarts = Math.min(relayStarts, warmSuccess + warmFailure);
const output = {
  contract: "observer-push38-relay-failure-timeline-v1",
  generated_at: new Date().toISOString(),
  immutable_inputs: {
    checkpoints: { path_class: "RESTRICTED_PUSH38_PRE_SOAK_CHECKPOINTS",
      sha256: sha256(checkpointsBytes), bytes: checkpointsBytes.byteLength },
    result: { path_class: "RESTRICTED_PUSH38_PRE_SOAK_RESULT",
      sha256: sha256(resultBytes), bytes: resultBytes.byteLength }
  },
  run: { started_at: result.started_at, ended_at: result.ended_at,
    elapsed_ms: result.elapsed_ms, checkpoints: result.checkpoints,
    gate_failures: result.gate_failures },
  relay_starts: { total: relayStarts,
    successful_warm_handoff: warmSuccess,
    failed_warm_handoff: warmFailure,
    recovery_or_unattributed: relayStarts - classifiedWarmStarts,
    event_level_mode_limit: "0.2.36_RECORDED_ONLY_LAST_HANDOFF_MODE_PER_SOURCE" },
  stale_inputs: { total: delta(first, last, "staleInput"),
    stale_playlist: delta(first, last, "stalePlaylist"),
    ownership_limit: "0.2.36_DID_NOT_SEPARATE_CURRENT_FROM_WARMING_OR_FALLBACK" },
  excluded_primary_causes: {
    process_restarts: result.gateway?.runtime_restarts ?? null,
    socket_errors: result.gateway?.socket_error_delta ?? null,
    recorder_session_failures: result.gateway?.recorder_session_failure_delta ?? null,
    authentication_rejections: result.gateway?.recorder_auth_rejection_delta ?? null
  },
  failure_windows: failureWindows,
  source_failure_windows: sourceFailureWindows,
  monitor_failure_windows: monitorFailureWindows,
  timeline
};
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, {
  mode: 0o600, flag: "wx" });
console.log(JSON.stringify({ status: "PASS", output: outputPath,
  checkpoints: timeline.length, failure_windows: failureWindows.length,
  relay_starts: output.relay_starts, stale_inputs: output.stale_inputs }));
