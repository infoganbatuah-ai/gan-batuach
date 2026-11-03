// Read-only live identity input; writes only a QA-only per-device derivation
// record outside the installed Connector and repository.
import { createHash, createPrivateKey, createPublicKey, sign } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { canonicalLegacyTransitionRecord, verifyLegacyTransitionRecord } from "../../services/video-gateway/edge-connector-legacy-transition.mjs";

const [legacyStore, transitionDir, signerPath, output] = process.argv.slice(2);
if (!legacyStore || !transitionDir || !signerPath || !output) throw new Error("P38L_BIND_INPUT_REQUIRED");
const idPath = join(homedir(), "Library/Application Support/Digital Observer/Tapo Connector/secrets/device_gateway_id");
const deviceId = readFileSync(idPath, "utf8").trim();
if (!/^[A-Za-z0-9._:-]{3,160}$/.test(deviceId)) throw new Error("P38L_LIVE_DEVICE_ID_INVALID");
const legacy = JSON.parse(readFileSync(join(resolve(legacyStore), "qa-legacy-connector-ee82c20a77ac/release.json")));
const transition = JSON.parse(readFileSync(join(resolve(transitionDir), "release.json")));
const original = JSON.parse(readFileSync(join(resolve(transitionDir), "derivation.json")));
const trusted = JSON.parse(readFileSync(join(resolve(legacyStore), "qa-trust-registry.json"))).trustedPublicKeys;
const qaDevice = { deviceId: original.device_id, profile: "SOFTWARE_CONNECTOR", platform: "darwin", architecture: "arm64" };
if (!original.device_id.startsWith("qa-") || !verifyLegacyTransitionRecord(original, { trustedPublicKeys: trusted,
  device: qaDevice, legacyManifest: legacy, transitionManifest: transition }).ok)
  throw new Error("P38L_QA_DERIVATION_INVALID");
if (statSync(signerPath).mode & 0o077) throw new Error("P38L_SIGNER_PERMISSIONS_UNSAFE");
const key = createPrivateKey(readFileSync(signerPath));
const publicKey = createPublicKey(key).export({ format: "der", type: "spki" }).toString("base64url");
if (key.asymmetricKeyType !== "ed25519" || publicKey !== trusted[original.signing_key_id])
  throw new Error("P38L_SIGNER_NOT_TRUSTED");
const record = { ...original, device_id: deviceId, created_at: new Date().toISOString(), signature: "" };
record.signature = sign(null, Buffer.from(canonicalLegacyTransitionRecord(record)), key).toString("base64url");
const device = { ...qaDevice, deviceId };
if (!verifyLegacyTransitionRecord(record, { trustedPublicKeys: trusted, device,
  legacyManifest: legacy, transitionManifest: transition }).ok) throw new Error("P38L_LIVE_DERIVATION_INVALID");
const target = resolve(output);
if (existsSync(target)) throw new Error("P38L_LIVE_BINDING_IMMUTABLE_EXISTS");
mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
writeFileSync(target, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600, flag: "wx" });
console.log(JSON.stringify({ status: "QA_PILOT_DEVICE_BINDING_SIGNED", record_sha256:
  createHash("sha256").update(readFileSync(target)).digest("hex"),
  device_fingerprint: createHash("sha256").update(deviceId).digest("hex").slice(0, 12),
  legacy_artifact_sha256: record.legacy_artifact_sha256,
  transition_artifact_sha256: record.transition_artifact_sha256, live_runtime_writes: 0 }));
