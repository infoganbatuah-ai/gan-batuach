// Idempotently report the exact locally promoted Gateway release after an
// interrupted health-verification recovery completed outside the long-lived
// OTA process. No release selection, installation or runtime mutation occurs.
import "../../services/video-gateway/http-runtime.mjs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createEdgeSecretStoreSync } from "../../services/video-gateway/edge-secret-store-sync.mjs";
import { EdgeUpdateManager } from "../../services/video-gateway/edge-update-manager.mjs";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";
import { reportEdgeUpdateStatus } from "../../services/video-gateway/edge-update-agent.mjs";
import { softwareConnectorDeviceSession } from "../../services/video-gateway/software-connector-cloud.mjs";

const outputIndex = process.argv.indexOf("--output");
const outputPath = outputIndex >= 0 ? resolve(process.argv[outputIndex + 1] || "") : "";
const restrictedRoot = realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted");
if (!outputPath || !outputPath.startsWith(`${restrictedRoot}/`) || existsSync(outputPath))
  throw new Error("P38_GATEWAY_HEALTHY_REPORT_OUTPUT_INVALID");
const expected = Object.freeze({
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-exclusive-acquisition-retry-from-hls-window-86fa5a9253a9",
  version: "0.2.62-p38-health",
  artifactSha256: "86fa5a9253a9d99ce9ea8f0d2dc192630f98294810cf7b7ade9af13411cfd8bc"
});
const root = join(homedir(), "Library/Application Support/Digital Observer/observer-gateway/ota");
const configPath = join(root, "agent-config.json");
if (!existsSync(configPath) || lstatSync(configPath).isSymbolicLink() ||
  realpathSync(configPath) !== configPath || (lstatSync(configPath).mode & 0o077) !== 0)
  throw new Error("P38_GATEWAY_HEALTHY_REPORT_CONFIG_UNSAFE");
const config = JSON.parse(readFileSync(configPath, "utf8"));
if (config.deviceId !== expected.deviceId || config.profile !== "PHYSICAL_GATEWAY" ||
  config.channel !== "HOME_QA" || !config.secretDir || !config.qaTlsCaPath ||
  !/^[a-f0-9]{64}$/.test(config.qaTlsCaSha256 || ""))
  throw new Error("P38_GATEWAY_HEALTHY_REPORT_CONFIG_MISMATCH");
const tlsChild = process.argv.includes("--tls-child");
if (!tlsChild) {
  const certificate = config.qaTlsCaPath;
  if (!existsSync(certificate) || lstatSync(certificate).isSymbolicLink() ||
    realpathSync(certificate) !== certificate || (lstatSync(certificate).mode & 0o022) !== 0 ||
    createHash("sha256").update(readFileSync(certificate)).digest("hex") !== config.qaTlsCaSha256)
    throw new Error("P38_GATEWAY_HEALTHY_REPORT_TLS_INVALID");
  execFileSync(process.execPath, [fileURLToPath(import.meta.url), ...process.argv.slice(2), "--tls-child"],
    { env: { ...process.env, NODE_EXTRA_CA_CERTS: certificate }, stdio: "inherit", timeout: 120_000 });
  process.exit(0);
}
if (!process.env.NODE_EXTRA_CA_CERTS ||
  realpathSync(process.env.NODE_EXTRA_CA_CERTS) !== realpathSync(config.qaTlsCaPath))
  throw new Error("P38_GATEWAY_HEALTHY_REPORT_TLS_PROCESS_INVALID");

const manager = new EdgeUpdateManager({ root,
  trustedPublicKeys: loadPinnedEdgeReleaseKeys({
    registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys,
  device: { deviceId: expected.deviceId, profile: config.profile, platform: "darwin",
    architecture: process.arch, channel: config.channel, currentVersion: expected.version,
    configVersion: config.configVersion || 1, revoked: false },
  adapter: {}, healthCheck: async () => { throw new Error("P38_GATEWAY_HEALTHY_REPORT_HEALTH_FORBIDDEN"); } });
const state = manager.status(), current = manager.current();
if (state.state !== "HEALTHY" || state.release_id !== expected.releaseId ||
  state.current_version !== expected.version || state.known_good_version !== expected.version ||
  state.failure_category || current.release_id !== expected.releaseId ||
  current.version !== expected.version || current.artifact_sha256 !== expected.artifactSha256 ||
  !manager.knownGood().some(item => item.release_id === expected.releaseId &&
    item.artifact_sha256 === expected.artifactSha256))
  throw new Error("P38_GATEWAY_HEALTHY_REPORT_STATE_MISMATCH");
manager.verifySlot(current);
const store = createEdgeSecretStoreSync({ secretDir: config.secretDir });
const cloudRequest = async ({ method, path, query, body }) => {
  const session = await softwareConnectorDeviceSession(store);
  if (session.authMode !== "ED25519_V1" || session.gatewayId !== expected.deviceId)
    throw new Error("P38_GATEWAY_HEALTHY_REPORT_IDENTITY_MISMATCH");
  const url = new URL(path, session.baseUrl);
  for (const [key, value] of Object.entries(query || {})) url.searchParams.set(key, String(value));
  const response = await fetch(url, { method, headers: {
    "x-video-gateway-device-token": session.accessToken,
    "x-video-gateway-id": session.gatewayId,
    ...(body ? { "content-type": "application/json" } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {}), redirect: "error",
  signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`P38_GATEWAY_HEALTHY_REPORT_HTTP_${response.status}`);
  return (await response.json()).data;
};
await reportEdgeUpdateStatus(cloudRequest, expected.releaseId, state);
const evidence = { protocol: "observer-push38-gateway-healthy-report-v1",
  generated_at: new Date().toISOString(), status: "PASS", release_id: expected.releaseId,
  version: expected.version, artifact_sha256: expected.artifactSha256,
  reported_state: state.state, managed_identity: "ED25519_V1",
  runtime_mutated: false, release_selected: false };
writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600, flag: "wx" });
console.log(JSON.stringify({ ...evidence,
  evidence_sha256: createHash("sha256").update(readFileSync(outputPath)).digest("hex") }));
