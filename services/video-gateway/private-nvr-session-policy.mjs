// An empty relay set is not proof of expired authentication. Native streams
// can all end together at the recorder's finite response boundary.
export function reuseMatchingPrivateNvrSession(existing, input) {
  return Boolean(existing?.input && existing.input.password === input?.password
    && (existing.input.stream_quality || "sub") === (input?.stream_quality || "sub")
    && existing.input.username === input.username);
}

export const PRIVATE_NVR_COMMON_CAUSE_HEARTBEAT_FAILURES = 3;
export const PRIVATE_NVR_COMMON_CAUSE_SOURCE_FAILURES = 2;
// The signed 0.2.66 Home Shadow measured the second productive response stop
// at 237.446 seconds of relay age. The live 0.2.67 pre-soak then proved that a
// new login can keep per-channel replacement requests open without media until
// the prior response closes. A complete nine-source serialized sweep therefore
// needs ten bounded acquisition slots: one concurrent observation, one reuse
// after releasing that owner, and eight direct exclusive replacements. Start
// renewal at two minutes so the measured response horizon leaves 117 seconds:
// 90 seconds for those slots plus 10 seconds for scheduler/Login jitter, with a
// final 17-second evidence margin. This changes lifecycle scheduling only; it
// does not relax freshness, health, or handoff-confirmation requirements.
export const PRIVATE_NVR_OBSERVED_MEDIA_RESPONSE_RETIREMENT_MS = 237_000;
export const PRIVATE_NVR_PROACTIVE_RENEWAL_MS = 2 * 60 * 1000;
export const PRIVATE_NVR_EXCLUSIVE_SESSION_SWEEP_BUDGET_MS = 90_000;
export const PRIVATE_NVR_SESSION_SWEEP_CONTROL_MARGIN_MS = 10_000;
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
// A socket close is only the recorder's measured finite-response boundary
// after the response has carried sustained media. Prime the next login at that
// exact boundary so the recovery relay does not have to fail once on the
// already-retired token before it can reopen. Early socket loss remains an
// ordinary transport failure and never rotates recorder authentication.
export const PRIVATE_NVR_RESPONSE_RETIREMENT_PRIME_MINIMUM_MS = 60_000;
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

export function privateNvrExclusiveRescueContinuationStalled({
  lastAdvanceObservedAt, now = Date.now(),
  maximumNoAdvanceMs = PRIVATE_NVR_OUTPUT_RESCUE_TRIGGER_MS
}) {
  return Boolean(Number.isFinite(lastAdvanceObservedAt) && Number.isFinite(now)
    && Number.isFinite(maximumNoAdvanceMs) && maximumNoAdvanceMs > 0
    && now - lastAdvanceObservedAt >= maximumNoAdvanceMs);
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
  currentEpoch, relayProgressing = false, preserveRelayEpochsThrough = null }) {
  const preservedProgressingOwner = relayProgressing
    && Number.isInteger(preserveRelayEpochsThrough)
    && Number.isInteger(relayEpoch)
    && relayEpoch <= preserveRelayEpochsThrough;
  return Boolean(!preservedProgressingOwner
    && Number.isInteger(relayEpoch) && Number.isInteger(currentEpoch)
    && relayEpoch < currentEpoch);
}

