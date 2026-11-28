// QA-only, offline derivation. Never modifies the installed Connector.
import { execFileSync } from "node:child_process";
import { createHash, createPrivateKey, createPublicKey, sign } from "node:crypto";
import { chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";
import { canonicalEdgeUpdateManifest, verifyEdgeArtifact, verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { canonicalLegacyTransitionRecord, verifyLegacyTransitionRecord } from "../../services/video-gateway/edge-connector-legacy-transition.mjs";
import { inspectArchive } from "../../services/video-gateway/edge-macos-installed-adapter.mjs";

const args = Object.fromEntries(process.argv.slice(2).map(x => { const at = x.indexOf("="); return [x.slice(0, at), x.slice(at + 1)]; }));
for (const key of ["--legacy-store", "--derived-store", "--out", "--qa-private-key", "--key-id", "--device-id"])
  if (!args[key]) throw new Error(`P38L_REQUIRED_${key}`);
if (!args["--key-id"].startsWith("qa-") || !/^qa-[a-z0-9-]+$/.test(args["--device-id"]))
  throw new Error("P38L_QA_SCOPE_REQUIRED");
const legacyDir = join(resolve(args["--legacy-store"]), "qa-legacy-connector-ee82c20a77ac");
const derivedDir = join(resolve(args["--derived-store"]), "qa-legacy-connector-resigned-6e7988808b05");
const legacy = JSON.parse(readFileSync(join(legacyDir, "release.json"), "utf8"));
const derived = JSON.parse(readFileSync(join(derivedDir, "release.json"), "utf8"));
const legacyArchive = join(legacyDir, "connector-app.tar.gz");
const derivedArchive = join(derivedDir, "connector-legacy-resigned.tar.gz");
const trusted = JSON.parse(readFileSync(join(resolve(args["--legacy-store"]), "qa-trust-registry.json"))).trustedPublicKeys;
for (const [manifest, path] of [[legacy, legacyArchive], [derived, derivedArchive]]) {
  if (!verifyEdgeUpdateManifest(manifest, trusted).ok || !verifyEdgeArtifact(readFileSync(path), manifest).ok ||
    manifest.profile !== "SOFTWARE_CONNECTOR" || manifest.platform !== "darwin" || manifest.architecture !== "arm64")
    throw new Error("P38L_INPUT_RELEASE_UNTRUSTED");
  inspectArchive(path);
}
const temporary = mkdtempSync(join(tmpdir(), "observer-p38l-equivalence-"));
try {
  const oldRoot = join(temporary, "old"), newRoot = join(temporary, "new");
  mkdirSync(oldRoot); mkdirSync(newRoot);
  execFileSync("tar", ["-xzf", legacyArchive, "-C", oldRoot]);
  execFileSync("tar", ["-xzf", derivedArchive, "-C", newRoot]);
  const app = "Digital Observer.app", executable = `${app}/Contents/MacOS/DigitalObserver`;
  const seal = `${app}/Contents/_CodeSignature/CodeResources`;
  let originalSealValid = true;
  try { execFileSync("/usr/bin/codesign", ["--verify", "--deep", "--strict", join(oldRoot, app)], { stdio: "ignore" }); }
  catch { originalSealValid = false; }
  if (originalSealValid) throw new Error("P38L_LEGACY_SEAL_UNEXPECTEDLY_VALID");
  execFileSync("/usr/bin/codesign", ["--verify", "--deep", "--strict", join(newRoot, app)]);
  function inventory(root) {
    const entries = new Map();
    const walk = directory => { for (const name of readdirSync(directory)) {
      const path = join(directory, name), info = lstatSync(path);
      if (info.isDirectory()) { walk(path); continue; }
      if (!info.isFile() || info.isSymbolicLink()) throw new Error("P38L_UNSAFE_PAYLOAD_MEMBER");
      entries.set(relative(root, path), createHash("sha256").update(readFileSync(path)).digest("hex"));
    } };
    walk(root); return entries;
  }
  const oldFiles = inventory(oldRoot), newFiles = inventory(newRoot);
  if (oldFiles.size !== newFiles.size || oldFiles.size < 200 ||
    [...oldFiles.keys()].some(path => !newFiles.has(path)) ||
    [...oldFiles.keys()].some(path => path !== executable && path !== seal && oldFiles.get(path) !== newFiles.get(path)))
    throw new Error("P38L_NON_SIGNING_PAYLOAD_DELTA");
  if (oldFiles.get(executable) === newFiles.get(executable) || oldFiles.get(seal) === newFiles.get(seal))
    throw new Error("P38L_EXPECTED_SIGNING_DELTA_ABSENT");
  // Strip only QA copies; the archives and installed app remain untouched.
  execFileSync("/usr/bin/codesign", ["--remove-signature", join(oldRoot, app)]);
  execFileSync("/usr/bin/codesign", ["--remove-signature", join(newRoot, app)]);
  const unsignedOld = readFileSync(join(oldRoot, executable));
  const unsignedNew = readFileSync(join(newRoot, executable));
  if (!unsignedOld.equals(unsignedNew)) throw new Error("P38L_EXECUTABLE_CODE_DELTA");
  const payload = [...oldFiles].filter(([path]) => path !== executable && path !== seal)
    .concat([[executable, createHash("sha256").update(unsignedOld).digest("hex")]])
    .sort(([a], [b]) => a.localeCompare(b));
  const payloadDigest = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  const resources = payload.filter(([path]) => path.startsWith(`${app}/Contents/Resources/`));
  const resourceDigest = createHash("sha256").update(JSON.stringify(resources)).digest("hex");
  for (const path of ["Contents/Resources/bin/node", "Contents/Resources/bin/ffmpeg",
    "Contents/Resources/bin/ffprobe", "Contents/Resources/models/ssd_mobilenet_v1_10.onnx",
    "Contents/Resources/runtime/node_modules"]) {
    if (![...oldFiles.keys()].some(name => name.startsWith(`${app}/${path}`))) throw new Error("P38L_RUNTIME_DEPENDENCY_MISSING");
  }
  const keyPath = resolve(args["--qa-private-key"]);
  if (statSync(keyPath).mode & 0o077) throw new Error("P38L_SIGNER_PERMISSIONS_UNSAFE");
  const privateKey = createPrivateKey(readFileSync(keyPath));
  if (privateKey.asymmetricKeyType !== "ed25519") throw new Error("P38L_SIGNER_ALGORITHM_INVALID");
  const publicKey = createPublicKey(privateKey).export({ format: "der", type: "spki" }).toString("base64url");
  if (publicKey !== trusted[args["--key-id"]]) throw new Error("P38L_SIGNER_NOT_TRUSTED");
  const id = `qa-connector-legacy-transition-v2-${derived.artifact_sha256.slice(0, 12)}`;
  const artifactName = basename(derivedArchive);
  const manifest = { ...derived, release_id: id,
    artifact_url: `https://qa.invalid/${id}/${artifactName}`, released_at: new Date().toISOString(),
    signature: "" };
  manifest.signature = sign(null, Buffer.from(canonicalEdgeUpdateManifest(manifest)), privateKey).toString("base64url");
  if (!verifyEdgeUpdateManifest(manifest, trusted).ok ||
    !verifyEdgeArtifact(readFileSync(derivedArchive), manifest).ok) throw new Error("P38L_TRANSITION_RELEASE_INVALID");
  const record = { protocol: "observer-connector-legacy-transition-v2",
    purpose: "CONNECTOR_LEGACY_TO_MANAGED_TRANSITION", device_id: args["--device-id"],
    profile: "SOFTWARE_CONNECTOR", platform: "darwin", architecture: "arm64",
    legacy_release_id: legacy.release_id, legacy_artifact_sha256: legacy.artifact_sha256,
    transition_release_id: manifest.release_id, transition_artifact_sha256: manifest.artifact_sha256,
    payload_equivalence_sha256: payloadDigest, resource_inventory_sha256: resourceDigest,
    source_lineage: { category: "CAPTURED_LEGACY_MIXED_GIT_BLOBS", single_build_commit: null,
      verified_blobs: [
        { path: "scripts/run-software-connector.mjs", commit: "dfbd604f", blob_sha1: "29e575540362327b3299decbe80a5b034f0d3b9d" },
        { path: "services/video-gateway/software-connector-cloud.mjs", commit: "d924ea9d", blob_sha1: "91ac9b33416c60a044a77765a23d243cb9544bf7" },
        { path: "services/video-gateway/managed-device-auth.mjs", commit: "d924ea9d", blob_sha1: "0251555ba5e977d8d4ca22e93bd11cd4321050d2" }
      ] },
    configuration_expectation: "IDENTITY_CREDENTIALS_SITE_SOURCES_AND_QUEUES_EXTERNAL",
    runtime_dependencies: ["Contents/Resources/bin/node", "Contents/Resources/bin/ffmpeg",
      "Contents/Resources/bin/ffprobe", "Contents/Resources/models/ssd_mobilenet_v1_10.onnx",
      "Contents/Resources/runtime/node_modules"],
    intentional_signing_paths: ["Contents/MacOS/DigitalObserver", "Contents/_CodeSignature/CodeResources"],
    signing_key_id: args["--key-id"],
    created_at: new Date().toISOString(), signature: "" };
  record.signature = sign(null, Buffer.from(canonicalLegacyTransitionRecord(record)), privateKey).toString("base64url");
  if (!verifyLegacyTransitionRecord(record, { trustedPublicKeys: trusted,
    device: { deviceId: args["--device-id"], profile: "SOFTWARE_CONNECTOR", platform: "darwin", architecture: "arm64" },
    legacyManifest: legacy, transitionManifest: manifest }).ok) throw new Error("P38L_DERIVATION_RECORD_INVALID");
  const out = resolve(args["--out"]);
  if (existsSync(out)) throw new Error("P38L_IMMUTABLE_RELEASE_EXISTS");
  mkdirSync(out, { recursive: true, mode: 0o700 });
  copyFileSync(derivedArchive, join(out, artifactName));
  chmodSync(join(out, artifactName), 0o600);
  writeFileSync(join(out, "release.json"), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  writeFileSync(join(out, "derivation.json"), `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  console.log(JSON.stringify({ status: "QA_TRANSITION_AUTHORIZED", release_id: id, version: manifest.version,
    artifact_sha256: manifest.artifact_sha256, legacy_artifact_sha256: legacy.artifact_sha256,
    payload_equivalence_sha256: payloadDigest, resource_inventory_sha256: resourceDigest, file_count: oldFiles.size,
    unchanged_payload_files: oldFiles.size - 2, executable_unsigned_equal: true,
    intentional_differences: [executable, seal], signer: manifest.signing_key_id }));
} finally { rmSync(temporary, { recursive: true, force: true }); }
