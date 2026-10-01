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
// The failed 0.2.36 pre-soak proved that elapsed time plus two playlist writes
// is not a safe handoff proof. It admitted up to four concurrent replacements,
// produced 437 relay starts in one hour, and exhausted a source long enough for
// a real CH3 playback failure. Require four distinct post-start playlist
// advances across at least six seconds. This is stronger media-continuity
// evidence than a pair of writes while still completing a nine-channel sweep
// well before the recorder's observed finite-response boundary.
export const PRIVATE_NVR_ROUTINE_HANDOFF_CONFIRMATION_MS = 6_000;
export const PRIVATE_NVR_ROUTINE_HANDOFF_MINIMUM_ADVANCES = 4;
// Recorder media concurrency is separate from login exclusivity. Login/Range
// and the model's documented sixteen-channel playback ceiling permit the nine
// qualified streams plus two bounded candidates. The 0.2.39 canary proved that
// one globally serialized candidate cannot drain nine synchronized finite
// responses before later sources become stale. Keep one routine lane and one
// independently reserved output-rescue lane; never return to the unbounded
// nine-candidate behavior that starved earlier releases.
export const PRIVATE_NVR_MAX_CONCURRENT_PROBATIONS = 2;
export const PRIVATE_NVR_MAX_ROUTINE_PROBATIONS = 1;
// The nine-channel live run measured routine first-output latency as high as
// 7.7 seconds. A fixed twelve-second probation could therefore expire before
// the unchanged six-second/four-advance continuity proof completed, even when
// the candidate was producing valid media. Bound acquisition separately and
// reserve sixteen seconds per serialized routine slot. A nine-source sweep is
// still bounded to 144 seconds, leaving margin before the recorder's observed
// roughly three-minute native-response boundary.
export const PRIVATE_NVR_ROUTINE_HANDOFF_ACQUISITION_MS = 9_000;
export const PRIVATE_NVR_ROUTINE_HANDOFF_PROBATION_MS = 16_000;
export const PRIVATE_NVR_ROUTINE_HANDOFF_BUDGET_MS =
  PRIVATE_NVR_ROUTINE_HANDOFF_PROBATION_MS;
// The signed 0.2.43 one-channel Home shadow kept HLS continuous, but six
// rejected routine candidates were launched in a seven-minute window. A
// rejected candidate is not evidence that the current progressing owner is
// unsafe. Keep that owner and bound another routine attempt to the ordinary
// twenty-second stale horizon. Output rescue remains independently eligible
// as soon as rendered media is stale, so this never delays a real outage.
export const PRIVATE_NVR_ROUTINE_HANDOFF_RETRY_BACKOFF_MS = 20_000;
// The live 0.2.41 proof showed that an output-rescue response can need about
// thirteen seconds before its first HLS segment and then remain continuously
// productive. Applying the routine lane's twelve-second scheduler budget to
// that independent rescue lane killed the candidate just before it could
// complete the unchanged six-second/four-advance confirmation contract. Keep
// acquisition and total probation separately bounded; this does not increase
// concurrency or relax the evidence required for ownership promotion.
export const PRIVATE_NVR_OUTPUT_RESCUE_ACQUISITION_MS = 14_000;
export const PRIVATE_NVR_OUTPUT_RESCUE_PROBATION_MS = 21_000;
// Rescue begins after twelve seconds of output idle. Preserve the old owner as
// a non-progressing identity anchor until the bounded rescue resolves, even
// though it is no longer selected as media. The 16-second extension beyond the
// ordinary stale boundary covers scheduler-tick jitter plus the full probation.
export const PRIVATE_NVR_OUTPUT_RESCUE_OWNER_GRACE_MS = 16_000;
// Routine handoff and direct-RTSP requests retain the original bounded wait.
// Output rescue uses the measured acquisition bound above, without extending
// unrelated request paths.
export const PRIVATE_NVR_WARM_HANDOFF_REQUEST_GRACE_MS = 8_000;
// A new login on the Home recorder was observed to retire media responses
// from the prior login after roughly fifty seconds. Keep one-at-a-time relay
// replacement, but drive the independent handoff scheduler quickly enough to
// move all sixteen possible channels inside that measured overlap window.
export const PRIVATE_NVR_RELAY_HANDOFF_TICK_MS = 2_000;

