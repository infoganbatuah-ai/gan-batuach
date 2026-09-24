// An empty relay set is not proof of expired authentication. Native streams
// can all end together at the recorder's finite response boundary.
export function reuseMatchingPrivateNvrSession(existing, input) {
  return Boolean(existing?.input && existing.input.password === input?.password
    && (existing.input.stream_quality || "sub") === (input?.stream_quality || "sub")
    && existing.input.username === input.username);
}

export const PRIVATE_NVR_COMMON_CAUSE_HEARTBEAT_FAILURES = 3;
export const PRIVATE_NVR_COMMON_CAUSE_SOURCE_FAILURES = 2;
export const PRIVATE_NVR_PROACTIVE_RENEWAL_MS = 4 * 60 * 1000;

// The Home recorder's own Login/Range contract explicitly reports that
// simultaneous logins are permitted. A bounded renewal before the observed
// idle-session expiry gives future stream opens a fresh login without tearing
// down streams that are already receiving media. Unknown/exclusive recorders
// keep the reactive recovery path only.
export function shouldProactivelyRefreshPrivateNvrSession(session, now = Date.now()) {
  return Boolean(session?.loginExclusivity === false
    && !session.refreshPromise
    && Number.isFinite(session.updatedAt)
    && now - session.updatedAt >= PRIVATE_NVR_PROACTIVE_RENEWAL_MS);
}

// A proactive non-exclusive renewal is not evidence that an established HTTP
// media response became unsafe. Preserve only an older relay from the same
// recorder session key while it is still making progress. Reactive/auth
// replacement clears the grace boundary and therefore invalidates old relays.
export function relayMaySurvivePrivateNvrRenewal({ sameToken, sameSessionKey,
  relayProgressing, relayEpoch, currentEpoch, preserveRelayEpochsThrough }) {
  if (sameToken) return true;
  return Boolean(sameSessionKey && relayProgressing
    && Number.isInteger(relayEpoch) && Number.isInteger(currentEpoch)
    && Number.isInteger(preserveRelayEpochsThrough)
    && relayEpoch < currentEpoch
    && relayEpoch <= preserveRelayEpochsThrough);
}

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
