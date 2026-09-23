function fail(code) { throw Object.assign(new Error(code), { code }); }

// The persistent runner supervises the local HTTP/media child while launchd
// supervises the runner. This watchdog never chooses releases or performs a
// rollback: a sustained child-liveness loss terminates only that child, then
// the existing launchd + signed OTA crash-loop policy owns restart/rollback.
export function createEdgeChildLivenessWatchdog({ probe, terminateChild,
  intervalMs = 5_000, failureThreshold = 3, setTimer = setInterval,
  clearTimer = clearInterval, onState = () => {} } = {}) {
  if (typeof probe !== "function" || typeof terminateChild !== "function" ||
    typeof onState !== "function" || !Number.isInteger(intervalMs) || intervalMs < 1_000 ||
    !Number.isInteger(failureThreshold) || failureThreshold < 2) fail("EDGE_CHILD_WATCHDOG_CONFIG_INVALID");
  let timer = null, running = false, failures = 0, terminated = false;
  async function tick() {
    if (running || terminated) return { state: running ? "PROBE_IN_PROGRESS" : "TERMINATED", failures };
    running = true;
    try {
      const healthy = await probe().then(Boolean, () => false);
      failures = healthy ? 0 : failures + 1;
      const state = healthy ? "HEALTHY" : failures >= failureThreshold ? "SUSTAINED_DOWN" : "PROBE_FAILED";
      onState({ state, failures });
      if (state === "SUSTAINED_DOWN" && !terminated) {
        terminated = true;
        terminateChild();
      }
      return { state, failures };
    } finally { running = false; }
  }
  return {
    tick,
    start() {
      if (timer || terminated) return;
      timer = setTimer(() => { void tick(); }, intervalMs);
      timer?.unref?.();
    },
    stop() { if (timer) clearTimer(timer); timer = null; },
    status: () => ({ failures, running, terminated })
  };
}
