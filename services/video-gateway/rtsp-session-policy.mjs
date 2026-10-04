// Long-lived camera RTSP sessions can stop producing media without closing
// their socket. The Home C211 has produced finite sessions as short as roughly
// nine minutes under the real qualification workload (and longer sessions in
// earlier observations). Replace a progressing session one measured minute
// before that shortest boundary; the old relay remains authoritative if the
// warm peer does not produce current HLS media.
export const DIRECT_RTSP_PROACTIVE_RELAY_HANDOFF_MS = 8 * 60 * 1000;
export const DIRECT_RTSP_PROACTIVE_OUTPUT_IDLE_HANDOFF_MS = 4_000;
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
