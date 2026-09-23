// An empty relay set is not proof of expired authentication. Native streams
// can all end together at the recorder's finite response boundary.
export function reuseMatchingPrivateNvrSession(existing, input) {
  return Boolean(existing?.input && existing.input.password === input?.password
    && (existing.input.stream_quality || "sub") === (input?.stream_quality || "sub")
    && existing.input.username === input.username);
}

export const PRIVATE_NVR_COMMON_CAUSE_HEARTBEAT_FAILURES = 3;
export const PRIVATE_NVR_COMMON_CAUSE_SOURCE_FAILURES = 2;

// Ordinary transport, finite native-stream, and camera-specific non-media
// responses must not rotate a recorder login shared by every channel. A
// bounded replacement is allowed only when the recorder heartbeat and more
// than one channel independently prove the same session is no longer usable.
// refreshPrivateNvrSession serializes that replacement, so eight failed
// channels still produce one login rather than a session-invalidating storm.
export function shouldRefreshPrivateNvrSession(failure, evidence = {}) {
  if (failure === "authentication_rejected") return true;
  if (failure !== "source_not_media") return false;
  return Number(evidence.heartbeatConsecutiveFailures || 0) >= PRIVATE_NVR_COMMON_CAUSE_HEARTBEAT_FAILURES
    && Number(evidence.commonCauseSourceFailures || 0) >= PRIVATE_NVR_COMMON_CAUSE_SOURCE_FAILURES;
}
