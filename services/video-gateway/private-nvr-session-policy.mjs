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
// Retain the historical two-minute cadence as a measured scheduling datum.
// It is no longer, by itself, authority to replace a healthy relay (see the
// evidence-bound switch immediately below).
export const PRIVATE_NVR_PROACTIVE_RELAY_HANDOFF_MS = 2 * 60 * 1000;
// The live nine-source 0.2.46 canary disproved relay age as a reliable signal
// for this recorder: established responses stayed productive for 12+ minutes,
// while age-only maintenance launched 49 routine candidates in ten minutes.
// Those candidates were followed by 27 rescue attempts and one real source
// gap, despite a healthy recorder session and zero socket/auth failures. Keep
// the historical cadence constant for evidence/scheduling tests, but disable
// age-only ownership changes. Actual input/output cessation still enters the
// independently bounded OUTPUT_RESCUE path below.
export const PRIVATE_NVR_ROUTINE_AGE_HANDOFF_ENABLED = false;
// Real Home evidence shows the recorder can pause both HTTP input and rendered
// HLS output for more than four seconds and then resume the same response. Idle
// timestamps therefore cannot prove that a finite native response ended. The
// stream pump records the actual ReadableStream end separately. After that
// authoritative event, preserve four seconds of buffered HLS drain before a
// bounded replacement. A later signed shadow also measured a 22-second joint
// input/output pause: waiting for the hard-stale boundary tore down the owner
// before a replacement could publish current HLS. Start one non-destructive
// rescue probe before the rendered-output freshness boundary. The signed
// 0.2.53 Home shadow measured a 10.136-second playlist freeze when the prior
// five-second trigger combined with 5.043 seconds of replacement acquisition.
// Start the non-destructive probe after three seconds instead. The separately
// measured 5.329-second worst-case first-output latency then remains inside the
// unchanged ten-second HLS freshness proof only when scheduler detection is
// included in the deadline. The signed 0.2.54 shadow caught the missing term:
// a two-second scheduler tick plus acquisition produced a real 10.060-second
// playlist freeze. Poll the bounded handoff scheduler every second so the
// complete measured bound is 3.000 + 1.000 + 5.329 = 9.329 seconds, without
// changing the HLS freshness threshold or the ownership proof.
// Canonical ownership
// still changes only after four advances across six seconds, so a burst pause
// cannot be mistaken for an authoritative native response end.
export const PRIVATE_NVR_PROACTIVE_OUTPUT_IDLE_HANDOFF_MS = 12_000;
export const PRIVATE_NVR_OUTPUT_RESCUE_TRIGGER_MS = 3_000;
export const PRIVATE_NVR_NATIVE_RESPONSE_END_OUTPUT_GRACE_MS = 4_000;
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
// responses before later sources become stale. When age-only maintenance is
// enabled, keep one routine lane and one independently reserved output-rescue
// lane. When it is disabled, both recorder-safe lanes may serve output rescue;
// never return to the unbounded nine-candidate behavior that starved earlier
// releases.
export const PRIVATE_NVR_MAX_CONCURRENT_PROBATIONS = 2;
export const PRIVATE_NVR_MAX_ROUTINE_PROBATIONS = 1;
// The nine-channel live run measured routine first-output latency as high as
// 7.7 seconds. A fixed twelve-second probation could therefore expire before
// the unchanged six-second/four-advance continuity proof completed, even when
// the candidate was producing valid media. Bound acquisition separately and
// reserve eighteen seconds per serialized routine slot. A nine-source sweep
// is still bounded to 162 seconds, leaving margin before the recorder's
// observed roughly three-minute native-response boundary.
export const PRIVATE_NVR_ROUTINE_HANDOFF_ACQUISITION_MS = 9_000;
// Real routine candidates produced valid playlist advances, but the previous
// first-output+7 s deadline expired about 0.1 s before the next cadence
// boundary could prove the six-second contract. Keep that bounded cadence
// grace for routine maintenance. Output rescue has a separately measured total
// probation below because its confirmation cadence is not routine scheduling.
export const PRIVATE_NVR_ROUTINE_HANDOFF_CONFIRMATION_GRACE_MS = 2_000;
export const PRIVATE_NVR_ROUTINE_HANDOFF_PROBATION_MS = 18_000;
export const PRIVATE_NVR_ROUTINE_HANDOFF_BUDGET_MS =
  PRIVATE_NVR_ROUTINE_HANDOFF_PROBATION_MS;
