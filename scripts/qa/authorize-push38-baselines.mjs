// QA-only release-custody tool. Never installs or starts a live runtime.
import { createHash, createPrivateKey, createPublicKey, sign } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { canonicalEdgeUpdateManifest, verifyEdgeArtifact, verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";

function fail(reason) { throw new Error(reason); }
const args = Object.fromEntries(process.argv.slice(2).map(value => { const equal = value.indexOf("="); return [value.slice(0, equal), value.slice(equal + 1)]; }));
for (const required of ["--candidates", "--candidate-root", "--store", "--qa-private-key", "--key-id"])
  if (!args[required]) fail(`REQUIRED_${required}`);
if (!args["--key-id"].startsWith("qa-")) fail("QA_KEY_ID_REQUIRED");
const candidates = JSON.parse(readFileSync(resolve(args["--candidates"]), "utf8"));
if (candidates.contract !== "observer-legacy-baseline-candidate-v1" ||
  !Array.isArray(candidates.artifacts) || candidates.artifacts.length < 1 || candidates.artifacts.length > 2 ||
  new Set(candidates.artifacts.map(item => item.profile)).size !== candidates.artifacts.length) fail("CANDIDATE_REGISTER_INVALID");
const privateKeyPath = resolve(args["--qa-private-key"]);
if (statSync(privateKeyPath).mode & 0o077) fail("QA_PRIVATE_KEY_PERMISSIONS_UNSAFE");
const privateKey = createPrivateKey(readFileSync(privateKeyPath));
if (privateKey.asymmetricKeyType !== "ed25519") fail("QA_KEY_ALGORITHM_INVALID");
const publicKey = createPublicKey(privateKey).export({ type: "spki", format: "der" }).toString("base64url");
const trusted = { [args["--key-id"]]: publicKey };
const root = resolve(args["--store"]); mkdirSync(root, { recursive: true, mode: 0o700 });
const results = [];
for (const candidate of candidates.artifacts) {
  if (!["PHYSICAL_GATEWAY", "SOFTWARE_CONNECTOR"].includes(candidate.profile) || candidates.platform !== "darwin" || candidates.architecture !== "arm64") fail("CANDIDATE_PROFILE_INVALID");
  if (basename(candidate.artifact_name) !== candidate.artifact_name) fail("CANDIDATE_NAME_INVALID");
  const source = join(resolve(args["--candidate-root"]), candidate.artifact_name);
  const bytes = readFileSync(source);
  const sha = createHash("sha256").update(bytes).digest("hex");
  if (sha !== candidate.artifact_sha256 || bytes.length !== candidate.artifact_size) fail("CANDIDATE_DIGEST_MISMATCH");
  const entries = execFileSync("tar", ["-tzf", source], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }).split("\n").filter(Boolean);
  if (!entries.length || entries.some(entry => entry.startsWith("/") || entry.split("/").includes("..") ||
    /(^|\/)(\.env(?:\..*)?|identity\.json|credentials\.json|.*\.(?:key|pem|sqlite|db))$/i.test(entry) ||
    /(^|\/)(?:backups|logs|queues|state|secrets)(\/|$)/i.test(entry))) fail("CANDIDATE_CONTENTS_UNSAFE");
  const id = `qa-${candidate.baseline_id}`;
  const releaseDir = join(root, id);
  if (existsSync(releaseDir)) fail("QA_RELEASE_ALREADY_PUBLISHED_IMMUTABLE");
  mkdirSync(releaseDir, { recursive: false, mode: 0o700 });
  const artifactPath = join(releaseDir, candidate.artifact_name); copyFileSync(source, artifactPath);
  const copied = readFileSync(artifactPath);
  if (createHash("sha256").update(copied).digest("hex") !== sha) fail("RELEASE_STORAGE_COPY_MISMATCH");
  const manifest = { protocol: "observer-edge-update-v1", release_id: id, version: "0.1.0-legacy",
    build_sha: sha, channel: "INTERNAL", platform: candidates.platform, architecture: candidates.architecture,
    profile: candidate.profile, artifact_url: `https://qa.invalid/${id}/${candidate.artifact_name}`,
    artifact_sha256: sha, artifact_size: bytes.length, signing_key_id: args["--key-id"],
    compatibility: { minimum_current_version: "0.1.0-legacy", maximum_current_version: null,
      minimum_config_version: 1, maximum_config_version: 9999, security_floor_version: "0.1.0-legacy" },
    released_at: new Date().toISOString(), rollout: { stage: "INTERNAL_QA", cohort_seed: "qa-p38f-bootstrap",
      cohort_percent: 0, explicit_device_ids: [] }, signature: "" };
  manifest.signature = sign(null, Buffer.from(canonicalEdgeUpdateManifest(manifest)), privateKey).toString("base64url");
  if (!verifyEdgeUpdateManifest(manifest, trusted).ok || !verifyEdgeArtifact(copied, manifest).ok) fail("RELEASE_SELF_VERIFICATION_FAILED");
  writeFileSync(join(releaseDir, "release.json"), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  results.push({ release_id: id, profile: candidate.profile, sha256: sha, bytes: bytes.length, entries: entries.length });
}
writeFileSync(join(root, "qa-trust-registry.json"), `${JSON.stringify({ classification: "QA_ONLY_NOT_PRODUCTION", trustedPublicKeys: trusted }, null, 2)}\n`, { mode: 0o600, flag: "wx" });
console.log(JSON.stringify({ status: "QA_SIGNED", key_id: args["--key-id"], results }));
