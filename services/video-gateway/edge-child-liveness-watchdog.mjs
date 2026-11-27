function fail(code) { throw Object.assign(new Error(code), { code }); }

// The persistent runner supervises the local HTTP/media child while launchd
// supervises the runner. This watchdog never chooses releases or performs a
// rollback: a sustained child-liveness loss terminates only that child, then
// the existing launchd + signed OTA crash-loop policy owns restart/rollback.
export function createEdgeChildLivenessWatchdog({ probe, terminateChild,
  intervalMs = 5_000, failureThreshold = 3, minimumDownMs = 45_000,
  now = Date.now, setTimer = setInterval, clearTimer = clearInterval,
  onState = () => {} } = {}) {
  if (typeof probe !== "function" || typeof terminateChild !== "function" ||
    typeof onState !== "function" || typeof now !== "function" ||
    !Number.isInteger(intervalMs) || intervalMs < 1_000 ||
    !Number.isInteger(failureThreshold) || failureThreshold < 2 ||
    !Number.isInteger(minimumDownMs) || minimumDownMs < intervalMs * failureThreshold) fail("EDGE_CHILD_WATCHDOG_CONFIG_INVALID");
  let timer = null, running = false, failures = 0, terminated = false, failureStartedAt = null;
  async function tick() {
    if (running || terminated) return { state: running ? "PROBE_IN_PROGRESS" : "TERMINATED", failures };
    running = true;
    try {
      const healthy = await probe().then(Boolean, () => false);
      const observedAt = now();
      if (healthy) {
        failures = 0;
        failureStartedAt = null;
      } else {
        failures += 1;
        if (failureStartedAt === null) failureStartedAt = observedAt;
      }
      const downDurationMs = failureStartedAt === null ? 0 : Math.max(0, observedAt - failureStartedAt);
      const state = healthy ? "HEALTHY"
        : failures < failureThreshold ? "PROBE_FAILED"
        : downDurationMs < minimumDownMs ? "LIVENESS_DEGRADED"
        : "SUSTAINED_DOWN";
      onState({ state, failures, downDurationMs, minimumDownMs });
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
    status: () => ({ failures, running, terminated,
      downDurationMs: failureStartedAt === null ? 0 : Math.max(0, now() - failureStartedAt), minimumDownMs })
  };
}