// The signed 0.2.43 one-channel Home shadow kept HLS continuous, but six
// rejected routine candidates were launched in a seven-minute window. A
// rejected candidate is not evidence that the current progressing owner is
// unsafe. Keep that owner and do not let the same source re-enter the single
// routine lane until the recorder's observed finite-response horizon has
// elapsed. This lets a complete nine-source sweep drain instead of allowing
// one rejected source to starve later cameras. Output rescue remains
// independently eligible as soon as rendered media is stale, so this never
// delays a real outage.
export const PRIVATE_NVR_ROUTINE_HANDOFF_RETRY_BACKOFF_MS = 180_000;
// The live 0.2.41 proof showed that an output-rescue response can need about
// thirteen seconds before its first HLS segment and then remain continuously
// productive. Applying the routine lane's twelve-second scheduler budget to
// that independent rescue lane killed the candidate just before it could
// complete the unchanged six-second/four-advance confirmation contract. The
// two-channel Home shadow then measured a rescue that emitted first output in
// 3.256 seconds and three advances, but was rejected at the clipped
// first-output+8 s sub-deadline before the next cadence boundary. Keep
// acquisition and total probation separately bounded: before first output the
// fourteen-second acquisition limit applies; after first output the original
// twenty-one-second total limit is authoritative. This does not increase
// concurrency or relax the evidence required for ownership promotion.
export const PRIVATE_NVR_OUTPUT_RESCUE_ACQUISITION_MS = 14_000;
export const PRIVATE_NVR_OUTPUT_RESCUE_PROBATION_MS = 21_000;
// A rejected rescue candidate can leave the original owner healthy and
// progressing. Do not immediately open another recorder response in that
// case: the signed Home shadow proved that such back-to-back probes add churn
// without improving HLS continuity. Hard-stale media bypasses this delay so a
// real outage still enters the existing bounded recovery path promptly.
export const PRIVATE_NVR_OUTPUT_RESCUE_RETRY_BACKOFF_MS = 60_000;
// Rescue begins after five seconds of output idle. Preserve the old owner as
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
export const PRIVATE_NVR_RELAY_HANDOFF_TICK_MS = 1_000;

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

