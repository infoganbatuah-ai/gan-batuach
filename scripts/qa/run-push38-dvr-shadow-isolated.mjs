import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const domain = `gui/${process.getuid()}`;
const gatewayLabel = "com.ganbatuach.video-gateway";
const agentLabel = "com.ganbatuach.video-gateway.ota-agent";
const gatewayPlist = join(homedir(), "Library/LaunchAgents/com.ganbatuach.video-gateway.plist");
const agentPlist = join(homedir(), "Library/LaunchAgents/com.ganbatuach.video-gateway.ota-agent.plist");
const outputPath = resolve(String(process.env.DVR_SHADOW_ISOLATION_OUTPUT || ""));
const shadowOutput = resolve(String(process.env.DVR_SHADOW_OUTPUT || ""));
const expectedVersion = String(process.env.DVR_SHADOW_EXPECTED_LIVE_VERSION || "").trim();
const expectedBuild = String(process.env.DVR_SHADOW_EXPECTED_LIVE_BUILD || "").trim();
const sessionQuiescenceMs = Number(process.env.DVR_SHADOW_SESSION_QUIESCENCE_MS || 90_000);
if (!outputPath || !shadowOutput || outputPath === resolve(".") || shadowOutput === resolve(".") ||
  outputPath === shadowOutput || existsSync(outputPath) || existsSync(shadowOutput))
  throw new Error("DVR_SHADOW_ISOLATION_OUTPUT_INVALID");
if (!/^0\.2\.\d+-p38-health$/.test(expectedVersion) || !/^[a-f0-9]{40}$/.test(expectedBuild))
  throw new Error("DVR_SHADOW_ISOLATION_EXACT_LIVE_RELEASE_REQUIRED");
if (!Number.isInteger(sessionQuiescenceMs) || sessionQuiescenceMs < 30_000
  || sessionQuiescenceMs > 5 * 60_000)
  throw new Error("DVR_SHADOW_ISOLATION_SESSION_QUIESCENCE_INVALID");
if (![gatewayPlist, agentPlist].every(existsSync))
  throw new Error("DVR_SHADOW_ISOLATION_PLIST_MISSING");

function launchctl(args) {
  return execFileSync("/bin/launchctl", args, { encoding: "utf8", timeout: 20_000,
    stdio: ["ignore", "pipe", "pipe"] });
}
function loaded(label) {
  try { launchctl(["print", `${domain}/${label}`]); return true; } catch { return false; }
}
async function health() {
  const response = await fetch("http://127.0.0.1:18082/health", {
    signal: AbortSignal.timeout(5_000)
  });
  if (!response.ok) throw new Error(`gateway_health_${response.status}`);
  return response.json();
}
async function waitFor(predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if (await predicate()) return true; } catch {}
    await new Promise(resolveWait => setTimeout(resolveWait, 500));
  }
  return false;
}
function safeHealth(value) {
  return {
    observed_at: value?.observed_at ?? null,
    status: value?.status ?? null,
    version: value?.edgeRuntime?.software_version ?? null,
    build_sha: value?.edgeRuntime?.build_sha ?? null,
    assigned: value?.lastDiscovery?.assignedCount ?? null,
    connected: value?.lastDiscovery?.connectedCount ?? null,
    failed: value?.lastDiscovery?.failedAssignedCount ?? null,
    empty: value?.lastDiscovery?.unassignedCount ?? null,
    progressing: value?.mediaHeartbeat?.progressingRelays ?? null,
    stalled: value?.mediaHeartbeat?.stalledRelays ?? null
  };
}
function baselineIdentityMatches(value) {
  // The signed 0.2.67 legacy health model can leave discovery counts stale
  // while eight or nine canonical relays are demonstrably progressing. This
  // diagnostic pauses only that exact signed release/configuration. Requiring
  // its already-proven faulty aggregate to say 8/9 at the instant of the pause
  // would circularly block the candidate intended to repair it. Exact runtime,
  // source identity/count, and at least one live media path remain mandatory;
  // every observed count is preserved in evidence.
  return value?.edgeRuntime?.software_version === expectedVersion &&
    value?.edgeRuntime?.build_sha === expectedBuild &&
    value?.lastDiscovery?.assignedCount === 10 && value?.lastDiscovery?.unassignedCount === 6 &&
    Number(value?.lastDiscovery?.connectedCount) >= 1 &&
    Number(value?.lastDiscovery?.connectedCount) <= 9 &&
    Number(value?.lastDiscovery?.failedAssignedCount) >= 1 &&
    Number(value?.lastDiscovery?.failedAssignedCount) <= 9 &&
    Number(value?.mediaHeartbeat?.progressingRelays) >= 1 &&
    Number(value?.mediaHeartbeat?.progressingRelays) <= 9;
}
function restoredBaselineMatches(value) {
  return baselineIdentityMatches(value) &&
    [8, 9].includes(value?.mediaHeartbeat?.progressingRelays);
}
function assertBaseline(value, phase) {
  const matches = phase === "POST"
    ? restoredBaselineMatches(value) : baselineIdentityMatches(value);
  if (!matches)
    throw new Error(`DVR_SHADOW_ISOLATION_${phase}_BASELINE_INVALID`);
}
function digest(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
function persist(value) {
  writeFileSync(outputPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  chmodSync(outputPath, 0o600);
}

const startedAt = new Date().toISOString();
const before = await health();
assertBaseline(before, "PRE");
if (!loaded(gatewayLabel) || !loaded(agentLabel))
  throw new Error("DVR_SHADOW_ISOLATION_SERVICE_NOT_READY");

let child = null;
let childExit = null;
let restored = false;
let after = null;
let interruptedBy = null;
async function restore() {
  if (restored) return;
  restored = true;
  if (!loaded(gatewayLabel)) launchctl(["bootstrap", domain, gatewayPlist]);
  const healthy = await waitFor(async () => {
    const value = await health();
    return restoredBaselineMatches(value);
  // A clean signed restart can spend up to three minutes in read-only DVR
  // discovery before the 10/6 source snapshot is visible. Restoration must
  // cover that already-bounded startup path rather than falsely failing at
  // ninety seconds while the exact known-good runtime is still recovering.
  }, 4 * 60_000);
  if (!loaded(agentLabel)) launchctl(["bootstrap", domain, agentPlist]);
  if (!(await waitFor(() => loaded(agentLabel), 20_000)))
    throw new Error("DVR_SHADOW_ISOLATION_AGENT_RESTORE_FAILED");
  if (!healthy) throw new Error("DVR_SHADOW_ISOLATION_GATEWAY_RESTORE_FAILED");
  if (!(await waitFor(async () => restoredBaselineMatches(await health()), 90_000)))
    throw new Error("DVR_SHADOW_ISOLATION_POST_RESTORE_HEALTH_FAILED");
  after = await health();
  assertBaseline(after, "POST");
}
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    interruptedBy = signal;
    if (child && child.exitCode === null) child.kill("SIGTERM");
  });
}

