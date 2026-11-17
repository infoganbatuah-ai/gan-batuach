// Converts the captured invalidly sealed Connector into a QA-only strict-valid
// rollback package. Runtime source remains byte-for-byte; app seal changes.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, createPrivateKey, createPublicKey, sign } from "node:crypto";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { canonicalEdgeUpdateManifest, verifyEdgeArtifact, verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";

const args = Object.fromEntries(process.argv.slice(2).map(value => { const equal = value.indexOf("="); return [value.slice(0, equal), value.slice(equal + 1)]; }));
for (const name of ["--baseline-store", "--store", "--qa-private-key", "--key-id"])
  if (!args[name]) throw new Error(`INPUT_REQUIRED_${name}`);
if (!args["--key-id"].startsWith("qa-")) throw new Error("QA_KEY_REQUIRED");
const baseline = join(resolve(args["--baseline-store"]), "qa-legacy-connector-ee82c20a77ac");
const oldManifest = JSON.parse(readFileSync(join(baseline, "release.json")));
const oldBytes = readFileSync(join(baseline, "connector-app.tar.gz"));
const oldTrust = JSON.parse(readFileSync(join(resolve(args["--baseline-store"]), "qa-trust-registry.json"))).trustedPublicKeys;
assert.equal(verifyEdgeUpdateManifest(oldManifest, oldTrust).ok, true);
assert.equal(verifyEdgeArtifact(oldBytes, oldManifest).ok, true);
const keyPath = resolve(args["--qa-private-key"]);
if (statSync(keyPath).mode & 0o077) throw new Error("QA_KEY_PERMISSIONS_UNSAFE");
const privateKey = createPrivateKey(readFileSync(keyPath));
const publicKey = createPublicKey(privateKey).export({ format: "der", type: "spki" }).toString("base64url");
const temp = mkdtempSync(join(tmpdir(), "observer-p38g-resigned-legacy-"));
try {
  const original = join(temp, "original"), repaired = join(temp, "repaired");
  mkdirSync(original); mkdirSync(repaired);
  execFileSync("tar", ["-xzf", join(baseline, "connector-app.tar.gz"), "-C", original]);
  execFileSync("tar", ["-xzf", join(baseline, "connector-app.tar.gz"), "-C", repaired]);
  const app = join(repaired, "Digital Observer.app");
  execFileSync("/usr/bin/codesign", ["--force", "--sign", "-", app]);
  execFileSync("/usr/bin/codesign", ["--verify", "--deep", "--strict", app]);
  let compared = 0;
  function compare(directory) { for (const name of readdirSync(directory, { withFileTypes: true })) {
    const source = join(directory, name.name), rel = relative(original, source), target = join(repaired, rel);
    if (rel.includes("/_CodeSignature/") || rel.endsWith("/MacOS/DigitalObserver")) continue;
    if (name.isDirectory()) compare(source);
    else { assert.equal(createHash("sha256").update(readFileSync(source)).digest("hex"),
      createHash("sha256").update(readFileSync(target)).digest("hex"), `runtime_changed:${rel}`); compared += 1; }
  } }
  compare(original);
  const packagePath = join(temp, "connector-legacy-resigned.tar.gz");
  execFileSync("tar", ["-czf", packagePath, "-C", repaired, "Digital Observer.app"]);
  const bytes = readFileSync(packagePath), digest = createHash("sha256").update(bytes).digest("hex");
  const releaseId = `qa-legacy-connector-resigned-${digest.slice(0, 12)}`;
  const manifest = { ...oldManifest, release_id: releaseId, build_sha: digest, artifact_url: `https://qa.invalid/${releaseId}/connector-legacy-resigned.tar.gz`,
    artifact_sha256: digest, artifact_size: bytes.length, released_at: new Date().toISOString(), signature: "" };
  manifest.signature = sign(null, Buffer.from(canonicalEdgeUpdateManifest(manifest)), privateKey).toString("base64url");
  assert.equal(verifyEdgeUpdateManifest(manifest, { [args["--key-id"]]: publicKey }).ok, true);
  const destination = join(resolve(args["--store"]), releaseId);
  if (existsSync(destination)) throw new Error("QA_RELEASE_IMMUTABLE_EXISTS");
  mkdirSync(destination, { recursive: true, mode: 0o700 });
  copyFileSync(packagePath, join(destination, "connector-legacy-resigned.tar.gz"));
  chmodSync(join(destination, "connector-legacy-resigned.tar.gz"), 0o600);
  assert.equal(verifyEdgeArtifact(readFileSync(join(destination, "connector-legacy-resigned.tar.gz")), manifest).ok, true);
  writeFileSync(join(destination, "release.json"), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  console.log(JSON.stringify({ status: "QA_RESIGNED_LEGACY_BASELINE", release_id: releaseId,
    artifact_sha256: digest, runtime_files_unchanged: compared, signature_strict: "PASS", source_git_sha: null }));
} finally { rmSync(temp, { recursive: true, force: true }); }
