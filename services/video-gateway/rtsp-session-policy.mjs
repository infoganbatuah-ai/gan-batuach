// Long-lived camera RTSP sessions can stop producing media without closing
// their socket. The Home C211 was observed doing this after roughly 36
// minutes. Replace a progressing session with an already-progressing peer
// before that boundary; the old relay remains authoritative if warm-up fails.
export const DIRECT_RTSP_PROACTIVE_RELAY_HANDOFF_MS = 25 * 60 * 1000;

export function shouldProactivelyHandoffDirectRtspRelay(relay, now = Date.now()) {
  return Boolean(relay?.progressing && relay?.recoveryStable && !relay?.warming
    && Number.isFinite(relay.startedAt)
    && now - relay.startedAt >= DIRECT_RTSP_PROACTIVE_RELAY_HANDOFF_MS);
}
