import { readFileSync, writeFileSync } from "node:fs";

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error("usage: analyze-push38-v7.mjs checkpoints.ndjson timeline.json");
const points = readFileSync(input, "utf8").trim().split("\n").map(line => JSON.parse(line));
const failures = [];
const windows = { dvr: [], tapo: [], component_gateway: [], component_connector: [], ai: [], monitor: [] };
const bad = (point, kind) => kind === "dvr" ? point.dvr.progressing !== 10 : kind === "tapo" ? point.tapo.progressing !== 1
  : kind === "component_gateway" ? point.dvr.health_ok !== true : kind === "component_connector" ? point.tapo.health_ok !== true
  : kind === "ai" ? point.ai?.ok === false : point.deep_probe_error != null;
for (const kind of Object.keys(windows)) {
  let active = null;
  for (let index = 0; index < points.length; index++) {
    const point = points[index];
    if (!bad(point, kind)) {
      if (active) {
        active.observed_until_next_good_ms = Date.parse(point.sampled_at) - Date.parse(active.first_bad_at);
        active.last_bad_at = points[index - 1].sampled_at;
        active.minimum_observed_ms = Date.parse(active.last_bad_at) - Date.parse(active.first_bad_at);
        windows[kind].push(active);
        active = null;
      }
      continue;
    }
    if (!active) active = { first_bad_at: point.sampled_at, first_sequence: point.sequence, checkpoints: 0 };
    active.checkpoints++;
    failures.push({ kind, sequence: point.sequence, at: point.sampled_at,
      dvr_progressing: point.dvr.progressing, dvr_failed_discovery: point.dvr.failed,
      dvr_health_ok: point.dvr.health_ok, dvr_health_error: point.dvr.health_error,
      dvr_channels_present: point.dvr.inputs?.map(input => input.channel) ?? [],
      dvr_lifecycle: point.dvr.lifecycle, recorder_session: point.dvr.recorder_session,
      tapo_progressing: point.tapo.progressing, tapo_health_ok: point.tapo.health_ok,
      tapo_health_error: point.tapo.health_error, tapo_lifecycle: point.tapo.lifecycle,
      gateway_pid: point.resources?.gateway?.runtime_pid, connector_pid: point.resources?.connector?.runtime_pid,
      gateway_cpu_percent: point.resources?.gateway?.total_cpu_percent, connector_cpu_percent: point.resources?.connector?.total_cpu_percent,
      gateway_rss_mb: point.resources?.gateway?.total_rss_mb, connector_rss_mb: point.resources?.connector?.total_rss_mb,
      gateway_handles: point.resources?.gateway?.open_handles, connector_handles: point.resources?.connector?.open_handles,
      gateway_queue_depth: point.runtime_state?.gateway?.offline_buffer?.queue_depth,
      connector_queue_depth: point.runtime_state?.connector?.offline_buffer?.queue_depth,
      playback_probe: point.playback ?? null, ai_probe: point.ai ?? null,
      gateway_log_end_bytes: point.logs?.gateway_bytes, connector_log_end_bytes: point.logs?.connector_bytes,
      recovery_action: "not_recorded_in_v7", recovery_result: "inferred_only_from_next_good_checkpoint" });
  }
  if (active) {
    active.last_bad_at = points.at(-1).sampled_at;
    active.minimum_observed_ms = Date.parse(active.last_bad_at) - Date.parse(active.first_bad_at);
    active.observed_until_next_good_ms = null;
    windows[kind].push(active);
  }
}
const gaps = points.slice(1).flatMap((point, index) => {
  const milliseconds = Date.parse(point.sampled_at) - Date.parse(points[index].sampled_at);
  return milliseconds > 150_000 ? [{ previous_sequence: points[index].sequence, next_sequence: point.sequence, previous_at: points[index].sampled_at, next_at: point.sampled_at, milliseconds }] : [];
});
const result = { contract: "observer-push38-v7-failure-analysis-v1", source: input, checkpoints: points.length,
  first_checkpoint_at: points[0].sampled_at, last_checkpoint_at: points.at(-1).sampled_at,
  windows, failed_checkpoint_details: failures.sort((a, b) => a.sequence - b.sequence || a.kind.localeCompare(b.kind)),
  monitor_gaps_over_150s: gaps,
  limitations: ["v7 DVR per-input progression absent; channel-specific downtime unknown", "local logs have no timestamps; cannot align a line to one failed checkpoint", "outage duration between minute probes is bounded, not exact", "monitor misses cannot be retroactively classified as product failures"] };
writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, { flag: "wx", mode: 0o600 });
console.log(JSON.stringify({ windows: Object.fromEntries(Object.entries(windows).map(([key, values]) => [key, values.length])), failed_checkpoint_records: failures.length, gaps }));
