function fail(code) { throw Object.assign(new Error(code), { code }); }

// A supervised parent must exit after its media child dies so launchd can
// restart the same signed release. Cleanup remains best-effort and bounded:
// a monitor waiting on the dead child must never keep the parent alive long
// enough for the OTA crash guard to classify the signed runtime as stuck.
export async function runBoundedEdgeParentShutdown({
  stopWatchdog,
  releaseJournalOwner,
  stopMonitoring,
  stopJournal,
  child,
  terminateChild,
  exitCode,
  timeoutMs = 5_000,
  exit = code => process.exit(code),
  setTimer = setTimeout,
  clearTimer = clearTimeout
}) {
  if (typeof stopWatchdog !== "function" || typeof releaseJournalOwner !== "function" ||
    typeof stopMonitoring !== "function" || typeof stopJournal !== "function" ||
    typeof exit !== "function" || typeof setTimer !== "function" || typeof clearTimer !== "function" ||
    !Number.isInteger(exitCode) || exitCode < 0 || exitCode > 255 ||
    !Number.isInteger(timeoutMs) || timeoutMs < 1)
    fail("EDGE_PARENT_SHUTDOWN_CONFIG_INVALID");

  try { stopWatchdog(); } catch {}
  // Release the ownership fence before any asynchronous cleanup. If cleanup
  // blocks, the replacement supervised process can still recover safely.
  try { releaseJournalOwner(); } catch {}
  let timedOut = false;
  let timer;
  const cleanup = Promise.allSettled([
    Promise.resolve().then(() => stopMonitoring()),
    Promise.resolve().then(() => stopJournal())
  ]);
  const deadline = new Promise(resolve => {
    timer = setTimer(() => { timedOut = true; resolve(); }, timeoutMs);
  });
  await Promise.race([cleanup, deadline]);
  clearTimer(timer);
  if (terminateChild && child?.exitCode === null && child?.killed !== true) {
    try { child.kill("SIGTERM"); } catch {}
  }
  exit(exitCode);
  return { timed_out: timedOut, exit_code: exitCode };
}
