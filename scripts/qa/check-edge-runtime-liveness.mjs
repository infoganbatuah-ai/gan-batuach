import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createDownstreamAbortScope } from "../../services/video-gateway/edge-cloud-proxy-lifecycle.mjs";
import { createEdgeChildLivenessWatchdog } from "../../services/video-gateway/edge-child-liveness-watchdog.mjs";
import { createEdgeCrashLoopGuard } from "../../services/video-gateway/edge-crash-loop-guard.mjs";

export async function checkEdgeRuntimeLiveness() {
{
  const request = new EventEmitter();
  const response = new EventEmitter();
  response.writableEnded = false;
  const scope = createDownstreamAbortScope({ request, response, timeoutMs: 30_000 });
  response.emit("close");
  assert.equal(scope.signal.aborted, true, "an abandoned loopback response must cancel its upstream request");
  scope.dispose();
}

{
  const request = new EventEmitter();
  request.aborted = true;
  const response = new EventEmitter();
  response.writableEnded = false;
  const scope = createDownstreamAbortScope({ request, response, timeoutMs: 30_000 });
  assert.equal(scope.signal.aborted, true, "an already-abandoned request must fail closed");
  scope.dispose();
}

{
  const request = new EventEmitter();
  const response = new EventEmitter();
  response.writableEnded = true;
  const scope = createDownstreamAbortScope({ request, response, timeoutMs: 30_000 });
  response.emit("close");
  assert.equal(scope.signal.aborted, false, "a completed response must not be reclassified as abandoned");
  scope.dispose();
}

{
  const observations = [false, false, false, false, false, false];
  let clock = 0;
  let terminations = 0;
  const states = [];
  const watchdog = createEdgeChildLivenessWatchdog({
    probe: async () => { const result = observations.shift(); clock += 10_000; return result; },
    terminateChild: () => { terminations += 1; },
    onState: event => states.push(event.state),
    now: () => clock,
    intervalMs: 5_000,
    minimumDownMs: 45_000
  });
  assert.equal((await watchdog.tick()).state, "PROBE_FAILED");
  assert.equal((await watchdog.tick()).state, "PROBE_FAILED");
  assert.equal((await watchdog.tick()).state, "LIVENESS_DEGRADED");
  assert.equal((await watchdog.tick()).state, "LIVENESS_DEGRADED");
  assert.equal((await watchdog.tick()).state, "LIVENESS_DEGRADED");
  assert.equal((await watchdog.tick()).state, "SUSTAINED_DOWN");
  assert.equal((await watchdog.tick()).state, "TERMINATED");
  assert.deepEqual(states, ["PROBE_FAILED", "PROBE_FAILED", "LIVENESS_DEGRADED", "LIVENESS_DEGRADED", "LIVENESS_DEGRADED", "SUSTAINED_DOWN"]);
  assert.equal(terminations, 1, "sustained liveness loss must terminate the child exactly once");
}

{
  const observations = [false, false, false, true, false, false, false];
  let clock = 0;
  let terminations = 0;
  const watchdog = createEdgeChildLivenessWatchdog({
    probe: async () => { const result = observations.shift(); clock += 5_000; return result; },
    terminateChild: () => { terminations += 1; },
    now: () => clock,
    intervalMs: 5_000,
    minimumDownMs: 45_000
  });
  for (let index = 0; index < 7; index += 1) await watchdog.tick();
  assert.equal(terminations, 0, "a healthy sample resets the sustained-down timer as well as the failure counter");
}

{
  const root = mkdtempSync(join(tmpdir(), "observer-edge-restart-grace-"));
  let clock = 1_000;
  let rollbacks = 0;
  const manager = {
    status: () => ({ state: "HEALTHY" }),
    current: () => ({ release_id: "signed-release" }),
    knownGood: () => [],
    rollbackAfterCrashLoop: async () => { rollbacks += 1; }
  };
  try {
    const guard = createEdgeCrashLoopGuard({ statePath: join(root, "guard.json"), manager,
      now: () => clock, sustainedDownMs: 60_000 });
    await guard.observe({ runtimePid: 100, healthy: true });
    clock += 60_001;
    await guard.observe({ runtimePid: 100, healthy: false });
    clock += 60_001;
    const recovering = await guard.observe({ runtimePid: 101, healthy: false });
    assert.equal(recovering.action, "OBSERVING",
      "a first supervised restart must receive a fresh health window");
    assert.equal(recovering.unhealthy_since, clock);
    assert.equal(recovering.crashes.length, 1,
      "the restart remains visible to the bounded crash-loop policy");
    clock += 1_000;
    const recovered = await guard.observe({ runtimePid: 101, healthy: true });
    assert.equal(recovered.action, "OBSERVING");
    assert.equal(rollbacks, 0, "successful same-release recovery must not race into rollback");
  } finally { rmSync(root, { recursive: true, force: true }); }
}

return { status: "PASS", orphan_cloud_requests_cancelled: true,
  liveness_restart_bounded: true, supervised_restart_health_grace: true,
  rollback_authority: "existing_signed_ota_crash_guard" };
}

if (process.argv[1] && realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url))) {
  console.log(JSON.stringify(await checkEdgeRuntimeLiveness()));
}
