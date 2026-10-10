const sleep = milliseconds => new Promise(resolve => {
  const timer = setTimeout(resolve, milliseconds);
  timer.unref?.();
});

/** Probe one replacement request while retaining a stranded relay owner.
 * A recorder may poison a request registered against the old per-channel
 * response. If the probe has not acquired headers inside the bounded grace,
 * cancel and settle it before releasing the owner. Only after the old owner is
 * transport-closed and a bounded quiescence has elapsed may one fresh request
 * be opened. A candidate never becomes authoritative here; the caller retains
 * the existing media confirmation and promotion contract. */
export async function preacquireExclusiveRelayReplacement({
  startCandidate,
  releaseOwner,
  stopCandidate = () => {},
  cancelCandidate = () => {},
  startFreshCandidate = null,
  graceMs,
  postReleaseQuiescenceMs = graceMs,
  wait = sleep
} = {}) {
  if (typeof startCandidate !== "function" || typeof releaseOwner !== "function" ||
    typeof stopCandidate !== "function" || typeof cancelCandidate !== "function" ||
    startFreshCandidate !== null && typeof startFreshCandidate !== "function" ||
    !Number.isFinite(graceMs) || graceMs < 1 ||
    !Number.isFinite(postReleaseQuiescenceMs) || postReleaseQuiescenceMs < 1 ||
    typeof wait !== "function") {
    throw new Error("RELAY_EXCLUSIVE_PREACQUIRE_CONFIG_INVALID");
  }

  // Invoke before starting the grace timer so the request is actually on its
  // way to the recorder before owner release can occur.
  const candidatePromise = Promise.resolve(startCandidate());
  const registration = await Promise.race([
    candidatePromise.then(candidate => ({ settled: true, candidate })),
    wait(graceMs).then(() => ({ settled: false, candidate: null }))
  ]);

  // An immediate acquisition rejection is not authority to destroy the only
  // retained owner. Let the existing bounded scheduler retry later.
  if (registration.settled && !registration.candidate) {
    return { candidate: null, ownerReleased: false,
      readyBeforeRelease: false, ownerReleaseSkipped: true,
      preacquireCancelledBeforeRelease: false,
      freshPostReleaseAttempted: false,
      freshPostReleaseSucceeded: false };
  }

  let preacquireCancelledBeforeRelease = false;
  let candidate = registration.candidate;
  if (!registration.settled) {
    // V8 on 0.2.94 proved that releasing the owner while this request was
    // still registered left CH3's recorder slot poisoned: 16/22 immediate
    // fresh requests then exhausted the unchanged fourteen-second budget.
    // Settle the losing probe first so owner release presents one clean edge.
    preacquireCancelledBeforeRelease = true;
    await cancelCandidate();
    candidate = await candidatePromise;
    if (candidate) await stopCandidate(candidate);
    candidate = null;
  }

  const ownerReleased = Boolean(await releaseOwner());
  let freshPostReleaseAttempted = false;
  let freshPostReleaseSucceeded = false;
  if (ownerReleased && preacquireCancelledBeforeRelease && startFreshCandidate) {
    // awaitRelayTransportRelease has already confirmed the old owner locally.
    // This small quiet period gives the recorder the same bounded close edge;
    // it is request ordering, not an increased acquisition/stale threshold.
    await wait(postReleaseQuiescenceMs);
    freshPostReleaseAttempted = true;
    candidate = await startFreshCandidate();
    freshPostReleaseSucceeded = Boolean(candidate);
  }
  if (!ownerReleased && candidate) await stopCandidate(candidate);
  return { candidate: ownerReleased ? candidate : null, ownerReleased,
    readyBeforeRelease: Boolean(registration.settled && registration.candidate),
    ownerReleaseSkipped: false, preacquireCancelledBeforeRelease,
    freshPostReleaseAttempted, freshPostReleaseSucceeded };
}
