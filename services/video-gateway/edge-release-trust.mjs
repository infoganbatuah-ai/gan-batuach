import { createHash, createPublicKey, verify } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const KEY = /^[A-Za-z0-9._:-]{3,160}$/;
const B64 = /^[A-Za-z0-9_-]{40,512}$/;
function fail(code) { throw Object.assign(new Error(code), { code }); }
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stable(v)]));
  return value;
}
export function canonicalEdgeTrustRegistry(input) { const copy = structuredClone(input); delete copy.signature; return JSON.stringify(stable(copy)); }
export function verifyEdgeTrustRegistry(input, { pinnedRootKeyId, pinnedRootPublicKey, minimumEpoch = 0 }) {
  try {
    if (!input || Object.keys(input).sort().join(",") !== ["epoch", "issued_at", "keys", "protocol", "root_key_id", "signature"].sort().join(",")) fail("EDGE_TRUST_REGISTRY_MALFORMED");
    if (input.protocol !== "observer-edge-trust-registry-v1" || input.root_key_id !== pinnedRootKeyId || !KEY.test(input.root_key_id)) fail("EDGE_TRUST_ROOT_MISMATCH");
    if (!Number.isSafeInteger(input.epoch) || input.epoch < 1 || input.epoch < minimumEpoch) fail("EDGE_TRUST_EPOCH_ROLLBACK");
    if (!Number.isFinite(Date.parse(input.issued_at)) || Date.parse(input.issued_at) > Date.now() + 300_000) fail("EDGE_TRUST_TIME_INVALID");
    if (!Array.isArray(input.keys) || input.keys.length < 1 || input.keys.length > 32) fail("EDGE_TRUST_KEYS_INVALID");
    const trustedPublicKeys = {};
    const seen = new Set();
    for (const entry of input.keys) {
      if (!entry || Object.keys(entry).sort().join(",") !== ["key_id", "public_key", "state"].sort().join(",") ||
        !KEY.test(entry.key_id) || !B64.test(entry.public_key) || !["TRUSTED", "REVOKED"].includes(entry.state) || seen.has(entry.key_id)) fail("EDGE_TRUST_KEYS_INVALID");
      seen.add(entry.key_id);
      if (entry.state === "TRUSTED") trustedPublicKeys[entry.key_id] = entry.public_key;
    }
    if (!B64.test(input.signature) || !B64.test(pinnedRootPublicKey)) fail("EDGE_TRUST_SIGNATURE_INVALID");
    const root = createPublicKey({ key: Buffer.from(pinnedRootPublicKey, "base64url"), format: "der", type: "spki" });
    if (root.asymmetricKeyType !== "ed25519" || !verify(null, Buffer.from(canonicalEdgeTrustRegistry(input)), root, Buffer.from(input.signature, "base64url"))) fail("EDGE_TRUST_SIGNATURE_INVALID");
    return { ok: true, trustedPublicKeys };
  } catch (error) { return { ok: false, reason: error.code || "EDGE_TRUST_REGISTRY_MALFORMED" }; }
}

// The root public key must be pinned by the signed installer/package, never
// supplied by an unauthenticated cloud response or local update request.
export function installEdgeTrustRegistry({ path, registry, pinnedRootKeyId, pinnedRootPublicKey }) {
  const target = resolve(path), directory = dirname(target);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  if (lstatSync(directory).isSymbolicLink() || (lstatSync(directory).mode & 0o022)) fail("EDGE_TRUST_STORE_UNSAFE");
  const prior = existsSync(target) ? JSON.parse(readFileSync(target, "utf8")) : null;
  if (prior && (lstatSync(target).isSymbolicLink() || (lstatSync(target).mode & 0o022))) fail("EDGE_TRUST_STORE_UNSAFE");
  const previous = prior ? verifyEdgeTrustRegistry(prior, { pinnedRootKeyId, pinnedRootPublicKey }) : null;
  if (prior && !previous?.ok) fail("EDGE_TRUST_PREVIOUS_INVALID");
  const verified = verifyEdgeTrustRegistry(registry, { pinnedRootKeyId, pinnedRootPublicKey, minimumEpoch: prior ? prior.epoch + 1 : 1 });
  if (!verified.ok) fail(verified.reason);
  const temporary = `${target}.${process.pid}.staging`;
  writeFileSync(temporary, `${JSON.stringify(registry, null, 2)}\n`, { mode: 0o644, flag: "wx" });
  renameSync(temporary, target);
  return { epoch: registry.epoch, trustedPublicKeys: verified.trustedPublicKeys };
}

export function loadEdgeTrustRegistry({ path, pinnedRootKeyId, pinnedRootPublicKey }) {
  const target = resolve(path);
  if (!existsSync(target) || lstatSync(dirname(target)).isSymbolicLink() || (lstatSync(dirname(target)).mode & 0o022) ||
    lstatSync(target).isSymbolicLink() || (lstatSync(target).mode & 0o022)) fail("EDGE_TRUST_STORE_UNSAFE");
  const registry = JSON.parse(readFileSync(target, "utf8"));
  const verified = verifyEdgeTrustRegistry(registry, { pinnedRootKeyId, pinnedRootPublicKey });
  if (!verified.ok) fail(verified.reason);
  return { epoch: registry.epoch, trustedPublicKeys: verified.trustedPublicKeys };
}

export const PROTECTED_EDGE_TRUST_ROOT_PATH = "/Library/Application Support/Digital Observer/release-trust/root-pin.json";
export const PROTECTED_EDGE_TRUST_REGISTRY_PATH = "/Library/Application Support/Digital Observer/release-trust/release-keys.json";

export function loadPinnedEdgeReleaseKeys({ registryPath, rootPinPath = PROTECTED_EDGE_TRUST_ROOT_PATH, qaOwnerAllowed = false }) {
  const path = resolve(rootPinPath), info = lstatSync(path), parent = lstatSync(dirname(path));
  if (info.isSymbolicLink() || parent.isSymbolicLink() || (info.mode & 0o022) || (parent.mode & 0o022) ||
    (!qaOwnerAllowed && (info.uid !== 0 || parent.uid !== 0))) fail("EDGE_TRUST_ROOT_PIN_UNPROTECTED");
  const pin = JSON.parse(readFileSync(path, "utf8"));
  if (!pin || Object.keys(pin).sort().join(",") !== ["protocol", "root_key_id", "root_public_key"].sort().join(",") ||
    pin.protocol !== "observer-edge-trust-root-v1" || !KEY.test(pin.root_key_id) || !B64.test(pin.root_public_key)) fail("EDGE_TRUST_ROOT_PIN_INVALID");
  const registry = loadEdgeTrustRegistry({ path: registryPath, pinnedRootKeyId: pin.root_key_id, pinnedRootPublicKey: pin.root_public_key });
  return { ...registry, root_key_id: pin.root_key_id, root_fingerprint_sha256: createHash("sha256").update(Buffer.from(pin.root_public_key, "base64url")).digest("hex") };
}
