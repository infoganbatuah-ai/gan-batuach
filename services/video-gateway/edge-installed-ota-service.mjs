// Installed OTA process entry point. A separate LaunchAgent owns this process;
// the existing Gateway/Connector LaunchAgent remains the sole camera supervisor.
import "./http-runtime.mjs";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInstalledEdgeOtaAgent } from "./edge-installed-ota-agent.mjs";
import { createMacOSInstalledEdgeAdapter } from "./edge-macos-installed-adapter.mjs";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "./edge-release-trust.mjs";
import { createEdgeSecretStoreSync } from "./edge-secret-store-sync.mjs";
import { softwareConnectorDeviceSession } from "./software-connector-cloud.mjs";

function fail(code) { throw Object.assign(new Error(code), { code }); }
function configFrom(path) {
  const target = resolve(path), info = lstatSync(target);
  if (info.isSymbolicLink() || (info.mode & 0o077)) fail("EDGE_OTA_AGENT_CONFIG_UNSAFE");
  const config = JSON.parse(readFileSync(target, "utf8"));
  if (!["PHYSICAL_GATEWAY", "SOFTWARE_CONNECTOR"].includes(config.profile) ||
    !config.managedRoot || !config.installedBase || !config.launchAgentPath || !config.label ||
    !Number.isInteger(config.port) || !config.deviceId || !config.channel ||
    !config.baselineArtifactSha256 || !Number.isInteger(config.expectedPhysicalCameras) ||
    config.expectedPhysicalCameras < (config.qaIsolationRoot ? 0 : 1)) fail("EDGE_OTA_AGENT_CONFIG_INVALID");
  if (config.qaIsolationRoot) {
    const scope = resolve(config.qaIsolationRoot);
    if (!scope.startsWith(`${tmpdir()}/`) || ![target, config.managedRoot, config.installedBase,
      config.launchAgentPath, config.qaRootPinPath, config.qaTrustRegistryPath, config.qaReleasePath].every(value =>
      typeof value === "string" && resolve(value).startsWith(`${scope}/`))) fail("EDGE_OTA_AGENT_QA_SCOPE_INVALID");
  } else if (config.qaRootPinPath || config.qaReleasePath || config.qaIsolationRoot) fail("EDGE_OTA_AGENT_QA_FORBIDDEN");
  return config;
}

export async function runInstalledEdgeOtaService(configPath, { signal } = {}) {
  const config = configFrom(configPath), qa = Boolean(config.qaIsolationRoot);
  const trustRegistryPath = qa ? config.qaTrustRegistryPath : PROTECTED_EDGE_TRUST_REGISTRY_PATH;
  const trusted = loadPinnedEdgeReleaseKeys({ registryPath: trustRegistryPath,
    ...(qa ? { rootPinPath: config.qaRootPinPath, qaOwnerAllowed: true } : {}) }).trustedPublicKeys;
  const adapter = createMacOSInstalledEdgeAdapter({ profile: config.profile, installedBase: config.installedBase,
    managedRoot: config.managedRoot, launchAgentPath: config.launchAgentPath, label: config.label,
    port: config.port, allowMutations: true, approvedArtifactSha256: config.baselineArtifactSha256,
    ...(qa ? { trustedPublicKeys: trusted, qaIsolationRoot: config.qaIsolationRoot } : {}) });
  const store = qa ? null : createEdgeSecretStoreSync({ keychainService: config.keychainService,
    secretDir: config.secretDir || "" });
  const cloudRequest = qa ? async ({ method }) => {
    if (method !== "GET") return { accepted: true };
    if (!existsSync(config.qaReleasePath)) return { manifest: null };
    const value = JSON.parse(readFileSync(config.qaReleasePath, "utf8"));
    return { manifest: value.manifest };
  } : async ({ method, path, query, body }) => {
    const session = await softwareConnectorDeviceSession(store);
    const url = new URL(path, session.baseUrl);
    for (const [key, value] of Object.entries(query || {})) url.searchParams.set(key, String(value));
    const response = await fetch(url, { method, headers: { "x-video-gateway-device-token": session.accessToken,
      "x-video-gateway-id": session.gatewayId, ...(body ? { "content-type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), redirect: "error", signal: AbortSignal.timeout(20_000) });
    if (!response.ok) fail("EDGE_OTA_AGENT_CLOUD_REQUEST_FAILED");
    const payload = await response.json();
    return payload.data;
  };
  const healthCheck = async () => {
    // Connector model/runtime startup can exceed a short liveness probe. This
    // is the bounded post-update readiness gate, not the lightweight poll.
    const probe = await adapter.health({ timeoutMs: 20_000 }), body = probe.body || {};
    const cloudReachable = qa || await softwareConnectorDeviceSession(store).then(() => true, () => false);
    const expected = config.expectedPhysicalCameras;
    const progressing = qa ? 0 : Number(body.lastDiscovery?.connectedCount || 0);
    return { process_running: probe.ok && probe.service.running, device_authenticated: qa || body.deviceAuthorization?.status === "ready",
      heartbeat: probe.ok, config_retrieved: probe.ok && (qa || body.lastDiscovery?.assignedCount === expected),
      cloud_reachable: cloudReachable, no_crash_loop: probe.ok,
      expected_physical_cameras: expected, progressing_physical_cameras: progressing,
      empty_slots: Number(body.lastDiscovery?.unassignedCount || 0), stalled_streams: Number(body.mediaHeartbeat?.stalledRelays || 0) };
  };
  const download = qa ? async ({ destination }) => {
    const value = JSON.parse(readFileSync(config.qaReleasePath, "utf8"));
    const source = resolve(dirname(config.qaReleasePath), value.artifact_name);
    if (!source.startsWith(`${dirname(resolve(config.qaReleasePath))}/`)) fail("EDGE_OTA_AGENT_QA_ARTIFACT_SCOPE_INVALID");
    mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
    writeFileSync(destination, readFileSync(source), { mode: 0o600 });
  } : undefined;
  const device = { deviceId: config.deviceId, profile: config.profile, platform: "darwin", architecture: process.arch,
    channel: config.channel, configVersion: config.configVersion || 1, revoked: false };
  const agent = createInstalledEdgeOtaAgent({ root: config.managedRoot, device, adapter, cloudRequest, healthCheck,
    trustRegistryPath, ...(qa ? { qaRootPinPath: config.qaRootPinPath, qaIsolationRoot: config.qaIsolationRoot } : {}),
    download, intervalMs: config.intervalMs || 5000,
    onEvent: event => process.stdout.write(`${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`) });
  await agent.start({ signal });
}

if (process.argv[1] && realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url))) {
  runInstalledEdgeOtaService(process.argv[2]).catch(error => {
    process.stderr.write(`${error.code || "EDGE_OTA_AGENT_START_FAILED"}\n`);
    process.exitCode = 1;
  });
}