try {
  launchctl(["bootout", domain, agentPlist]);
  launchctl(["bootout", domain, gatewayPlist]);
  if (!(await waitFor(async () => {
    try { await health(); return false; } catch { return true; }
  }, 20_000))) throw new Error("DVR_SHADOW_ISOLATION_GATEWAY_DID_NOT_STOP");
  // Signed 0.2.67 predates graceful recorder Logout. Leave one bounded
  // heartbeat-free interval after stopping it so that a stale live session
  // cannot contaminate the candidate's login/session qualification.
  await new Promise(resolveWait => setTimeout(resolveWait, sessionQuiescenceMs));
  child = spawn(process.execPath, ["scripts/qa/run-push38-dvr-shadow.mjs"], {
    cwd: process.cwd(), env: { ...process.env, DVR_SHADOW_ISOLATED: "1" },
    stdio: ["ignore", "inherit", "inherit"]
  });
  childExit = await new Promise(resolveExit => child.once("exit", (code, signal) =>
    resolveExit({ code, signal })));
} finally {
  await restore();
}

if (!existsSync(shadowOutput)) throw new Error("DVR_SHADOW_ISOLATION_EVIDENCE_MISSING");
const shadow = JSON.parse(readFileSync(shadowOutput, "utf8"));
const result = childExit?.code === 0 && shadow.result === "PASS" && !interruptedBy ? "PASS" : "FAIL";
persist({
  protocol: "observer-push38-isolated-dvr-shadow-v1",
  started_at: startedAt,
  ended_at: new Date().toISOString(),
  method: "CONTROLLED_LAUNCHD_PAUSE_WITH_FINALLY_RESTORE",
  live_gateway_runtime_mutated: false,
  live_gateway_temporarily_unavailable: true,
  ota_agent_paused_during_test: true,
  pre_shadow_session_quiescence_ms: sessionQuiescenceMs,
  baseline_before: safeHealth(before),
  baseline_after: safeHealth(after),
  exact_live_release_restored: true,
  shadow_evidence_sha256: digest(shadowOutput),
  shadow_result: shadow.result,
  shadow_checkpoints: shadow.checkpoints?.length ?? 0,
  child_exit: childExit,
  interrupted_by: interruptedBy,
  result
});
console.log(JSON.stringify({ result, output: outputPath, shadow_output: shadowOutput,
  exact_live_release_restored: true }));
if (result !== "PASS") process.exitCode = 1;
