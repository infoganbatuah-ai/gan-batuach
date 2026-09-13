import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { canonicalEdgeTrustRegistry, installEdgeTrustRegistry } from "../../services/video-gateway/edge-release-trust.mjs";
import { canonicalEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { EdgeUpdateManager } from "../../services/video-gateway/edge-update-manager.mjs";
import { createInstalledEdgeOtaAgent } from "../../services/video-gateway/edge-installed-ota-agent.mjs";

const rootKey = generateKeyPairSync("ed25519"), releaseKey = generateKeyPairSync("ed25519");
const publicKey = pair => pair.publicKey.export({ format: "der", type: "spki" }).toString("base64url");
const bytes = Buffer.from("isolated QA artifact\n"), digest = createHash("sha256").update(bytes).digest("hex");
function release(profile, version) {
  const manifest = { protocol: "observer-edge-update-v1", release_id: `qa-agent-${profile}-${version}`, version,
    build_sha: "a".repeat(40), channel: "INTERNAL", platform: "darwin", architecture: "arm64", profile,
    artifact_url: `https://qa.invalid/${profile}/${version}`, artifact_sha256: digest, artifact_size: bytes.length,
    signing_key_id: "qa-agent-key", compatibility: { minimum_current_version: "1.0.0", maximum_current_version: null,
      minimum_config_version: 1, maximum_config_version: 1, security_floor_version: "1.0.0" },
    released_at: new Date().toISOString(), rollout: { stage: "INTERNAL_QA", cohort_seed: "qa-agent",
      cohort_percent: 100, explicit_device_ids: [] }, signature: "" };
  manifest.signature = sign(null, Buffer.from(canonicalEdgeUpdateManifest(manifest)), releaseKey.privateKey).toString("base64url");
  return manifest;
}
function health(profile) { const cameras = profile === "PHYSICAL_GATEWAY" ? 10 : 1;
  return { process_running: true, device_authenticated: true, heartbeat: true, config_retrieved: true,
    cloud_reachable: true, no_crash_loop: true, expected_physical_cameras: cameras,
    progressing_physical_cameras: cameras, empty_slots: profile === "PHYSICAL_GATEWAY" ? 6 : 0, stalled_streams: 0 }; }

const results = [];
for (const profile of ["PHYSICAL_GATEWAY", "SOFTWARE_CONNECTOR"]) {
  const scope = mkdtempSync(join(tmpdir(), "observer-p38i-agent-core-"));
  try {
    const ota = join(scope, "ota"), registryPath = join(scope, "trust", "registry.json"), rootPinPath = join(scope, "trust", "root-pin.json");
    const rootPublic = publicKey(rootKey);
    const registry = { protocol: "observer-edge-trust-registry-v1", epoch: 1, issued_at: new Date().toISOString(),
      root_key_id: "qa-agent-root", keys: [{ key_id: "qa-agent-key", public_key: publicKey(releaseKey), state: "TRUSTED" }], signature: "" };
    registry.signature = sign(null, Buffer.from(canonicalEdgeTrustRegistry(registry)), rootKey.privateKey).toString("base64url");
    installEdgeTrustRegistry({ path: registryPath, registry, pinnedRootKeyId: "qa-agent-root", pinnedRootPublicKey: rootPublic });
    writeFileSync(rootPinPath, JSON.stringify({ protocol: "observer-edge-trust-root-v1", root_key_id: "qa-agent-root",
      root_public_key: rootPublic }), { mode: 0o600 });
    let pid = 101, restarts = 0;
    const adapter = { plan: () => ({ qa: true }), status: () => ({ running: true, pid: 99 }), runtimePid: () => pid,
      health: async () => ({ ok: true }), verifyInstalled: async () => true,
      stageBaseline: async ({ staging }) => writeFileSync(join(staging, "runtime"), "qa"),
      install: async ({ staging }) => writeFileSync(join(staging, "runtime"), "qa"),
      restart: async () => { restarts++; pid++; } };
    const device = { deviceId: `qa-${profile.toLowerCase()}-agent`, profile, platform: "darwin", architecture: "arm64",
      channel: "INTERNAL", currentVersion: "1.0.0", configVersion: 1, revoked: false };
    const manager = new EdgeUpdateManager({ root: ota, trustedPublicKeys: { "qa-agent-key": publicKey(releaseKey) },
      device, adapter, healthCheck: async () => health(profile) });
    await manager.bootstrapInstalled({ manifest: release(profile, "1.0.0"), artifactBytes: bytes });
    const target = release(profile, "1.1.0");
    const cloudRequest = async ({ method }) => method === "GET" ? { manifest: target } : { accepted: true };
    const options = { root: ota, device, adapter, cloudRequest, healthCheck: async () => health(profile),
      trustRegistryPath: registryPath, qaRootPinPath: rootPinPath, qaIsolationRoot: scope,
      download: async ({ destination }) => { mkdirSync(dirname(destination), { recursive: true }); writeFileSync(destination, bytes); } };
    const agent = createInstalledEdgeOtaAgent(options);
    let unsafeDownload = 0;
    const malicious = createInstalledEdgeOtaAgent({ ...options,
      cloudRequest: async () => ({ manifest: { ...target, release_id: "../escape" } }),
      download: async () => { unsafeDownload++; } });
    await assert.rejects(malicious.tick(), /EDGE_UPDATE_RELEASE_ID_INVALID/);
    assert.equal(unsafeDownload, 0, "unverified release must never reach download path");
    assert.equal((await agent.tick()).state, "HEALTHY");
    assert.equal(manager.current().release_id, target.release_id);
    // The agent process can be replaced without touching the camera process.
    const restartedAgent = createInstalledEdgeOtaAgent(options);
    assert.equal((await restartedAgent.tick()).state, "HEALTHY");
    for (let n = 0; n < 3; n++) { pid++; await restartedAgent.tick(); }
    assert.equal(manager.status().state, "ROLLED_BACK");
    assert.equal(manager.current().version, "1.0.0");
    assert.equal(createHash("sha256").update(readFileSync(join(manager.current().slot, "artifact.bin"))).digest("hex"), digest);
    assert.equal(manager.quarantine().some(item => item.release_id === target.release_id), true);
    assert.equal((await restartedAgent.tick()).state, "ROLLED_BACK");
    assert.equal(restarts, 2);
    results.push({ profile, automatic_cycle: "PASS", persistent_crash_rollback: "PASS", quarantine: "PASS", agent_restart: "PASS", predownload_manifest_gate: "PASS" });
  } finally { rmSync(scope, { recursive: true, force: true }); }
}
console.log(JSON.stringify({ status: "PASS", evidence_level: "isolated agent core; no installed service-manager proof", results }));
