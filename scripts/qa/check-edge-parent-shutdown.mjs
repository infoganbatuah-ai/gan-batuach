import assert from "node:assert/strict";
import { runBoundedEdgeParentShutdown } from "../../services/video-gateway/edge-parent-shutdown.mjs";

{
  const order = [];
  let exitCode = null;
  const result = await runBoundedEdgeParentShutdown({
    stopWatchdog: () => order.push("watchdog"),
    releaseJournalOwner: () => order.push("release"),
    stopMonitoring: () => new Promise(() => {}),
    stopJournal: async () => order.push("journal"),
    child: { exitCode: 1, killed: false, kill: () => order.push("unexpected-kill") },
    terminateChild: false,
    exitCode: 1,
    timeoutMs: 10,
    exit: code => { exitCode = code; order.push("exit"); }
  });
  assert.deepEqual(order.slice(0, 2), ["watchdog", "release"]);
  assert.equal(order.includes("unexpected-kill"), false);
  assert.equal(order.at(-1), "exit");
  assert.equal(exitCode, 1);
  assert.equal(result.timed_out, true);
}

{
  const order = [];
  let signal = null;
  const result = await runBoundedEdgeParentShutdown({
    stopWatchdog: () => order.push("watchdog"),
    releaseJournalOwner: () => order.push("release"),
    stopMonitoring: async () => order.push("monitor"),
    stopJournal: async () => order.push("journal"),
    child: { exitCode: null, killed: false, kill: value => { signal = value; order.push("kill"); } },
    terminateChild: true,
    exitCode: 0,
    timeoutMs: 1_000,
    exit: () => order.push("exit")
  });
  assert.equal(result.timed_out, false);
  assert.equal(signal, "SIGTERM");
  assert.deepEqual(order.slice(0, 2), ["watchdog", "release"]);
  assert.deepEqual(order.slice(-2), ["kill", "exit"]);
}

console.log(JSON.stringify({ result: "PASS", dead_child_cleanup_bounded: true,
  ownership_released_before_async_cleanup: true, launchd_restart_path_preserved: true }));
