// Builds a complete QA Gateway runtime from a verified legacy dependency/model
// baseline plus the exact committed PUSH 38 source tree. No live files touched.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { verifyEdgeArtifact, verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";

const args = Object.fromEntries(process.argv.slice(2).map(value => { const equal = value.indexOf("="); return [value.slice(0, equal), value.slice(equal + 1)]; }));
for (const name of ["--commit", "--baseline-store", "--out", "--version"]) if (!args[name]) throw new Error(`REQUIRED_${name}`);
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(args["--version"])) throw new Error("GATEWAY_VERSION_INVALID");
const commit = execFileSync("git", ["rev-parse", `${args["--commit"]}^{commit}`], { encoding: "utf8" }).trim();
if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error("GATEWAY_SOURCE_COMMIT_INVALID");
const source = join(resolve(args["--baseline-store"]), "qa-legacy-gateway-aa57572e8736");
const trust = JSON.parse(readFileSync(join(resolve(args["--baseline-store"]), "qa-trust-registry.json"))).trustedPublicKeys;
const manifest = JSON.parse(readFileSync(join(source, "release.json")));
const archive = join(source, "gateway-runtime.tar.gz"), bytes = readFileSync(archive);
assert.equal(verifyEdgeUpdateManifest(manifest, trust).ok, true);
assert.equal(verifyEdgeArtifact(bytes, manifest).ok, true);
const out = resolve(args["--out"]); if (existsSync(out)) throw new Error("GATEWAY_OUTPUT_MUST_BE_NEW");
mkdirSync(out, { recursive: true, mode: 0o700 });
const temporary = mkdtempSync(join(tmpdir(), "observer-p38g-gateway-build-"));
try {
  const runtime = join(temporary, "runtime"); mkdirSync(runtime, { mode: 0o700 });
  execFileSync("tar", ["-xzf", archive, "-C", runtime]);
  const overlay = execFileSync("git", ["archive", commit, "--", "services/video-gateway", "scripts/run-persistent-home-gateway.mjs"], { maxBuffer: 64 * 1024 * 1024 });
  const extract = spawnSync("tar", ["-xf", "-", "-C", runtime], { input: overlay, maxBuffer: 4 * 1024 * 1024 });
  if (extract.status !== 0) throw new Error(`GATEWAY_SOURCE_OVERLAY_FAILED:${extract.stderr?.toString().slice(0, 200)}`);
  const metadata = { version: args["--version"], build_sha: commit, health_contract: "observer-edge-health-v1",
    profile: "PHYSICAL_GATEWAY", baseline_release_id: manifest.release_id };
  writeFileSync(join(runtime, "edge-release-metadata.json"), `${JSON.stringify(metadata)}\n`, { mode: 0o600 });
  execFileSync(process.execPath, ["--check", join(runtime, "services/video-gateway/server.mjs")]);
  const packagePath = join(out, "gateway-runtime.tar.gz");
  execFileSync("tar", ["-czf", packagePath, "-C", runtime, "."]);
  const packageBytes = readFileSync(packagePath), sha = createHash("sha256").update(packageBytes).digest("hex");
  writeFileSync(join(out, "package-status.json"), `${JSON.stringify({ classification: "QA_ONLY", ...metadata,
    artifact_sha256: sha, artifact_size: packageBytes.length }, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ status: "QA_GATEWAY_PACKAGE_BUILT", ...metadata, artifact_sha256: sha, artifact_size: packageBytes.length }));
} finally { rmSync(temporary, { recursive: true, force: true }); }