// The owned Home recorder proved a one-productive-response boundary per
// channel during proactive login renewal: a candidate request can stay open
// without media until the prior response is released. After that behavior is
// observed once, later stale-epoch channels use a serialized exclusive sweep
// instead of spending the recorder's finite prior-login overlap on candidates
// that cannot publish. This remains limited to a newer authenticated session;
// it is never authority to replace a current-epoch owner.
export function shouldUsePrivateNvrExclusiveSessionSweep({
  handoffMode, sourceKind, exclusiveBoundaryObserved = false,
  ownerRunning, ownerCurrent, candidateRunning = false,
  candidateConfirmed = false, candidateAcquisitionFailed = false,
  candidateFailure = null, ownerProgressing = false, relayEpoch, currentEpoch
}) {
  const recorderWithheldCandidate = candidateRunning && !candidateConfirmed;
  const recorderRejectedConcurrentAcquisition = candidateAcquisitionFailed
    && candidateFailure === "source_timeout" && ownerProgressing;
  return Boolean(["SESSION_SWEEP", "SESSION_SWEEP_EXCLUSIVE"].includes(handoffMode)
    && sourceKind === "private_nvr_http_mp4"
    && (exclusiveBoundaryObserved || recorderWithheldCandidate
      || recorderRejectedConcurrentAcquisition)
    && ownerRunning && ownerCurrent
    && Number.isInteger(relayEpoch) && Number.isInteger(currentEpoch)
    && relayEpoch < currentEpoch);
}

// A proactive Login refresh and an output rescue must never compete for the
// same old session epoch. While the bounded refresh is in flight, retain the
// still-authoritative owner; success immediately moves it into SESSION_SWEEP,
// while failure clears the promise and restores ordinary output-rescue
// eligibility. A relay already behind the current epoch is handled by the
// higher-priority sweep and is not deferred here.
export function shouldDeferPrivateNvrOutputRescueForSessionRenewal({
  refreshPending, relayEpoch, currentEpoch
}) {
  return Boolean(refreshPending
    && Number.isInteger(relayEpoch) && Number.isInteger(currentEpoch)
    && relayEpoch === currentEpoch);
}

