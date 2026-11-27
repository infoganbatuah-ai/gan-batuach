import assert from "node:assert/strict";
import { createHash, createPublicKey, generateKeyPairSync, randomBytes, sign, verify } from "node:crypto";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { canonicalEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { EdgeUpdateManager } from "../../services/video-gateway/edge-update-manager.mjs";
import { openProductDeviceIdentity } from "../../services/video-gateway/product-device-identity.mjs";
import { recordProductDeviceMigrationChallenge, stageProductDeviceMigration } from "../../services/video-gateway/product-device-migration.mjs";
import { productCameraBindingsDigest, qualifyProductRouteCorrection, recoverProductDevice } from "../../services/video-gateway/product-device-recovery.mjs";
import { refreshDeviceCredentials } from "../../services/video-gateway/device-refresh.mjs";

const siteId = "11111111-1111-4111-8111-111111111111";
const gatewayId = "22222222-2222-4222-8222-222222222222";
const rotationId = "33333333-3333-4333-8333-333333333333";
const binding = { siteId, gatewayId };
const issuer = generateKeyPairSync("ed25519");
const keyId = "test-release-key";
const trustedPublicKeys = { [keyId]: issuer.publicKey.export({ format: "der", type: "spki" }).toString("base64url") };
const sha = value => createHash("sha256").update(value).digest("hex");

function signedRelease(profile, version) {
  const artifactBytes = Buffer.from(`${profile}-${version} fixture`);
  const artifactSha256 = sha(artifactBytes);
  const value = { protocol: "observer-edge-update-v1", release_id: `fixture-${version}`, version, build_sha: "a".repeat(40),
    channel: "HOME_QA", platform: "darwin", architecture: "arm64", profile,
    artifact_url: `https://updates.example.invalid/${version}`, artifact_sha256: artifactSha256,
    artifact_size: artifactBytes.length, signing_key_id: keyId, released_at: new Date().toISOString(),
    compatibility: { minimum_current_version: "1.0.0", maximum_current_version: "1.0.0", minimum_config_version: 1,
      maximum_config_version: 1, security_floor_version: "1.0.0" },
    rollout: { stage: "INTERNAL_QA", cohort_seed: "fixture-seed", cohort_percent: 0, explicit_device_ids: [gatewayId] },
    signature: "" };
  value.signature = sign(null, Buffer.from(canonicalEdgeUpdateManifest(value)), issuer.privateKey).toString("base64url");
  return { manifest: value, artifactBytes };
}

async function fixture(t, profile) {
  const root = mkdtempSync(join(tmpdir(), "observer-product-recovery-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const baseline = signedRelease(profile, "1.0.0");
  const target = signedRelease(profile, "1.1.0-product-identity");
  const failureCategory = profile === "SOFTWARE_CONNECTOR"
    ? "EDGE_UPDATE_ROLLBACK_HEALTH_FAILED" : "EDGE_UPDATE_KNOWN_GOOD_CRASH_LOOP";
  const count = profile === "PHYSICAL_GATEWAY" ? 10 : 1;
  const rows = Array.from({ length: count }, (_, i) => ({
    siteId, gatewayId, cameraId: `44444444-4444-4444-8444-${String(i).padStart(12, "0")}`, streamId: `channel-${i + 1}`
  }));
  const challenge = randomBytes(32).toString("base64url");
  const staged = stageProductDeviceMigration(root, binding);
  const { store } = openProductDeviceIdentity(root);
  const baselineHealth = { process_running: true, device_authenticated: true, heartbeat: true,
    config_retrieved: true, cloud_reachable: true, no_crash_loop: true, expected_physical_cameras: count,
    progressing_physical_cameras: count, empty_slots: 0, stalled_streams: 0 };
  recordProductDeviceMigrationChallenge(store, { status: "MIGRATION_PREPARED", gateway_id: gatewayId,
    new_credential_version: 1, rotation_id: rotationId, challenge,
    expires_at: new Date(Date.now() + 300_000).toISOString() });
  const state = { calls: 0, installs: 0, restarts: [], cloudKey: null, confirmationBody: null,
    loseResponse: false, failInstall: false, failHealth: false, rows };
  const adapter = { async verifyInstalled() { return true; }, async stageBaseline() {},
    async install() {
      state.installs++;
      if (state.failInstall) throw Object.assign(new Error("transient_install_failure"), { code: "transient_install_failure" });
    },
    async restart({ rollback, manifest }) { state.restarts.push(rollback ? baseline.manifest.release_id : manifest.release_id); } };
  async function healthCheck({ version, rollback }) {
    if (rollback) return { ...baselineHealth, device_authenticated: false };
    if (version === baseline.manifest.version) return baselineHealth;
    const auth = await refreshDeviceCredentials({ gatewayId, cloudBaseUrl: "https://ganbatuach.com",
      readSecret: store.read, writeSecret: store.write, removeSecret: store.remove, fetcher: async (_url, options) => {
        const payload = JSON.parse(options.body);
        assert.equal(payload.gateway_id, gatewayId);
        assert.equal(payload.action, "authenticate");
        const header = options.headers;
        const canonical = ["observer-managed-device-v1", "POST", "/api/digital-observer/gateway-enrollment", sha(options.body),
          gatewayId, "1", header["x-observer-device-timestamp"], header["x-observer-device-nonce"],
          header["x-observer-device-runtime-instance"], header["x-observer-device-sequence"]].join("\n");
        const authenticated = verify(null, Buffer.from(canonical), state.cloudKey,
          Buffer.from(header["x-observer-device-signature"], "base64url"));
        return authenticated ? Response.json({ data: { authentication_protocol: "ED25519_V1", access_token: "fixture" } })
          : Response.json({}, { status: 401 });
      } });
    return { ...baselineHealth, device_authenticated: auth.accessToken === "fixture",
      progressing_physical_cameras: state.failHealth ? 0 : count };
  }
  const manager = new EdgeUpdateManager({ root, trustedPublicKeys, adapter, healthCheck, device: {
    deviceId: gatewayId, profile, platform: "darwin", architecture: "arm64", channel: "HOME_QA",
    currentVersion: baseline.manifest.version, configVersion: 1
  } });
  await manager.bootstrapInstalled(baseline);
  manager.transition("ACTION_REQUIRED", { failure_category: failureCategory });
  const approval = { deviceId: gatewayId, profile, baselineSha256: baseline.manifest.artifact_sha256,
    targetSha256: target.manifest.artifact_sha256, targetReleaseId: target.manifest.release_id,
    failureCategory, evidenceSha256: "e".repeat(64) };
  const expectedBindingsDigest = productCameraBindingsDigest(rows, siteId);
  const run = overrides => recoverProductDevice({ manager, store, binding, release: { ...target, approval },
    readCameraBindings: () => structuredClone(state.rows), expectedBindingsDigest,
    fetcher: async (_url, options) => {
      state.calls++;
      const payload = JSON.parse(options.body);
      const key = createPublicKey({ key: Buffer.from(staged.new_public_key_spki, "base64url"), format: "der", type: "spki" });
      assert.equal(payload.gateway_id, gatewayId);
      const proof = ["observer-managed-device-rotation-v1", gatewayId, "1", rotationId, challenge].join("\n");
      assert(verify(null, Buffer.from(proof), key, Buffer.from(payload.signature, "base64url")));
      if (state.confirmationBody) assert.equal(options.body, state.confirmationBody);
      state.confirmationBody = options.body;
      state.cloudKey = key;
      if (state.loseResponse) throw new Error("lost_confirm_response");
      return Response.json({ data: { status: "ROTATED", credential_version: 1 } });
    }, ...overrides });
  return { manager, state, binding, run, target, baseline, approval, store, expectedBindingsDigest };
}

for (const profile of ["SOFTWARE_CONNECTOR", "PHYSICAL_GATEWAY"]) {
  test(`${profile}: resume a lost confirmation, recover failed install and keep all camera IDs`, async t => {
    const f = await fixture(t, profile);
    f.state.loseResponse = true;
    await assert.rejects(f.run(), /lost_confirm_response/);
    assert(f.state.cloudKey);
    assert.equal(f.state.installs, 0);
    assert.equal(f.manager.current().release_id, f.baseline.manifest.release_id);
    f.state.loseResponse = false;
    f.state.failInstall = true;
    await assert.rejects(f.run(), /transient_install_failure/);
    assert.equal(f.manager.status().state, "UPDATE_FAILED");
    assert.equal(f.store.read("device_credential_version"), "1");
    const key = f.store.read("device_private_key_pkcs8");
    await assert.rejects(f.run(), /RECOVERY_SCOPE_INVALID/);
    await assert.rejects(f.manager.apply(f.target), /RECOVERY_AUTHORIZATION_REQUIRED/);
    f.state.failInstall = false;
    f.approval.evidenceSha256 = "d".repeat(64);
    assert.equal((await f.run()).state, "HEALTHY");
    assert.equal((await f.run()).state, "HEALTHY");
    assert.equal(f.state.calls, 2);
    assert.equal(f.state.installs, 2);
    assert.equal(f.store.read("device_private_key_pkcs8"), key);
    assert.equal(productCameraBindingsDigest(f.state.rows, siteId), f.expectedBindingsDigest);
  });

  test(`${profile}: resume a restart from the exact promoted-on-disk slot`, async t => {
    const f = await fixture(t, profile);
    assert.equal((await f.run()).state, "HEALTHY");
    const healthy = f.manager.status();
    // Model a killed installer after committing CURRENT but before it finished
    // restarting. The completed fixture provides the same signed slot bytes.
    const baseline = f.manager.knownGood().filter(p => p.release_id === f.baseline.manifest.release_id);
    writeFileSync(f.manager.knownGoodPath, JSON.stringify(baseline));
    writeFileSync(f.manager.statePath, JSON.stringify({ ...healthy, state: "RESTARTING" }));
    const proof = f.approval.evidenceSha256;
    f.approval.evidenceSha256 = "c".repeat(64);
    await assert.rejects(f.run(), /RECOVERY_RESUME_INVALID/);
    f.approval.evidenceSha256 = proof;
    assert.equal((await f.run()).state, "HEALTHY");
    assert.equal(f.state.calls, 1);
    assert.equal(f.state.installs, 1);
    assert.deepEqual(f.state.restarts, [f.target.manifest.release_id, f.target.manifest.release_id]);
  });

  test(`${profile}: stop, retain the approved key and quarantine a release that fails after handoff`, async t => {
    const f = await fixture(t, profile);
    f.state.failHealth = true;
    assert.equal((await f.run()).state, "ACTION_REQUIRED");
    assert.deepEqual(f.state.restarts, [f.target.manifest.release_id, f.baseline.manifest.release_id]);
    assert.equal(f.manager.current().release_id, f.baseline.manifest.release_id);
    assert(f.manager.quarantine().some(row => row.release_id === f.target.manifest.release_id));
    assert.equal(f.store.read("device_credential_version"), "1");
    assert.equal(f.state.calls, 1);
    await assert.rejects(f.run(), /RECOVERY_SCOPE_INVALID/);
    assert.equal(f.state.installs, 1);
  });
}

test("duplicates, reassignment, artifact changes and a conflicting controller stop before confirmation", async t => {
  const f = await fixture(t, "PHYSICAL_GATEWAY");
  const original = structuredClone(f.state.rows);
  f.state.rows.push({ ...f.state.rows[0], cameraId: f.state.rows[1].cameraId });
  await assert.rejects(f.run(), /CAMERA_BINDINGS_DUPLICATE/);
  f.state.rows = structuredClone(original);
  f.state.rows[0].streamId = "different-stream";
  await assert.rejects(f.run(), /CAMERA_BINDINGS_CHANGED/);
  f.state.rows = original;
  await assert.rejects(f.run({ release: { ...f.target, approval: f.approval, artifactBytes: Buffer.from("bad") } }),
    /RECOVERY_BINDING_INVALID/);
  let releaseRead;
  const blockedRead = new Promise(resolve => { releaseRead = resolve; });
  const inFlight = f.run({ readCameraBindings: () => blockedRead });
  await assert.rejects(f.run(), { code: "EEXIST" });
  releaseRead([]);
  await assert.rejects(inFlight, /CAMERA_BINDINGS_INVALID/);
  assert.equal(f.state.calls, 0);
  assert.equal(f.state.installs, 0);
});

test("one authenticated Tapo route correction preserves the quarantined slot and uses the same device key", async t => {
  const f = await fixture(t, "SOFTWARE_CONNECTOR");
  const row = f.state.rows[0];
  const before = "dvr_001122334455667788_1", after = "dvr_ffeeddccbbaa998877_1";
  row.streamId = before;
  const originalDigest = productCameraBindingsDigest(f.state.rows, siteId);
  let reads = 0;
  assert.equal((await f.run({ expectedBindingsDigest: originalDigest, readCameraBindings: () => {
    if (++reads === 3) row.streamId = after;
    return structuredClone(f.state.rows);
  } })).state, "ACTION_REQUIRED");
  assert.equal(f.state.calls, 1);
  const key = f.store.read("device_private_key_pkcs8");
  const routeCorrection = { cameraId: row.cameraId, before, after, originalDigest };
  const scope = { ...routeCorrection, siteId, gatewayId };
  const proof = qualifyProductRouteCorrection(f.state.rows, scope);
  assert.throws(() => qualifyProductRouteCorrection([{ ...row, cameraId: rotationId }], scope), /ROUTE_CORRECTION_INVALID/);
  f.approval.routeCorrectionSha256 = proof.proofSha256;
  await assert.rejects(f.run({ routeCorrection, expectedBindingsDigest: proof.correctedDigest }), /ROUTE_RETRY_SCOPE_INVALID/);
  f.approval.evidenceSha256 = "c".repeat(64);
  assert.equal((await f.run({ routeCorrection, expectedBindingsDigest: proof.correctedDigest })).state, "HEALTHY");
  assert.equal(f.state.calls, 1);
  assert.equal(f.state.installs, 2);
  assert.equal(f.store.read("device_private_key_pkcs8"), key);
  assert(existsSync(join(f.manager.root, "slots", ".1.1.0-product-identity.previous-quarantined", "artifact.bin")));
  assert(existsSync(join(f.manager.root, "product-route-retry-1.1.0-product-identity.json")));
  await assert.rejects(f.manager.applyProductIdentityRecovery({ ...f.target, approval: f.approval }), /ROUTE_RETRY_SCOPE_INVALID/);
});
