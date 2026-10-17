import { existsSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { EdgeUpdateManager } from "./edge-update-manager.mjs";
import { reportEdgeUpdateStatus, runEdgeUpdateCycle } from "./edge-update-agent.mjs";
import { createEdgeCrashLoopGuard } from "./edge-crash-loop-guard.mjs";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "./edge-release-trust.mjs";

function fail(code) { throw Object.assign(new Error(code), { code }); }

// Separate process from the camera supervisor. The agent owns release
// decisions; the installed adapter alone owns launchd runtime handoffs.
export function createInstalledEdgeOtaAgent({ root, device, adapter, cloudRequest, healthCheck,
  trustRegistryPath = PROTECTED_EDGE_TRUST_REGISTRY_PATH, qaRootPinPath = "", qaIsolationRoot = "",
  download, intervalMs = 5000, onEvent = () => {} }) {
  if (typeof adapter?.restart !== "function" || typeof adapter?.runtimePid !== "function" ||
    typeof cloudRequest !== "function" || typeof healthCheck !== "function" || intervalMs < 1000)
    fail("EDGE_OTA_AGENT_CONFIG_INVALID");
  if (qaRootPinPath || qaIsolationRoot) {
    const scope = resolve(qaIsolationRoot), actual = realpathSync(scope);
    if (!qaRootPinPath || !scope.startsWith(`${tmpdir()}/`) || !actual.startsWith(`${realpathSync(tmpdir())}/`) ||
      ![root, trustRegistryPath, qaRootPinPath].every(path => resolve(path).startsWith(`${scope}/`)) ||
      adapter.plan?.().qa !== true) fail("EDGE_OTA_AGENT_QA_SCOPE_INVALID");
  }
  const trustArgs = { registryPath: trustRegistryPath,
    ...(qaRootPinPath ? { rootPinPath: qaRootPinPath, qaOwnerAllowed: true } : {}) };
  const load = () => loadPinnedEdgeReleaseKeys(trustArgs).trustedPublicKeys;
  const guardPath = join(root, "crash-guard.json");
  const reportPath = join(root, "agent-status-report.json");
  async function reportLateFailure(manager) {
    const state = manager.status();
    if (!state.release_id || !["EDGE_UPDATE_CRASH_LOOP", "EDGE_UPDATE_KNOWN_GOOD_CRASH_LOOP"].includes(state.failure_category)) return;
    const fingerprint = `${state.release_id}:${state.updated_at}:${state.state}`;
    if (existsSync(reportPath) && JSON.parse(readFileSync(reportPath, "utf8")).fingerprint === fingerprint) return;
    await reportEdgeUpdateStatus(cloudRequest, state.release_id, state);
    const temporary = `${reportPath}.${randomUUID()}.staging`;
    writeFileSync(temporary, JSON.stringify({ fingerprint }), { mode: 0o600, flag: "wx" });
    renameSync(temporary, reportPath);
  }
  let stopped = false, running = false;
  async function tick() {
    if (running || stopped) return { state: "SKIPPED" };
    running = true;
    try {
      const manager = new EdgeUpdateManager({ root, trustedPublicKeys: load(), device, adapter, healthCheck });
      if (!manager.current().slot || !manager.knownGood().length) fail("EDGE_UPDATE_SIGNED_BOOTSTRAP_REQUIRED");
      if (["ROLLBACK_REQUIRED", "ROLLING_BACK"].includes(manager.status().state)) {
        const recovered = await manager.recoverInterruptedRollback();
        onEvent({ state: recovered.state, reason: recovered.failure_category || null });
        await reportLateFailure(manager);
        return recovered;
      }
      const guard = createEdgeCrashLoopGuard({ statePath: guardPath, manager });
      const service = adapter.status();
      const observed = await adapter.health({ timeoutMs: 1500 });
      const crash = await guard.observe({ runtimePid: adapter.runtimePid(), healthy: observed.ok && service.running });
      if (["ROLLED_BACK", "ACTION_REQUIRED"].includes(crash.action)) {
        onEvent({ state: crash.action, reason: manager.status().failure_category || null });
        await reportLateFailure(manager);
        return manager.status();
      }
      if (["ROLLED_BACK", "ACTION_REQUIRED"].includes(manager.status().state)) await reportLateFailure(manager);
      if (manager.status().state === "ACTION_REQUIRED") return manager.status();
      if (!observed.ok || !service.running) return { state: "RUNTIME_UNHEALTHY", reason: "HEALTH_PROBE_FAILED" };
      const result = await runEdgeUpdateCycle({ root, device, adapter, cloudRequest, healthCheck,
        trustRegistryPath, qaRootPinPath, qaIsolationRoot, download,
        onTransition: event => onEvent(event) });
      onEvent({ state: result.state, release_id: manager.current().release_id });
      return result;
    } finally { running = false; }
  }
  async function start({ signal } = {}) {
    onEvent({ state: "OTA_AGENT_ACTIVE" });
    while (!stopped && !signal?.aborted) {
      try { await tick(); } catch (error) { onEvent({ state: "OTA_AGENT_ERROR", reason: error.code || "EDGE_OTA_AGENT_FAILED" }); }
      await new Promise(resolve => {
        const timer = setTimeout(resolve, intervalMs);
        signal?.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
      });
    }
  }
  return { tick, start, stop() { stopped = true; } };
}
