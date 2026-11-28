// Issues public Home-QA trust material through the two existing protected KMS
// environments. The legacy QA verification key is pinned; no private key is
// loaded, copied, or emitted by this tool.
import { execFileSync } from "node:child_process";
import { createHash, createPublicKey } from "node:crypto";
import { appendFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateRemoteSignerConfig, signRemoteEdgeDocument } from "./remote-ed25519-signer.mjs";
import { verifyEdgeTrustRegistry } from "../../services/video-gateway/edge-release-trust.mjs";

export const LEGACY_QA_KEY_ID = "qa-p38f-ed25519-20260913";
export const LEGACY_QA_PUBLIC_KEY = "MCowBQYDK2VwAyEAKp4MSELVbUMyVI2DrOi5VnA0jGCKL_mFiphgeVLoglE";
export const LEGACY_QA_PUBLIC_KEY_SHA256 = "6efcf805c4829f4bc4264bbe57b96d9d8aab05a0aa82d87ce82e19eb520a4852";
const SPEC = "ECC_NIST_EDWARDS25519";
const ALGORITHM = "ED25519_SHA_512";
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const fail = code => { throw new Error(code); };

function checkedPublicKey(value, expectedSha) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{40,512}$/.test(value)) fail("HOME_QA_PUBLIC_KEY_INVALID");
  const bytes = Buffer.from(value, "base64url");
  if (sha256(bytes) !== expectedSha || createPublicKey({ key: bytes, format: "der", type: "spki" }).asymmetricKeyType !== "ed25519")
    fail("HOME_QA_PUBLIC_KEY_PIN_MISMATCH");
  return value;
}

export function buildHomeQaTrustRegistry({ rootKeyId, releaseKeyId, releasePublicKey, releasePublicKeySha256, issuedAt }) {
  checkedPublicKey(LEGACY_QA_PUBLIC_KEY, LEGACY_QA_PUBLIC_KEY_SHA256);
  checkedPublicKey(releasePublicKey, releasePublicKeySha256);
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(rootKeyId) || !/^[A-Za-z0-9._:-]{3,160}$/.test(releaseKeyId) ||
    new Set([rootKeyId, releaseKeyId, LEGACY_QA_KEY_ID]).size !== 3 ||
    releasePublicKey === LEGACY_QA_PUBLIC_KEY || !Number.isFinite(Date.parse(issuedAt))) fail("HOME_QA_TRUST_SCOPE_INVALID");
  return { protocol: "observer-edge-trust-registry-v1", epoch: 1, issued_at: issuedAt,
    root_key_id: rootKeyId, keys: [
      { key_id: LEGACY_QA_KEY_ID, public_key: LEGACY_QA_PUBLIC_KEY, state: "TRUSTED" },
      { key_id: releaseKeyId, public_key: releasePublicKey, state: "TRUSTED" }
    ], signature: "" };
}

function signerConfig(role) {
  const config = { keyArn: process.env.SIGNER_KEY_ARN, keyId: process.env.SIGNER_KEY_ID,
    publicKeySha256: process.env.SIGNER_PUBLIC_KEY_SHA256, role };
  validateRemoteSignerConfig(config);
  return config;
}

function createKmsCaller(region) {
  const temporary = mkdtempSync(join(tmpdir(), "observer-homeqa-kms-"));
  let sequence = 0;
  return { call(operation, request) {
    const path = join(temporary, `request-${++sequence}.json`);
    writeFileSync(path, JSON.stringify(request), { mode: 0o600, flag: "wx" });
    try {
      const result = execFileSync("aws", ["kms", operation, "--region", region,
        "--cli-input-json", `file://${path}`, "--output", "json", "--cli-binary-format", "base64", "--no-cli-pager"],
      { encoding: "utf8", timeout: 30_000, maxBuffer: 64 * 1024, stdio: ["ignore", "pipe", "ignore"],
        env: { ...process.env, AWS_MAX_ATTEMPTS: "2", AWS_RETRY_MODE: "standard" } });
      return JSON.parse(result);
    } catch { fail("HOME_QA_KMS_REQUEST_FAILED"); }
  }, close() { rmSync(temporary, { recursive: true, force: true }); } };
}

async function kmsPublic(config, call) {
  const response = await call("get-public-key", { KeyId: config.keyArn });
  if (response.KeyId !== config.keyArn || response.KeySpec !== SPEC || response.KeyUsage !== "SIGN_VERIFY" ||
    !response.SigningAlgorithms?.includes(ALGORITHM) || typeof response.PublicKey !== "string")
    fail("HOME_QA_KMS_PUBLIC_KEY_INVALID");
  const value = Buffer.from(response.PublicKey, "base64").toString("base64url");
  checkedPublicKey(value, config.publicKeySha256);
  return value;
}

function appendPublicOutput(publicKey, sha, keyId) {
  const path = process.env.GITHUB_OUTPUT;
  if (!path) fail("HOME_QA_GITHUB_OUTPUT_MISSING");
  appendFileSync(path, `public_key_spki=${publicKey}\npublic_key_sha256=${sha}\nkey_id=${keyId}\n`);
}

