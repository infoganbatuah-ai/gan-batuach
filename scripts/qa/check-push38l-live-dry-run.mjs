// The only filesystem writes are isolated temporary extraction/cleanup.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { verifyEdgeArtifact, verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { verifyLegacyTransitionRecord } from "../../services/video-gateway/edge-connector-legacy-transition.mjs";

const [legacyStore, gatewayStore, transitionDir, bindingPath] = process.argv.slice(2);
if (!legacyStore || !gatewayStore || !transitionDir || !bindingPath) throw new Error("P38L_DRY_RUN_INPUT_REQUIRED");
const root = resolve(legacyStore), transitionRoot = resolve(transitionDir);
const raw = execFileSync(process.execPath, ["scripts/qa/check-push38h-live-dry-run.mjs", root,
  `--gateway-baseline-store=${resolve(gatewayStore)}`,
  "--gateway-baseline-id=qa-legacy-gateway-91bf6814075f"], { encoding: "utf8", timeout: 120_000 });
const plan = JSON.parse(raw);
if (!plan.compatible || plan.write_operations !== 0) throw new Error("P38L_LIVE_BASELINE_OR_LAYOUT_CHANGED");
const connector = plan.results.find(item => item.profile === "SOFTWARE_CONNECTOR");
if (!connector || connector.live_file_matches !== 250 || connector.live_file_changed.length ||
  connector.live_file_missing.length || connector.conflicts.length) throw new Error("P38L_CONNECTOR_BASELINE_CHANGED");
const legacyDir = join(root, "qa-legacy-connector-ee82c20a77ac");
const legacy = JSON.parse(readFileSync(join(legacyDir, "release.json")));
const transition = JSON.parse(readFileSync(join(transitionRoot, "release.json")));
const record = JSON.parse(readFileSync(resolve(bindingPath)));
const trusted = JSON.parse(readFileSync(join(root, "qa-trust-registry.json"))).trustedPublicKeys;
const legacyBytes = readFileSync(join(legacyDir, "connector-app.tar.gz"));
const transitionBytes = readFileSync(join(transitionRoot, "connector-legacy-resigned.tar.gz"));
if (!verifyEdgeUpdateManifest(legacy, trusted).ok || !verifyEdgeArtifact(legacyBytes, legacy).ok ||
  !verifyEdgeUpdateManifest(transition, trusted).ok || !verifyEdgeArtifact(transitionBytes, transition).ok)
  throw new Error("P38L_RELEASE_TRUST_FAILED");
const deviceId = readFileSync(join(homedir(),
  "Library/Application Support/Digital Observer/Tapo Connector/secrets/device_gateway_id"), "utf8").trim();
if (!verifyLegacyTransitionRecord(record, { trustedPublicKeys: trusted,
  device: { deviceId, profile: "SOFTWARE_CONNECTOR", platform: "darwin", architecture: "arm64" },
  legacyManifest: legacy, transitionManifest: transition }).ok) throw new Error("P38L_LIVE_BINDING_INVALID");
const plist = join(homedir(), "Library/LaunchAgents/com.ganbatuach.software-connector.tapo.plist");
const settings = JSON.parse(execFileSync("/usr/bin/plutil", ["-convert", "json", "-o", "-", plist], { encoding: "utf8" }));
const app = join(homedir(), "Applications/Digital Observer.app");
for (const name of ["OBSERVER_CONNECTOR_DATA_DIR", "OBSERVER_CONNECTOR_SECRET_DIR"]) {
  const path = settings.EnvironmentVariables?.[name];
  if (!path || resolve(path).startsWith(`${resolve(app)}/`)) throw new Error("P38L_EXTERNAL_STATE_PATH_INVALID");
}
const temp = mkdtempSync(join(tmpdir(), "observer-p38l-live-plan-"));
try {
  execFileSync("tar", ["-xzf", join(transitionRoot, "connector-legacy-resigned.tar.gz"), "-C", temp],
    { timeout: 120_000 });
  execFileSync("/usr/bin/codesign", ["--verify", "--deep", "--strict", join(temp, "Digital Observer.app")]);
} finally { rmSync(temp, { recursive: true, force: true }); }
console.log(JSON.stringify({ status: "PASS", protocol: "observer-connector-legacy-transition-plan-v1",
  live_runtime_writes: 0, legacy_exact_match: true, legacy_artifact_sha256: legacy.artifact_sha256,
  transition_release: transition.release_id, transition_artifact_sha256: transition.artifact_sha256,
  transition_strict_signature: true, device_binding_verified: true,
  device_fingerprint: createHash("sha256").update(deviceId).digest("hex").slice(0, 12),
  external_identity_config_state_paths: true, service_running: connector.service_running,
  managed_layout_conflicts: connector.conflicts.length, gateway_baseline_still_matches:
    plan.results.find(item => item.profile === "PHYSICAL_GATEWAY")?.live_file_matches === 491 }));