export function privateNvrProvisionalHandoffAllowed({ activeProbations,
  replacingExistingProbation = false,
  handoffMode = "ROUTINE_FINITE_RESPONSE",
  maximum = PRIVATE_NVR_MAX_CONCURRENT_PROBATIONS }) {
  const limit = handoffMode === "OUTPUT_RESCUE"
    ? maximum
    : Math.max(1, Math.min(maximum, PRIVATE_NVR_MAX_ROUTINE_PROBATIONS));
  return Boolean(!replacingExistingProbation
    && Number.isInteger(activeProbations) && activeProbations >= 0
    && Number.isInteger(maximum) && maximum > 0
    && activeProbations < limit);
}

export function privateNvrRoutineHandoffSchedule(startedAts, now = Date.now(), {
  renewalMs = PRIVATE_NVR_PROACTIVE_RELAY_HANDOFF_MS,
  slotBudgetMs = PRIVATE_NVR_ROUTINE_HANDOFF_BUDGET_MS
} = {}) {
  const deadlines = (Array.isArray(startedAts) ? startedAts : [])
    .filter(Number.isFinite)
    .map(startedAt => ({ startedAt, deadlineAt: startedAt + renewalMs }))
    .sort((left, right) => left.deadlineAt - right.deadlineAt);
  if (!deadlines.length || !Number.isFinite(now) || !Number.isFinite(slotBudgetMs)
    || slotBudgetMs <= 0) {
    return { ready: false, latestSafeStartAt: null, nextStartedAt: null,
      queued: deadlines.length };
  }
  const latestSafeStartAt = Math.min(...deadlines.map((entry, index) =>
    entry.deadlineAt - (index + 1) * slotBudgetMs));
  return { ready: now >= latestSafeStartAt, latestSafeStartAt,
    nextStartedAt: deadlines[0].startedAt, queued: deadlines.length };
}

export function privateNvrRoutineHandoffRetryAllowed(lastAttemptAt,
  now = Date.now(), retryBackoffMs = PRIVATE_NVR_ROUTINE_HANDOFF_RETRY_BACKOFF_MS) {
  return Boolean(Number.isFinite(now)
    && (!Number.isFinite(lastAttemptAt) || now - lastAttemptAt >= retryBackoffMs)
    && Number.isFinite(retryBackoffMs) && retryBackoffMs > 0);
}

export function privateNvrHandoffProbationDeadline({ handoffMode,
  probationStartedAt, firstOutputObservedAt = null,
  minimumConfirmationMs = PRIVATE_NVR_ROUTINE_HANDOFF_CONFIRMATION_MS }) {
  if (!Number.isFinite(probationStartedAt)) return null;
  if (handoffMode !== "OUTPUT_RESCUE") {
    if (!Number.isFinite(firstOutputObservedAt)) {
      return probationStartedAt + PRIVATE_NVR_ROUTINE_HANDOFF_ACQUISITION_MS;
    }
    return Math.min(
      probationStartedAt + PRIVATE_NVR_ROUTINE_HANDOFF_PROBATION_MS,
      firstOutputObservedAt + minimumConfirmationMs + 1_000);
  }
  if (!Number.isFinite(firstOutputObservedAt)) {
    return probationStartedAt + PRIVATE_NVR_OUTPUT_RESCUE_ACQUISITION_MS;
  }
  return Math.min(
    probationStartedAt + PRIVATE_NVR_OUTPUT_RESCUE_PROBATION_MS,
    firstOutputObservedAt + minimumConfirmationMs + 1_000);
}

