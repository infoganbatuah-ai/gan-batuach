// Completes one exact HOME_QA Gateway retry from an immutable, previously
// authenticated R2 cache entry after a slow network transfer exceeded the
// device's bounded download timer. The normal manager still owns install,
// launchd handoff, health promotion and rollback.
import "../../services/video-gateway/http-runtime.mjs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInstalledEdgeOtaService } from "../../services/video-gateway/edge-installed-ota-service.mjs";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";
import { verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { createEdgeSecretStoreSync } from "../../services/video-gateway/edge-secret-store-sync.mjs";
import { softwareConnectorDeviceSession } from "../../services/video-gateway/software-connector-cloud.mjs";

const apply = process.argv.includes("--apply"), dryRun = process.argv.includes("--dry-run");
if (apply === dryRun) throw new Error("P38_GATEWAY_CACHE_RECOVERY_EXPLICIT_MODE_REQUIRED");
const outputIndex = process.argv.indexOf("--output");
const outputPath = outputIndex >= 0 ? resolve(process.argv[outputIndex + 1] || "") : "";
const restrictedRoot = realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted");
if (!outputPath || !outputPath.startsWith(`${restrictedRoot}/`) || existsSync(outputPath))
  throw new Error("P38_GATEWAY_CACHE_RECOVERY_OUTPUT_INVALID");

const expected = Object.freeze({
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-health-serialization-dee178ab7c45",
  version: "0.2.64-p38-health",
  artifactSha256: "dee178ab7c455b7e744d3a1658e79333296f5420787299182b021f9020068ba2",
  artifactSize: 135842806,
  priorReleaseId: "qa-p38-health-gateway-finite-owner-exit-79141a089f25",
  priorVersion: "0.2.63-p38-health"
});
const root = join(homedir(), "Library/Application Support/Digital Observer/observer-gateway/ota");
const configPath = join(root, "agent-config.json");
const cachePath = join(root, "downloads", `${expected.releaseId}.artifact`);
const agentPlist = join(homedir(), "Library/LaunchAgents/com.ganbatuach.video-gateway.ota-agent.plist");
const agentDomain = `gui/${process.getuid()}/com.ganbatuach.video-gateway.ota-agent`;
const guiDomain = `gui/${process.getuid()}`;
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const safeFile = path => {
  if (!existsSync(path) || lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile() ||
    realpathSync(path) !== path || (lstatSync(path).mode & 0o077) !== 0)
    throw new Error("P38_GATEWAY_CACHE_RECOVERY_FILE_UNSAFE");
  return readFileSync(path);
};
const config = JSON.parse(safeFile(configPath));
if (config.profile !== "PHYSICAL_GATEWAY" || config.deviceId !== expected.deviceId ||
  config.channel !== "HOME_QA" || config.managedRoot !== root || config.port !== 18082 ||
  config.expectedPhysicalCameras !== 9 || config.configuredPhysicalCameras !== 10 ||
  !config.secretDir || !config.qaTlsCaPath || !/^[a-f0-9]{64}$/.test(config.qaTlsCaSha256 || ""))
  throw new Error("P38_GATEWAY_CACHE_RECOVERY_CONFIG_INVALID");
const certificate = safeFile(config.qaTlsCaPath);
if (sha(certificate) !== config.qaTlsCaSha256)
  throw new Error("P38_GATEWAY_CACHE_RECOVERY_TLS_INVALID");

const tlsChild = process.argv.includes("--tls-child");
if (!tlsChild) {
  execFileSync(process.execPath, [fileURLToPath(import.meta.url), ...process.argv.slice(2), "--tls-child"], {
    env: { ...process.env, NODE_EXTRA_CA_CERTS: config.qaTlsCaPath }, stdio: "inherit", timeout: 720_000
  });
  process.exit(0);
}
if (!process.env.NODE_EXTRA_CA_CERTS || realpathSync(process.env.NODE_EXTRA_CA_CERTS) !== realpathSync(config.qaTlsCaPath))
  throw new Error("P38_GATEWAY_CACHE_RECOVERY_TLS_PROCESS_INVALID");

const cached = safeFile(cachePath);
if (cached.length !== expected.artifactSize || sha(cached) !== expected.artifactSha256)
  throw new Error("P38_GATEWAY_CACHE_RECOVERY_ARTIFACT_INVALID");
const current = JSON.parse(safeFile(join(root, "current.json")));
const knownGood = JSON.parse(safeFile(join(root, "known-good.json")));
const state = JSON.parse(safeFile(join(root, "update-state.json")));
if (current.release_id !== expected.priorReleaseId || current.version !== expected.priorVersion ||
  state.state !== "ROLLED_BACK" || state.release_id !== expected.releaseId ||
  !knownGood.some(item => item.release_id === expected.priorReleaseId && item.version === expected.priorVersion))
  throw new Error("P38_GATEWAY_CACHE_RECOVERY_STATE_INVALID");

const store = createEdgeSecretStoreSync({ secretDir: config.secretDir });
const session = await softwareConnectorDeviceSession(store);
if (session.authMode !== "ED25519_V1" || session.gatewayId !== expected.deviceId)
  throw new Error("P38_GATEWAY_CACHE_RECOVERY_IDENTITY_INVALID");
const request = async ({ method, path, query = {}, body }) => {
  const url = new URL(path, session.baseUrl);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, String(value));
  const response = await fetch(url, { method, headers: {
    "x-video-gateway-device-token": session.accessToken, "x-video-gateway-id": session.gatewayId,
    ...(body ? { "content-type": "application/json" } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {}), redirect: "error", signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error("P38_GATEWAY_CACHE_RECOVERY_CONTROL_REQUEST_FAILED");
  return (await response.json()).data;
};
const query = { platform: "darwin", architecture: process.arch, profile: config.profile,
  current_version: expected.priorVersion, config_version: config.configVersion || 1, channel: "HOME_QA" };
const plan = await request({ method: "GET", path: "/api/video-gateway/edge-updates", query });
const trusted = loadPinnedEdgeReleaseKeys({ registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys;
const verified = verifyEdgeUpdateManifest(plan?.manifest, trusted);
if (!verified.ok || verified.manifest.release_id !== expected.releaseId ||
  verified.manifest.version !== expected.version ||
  verified.manifest.artifact_sha256 !== expected.artifactSha256 ||
  verified.manifest.artifact_size !== expected.artifactSize)
  throw new Error("P38_GATEWAY_CACHE_RECOVERY_MANIFEST_INVALID");
const grant = await request({ method: "POST", path: "/api/video-gateway/edge-updates/download", body: {
  release_id: expected.releaseId, platform: "darwin", architecture: process.arch,
  profile: config.profile, channel: "HOME_QA", current_version: expected.priorVersion,
  config_version: config.configVersion || 1 } });
const granted = new URL(grant?.url || "https://invalid.example/");
const artifactUrl = new URL(verified.manifest.artifact_url);
const expires = Date.parse(grant?.expires_at || "");
if (grant?.release_id !== expected.releaseId || grant?.artifact_sha256 !== expected.artifactSha256 ||
  grant?.artifact_size !== expected.artifactSize || granted.protocol !== "https:" ||
  granted.origin !== artifactUrl.origin || granted.pathname !== artifactUrl.pathname ||
  granted.searchParams.get("X-Amz-Expires") !== "120" || !granted.searchParams.has("X-Amz-Signature") ||
  !Number.isFinite(expires) || expires <= Date.now() + 5_000 || expires > Date.now() + 5 * 60_000)
  throw new Error("P38_GATEWAY_CACHE_RECOVERY_GRANT_INVALID");

const baseEvidence = { protocol: "observer-push38-gateway-verified-cache-recovery-v1",
  generated_at: new Date().toISOString(), mode: dryRun ? "DRY_RUN" : "APPLY",
  release_id: expected.releaseId, current_release_before: current.release_id,
  artifact_sha256: expected.artifactSha256, artifact_size: expected.artifactSize,
  installed_trust_acceptance: "PASS", managed_device_authentication: "PASS",
  short_lived_r2_authorization: "PASS", immutable_cache_verification: "PASS",
  camera_runtime_mutated_by_dry_run: false };
if (dryRun) {
  writeFileSync(outputPath, `${JSON.stringify({ ...baseEvidence, status: "PASS",
    intended_action: "CANONICAL_MANAGER_INSTALL_HEALTH_PROMOTE_OR_ROLLBACK" }, null, 2)}\n`,
  { mode: 0o600, flag: "wx" });
  console.log(JSON.stringify({ status: "P38_GATEWAY_VERIFIED_CACHE_DRY_RUN_PASS",
    release_id: expected.releaseId, artifact_sha256: expected.artifactSha256,
    managed_device_authentication: "PASS", r2_authorization: "PASS" }));
  process.exit(0);
}

try {
  execFileSync("/bin/launchctl", ["print", agentDomain], { stdio: "ignore", timeout: 10_000 });
  throw new Error("P38_GATEWAY_CACHE_RECOVERY_AGENT_MUST_BE_PAUSED");
} catch (error) {
  if (error?.message === "P38_GATEWAY_CACHE_RECOVERY_AGENT_MUST_BE_PAUSED") throw error;
}
let result;
try {
  result = await runInstalledEdgeOtaService(configPath, { once: true });
} finally {
  execFileSync("/bin/launchctl", ["bootstrap", guiDomain, agentPlist], { stdio: "ignore", timeout: 15_000 });
  execFileSync("/bin/launchctl", ["kickstart", agentDomain], { stdio: "ignore", timeout: 15_000 });
}
const currentAfter = JSON.parse(safeFile(join(root, "current.json")));
const knownGoodAfter = JSON.parse(safeFile(join(root, "known-good.json")));
if (result?.state !== "HEALTHY" || currentAfter.release_id !== expected.releaseId ||
  currentAfter.version !== expected.version || currentAfter.artifact_sha256 !== expected.artifactSha256 ||
  !knownGoodAfter.some(item => item.release_id === expected.releaseId &&
    item.artifact_sha256 === expected.artifactSha256))
  throw new Error("P38_GATEWAY_CACHE_RECOVERY_PROMOTION_FAILED");
const evidence = { ...baseEvidence, status: "HEALTHY", current_release_after: currentAfter.release_id,
  known_good_after: expected.releaseId, canonical_manager_result: result.state,
  ota_agent_restored: true, functional_runtime_changed_by: "SIGNED_OTA_MANAGER" };
writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600, flag: "wx" });
console.log(JSON.stringify({ status: "P38_GATEWAY_VERIFIED_CACHE_RECOVERY_HEALTHY",
  release_id: expected.releaseId, current: expected.version, known_good: expected.version,
  evidence_sha256: sha(readFileSync(outputPath)) }));
