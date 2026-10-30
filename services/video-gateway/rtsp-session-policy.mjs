// Long-lived camera RTSP sessions can stop producing media without closing
// their socket. The Home C211 has produced finite sessions as short as roughly
// nine minutes under the real qualification workload (and longer sessions in
// earlier observations). Replace a progressing session one measured minute
// before that shortest boundary; the old relay remains authoritative if the
// warm peer does not produce current HLS media.
export const DIRECT_RTSP_PROACTIVE_RELAY_HANDOFF_MS = 8 * 60 * 1000;
// In the 0.2.40 V8, healthy Tapo relays routinely had 1-2s output gaps and a
// measured warm candidate needed about 2.5s to publish its first output. A 4s
// trigger caused unnecessary replacement churn (511 warm handoffs/day) and
// two single-checkpoint ownership gaps. Eight seconds remains well inside the
// unchanged 20s hard-stale deadline while allowing a real warm start to settle.
export const DIRECT_RTSP_PROACTIVE_OUTPUT_IDLE_HANDOFF_MS = 8_000;
export const DIRECT_RTSP_MINIMUM_OUTPUT_RESCUE_AGE_MS = 10_000;

export function shouldProactivelyHandoffDirectRtspRelay(relay, now = Date.now()) {
  if (!relay?.progressing || relay?.warming || !Number.isFinite(relay.startedAt)) return false;
  const ageMs = now - relay.startedAt;
  const outputRescue = ageMs >= DIRECT_RTSP_MINIMUM_OUTPUT_RESCUE_AGE_MS
    && Number.isFinite(relay.lastOutputAt)
    && now - relay.lastOutputAt >= DIRECT_RTSP_PROACTIVE_OUTPUT_IDLE_HANDOFF_MS;
  return Boolean(outputRescue || relay.recoveryStable
    && ageMs >= DIRECT_RTSP_PROACTIVE_RELAY_HANDOFF_MS);
}