export function comparePrivateNvrHandoffPriority(left, right) {
  const leftOutputAt = Number.isFinite(left?.lastOutputAt)
    ? left.lastOutputAt : Number.POSITIVE_INFINITY;
  const rightOutputAt = Number.isFinite(right?.lastOutputAt)
    ? right.lastOutputAt : Number.POSITIVE_INFINITY;
  if (leftOutputAt !== rightOutputAt) return leftOutputAt - rightOutputAt;
  const leftStartedAt = Number.isFinite(left?.startedAt)
    ? left.startedAt : Number.POSITIVE_INFINITY;
  const rightStartedAt = Number.isFinite(right?.startedAt)
    ? right.startedAt : Number.POSITIVE_INFINITY;
  return leftStartedAt - rightStartedAt;
}

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
  const outputRescue = ageMs >= PRIVATE_NVR_MINIMUM_OUTPUT_RESCUE_AGE_MS
    && Number.isFinite(relay.lastOutputAt)
    && now - relay.lastOutputAt >= PRIVATE_NVR_PROACTIVE_OUTPUT_IDLE_HANDOFF_MS;
  // Rendered-output loss is more urgent than the age-based finite-response
  // sweep. This also gives a genuinely stale older relay the separately
  // measured rescue acquisition budget instead of misclassifying it as a
  // routine replacement.
  if (outputRescue) return "OUTPUT_RESCUE";
  if (relay.recoveryStable && ageMs >= PRIVATE_NVR_PROACTIVE_RELAY_HANDOFF_MS) {
    return "ROUTINE_FINITE_RESPONSE";
  }
  return null;
}

export function shouldProactivelyHandoffPrivateNvrRelay(relay, now = Date.now()) {
  return privateNvrRelayHandoffMode(relay, now) !== null;
}

export function privateNvrRoutineHandoffConfirmed({ confirmationStartedAt,
  outputAdvanced, outputAdvanceCount = outputAdvanced ? 1 : 0,
  lastOutputAt, now = Date.now(),
  minimumConfirmationMs = PRIVATE_NVR_ROUTINE_HANDOFF_CONFIRMATION_MS,
  maximumOutputIdleMs = PRIVATE_NVR_PROACTIVE_OUTPUT_IDLE_HANDOFF_MS,
  minimumOutputAdvances = PRIVATE_NVR_ROUTINE_HANDOFF_MINIMUM_ADVANCES }) {
  return Boolean(outputAdvanced && outputAdvanceCount >= minimumOutputAdvances
    && Number.isFinite(confirmationStartedAt)
    && now - confirmationStartedAt >= minimumConfirmationMs
    && Number.isFinite(lastOutputAt)
    && now - lastOutputAt <= maximumOutputIdleMs);
}

// Ownership and media availability are deliberately separate during a warm
// handoff. The current relay remains authoritative until the replacement
// passes the full confirmation contract, but a replacement that is already
// producing current HLS is real media continuity and must not make the source
// or the whole Gateway appear offline.
export function privateNvrHandoffMediaContinuity({ currentProgressing,
  candidateProgressing }) {
  if (currentProgressing) return { progressing: true, owner: "CURRENT" };
  if (candidateProgressing) return { progressing: true, owner: "WARMING_CONTINUITY" };
  return { progressing: false, owner: "NONE" };
}

// The stale-owner monitor and the warm-handoff confirmation loop run
// independently. Once a bounded candidate is producing current media, the
// monitor must not remove the authoritative owner underneath that loop: doing
// so makes the confirmation fail its ownership check and tears down both
// relays. The handoff promise is the lifetime bound; without it, a candidate
// can never keep a stale owner alive.
export function shouldDeferPrivateNvrStaleOwnerTeardown({ handoffInFlight,
  candidateProgressing, currentOutputAt, relayStaleMs,
  requestGraceMs = PRIVATE_NVR_WARM_HANDOFF_REQUEST_GRACE_MS,
  now = Date.now() }) {
  if (!handoffInFlight) return false;
  if (candidateProgressing) return true;
  return Number.isFinite(currentOutputAt) && Number.isFinite(relayStaleMs) &&
    relayStaleMs > 0 && now - currentOutputAt < relayStaleMs + requestGraceMs;
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
