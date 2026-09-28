// Long-lived camera RTSP sessions can stop producing media without closing
// their socket. The Home C211 has produced finite sessions as short as roughly
// nine minutes under the real qualification workload (and longer sessions in
// earlier observations). Replace a progressing session one measured minute
// before that shortest boundary; the old relay remains authoritative if the
// warm peer does not produce current HLS media.
export const DIRECT_RTSP_PROACTIVE_RELAY_HANDOFF_MS = 8 * 60 * 1000;

export function shouldProactivelyHandoffDirectRtspRelay(relay, now = Date.now()) {
  return Boolean(relay?.progressing && relay?.recoveryStable && !relay?.warming
    && Number.isFinite(relay.startedAt)
    && now - relay.startedAt >= DIRECT_RTSP_PROACTIVE_RELAY_HANDOFF_MS);
}
