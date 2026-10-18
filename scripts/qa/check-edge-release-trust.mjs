import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalEdgeTrustRegistry, installEdgeTrustRegistry, loadEdgeTrustRegistry, loadPinnedEdgeReleaseKeys, verifyEdgeTrustRegistry } from "../../services/video-gateway/edge-release-trust.mjs";
import { runEdgeUpdateCycle } from "../../services/video-gateway/edge-update-agent.mjs";
import { canonicalEdgeUpdateManifest, verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";

const root = generateKeyPairSync("ed25519"), old = generateKeyPairSync("ed25519"), next = generateKeyPairSync("ed25519");
const pub = pair => pair.publicKey.export({ format: "der", type: "spki" }).toString("base64url");
const rootOptions = { pinnedRootKeyId: "qa-p38g-root", pinnedRootPublicKey: pub(root) };
const key = (key_id, pair, state = "TRUSTED") => ({ key_id, public_key: pub(pair), state });
const make = (epoch, keys) => { const registry = { protocol: "observer-edge-trust-registry-v1", epoch,
  issued_at: new Date().toISOString(), root_key_id: rootOptions.pinnedRootKeyId, keys, signature: "" };
  registry.signature = sign(null, Buffer.from(canonicalEdgeTrustRegistry(registry)), root.privateKey).toString("base64url"); return registry; };
const home = mkdtempSync(join(tmpdir(), "observer-p38g-trust-"));
try {
  const path = join(home, "protected", "release-keys.json");
  const first = make(1, [key("qa-old", old)]);
  assert.equal(installEdgeTrustRegistry({ path, registry: first, ...rootOptions }).epoch, 1);
  assert.equal(loadEdgeTrustRegistry({ path, ...rootOptions }).trustedPublicKeys["qa-old"], pub(old));
  const released = { protocol: "observer-edge-update-v1", release_id: "qa-trust-old-release", version: "1.0.0",
    build_sha: "a".repeat(64), channel: "INTERNAL", platform: "darwin", architecture: "arm64", profile: "PHYSICAL_GATEWAY",
    artifact_url: "https://qa.invalid/test", artifact_sha256: "b".repeat(64), artifact_size: 1, signing_key_id: "qa-old",
    compatibility: { minimum_current_version: "1.0.0", maximum_current_version: null, minimum_config_version: 1,
      maximum_config_version: 1, security_floor_version: "1.0.0" }, released_at: new Date().toISOString(),
    rollout: { stage: "INTERNAL_QA", cohort_seed: "qa-rotation", cohort_percent: 100, explicit_device_ids: [] }, signature: "" };
  released.signature = sign(null, Buffer.from(canonicalEdgeUpdateManifest(released)), old.privateKey).toString("base64url");
  assert.equal(verifyEdgeUpdateManifest(released, loadEdgeTrustRegistry({ path, ...rootOptions }).trustedPublicKeys).ok, true);
  const rotated = make(2, [key("qa-old", old), key("qa-next", next)]);
  installEdgeTrustRegistry({ path, registry: rotated, ...rootOptions });
  const nextRelease = { ...released, release_id: "qa-trust-next-release", signing_key_id: "qa-next", signature: "" };
  nextRelease.signature = sign(null, Buffer.from(canonicalEdgeUpdateManifest(nextRelease)), next.privateKey).toString("base64url");
  assert.equal(verifyEdgeUpdateManifest(nextRelease, loadEdgeTrustRegistry({ path, ...rootOptions }).trustedPublicKeys).ok, true);
  const revoked = make(3, [key("qa-old", old, "REVOKED"), key("qa-next", next)]);
  installEdgeTrustRegistry({ path, registry: revoked, ...rootOptions });
  const trusted = loadEdgeTrustRegistry({ path, ...rootOptions }).trustedPublicKeys;
  assert.equal(verifyEdgeUpdateManifest(nextRelease, trusted).ok, true);
  assert.equal(verifyEdgeUpdateManifest(released, trusted).reason, "EDGE_UPDATE_SIGNING_KEY_UNTRUSTED");
  assert.equal(verifyEdgeTrustRegistry(revoked, { pinnedRootKeyId: "attacker", pinnedRootPublicKey: pub(root) }).ok, false);
  assert.equal(verifyEdgeTrustRegistry({ ...revoked, keys: [key("qa-old", old)] }, rootOptions).ok, false);
  assert.throws(() => installEdgeTrustRegistry({ path, registry: first, ...rootOptions }), /EDGE_TRUST_EPOCH_ROLLBACK/);
  assert.equal(JSON.parse(readFileSync(path)).epoch, 3);
  const rootPinPath = join(home, "root-pin.json");
  writeFileSync(rootPinPath, JSON.stringify({ protocol: "observer-edge-trust-root-v1",
    root_key_id: rootOptions.pinnedRootKeyId, root_public_key: rootOptions.pinnedRootPublicKey }), { mode: 0o600 });
  assert.equal(loadPinnedEdgeReleaseKeys({ registryPath: path, rootPinPath, qaOwnerAllowed: true }).epoch, 3);
  const attacker = generateKeyPairSync("ed25519");
  writeFileSync(rootPinPath, JSON.stringify({ protocol: "observer-edge-trust-root-v1",
    root_key_id: "qa-attacker", root_public_key: pub(attacker) }));
  assert.throws(() => loadPinnedEdgeReleaseKeys({ registryPath: path, rootPinPath, qaOwnerAllowed: true }), /EDGE_TRUST_ROOT_MISMATCH/);
  await assert.rejects(runEdgeUpdateCycle({ root: home, trustedPublicKeys: { attacker: pub(attacker) },
    device: {}, cloudRequest: async () => null }), /EDGE_UPDATE_UNPINNED_KEYS_FORBIDDEN/);
  console.log(JSON.stringify({ status: "PASS", root_pin: "QA_ONLY", epochs: [1, 2, 3], rotation: true,
    revoked_old_release_rejected: true, unauthorized_root_rejected: true, replay_rejected: true,
    pinned_loader: true, update_agent_unpinned_keys_rejected: true }));
} finally { rmSync(home, { recursive: true, force: true }); }
