// Read-only live capture. Writes only to an explicitly selected QA output dir.
// The old signed file list is the release boundary; known mutable extras stay
// outside the archive. The one authorized runtime delta is byte-verified.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { verifyEdgeArtifact, verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";

function fail(code) { throw Object.assign(new Error(code), { code }); }
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const args = Object.fromEntries(process.argv.slice(2).map(value => { const at = value.indexOf("="); return [value.slice(0, at), value.slice(at + 1)]; }));
if (!args["--baseline-store"] || !args["--qa-store-root"] || !args["--out"]) fail("P38J_CAPTURE_INPUT_REQUIRED");
const live = join(homedir(), ".local/share/gan-batuach/video-gateway");
const output = resolve(args["--out"]);
if (!output.startsWith(`${resolve(args["--qa-store-root"])}${sep}`) || existsSync(output)) fail("P38J_CAPTURE_OUTPUT_SCOPE_INVALID");
const baseline = join(resolve(args["--baseline-store"]), "qa-legacy-gateway-aa57572e8736");
const archive = join(baseline, "gateway-runtime.tar.gz");
const manifest = JSON.parse(readFileSync(join(baseline, "release.json"), "utf8"));
const trust = JSON.parse(readFileSync(join(resolve(args["--baseline-store"]), "qa-trust-registry.json"), "utf8")).trustedPublicKeys;
if (!verifyEdgeUpdateManifest(manifest, trust).ok || !verifyEdgeArtifact(readFileSync(archive), manifest).ok ||
  manifest.profile !== "PHYSICAL_GATEWAY" || manifest.platform !== "darwin" || manifest.architecture !== process.arch)
  fail("P38J_OLD_BASELINE_UNTRUSTED");
const changed = "services/video-gateway/journal-loop.mjs";
const oldHash = "1c3013914b8a12ab3dad45f44559af245e0cfc166822af97eabf5a17a8a11151";
const newHash = "d53d531be773c3e7948b6c400f1d89142f36c6b5d636acf972af10fc2e58a169";
const listed = execFileSync("tar", ["-tzf", archive], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 })
  .split("\n").filter(Boolean).map(name => name.replace(/^\.\//, ""));
const files = listed.filter(name => !name.endsWith("/"));
if (files.length !== 491 || new Set(files).size !== files.length || !files.includes(changed)) fail("P38J_BOUNDARY_UNEXPECTED");
const oldRoots = new Set(listed.map(name => name.split("/")[0]));
const external = new Set([".env.video-gateway.local", "backups", "connector-config.json",
  "continuous-monitor-status.json", "journal-outbox.sqlite", "journal-outbox.sqlite-shm",
  "journal-outbox.sqlite-wal", "journal-owner.lock", "journal-status.json",
  "private-nvr-command-state.sqlite", "private-nvr-command-state.sqlite-shm",
  "private-nvr-command-state.sqlite-wal"]);
for (const entry of readdirSync(live)) if (!oldRoots.has(entry) && !external.has(entry)) fail("P38J_UNCLASSIFIED_RUNTIME_ROOT_ENTRY");
const priorDir = mkdtempSync(join(tmpdir(), "observer-p38j-prior-"));
const capturedDir = mkdtempSync(join(tmpdir(), "observer-p38j-captured-"));
process.on("exit", () => { rmSync(priorDir, { recursive: true, force: true }); rmSync(capturedDir, { recursive: true, force: true }); });
execFileSync("tar", ["-xzf", archive, "-C", priorDir], { timeout: 120_000 });
const expected = new Map();
for (const name of files) {
  if (name.startsWith("/") || name.split("/").includes("..") || /(^|\/)(\.env(?:\..*)?|identity\.json|credentials\.json|.*\.(?:key|pem|sqlite|db))$/i.test(name)) fail("P38J_UNSAFE_MEMBER");
  const path = join(live, name), info = lstatSync(path);
  if (!info.isFile() || info.isSymbolicLink()) fail("P38J_LIVE_MEMBER_NOT_REGULAR");
  const old = readFileSync(join(priorDir, name));
  const current = readFileSync(path);
  if (name === changed) {
    const from = `      try {\n        const manifest = await request("/cloud/event-manifest", undefined, { timeoutMs: 2_500 });\n        deliveryManifest = manifest;\n        deliveryManifestAt = Date.now();\n      } catch (error) {\n        if (!deliveryManifest) throw error;\n      }`;
    const to = `      if (!deliveryManifest || Date.now() - deliveryManifestAt >= 10_000) {\n        try {\n          const manifest = await request("/cloud/event-manifest", undefined, { timeoutMs: 2_500 });\n          deliveryManifest = manifest;\n          deliveryManifestAt = Date.now();\n        } catch (error) {\n          if (!deliveryManifest) throw error;\n        }\n      }`;
    const text = old.toString("utf8");
    if (hash(old) !== oldHash || text.split(from).length !== 2 || hash(current) !== newHash ||
      !Buffer.from(text.replace(from, to)).equals(current)) fail("P38J_DELTA_NOT_AUTHORIZED");
  } else if (!old.equals(current)) fail("P38J_OTHER_RUNTIME_DELTA");
  expected.set(name, hash(current));
}
// New files in the release-code locations must not be silently omitted.
for (const directory of ["scripts", "services", "node_modules"]) {
  const visit = path => { for (const entry of readdirSync(path, { withFileTypes: true })) {
    const member = join(path, entry.name), name = relative(live, member);
    if (entry.isDirectory()) visit(member);
    else if (!expected.has(name)) fail("P38J_UNLISTED_RUNTIME_FILE");
  } };
  visit(join(live, directory));
}
const artifactName = "gateway-runtime.tar.gz";
mkdirSync(output, { recursive: false, mode: 0o700 });
const artifactPath = join(output, artifactName);
execFileSync("tar", ["-czf", artifactPath, "-C", live, ...files], { timeout: 120_000 });
const saved = readFileSync(artifactPath), digest = hash(saved);
execFileSync("tar", ["-xzf", artifactPath, "-C", capturedDir], { timeout: 120_000 });
for (const name of files) {
  const stored = readFileSync(join(capturedDir, name));
  if (hash(stored) !== expected.get(name) || hash(readFileSync(join(live, name))) !== expected.get(name))
    fail("P38J_CAPTURE_CHANGED_DURING_ARCHIVE");
}
const id = `legacy-gateway-${digest.slice(0, 12)}`;
const candidate = { contract: "observer-legacy-baseline-candidate-v1", platform: "darwin", architecture: process.arch,
  captured_at: new Date().toISOString(), artifacts: [{ baseline_id: id, profile: "PHYSICAL_GATEWAY",
    artifact_name: artifactName, artifact_sha256: digest, artifact_size: statSync(artifactPath).size,
    runtime_file_count: files.length, prior_release_id: manifest.release_id }] };
writeFileSync(join(output, "candidates.json"), `${JSON.stringify(candidate, null, 2)}\n`, { mode: 0o600, flag: "wx" });
console.log(JSON.stringify({ candidate_id: id, artifact_sha256: digest, file_count: files.length,
  platform: "darwin", architecture: process.arch, captured_at: candidate.captured_at,
  previous_baseline_sha256: manifest.artifact_sha256, live_runtime_writes: 0 }));