export function privateNvrHandoffCapacityAllowed({ activeProbations,
  activeRoutineProbations, activeRescueProbations, handoffMode,
  replacingExistingProbation = false,
  routineAgeHandoffEnabled = PRIVATE_NVR_ROUTINE_AGE_HANDOFF_ENABLED,
  maximum = PRIVATE_NVR_MAX_CONCURRENT_PROBATIONS,
  routineMaximum = PRIVATE_NVR_MAX_ROUTINE_PROBATIONS }) {
  const activeModeProbations = handoffMode === "OUTPUT_RESCUE"
    ? activeRescueProbations : activeRoutineProbations;
  // When age-only maintenance is disabled, there is no routine candidate to
  // reserve a lane for. Let the bounded rescue path use both recorder-safe
  // probation slots so synchronized finite responses do not queue behind a
  // lane that cannot run. The global maximum remains authoritative.
  const modeMaximum = handoffMode === "OUTPUT_RESCUE" && !routineAgeHandoffEnabled
    ? maximum : routineMaximum;
  return privateNvrProvisionalHandoffAllowed({ activeProbations, maximum,
    replacingExistingProbation, handoffMode: "OUTPUT_RESCUE" })
    && privateNvrProvisionalHandoffAllowed({
      activeProbations: activeModeProbations, maximum: modeMaximum,
      replacingExistingProbation, handoffMode
    });
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

export function privateNvrOutputRescueRetryAllowed(lastFailureAt,
  now = Date.now(), { hardStale = false,
    retryBackoffMs = PRIVATE_NVR_OUTPUT_RESCUE_RETRY_BACKOFF_MS } = {}) {
  return Boolean(hardStale || Number.isFinite(now)
    && (!Number.isFinite(lastFailureAt) || now - lastFailureAt >= retryBackoffMs)
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
      firstOutputObservedAt + minimumConfirmationMs
        + PRIVATE_NVR_ROUTINE_HANDOFF_CONFIRMATION_GRACE_MS);
  }
  if (!Number.isFinite(firstOutputObservedAt)) {
    return probationStartedAt + PRIVATE_NVR_OUTPUT_RESCUE_ACQUISITION_MS;
  }
  return probationStartedAt + PRIVATE_NVR_OUTPUT_RESCUE_PROBATION_MS;
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
  if (!relay || relay.warming || !Number.isFinite(relay.startedAt)) return null;
  const ageMs = now - relay.startedAt;
  const outputIdleMs = Number.isFinite(relay.lastOutputAt)
    ? now - relay.lastOutputAt : Number.POSITIVE_INFINITY;
  const relayStaleMs = Number.isFinite(relay.relayStaleMs) && relay.relayStaleMs > 0
    ? relay.relayStaleMs : 20_000;
  const finiteResponseEnded = relay.nativeInputEnded === true
    && outputIdleMs >= PRIVATE_NVR_NATIVE_RESPONSE_END_OUTPUT_GRACE_MS;
  const continuityAtRisk = outputIdleMs >= PRIVATE_NVR_OUTPUT_RESCUE_TRIGGER_MS;
  const hardStale = outputIdleMs >= relayStaleMs;
  const outputRescue = ageMs >= PRIVATE_NVR_MINIMUM_OUTPUT_RESCUE_AGE_MS
    && Number.isFinite(relay.lastOutputAt)
    && (finiteResponseEnded || continuityAtRisk || hardStale);
  // Rendered-output loss is more urgent than the age-based finite-response
  // sweep. This also gives a genuinely stale older relay the separately
  // measured rescue acquisition budget instead of misclassifying it as a
  // routine replacement.
  if (outputRescue) return "OUTPUT_RESCUE";
  if (!relay.progressing) return null;
  if (PRIVATE_NVR_ROUTINE_AGE_HANDOFF_ENABLED
    && relay.recoveryStable && ageMs >= PRIVATE_NVR_PROACTIVE_RELAY_HANDOFF_MS) {
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

// Some recorders permit one productive HTTP media response per channel while
// still accepting a second request far enough to emit an initial playlist.
// A concurrent OUTPUT_RESCUE probe can therefore look alive without ever
// advancing. Once the old owner is already hard stale, keeping it open and
// launching further concurrent probes only creates a restart storm. Permit a
// single controlled owner-release fallback only for that exact evidence. The
// already-open candidate becomes the exclusive response after owner release;
// killing it and opening a third response creates a measured acquisition gap.
// The retained candidate still has to pass the unchanged sustained-output
// contract from a fresh post-release observation window.
export function shouldUsePrivateNvrExclusiveOutputRescue({ handoffMode,
  sourceKind, ownerRunning, ownerCurrent, ownerOutputAt, relayStaleMs,
  candidateRunning, candidateFirstOutputObserved, candidateConfirmed,
  now = Date.now() }) {
  return Boolean(handoffMode === "OUTPUT_RESCUE"
    && sourceKind === "private_nvr_http_mp4"
    && ownerRunning && ownerCurrent && candidateRunning
    && candidateFirstOutputObserved && !candidateConfirmed
    && Number.isFinite(ownerOutputAt) && Number.isFinite(relayStaleMs)
    && relayStaleMs > 0 && Number.isFinite(now)
    && now - ownerOutputAt >= relayStaleMs);
}

// Ownership and media availability are deliberately separate during a warm
// handoff. The current relay remains authoritative until the replacement
// passes the full confirmation contract, but a replacement that is already
// producing current HLS is real media continuity and must not make the source
// or the whole Gateway appear offline.
export function privateNvrHandoffMediaContinuity({ currentProgressing,
  candidateProgressing, handoffMode = null, currentOutputAt = null,
  candidateOutputAt = null, now = Date.now(),
  mediaTakeoverIdleMs = PRIVATE_NVR_OUTPUT_RESCUE_TRIGGER_MS }) {
  const warmingMediaNewer = handoffMode === "OUTPUT_RESCUE"
    && currentProgressing && candidateProgressing
    && Number.isFinite(currentOutputAt) && Number.isFinite(candidateOutputAt)
    && Number.isFinite(now) && Number.isFinite(mediaTakeoverIdleMs)
    && mediaTakeoverIdleMs > 0 && now - currentOutputAt >= mediaTakeoverIdleMs
    && candidateOutputAt > currentOutputAt;
  if (warmingMediaNewer) return { progressing: true, owner: "CURRENT",
    mediaOwner: "WARMING_CONTINUITY" };
  if (currentProgressing) return { progressing: true, owner: "CURRENT",
    mediaOwner: "CURRENT" };
  if (candidateProgressing) return { progressing: true,
    owner: "WARMING_CONTINUITY", mediaOwner: "WARMING_CONTINUITY" };
  return { progressing: false, owner: "NONE", mediaOwner: "NONE" };
}

// The stale-owner monitor and the warm-handoff confirmation loop run
// independently. Once a bounded candidate is producing current media, the
// monitor must not remove the authoritative owner underneath that loop: doing
// so makes the confirmation fail its ownership check and tears down both
// relays. The handoff promise is the lifetime bound; without it, a candidate
// can never keep a stale owner alive.
export function shouldDeferPrivateNvrStaleOwnerTeardown({ handoffInFlight,
  candidateProgressing, currentOutputAt, relayStaleMs,
  preserveOwnerUntilHandoffSettles = false,
  requestGraceMs = PRIVATE_NVR_WARM_HANDOFF_REQUEST_GRACE_MS,
  now = Date.now() }) {
  if (!handoffInFlight) return false;
  if (candidateProgressing || preserveOwnerUntilHandoffSettles) return true;
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