export function privateNvrRelayHandoffMode(relay, now = Date.now()) {
  if (!relay || relay.warming || !Number.isFinite(relay.startedAt)) return null;
  const ageMs = now - relay.startedAt;
  const outputIdleMs = Number.isFinite(relay.lastOutputAt)
    ? now - relay.lastOutputAt : Number.POSITIVE_INFINITY;
  const finiteResponseEnded = relay.nativeInputEnded === true
    && outputIdleMs >= PRIVATE_NVR_NATIVE_RESPONSE_END_OUTPUT_GRACE_MS;
  // Neither rendered-output idle nor joint input/output idle proves this
  // recorder's response retired: the real Home recorder resumed after both,
  // and a soft-idle probe later contaminated an otherwise healthy response.
  // Only an observed body end may start replacement. The real Home recorder
  // resumed after both soft and hard output-idle boundaries, and probing at
  // either boundary contaminated the still-authoritative response. The body
  // or socket termination drives the existing recovery path; retained HLS
  // covers the bounded reopen gap.
  const outputRescue = ageMs >= PRIVATE_NVR_MINIMUM_OUTPUT_RESCUE_AGE_MS
    && Number.isFinite(relay.lastOutputAt)
    && finiteResponseEnded;
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

export function shouldPrimePrivateNvrSessionForResponseRetirement({
  sourceKind, inputErrorCode = null, sourceEnded = false,
  sustainedMedia = false, ownerCurrent = false,
  warming = false, relayAgeMs = 0,
  minimumAgeMs = PRIVATE_NVR_RESPONSE_RETIREMENT_PRIME_MINIMUM_MS
} = {}) {
  return Boolean(sourceKind === "private_nvr_http_mp4"
    && (sourceEnded || inputErrorCode === "UND_ERR_SOCKET")
    && sustainedMedia && ownerCurrent && !warming
    && Number.isFinite(relayAgeMs) && Number.isFinite(minimumAgeMs)
    && minimumAgeMs > 0 && relayAgeMs >= minimumAgeMs);
}

// Playback, AI, learning, and health all converge on ensureRelay. None may
// turn a bursty recorder pause into an independent relay lifecycle. Keep the
// canonical owner while the actual response remains open and the recorder
// heartbeat is healthy. A body/socket boundary or corroborated heartbeat loss
// releases this guard and reuses the normal bounded recovery path.
export function shouldRetainPrivateNvrOwnerOnDemand({ sourceKind,
  ownerRunning = false, belongsToCurrentSession = false,
  sessionSweepPending = false,
  nativeInputEnded = false, inputFailed = false,
  heartbeatConsecutiveFailures = 0 } = {}) {
  return Boolean(sourceKind === "private_nvr_http_mp4" && ownerRunning
    && (belongsToCurrentSession || sessionSweepPending)
    && !nativeInputEnded && !inputFailed
    && Number(heartbeatConsecutiveFailures || 0)
      < PRIVATE_NVR_COMMON_CAUSE_HEARTBEAT_FAILURES);
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

// Some recorders permit only one productive HTTP media response per channel.
// They may accept a second request while withholding its body until the first
// response closes, so "candidate acquired and still running" is the strongest
// continuity evidence available before releasing an already hard-stale owner.
// Waiting for a first candidate playlist in that state is circular: the first
// playlist cannot exist until the stale owner releases the recorder slot.
// Permit one controlled owner release only after the old output is hard stale.
// Reuse the already-open candidate instead of killing it and opening a third
// response; it must still pass the unchanged sustained-output contract from a
// fresh post-release observation window before promotion.
export function shouldUsePrivateNvrExclusiveOutputRescue({ handoffMode,
  sourceKind, ownerRunning, ownerCurrent, ownerMissing = false,
  ownerOutputAt, relayStaleMs,
  candidateRunning, candidateConfirmed,
  now = Date.now() }) {
  return Boolean(handoffMode === "OUTPUT_RESCUE"
    && sourceKind === "private_nvr_http_mp4"
    // The finite recorder response can end naturally while the already-open
    // candidate is still inside its bounded confirmation window. An absent
    // canonical owner is not an ownership conflict: retain the candidate as
    // the one exclusive response. A different owner remains a hard deny.
    && ((ownerRunning && ownerCurrent) || (!ownerRunning && ownerMissing))
    && candidateRunning
    && !candidateConfirmed
    && Number.isFinite(ownerOutputAt) && Number.isFinite(relayStaleMs)
    && relayStaleMs > 0 && Number.isFinite(now)
    && now - ownerOutputAt >= relayStaleMs);
}

// A one-response-per-channel recorder can reject the concurrent rescue probe
// with a non-media response at the exact boundary where the old response is
// ending. That rejection is not authority to rotate the shared login, but it
// is evidence that a second productive response cannot coexist with the hard-
// stale owner. Permit one continuation of the already-bounded rescue after
// the owner has become hard stale, provided no different canonical owner took
// its place. The caller still requires the full four-advance/six-second media
// proof before promotion.
export function shouldRetryPrivateNvrExclusiveRescueAfterAcquisitionRejection({
  handoffMode, sourceKind, acquisitionFailure, canonicalOwnerUnchanged,
  ownerOutputAt, relayStaleMs, now = Date.now()
}) {
  return Boolean(handoffMode === "OUTPUT_RESCUE"
    && sourceKind === "private_nvr_http_mp4"
    && acquisitionFailure === "source_not_media"
    && canonicalOwnerUnchanged
    && Number.isFinite(ownerOutputAt) && Number.isFinite(relayStaleMs)
    && relayStaleMs > 0 && Number.isFinite(now)
    && now - ownerOutputAt >= relayStaleMs);
}

// A concurrent candidate can acquire the recorder response and then exit
// before publishing HLS. Live 0.2.64 evidence showed that the prior owner may
// cross the hard-stale boundary during that bounded observation. Treating the
// ended candidate as an ordinary confirmation failure left no productive
// owner until the separate recovery timer fired. This is the same one-response
// boundary as an acquisition rejection: permit exactly one exclusive reopen,
// but only after the canonical owner is still the same and is provably hard
// stale. The caller retains the normal confirmation and rollback contracts.
export function shouldRetryPrivateNvrExclusiveRescueAfterCandidateExit({
  handoffMode, sourceKind, candidateRunning, candidateConfirmed,
  canonicalOwnerUnchanged, ownerOutputAt, relayStaleMs, now = Date.now()
}) {
  return Boolean(handoffMode === "OUTPUT_RESCUE"
    && sourceKind === "private_nvr_http_mp4"
    && candidateRunning === false
    && candidateConfirmed === false
    && canonicalOwnerUnchanged
    && Number.isFinite(ownerOutputAt) && Number.isFinite(relayStaleMs)
    && relayStaleMs > 0 && Number.isFinite(now)
    && now - ownerOutputAt >= relayStaleMs);
}

// An early output-rescue probe is intentionally non-destructive. It is not
// authority to replace a relay that resumed current HLS while the candidate
// was proving itself. Promote only when the old owner still needs rescue and
// the replacement is the fresher media path. This preserves the measured
// three-second early-warning budget without turning ordinary DVR/encoder
// cadence jitter into a replacement storm.
export function privateNvrOutputRescueStillRequired({ ownerRunning,
  ownerCurrent, ownerProgressing, ownerOutputAt, candidateOutputAt,
  rescueTriggerMs = PRIVATE_NVR_OUTPUT_RESCUE_TRIGGER_MS,
  now = Date.now() }) {
  if (!ownerRunning || !ownerCurrent || !ownerProgressing) return true;
  return Boolean(Number.isFinite(ownerOutputAt)
    && Number.isFinite(candidateOutputAt)
    && Number.isFinite(rescueTriggerMs) && rescueTriggerMs > 0
    && Number.isFinite(now)
    && now - ownerOutputAt >= rescueTriggerMs
    && candidateOutputAt > ownerOutputAt);
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

// The Home recorder permits only one productive HTTP response per channel.
// During an exclusive session sweep the old response must therefore close
// before the replacement can publish its first segment. The prior HLS
// generation remains a valid, bounded playback buffer during that exact
// interval. This is not progression evidence and it never extends the normal
// freshness deadline: once the retained playlist crosses the existing hard
// stale boundary, playback and health fail closed.
export function privateNvrRetainedHlsContinuity({ handoffInFlight,
  recoveryInFlight = false, handoffMode = null, retainedOutputAt = null, relayStaleMs,
  now = Date.now() }) {
  return Boolean((handoffInFlight || recoveryInFlight)
    && handoffMode === "SESSION_SWEEP_EXCLUSIVE"
    && Number.isFinite(retainedOutputAt) && Number.isFinite(relayStaleMs)
    && relayStaleMs > 0 && Number.isFinite(now)
    && now >= retainedOutputAt && now - retainedOutputAt < relayStaleMs);
}

// Health is sampled independently from relay acquisition. A candidate can be
// registered before it has produced current media, while the finite prior
// owner has already exited. In that bounded state there is deliberately no
// effective media owner. Return null instead of selecting a missing owner so
// the health endpoint can report a stalled source without throwing.
export function privateNvrHealthEffectiveRelay({ current = null,
  candidate = null, mediaOwner = "NONE" } = {}) {
  if (mediaOwner === "WARMING_CONTINUITY") return candidate || null;
  if (mediaOwner === "CURRENT") return current || null;
  return null;
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
// The earlier nine-source proof failed because it first opened concurrent
// same-channel responses and learned the recorder's one-productive-response
// boundary only after several acquisition windows. The unthrottled Home-DVR
// proof then exposed the complementary truth: a healthy response can pause
// rendered media near its finite boundary before the socket closes, so waiting
// for body/socket retirement creates a real HLS gap. Once Range proves
// non-exclusive logins, renew the shared login at the measured two-minute
// deadline and drain the prior epoch through the already-bounded *exclusive*
// session sweep. This is not generic per-relay age churn: one login rotation
// owns one serialized sweep, and another rotation is blocked until every prior
// epoch relay and retired login is settled. Repeated heartbeat loss while all
// media is idle retains the same bounded recovery authority.
export function shouldProactivelyRefreshPrivateNvrSession(session, evidence = {},
  now = Date.now()) {
  const activeProgressingRelays = Number(evidence.activeProgressingRelays || 0);
  const heartbeatConsecutiveFailures = Number(evidence.heartbeatConsecutiveFailures || 0);
  const pendingRetiredSessions = Number(evidence.pendingRetiredSessions || 0);
  const staleEpochRelays = Number(evidence.staleEpochRelays || 0);
  const activeHandoffs = Number(evidence.activeHandoffs || 0);
  const recoveryBacklog = Number(evidence.recoveryBacklog || 0);
  const priorEpochSettled = pendingRetiredSessions === 0
    && staleEpochRelays === 0 && activeHandoffs === 0 && recoveryBacklog === 0;
  const corroboratedIdleExpiry = activeProgressingRelays === 0
    && heartbeatConsecutiveFailures >= PRIVATE_NVR_COMMON_CAUSE_HEARTBEAT_FAILURES
    && priorEpochSettled;
  const measuredActiveFiniteBoundary = activeProgressingRelays > 0
    && heartbeatConsecutiveFailures === 0
    && Number(evidence.heartbeatResponsesOk || 0) > 0
    && priorEpochSettled;
  return Boolean(session?.loginExclusivity === false
    && !session.refreshPromise
    && Number.isFinite(session.updatedAt)
    && now - session.updatedAt >= PRIVATE_NVR_PROACTIVE_RENEWAL_MS
    && (measuredActiveFiniteBoundary || corroboratedIdleExpiry));
}

// The recorder web contract exposes Logout for retiring an authenticated
// session. Close a superseded login only after every canonical and candidate
// media process has left that epoch; otherwise Logout could invalidate a
// replacement still proving continuity.
export function privateNvrRetiredSessionReady({ retiredEpoch,
  activeRelayEpochs = [] }) {
  if (!Number.isInteger(retiredEpoch)) return false;
  return !activeRelayEpochs.some(epoch =>
    Number.isInteger(epoch) && epoch <= retiredEpoch);
}

// The recorder returns HTTP 400 with error_code "logout" or "expired" when a
// token is already unusable. Bounded read-only live probes verified both: the
// first after repeated Logout, the second after finite-response lazy session
// migration. Either means the old session is retired; arbitrary 400s remain
// failures and continue to block another login.
export function privateNvrLogoutResponseRetired({ httpStatus, result = null,
  errorCode = null }) {
  const status = Number(httpStatus || 0);
  if (status === 401 || status === 403) return true;
  if (status === 400 && ["logout", "expired"].includes(errorCode)) return true;
  return status >= 200 && status < 300
    && !["failed", "error"].includes(String(result || "").toLowerCase());
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

// Ordinary transport and camera-specific non-media responses must not rotate
// a recorder login shared by every channel. The owned recorder additionally
// proved a finite-response contract: after ffmpeg successfully consumes one
// response, the recorder rejects reopening that exact channel on the same
// login as non-media. That exact two-step proof authorizes one serialized
// non-exclusive login while existing progressing owners remain untouched and
// migrate lazily as their own responses end. Otherwise a bounded replacement
// is allowed only when heartbeat plus multiple channels prove common expiry.
export function shouldRefreshPrivateNvrSession(failure, evidence = {}) {
  if (failure === "authentication_rejected") return true;
  if (failure !== "source_not_media") return false;
  if (["SOURCE_STREAM_ENDED", "SOURCE_RESPONSE_RETIRED"]
    .includes(evidence.previousRelayExitReason)) return true;
  return Number(evidence.heartbeatConsecutiveFailures || 0) >= PRIVATE_NVR_COMMON_CAUSE_HEARTBEAT_FAILURES
    && Number(evidence.commonCauseSourceFailures || 0) >= PRIVATE_NVR_COMMON_CAUSE_SOURCE_FAILURES;
}
