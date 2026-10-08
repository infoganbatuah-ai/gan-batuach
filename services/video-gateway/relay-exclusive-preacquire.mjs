const sleep = milliseconds => new Promise(resolve => {
  const timer = setTimeout(resolve, milliseconds);
  timer.unref?.();
});

/** Register one replacement request before releasing a stranded relay owner.
 * If the recorder leaves that request pending after release, cancel it after a
 * bounded grace and optionally open one fresh post-release request. A candidate
 * never becomes authoritative here; the caller retains the existing media
 * confirmation and promotion contract. */
export async function preacquireExclusiveRelayReplacement({
  startCandidate,
  releaseOwner,
  stopCandidate = () => {},
  cancelCandidate = () => {},
  startFreshCandidate = null,
  graceMs,
  postReleaseGraceMs = graceMs,
  wait = sleep
} = {}) {
  if (typeof startCandidate !== "function" || typeof releaseOwner !== "function" ||
    typeof stopCandidate !== "function" || typeof cancelCandidate !== "function" ||
    startFreshCandidate !== null && typeof startFreshCandidate !== "function" ||
    !Number.isFinite(graceMs) || graceMs < 1 ||
    !Number.isFinite(postReleaseGraceMs) || postReleaseGraceMs < 1 ||
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
      postReleaseExpired: false, freshPostReleaseAttempted: false,
      freshPostReleaseSucceeded: false };
  }

  const ownerReleased = Boolean(await releaseOwner());
  if (!ownerReleased && !registration.settled) await cancelCandidate();
  let postReleaseExpired = false;
  let freshPostReleaseAttempted = false;
  let freshPostReleaseSucceeded = false;
  let candidate = registration.candidate;
  if (!registration.settled && ownerReleased) {
    const postRelease = await Promise.race([
      candidatePromise.then(value => ({ settled: true, candidate: value })),
      wait(postReleaseGraceMs).then(() => ({ settled: false, candidate: null }))
    ]);
    if (postRelease.settled) candidate = postRelease.candidate;
    else {
      postReleaseExpired = true;
      await cancelCandidate();
      candidate = await candidatePromise;
      if (candidate) await stopCandidate(candidate);
      candidate = null;
      if (startFreshCandidate) {
        freshPostReleaseAttempted = true;
        candidate = await startFreshCandidate();
        freshPostReleaseSucceeded = Boolean(candidate);
      }
    }
  } else if (!registration.settled) {
    candidate = await candidatePromise;
  }
  if (!ownerReleased && candidate) await stopCandidate(candidate);
  return { candidate: ownerReleased ? candidate : null, ownerReleased,
    readyBeforeRelease: Boolean(registration.settled && registration.candidate),
    ownerReleaseSkipped: false, postReleaseExpired,
    freshPostReleaseAttempted, freshPostReleaseSucceeded };
}
