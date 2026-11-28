import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { buildHomeQaTrustRegistry, LEGACY_QA_KEY_ID, LEGACY_QA_PUBLIC_KEY } from "../release/issue-home-qa-trust-registry.mjs";
import { canonicalEdgeTrustRegistry, verifyEdgeTrustRegistry } from "../../services/video-gateway/edge-release-trust.mjs";

const release = generateKeyPairSync("ed25519");
const root = generateKeyPairSync("ed25519");
const publicDer = key => key.export({ format: "der", type: "spki" });
const releasePublic = publicDer(release.publicKey).toString("base64url");
const releaseSha = createHash("sha256").update(publicDer(release.publicKey)).digest("hex");
const rootPublic = publicDer(root.publicKey).toString("base64url");
const args = { rootKeyId: "aws-root-test", releaseKeyId: "aws-release-test",
  releasePublicKey: releasePublic, releasePublicKeySha256: releaseSha, issuedAt: new Date().toISOString() };
const registry = buildHomeQaTrustRegistry(args);
assert.equal(registry.keys.length, 2);
assert.deepEqual(registry.keys.map(key => key.key_id), [LEGACY_QA_KEY_ID, "aws-release-test"]);
assert.ok(registry.keys.every(key => key.state === "TRUSTED"));
registry.signature = sign(null, Buffer.from(canonicalEdgeTrustRegistry(registry)), root.privateKey).toString("base64url");
assert.equal(verifyEdgeTrustRegistry(registry, { pinnedRootKeyId: args.rootKeyId, pinnedRootPublicKey: rootPublic }).ok, true);
const tampered = structuredClone(registry); tampered.keys[0].state = "REVOKED";
assert.equal(verifyEdgeTrustRegistry(tampered, { pinnedRootKeyId: args.rootKeyId, pinnedRootPublicKey: rootPublic }).ok, false);
assert.throws(() => buildHomeQaTrustRegistry({ ...args, releasePublicKeySha256: "0".repeat(64) }), /HOME_QA_PUBLIC_KEY_PIN_MISMATCH/);
assert.throws(() => buildHomeQaTrustRegistry({ ...args, releaseKeyId: args.rootKeyId }), /HOME_QA_TRUST_SCOPE_INVALID/);
assert.throws(() => buildHomeQaTrustRegistry({ ...args, releaseKeyId: LEGACY_QA_KEY_ID }), /HOME_QA_TRUST_SCOPE_INVALID/);
assert.throws(() => buildHomeQaTrustRegistry({ ...args, releasePublicKey: LEGACY_QA_PUBLIC_KEY,
  releasePublicKeySha256: "6efcf805c4829f4bc4264bbe57b96d9d8aab05a0aa82d87ce82e19eb520a4852" }), /HOME_QA_TRUST_SCOPE_INVALID/);
console.log(JSON.stringify({ result: "PASS", cases: 9, scope: "FIXED_HOME_QA_PUBLIC_TRUST_ISSUANCE",
  aws_live_signature: false }));
