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
// Real Home evidence shows the recorder can pause HTTP input while FFmpeg is
// still producing current HLS output from already-buffered media. Input idle
// alone is therefore not a handoff signal. Conversely, current input with a
// frozen rendered playlist is an output-path failure and must not wait for the
// twenty-second hard-stale boundary. Live Home canary evidence showed that a
// four-second warning window was shorter than normal recorder/HLS cadence: it
// caused 197 relay starts in fifteen minutes and one qualified-channel outage.
// Require twelve continuous output-idle seconds, leaving eight seconds before
// the hard-stale boundary for the bounded warm replacement to become current.
export const PRIVATE_NVR_PROACTIVE_OUTPUT_IDLE_HANDOFF_MS = 12_000;
export const PRIVATE_NVR_MINIMUM_OUTPUT_RESCUE_AGE_MS = 10_000;
// A private-recorder response can stop delivering bytes even though the login
// remains valid.  A replacement response is therefore allowed to probe that
// condition before the hard-stale boundary.  The replacement is promoted only
// provisionally and the old relay remains available throughout probation.
// This avoids both the no-rescue regression caused by an input-freshness gate
// and the earlier false promotion after only two playlist writes.
export const PRIVATE_NVR_ROUTINE_HANDOFF_CONFIRMATION_MS = 20_000;
// Output rescue begins after twelve seconds without rendered HLS progress,
// leaving eight seconds before the ordinary twenty-second stale boundary.
// If an already-running warm replacement has not promoted by that boundary,
// a playback request may wait through one additional bounded eight-second
// interval instead of tearing down the only relay while its successor starts.
export const PRIVATE_NVR_WARM_HANDOFF_REQUEST_GRACE_MS = 8_000;
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

export function privateNvrRelayHandoffMode(relay, now = Date.now()) {
  if (!relay?.progressing || relay?.warming || !Number.isFinite(relay.startedAt)) return null;
  const ageMs = now - relay.startedAt;
  if (relay.recoveryStable && ageMs >= PRIVATE_NVR_PROACTIVE_RELAY_HANDOFF_MS) {
    return "ROUTINE_FINITE_RESPONSE";
  }
  const outputRescue = ageMs >= PRIVATE_NVR_MINIMUM_OUTPUT_RESCUE_AGE_MS
    && Number.isFinite(relay.lastOutputAt)
    && now - relay.lastOutputAt >= PRIVATE_NVR_PROACTIVE_OUTPUT_IDLE_HANDOFF_MS;
  return outputRescue ? "OUTPUT_RESCUE" : null;
}

export function shouldProactivelyHandoffPrivateNvrRelay(relay, now = Date.now()) {
  return privateNvrRelayHandoffMode(relay, now) !== null;
}

export function privateNvrRoutineHandoffConfirmed({ confirmationStartedAt,
  outputAdvanced, lastOutputAt, now = Date.now(),
  minimumConfirmationMs = PRIVATE_NVR_ROUTINE_HANDOFF_CONFIRMATION_MS,
  maximumOutputIdleMs = PRIVATE_NVR_PROACTIVE_OUTPUT_IDLE_HANDOFF_MS }) {
  return Boolean(outputAdvanced
    && Number.isFinite(confirmationStartedAt)
    && now - confirmationStartedAt >= minimumConfirmationMs
    && Number.isFinite(lastOutputAt)
    && now - lastOutputAt <= maximumOutputIdleMs);
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
