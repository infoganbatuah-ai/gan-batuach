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
// The Home recorder's native live.mp4 response has a separately observed
// finite boundary of roughly three minutes. Refreshing only the login at four
// minutes leaves a media gap even though authentication remains valid. Warmly
// hand each progressing relay to a replacement with a full one-minute margin,
// without creating another recorder login.
export const PRIVATE_NVR_PROACTIVE_RELAY_HANDOFF_MS = 2 * 60 * 1000;
// Real Home canary evidence showed individual native responses becoming idle
// before the ordinary two-minute cadence while the shared recorder session and
// heartbeat remained healthy. Eight seconds is known normal recorder jitter
// and twenty seconds is the hard stale boundary, so begin a warm replacement
// after twelve idle seconds. Promotion still requires current HLS output and a
// failed warm-up leaves the existing relay untouched.
export const PRIVATE_NVR_PROACTIVE_IDLE_HANDOFF_MS = 12_000;
// A new login on the Home recorder was observed to retire media responses
// from the prior login after roughly fifty seconds. Keep one-at-a-time relay
// replacement, but drive the independent handoff scheduler quickly enough to
// move all sixteen possible channels inside that measured overlap window.
export const PRIVATE_NVR_RELAY_HANDOFF_TICK_MS = 2_000;

// A proactive login renewal starts the recorder's observed prior-login media
// retirement window. Relays still owned by the earlier epoch therefore take
// precedence over the ordinary finite-response refresh cadence. The caller
// drains this bounded set without inserting another scheduler-tick delay
// between channels.
export function shouldPrioritizePrivateNvrSessionHandoff({ relayEpoch,
  currentEpoch }) {
  return Boolean(Number.isInteger(relayEpoch) && Number.isInteger(currentEpoch)
    && relayEpoch < currentEpoch);
}

export function shouldProactivelyHandoffPrivateNvrRelay(relay, now = Date.now()) {
  return Boolean(relay?.progressing && relay?.recoveryStable && !relay?.warming
    && Number.isFinite(relay.startedAt)
    && (now - relay.startedAt >= PRIVATE_NVR_PROACTIVE_RELAY_HANDOFF_MS
      || Number.isFinite(relay.lastInputAt)
        && now - relay.lastInputAt >= PRIVATE_NVR_PROACTIVE_IDLE_HANDOFF_MS));
}

// Login/Heartbeat is the recorder's supported session-maintenance contract.
// A successful heartbeat means the current login remains authoritative; a
// second login was observed to retire every media response from the prior
// login and can therefore create a recorder-wide outage. Never rotate a login
// while any relay from that recorder is progressing. Background replacement
// is limited to an idle recorder session after corroborated heartbeat loss;
// active media/auth failures retain the separately bounded reactive path.
export function shouldProactivelyRefreshPrivateNvrSession(session, evidence = {},
  now = Date.now()) {
  return Boolean(session?.loginExclusivity === false
    && !session.refreshPromise
    && Number.isFinite(session.updatedAt)
    && now - session.updatedAt >= PRIVATE_NVR_PROACTIVE_RENEWAL_MS
    && Number(evidence.activeProgressingRelays || 0) === 0
    && Number(evidence.heartbeatConsecutiveFailures || 0)
      >= PRIVATE_NVR_COMMON_CAUSE_HEARTBEAT_FAILURES);
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
