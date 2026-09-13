// QA-only release authorization. The private signer stays outside Git/devices.
import { createHash, createPrivateKey, createPublicKey, sign } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { canonicalEdgeUpdateManifest, verifyEdgeArtifact, verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";

const args = Object.fromEntries(process.argv.slice(2).map(value => { const equal = value.indexOf("="); return [value.slice(0, equal), value.slice(equal + 1)]; }));
for (const name of ["--artifact", "--store", "--qa-private-key", "--key-id", "--profile", "--release-id", "--version", "--build-sha"])
  if (!args[name]) throw new Error(`RELEASE_INPUT_REQUIRED_${name}`);
if (!args["--key-id"].startsWith("qa-") || !args["--release-id"].startsWith("qa-")) throw new Error("QA_CLASSIFICATION_REQUIRED");
if (!["PHYSICAL_GATEWAY", "SOFTWARE_CONNECTOR"].includes(args["--profile"])) throw new Error("RELEASE_PROFILE_INVALID");
if (!/^[a-f0-9]{40}$/.test(args["--build-sha"])) throw new Error("RELEASE_BUILD_SHA_NOT_EXACT_COMMIT");
const artifact = resolve(args["--artifact"]), bytes = readFileSync(artifact);
const entries = execFileSync("tar", ["-tzf", artifact], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }).split("\n").filter(Boolean);
if (!entries.length || entries.some(item => item.startsWith("/") || item.split("/").includes("..") ||
  /(^|\/)(\.env(?:\..*)?|identity\.json|credentials\.json|.*\.(?:key|pem|sqlite|db))$/i.test(item) ||
  /(^|\/)(?:backups|logs|queues|state|secrets)(\/|$)/i.test(item))) throw new Error("QA_RELEASE_CONTENTS_UNSAFE");
const metadataMember = args["--profile"] === "PHYSICAL_GATEWAY" ? "./edge-release-metadata.json"
  : "Digital Observer.app/Contents/Resources/runtime/edge-release-metadata.json";
const metadata = JSON.parse(execFileSync("tar", ["-xOzf", artifact, metadataMember], { encoding: "utf8" }));
if (metadata.profile !== args["--profile"] || metadata.version !== args["--version"] ||
  metadata.build_sha !== args["--build-sha"] || metadata.health_contract !== "observer-edge-health-v1") throw new Error("QA_RELEASE_METADATA_MISMATCH");
if (args["--profile"] === "SOFTWARE_CONNECTOR") {
  const extracted = mkdtempSync(join(tmpdir(), "observer-p38g-signature-"));
  try { execFileSync("tar", ["-xzf", artifact, "-C", extracted]);
    execFileSync("/usr/bin/codesign", ["--verify", "--deep", "--strict", join(extracted, "Digital Observer.app")]);
  } finally { rmSync(extracted, { recursive: true, force: true }); }
}
const keyPath = resolve(args["--qa-private-key"]);
if (statSync(keyPath).mode & 0o077) throw new Error("QA_KEY_PERMISSIONS_UNSAFE");
const privateKey = createPrivateKey(readFileSync(keyPath));
if (privateKey.asymmetricKeyType !== "ed25519") throw new Error("QA_KEY_ALGORITHM_INVALID");
const publicKey = createPublicKey(privateKey).export({ format: "der", type: "spki" }).toString("base64url");
const trusted = { [args["--key-id"]]: publicKey };
const digest = createHash("sha256").update(bytes).digest("hex");
const manifest = { protocol: "observer-edge-update-v1", release_id: args["--release-id"], version: args["--version"],
  build_sha: args["--build-sha"], channel: "INTERNAL", platform: "darwin", architecture: "arm64", profile: args["--profile"],
  artifact_url: `https://qa.invalid/${args["--release-id"]}/${encodeURIComponent(basename(artifact))}`,
  artifact_sha256: digest, artifact_size: bytes.length, signing_key_id: args["--key-id"],
  compatibility: { minimum_current_version: "0.1.0-legacy", maximum_current_version: null,
    minimum_config_version: 1, maximum_config_version: 9999, security_floor_version: "0.1.0-legacy" },
  released_at: new Date().toISOString(), rollout: { stage: "INTERNAL_QA", cohort_seed: "qa-p38g-release",
    cohort_percent: 100, explicit_device_ids: [] }, signature: "" };
manifest.signature = sign(null, Buffer.from(canonicalEdgeUpdateManifest(manifest)), privateKey).toString("base64url");
if (!verifyEdgeUpdateManifest(manifest, trusted).ok || !verifyEdgeArtifact(bytes, manifest).ok) throw new Error("QA_RELEASE_VERIFY_FAILED");
const store = resolve(args["--store"]), target = join(store, args["--release-id"]);
if (existsSync(target)) throw new Error("QA_RELEASE_IMMUTABLE_EXISTS");
mkdirSync(target, { recursive: true, mode: 0o700 });
copyFileSync(artifact, join(target, basename(artifact)));
chmodSync(join(target, basename(artifact)), 0o600);
if (!verifyEdgeArtifact(readFileSync(join(target, basename(artifact))), manifest).ok) throw new Error("QA_RELEASE_STORE_COPY_FAILED");
writeFileSync(join(target, "release.json"), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600, flag: "wx" });
console.log(JSON.stringify({ status: "QA_RELEASE_SIGNED", release_id: manifest.release_id, version: manifest.version,
  build_sha: manifest.build_sha, profile: manifest.profile, artifact_sha256: digest, artifact_size: bytes.length,
  key_id: manifest.signing_key_id }));
