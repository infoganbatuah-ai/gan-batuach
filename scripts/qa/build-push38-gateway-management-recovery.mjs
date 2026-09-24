// Builds a management-only Gateway OTA agent payload from one exact reviewed
// commit. It cannot serve as a functional Gateway runtime because the launch
// runner and Product runtime are deliberately absent.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const args = Object.fromEntries(process.argv.slice(2).map(value => {
  const equal = value.indexOf("=");
  return [value.slice(0, equal), value.slice(equal + 1)];
}));
for (const name of ["--commit", "--out", "--version"])
  if (!args[name]) throw new Error(`REQUIRED_${name}`);
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(args["--version"]))
  throw new Error("GATEWAY_MANAGEMENT_VERSION_INVALID");

const commit = execFileSync("git", ["rev-parse", `${args["--commit"]}^{commit}`], { encoding: "utf8" }).trim();
if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error("GATEWAY_MANAGEMENT_SOURCE_COMMIT_INVALID");
const out = resolve(args["--out"]);
if (existsSync(out)) throw new Error("GATEWAY_MANAGEMENT_OUTPUT_MUST_BE_NEW");

const lock = JSON.parse(execFileSync("git", ["show", `${commit}:package-lock.json`], {
  encoding: "utf8", maxBuffer: 32 * 1024 * 1024
}));
const expectedUndici = lock.packages?.["node_modules/undici"]?.version;
const installedUndici = JSON.parse(readFileSync("node_modules/undici/package.json", "utf8"));
assert.equal(installedUndici.version, expectedUndici, "The installed undici dependency does not match the reviewed lockfile");

mkdirSync(out, { recursive: true, mode: 0o700 });
const temporary = mkdtempSync(join(tmpdir(), "observer-p38-gateway-management-"));
try {
  const payload = join(temporary, "payload");
  mkdirSync(join(payload, "node_modules"), { recursive: true, mode: 0o700 });
  const source = execFileSync("git", ["archive", commit, "--", "services/video-gateway"], {
    maxBuffer: 64 * 1024 * 1024
  });
  const extract = spawnSync("tar", ["-xf", "-", "-C", payload], {
    input: source, maxBuffer: 4 * 1024 * 1024
  });
  if (extract.status !== 0)
    throw new Error(`GATEWAY_MANAGEMENT_SOURCE_OVERLAY_FAILED:${extract.stderr?.toString().slice(0, 200)}`);
  cpSync("node_modules/undici", join(payload, "node_modules/undici"), { recursive: true });
  writeFileSync(join(payload, "edge-management-release.json"), `${JSON.stringify({
    role: "GATEWAY_OTA_MANAGEMENT_GUARD_RECOVERY",
    version: args["--version"],
    build_sha: commit,
    profile: "PHYSICAL_GATEWAY",
    functional_runtime_included: false,
    undici_version: installedUndici.version
  })}\n`, { mode: 0o600 });
  for (const file of ["edge-installed-ota-service.mjs", "edge-installed-ota-agent.mjs",
    "edge-crash-loop-guard.mjs", "edge-update-manager.mjs", "edge-macos-installed-adapter.mjs"])
    execFileSync(process.execPath, ["--check", join(payload, "services/video-gateway", file)]);
  if (existsSync(join(payload, "scripts/run-persistent-home-gateway.mjs")))
    throw new Error("GATEWAY_MANAGEMENT_FUNCTIONAL_RUNNER_PRESENT");
  const packagePath = join(out, "gateway-management.tar.gz");
  execFileSync("tar", ["-czf", packagePath, "-C", payload, "."]);
  const bytes = readFileSync(packagePath);
  const status = {
    classification: "QA_ONLY_MANAGEMENT_AGENT",
    role: "GATEWAY_OTA_MANAGEMENT_GUARD_RECOVERY",
    version: args["--version"],
    build_sha: commit,
    profile: "PHYSICAL_GATEWAY",
    functional_runtime_included: false,
    artifact_sha256: createHash("sha256").update(bytes).digest("hex"),
    artifact_size: bytes.length
  };
  writeFileSync(join(out, "package-status.json"), `${JSON.stringify(status, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ status: "QA_GATEWAY_MANAGEMENT_PACKAGE_BUILT", ...status }));
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
