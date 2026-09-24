import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

function fail(code) { throw Object.assign(new Error(code), { code }); }
function save(path, value) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value)}\n`, { mode: 0o600, flag: "wx" });
  renameSync(temporary, path);
}

// The agent observes the supervisor's runtime child, not its own PID. A
// successful HTTP probe alone cannot erase recent process failures.
export function createEdgeCrashLoopGuard({ statePath, manager, now = () => Date.now(),
  threshold = 3, windowMs = 120_000, stableResetMs = 60_000, sustainedDownMs = 60_000 }) {
  if (!Number.isInteger(threshold) || threshold < 2 || windowMs < 1000 || stableResetMs < 1000 || sustainedDownMs < 1000)
    fail("EDGE_CRASH_POLICY_INVALID");
  const path = resolve(statePath);
  const load = () => existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
  return {
    status: load,
    // A terminal guard record belongs to the observation that produced it.
    // Once the manager has independently re-verified the exact signed
    // CURRENT/KNOWN_GOOD slot with one stable supervisor PID, retain the
    // rollback evidence in update-state.json but begin a fresh observation
    // window. This cannot select, install or promote a release.
    reconcileVerifiedRecovery({ runtimePid }) {
      const state = manager.status(), current = manager.current(), known = manager.knownGood();
      if (state.state !== "ROLLED_BACK" ||
        !["EDGE_UPDATE_SIGNED_KNOWN_GOOD_RECOVERED",
          "EDGE_UPDATE_SIGNED_KNOWN_GOOD_STABILITY_REVERIFIED"].includes(state.recovery_category) ||
        state.recovered_version !== current.version || state.recovered_runtime_pid !== runtimePid ||
        !Number.isInteger(runtimePid) || runtimePid < 1 || !current.slot ||
        !known.some(item => item.release_id === current.release_id &&
          item.artifact_sha256 === current.artifact_sha256))
        fail("EDGE_CRASH_GUARD_RECOVERY_RECONCILIATION_NOT_APPLICABLE");
      manager.verifySlot(current);
      const at = Math.max(now(), load()?.last_observed_at || 0);
      const record = { protocol: "observer-edge-crash-guard-v1", release_id: current.release_id,
        runtime_pid: runtimePid, first_healthy_at: at, unhealthy_since: null,
        crashes: [], last_observed_at: at, state: "OBSERVING",
        recovery_category: state.recovery_category, recovery_state_updated_at: state.updated_at };
      save(path, record);
      return { ...record, action: "OBSERVING" };
    },
    async observe({ runtimePid, healthy }) {
      const observedAt = now(), current = manager.current(), state = manager.status().state;
      const prior = load();
      const at = Math.max(observedAt, prior?.last_observed_at || 0);
      const record = prior?.release_id === current.release_id ? prior : {
        protocol: "observer-edge-crash-guard-v1", release_id: current.release_id,
        runtime_pid: null, first_healthy_at: null, unhealthy_since: null,
        crashes: [], last_observed_at: at, state: "OBSERVING" };
      if (!Number.isInteger(runtimePid) || runtimePid < 1) runtimePid = null;
      if (!["HEALTHY", "ROLLED_BACK"].includes(state)) {
        record.runtime_pid = runtimePid; record.first_healthy_at = null;
        record.last_observed_at = at; save(path, record); return { ...record, action: "UPDATE_IN_PROGRESS" };
      }
      if (record.runtime_pid && record.runtime_pid !== runtimePid) {
        record.crashes.push(at);
        record.first_healthy_at = null;
      }
      record.crashes = record.crashes.filter(time => at - time <= windowMs);
      record.runtime_pid = runtimePid;
      if (healthy && runtimePid) {
        record.unhealthy_since = null;
        record.first_healthy_at ??= at;
        if (at - record.first_healthy_at >= stableResetMs) record.crashes = [];
      } else {
        record.first_healthy_at = null;
        record.unhealthy_since ??= at;
      }
      record.last_observed_at = at;
      if (record.crashes.length >= threshold ||
        (record.unhealthy_since !== null && at - record.unhealthy_since >= sustainedDownMs)) {
        record.state = "ROLLBACK_REQUIRED"; save(path, record);
        if (state === "ROLLED_BACK") {
          // The restored known-good is itself failing: never oscillate slots.
          manager.requireAction("EDGE_UPDATE_KNOWN_GOOD_CRASH_LOOP");
        } else await manager.rollbackAfterCrashLoop();
        record.state = manager.status().state;
        save(path, record);
        return { ...record, action: record.state };
      }
      record.state = "OBSERVING"; save(path, record);
      return { ...record, action: "OBSERVING" };
    }
  };
}