async function emitReleasePublic() {
  const config = signerConfig("RELEASE_MANIFEST");
  const kms = createKmsCaller(config.keyArn.split(":")[3]);
  try {
    const publicKey = await kmsPublic(config, kms.call);
    appendPublicOutput(publicKey, config.publicKeySha256, config.keyId);
    console.log(JSON.stringify({ status: "PUBLIC_RELEASE_KEY_VERIFIED", key_id: config.keyId,
      public_key_sha256: config.publicKeySha256 }));
  } finally { kms.close(); }
}

async function issueRootRegistry() {
  const config = signerConfig("ROOT_REGISTRY");
  const releasePublicKey = process.env.RELEASE_PUBLIC_KEY_SPKI;
  const releasePublicKeySha256 = process.env.RELEASE_PUBLIC_KEY_SHA256;
  const releaseKeyId = process.env.RELEASE_KEY_ID;
  const runnerTemp = resolve(process.env.RUNNER_TEMP || "");
  const output = resolve(process.env.TRUST_OUTPUT_DIR || "");
  if (!process.env.RUNNER_TEMP || !process.env.TRUST_OUTPUT_DIR || !output.startsWith(`${runnerTemp}/`) ||
    existsSync(output)) fail("HOME_QA_OUTPUT_SCOPE_INVALID");
  const kms = createKmsCaller(config.keyArn.split(":")[3]);
  try {
    const rootPublicKey = await kmsPublic(config, kms.call);
    const unsigned = buildHomeQaTrustRegistry({ rootKeyId: config.keyId, releaseKeyId,
      releasePublicKey, releasePublicKeySha256, issuedAt: new Date().toISOString() });
    const result = await signRemoteEdgeDocument({ document: unsigned, config, call: kms.call });
    const checked = verifyEdgeTrustRegistry(result.document,
      { pinnedRootKeyId: config.keyId, pinnedRootPublicKey: rootPublicKey });
    if (!checked.ok || Object.keys(checked.trustedPublicKeys).sort().join(",") !==
      [LEGACY_QA_KEY_ID, releaseKeyId].sort().join(",")) fail("HOME_QA_TRUST_VERIFICATION_FAILED");
    const tampered = structuredClone(result.document); tampered.keys[0].state = "REVOKED";
    if (verifyEdgeTrustRegistry(tampered, { pinnedRootKeyId: config.keyId, pinnedRootPublicKey: rootPublicKey }).ok)
      fail("HOME_QA_TRUST_TAMPER_ACCEPTED");
    const rootPin = { protocol: "observer-edge-trust-root-v1", root_key_id: config.keyId,
      root_public_key: rootPublicKey };
    mkdirSync(output, { mode: 0o700 });
    if (lstatSync(output).isSymbolicLink() || (lstatSync(output).mode & 0o077)) fail("HOME_QA_OUTPUT_UNSAFE");
    const registryBytes = Buffer.from(`${JSON.stringify(result.document, null, 2)}\n`);
    const pinBytes = Buffer.from(`${JSON.stringify(rootPin, null, 2)}\n`);
    writeFileSync(join(output, "release-keys.json"), registryBytes, { mode: 0o600, flag: "wx" });
    writeFileSync(join(output, "root-pin.json"), pinBytes, { mode: 0o600, flag: "wx" });
    const evidence = { protocol: "observer-home-qa-public-trust-issuance-v1", issued_at: result.document.issued_at,
      source_commit: process.env.GITHUB_SHA, root_key_id: config.keyId, root_public_key_sha256: config.publicKeySha256,
      trusted_release_key_ids: [LEGACY_QA_KEY_ID, releaseKeyId], legacy_qa_public_key_sha256: LEGACY_QA_PUBLIC_KEY_SHA256,
      release_public_key_sha256: releasePublicKeySha256, algorithm: ALGORITHM, epoch: 1,
      rotation_rule: "ROOT_SIGNED_MONOTONIC_EPOCH", revocation_rule: "TRUSTED_OR_REVOKED_PER_KEY",
      registry_sha256: sha256(registryBytes), root_pin_sha256: sha256(pinBytes),
      provider_signature_verified: result.evidence.provider_signature_verified, tampered_registry_rejected: true };
    writeFileSync(join(output, "issuance-evidence.json"), `${JSON.stringify(evidence, null, 2)}\n`,
      { mode: 0o600, flag: "wx" });
    console.log(JSON.stringify({ status: "AWS_SIGNED_PUBLIC_TRUST_REGISTRY_VERIFIED",
      root_key_id: config.keyId, release_key_ids: evidence.trusted_release_key_ids,
      registry_sha256: evidence.registry_sha256, algorithm: ALGORITHM }));
  } finally { kms.close(); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    if (process.argv[2] === "emit-release-public") await emitReleasePublic();
    else if (process.argv[2] === "issue-root-registry") await issueRootRegistry();
    else fail("HOME_QA_MODE_INVALID");
  } catch (error) {
    const code = /^HOME_QA_[A-Z0-9_]+$/.test(error.message) ? error.message : "HOME_QA_TRUST_ISSUANCE_FAILED";
    console.error(code);
    process.exitCode = 1;
  }
}
