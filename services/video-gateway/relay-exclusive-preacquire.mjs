const sleep = milliseconds => new Promise(resolve => {
  const timer = setTimeout(resolve, milliseconds);
  timer.unref?.();
});

/** Register exactly one replacement request before releasing a stranded relay
 * owner. The candidate never becomes authoritative here; the caller retains
 * the existing media confirmation and promotion contract. */
export async function preacquireExclusiveRelayReplacement({
  startCandidate,
  releaseOwner,
  stopCandidate = () => {},
  graceMs,
  wait = sleep
} = {}) {
  if (typeof startCandidate !== "function" || typeof releaseOwner !== "function" ||
    typeof stopCandidate !== "function" || !Number.isFinite(graceMs) || graceMs < 1 ||
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
      readyBeforeRelease: false, ownerReleaseSkipped: true };
  }

  const ownerReleased = Boolean(await releaseOwner());
  const candidate = registration.settled
    ? registration.candidate : await candidatePromise;
  if (!ownerReleased && candidate) await stopCandidate(candidate);
  return { candidate: ownerReleased ? candidate : null, ownerReleased,
    readyBeforeRelease: Boolean(registration.settled && registration.candidate),
    ownerReleaseSkipped: false };
}
