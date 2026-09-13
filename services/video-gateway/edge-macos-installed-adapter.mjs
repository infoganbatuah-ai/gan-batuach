// macOS installed-runtime adapter. Constructor is read-only. Mutations require
// an explicit approved artifact digest and are never invoked by discovery.
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync,
  renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { verifyEdgeArtifact, verifyEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "./edge-release-trust.mjs";

function fail(code) { throw Object.assign(new Error(code), { code }); }
const run = (binary, args, options = {}) => execFileSync(binary, args, { encoding: "utf8", timeout: 120_000,
  stdio: ["ignore", "pipe", "pipe"], ...options });
function xml(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }
function plistXml(value) {
  const entry = input => {
    if (typeof input === "string") return `<string>${xml(input)}</string>`;
    if (typeof input === "boolean") return input ? "<true/>" : "<false/>";
    if (Number.isInteger(input)) return `<integer>${input}</integer>`;
    if (Array.isArray(input)) return `<array>${input.map(entry).join("")}</array>`;
    if (input && typeof input === "object") return `<dict>${Object.entries(input).map(([key, child]) => `<key>${xml(key)}</key>${entry(child)}`).join("")}</dict>`;
    fail("EDGE_INSTALLED_PLIST_TYPE_UNSUPPORTED");
  };
  return `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0">${entry(value)}</plist>`;
}
function atomic(path, bytes) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.${randomUUID()}.staging`;
  writeFileSync(temporary, bytes, { mode: 0o600, flag: "wx" }); renameSync(temporary, path);
}
function fileDigest(path) { return createHash("sha256").update(readFileSync(path)).digest("hex"); }
function inspectArchive(path) {
  const members = run("tar", ["-tzf", path]).split("\n").filter(Boolean);
  const modes = run("tar", ["-tvzf", path]).split("\n").filter(Boolean);
  if (!members.length || members.length > 20_000 || modes.length !== members.length ||
    members.some(name => name.startsWith("/") || name.split("/").includes("..")) ||
    modes.some(line => /^[lh]/.test(line))) fail("EDGE_INSTALLED_ARCHIVE_UNSAFE");
}

export function createMacOSInstalledEdgeAdapter({ profile, installedBase, managedRoot, launchAgentPath, label,
  port, allowMutations = false, approvedArtifactSha256 = "", trustedPublicKeys = {}, qaIsolationRoot = "" }) {
  if (process.platform !== "darwin" || !["PHYSICAL_GATEWAY", "SOFTWARE_CONNECTOR"].includes(profile)) fail("EDGE_INSTALLED_PLATFORM_INVALID");
  if (!Number.isInteger(port) || port < 1024 || port > 65535) fail("EDGE_INSTALLED_PORT_INVALID");
  const home = homedir(), base = resolve(installedBase), root = resolve(managedRoot), plistPath = resolve(launchAgentPath);
  const qa = Boolean(qaIsolationRoot);
  if (qa) {
    const scope = resolve(qaIsolationRoot);
    if (!scope.startsWith(`${tmpdir()}/`) || ![base, root, plistPath].every(path => path.startsWith(`${scope}/`)) ||
      !/^com\.digitalobserver\.qa\.push38h\.[a-z0-9.-]+$/.test(label) || port < 20000) fail("EDGE_INSTALLED_QA_SCOPE_INVALID");
  } else {
    const gateway = profile === "PHYSICAL_GATEWAY";
    const expected = { label: gateway ? "com.ganbatuach.video-gateway" : "com.ganbatuach.software-connector.tapo",
      base: gateway ? join(home, ".local/share/gan-batuach/video-gateway") : join(home, "Applications"),
      root: join(home, "Library/Application Support/Digital Observer", gateway ? "observer-gateway" : "observer-connector", "ota"),
      plist: join(home, "Library/LaunchAgents", `${gateway ? "com.ganbatuach.video-gateway" : "com.ganbatuach.software-connector.tapo"}.plist`),
      port: gateway ? 18082 : 18083 };
    if (label !== expected.label || base !== expected.base || root !== expected.root ||
      plistPath !== expected.plist || port !== expected.port) fail("EDGE_INSTALLED_LIVE_SCOPE_INVALID");
  }
  if (allowMutations && !/^[a-f0-9]{64}$/.test(approvedArtifactSha256)) fail("EDGE_INSTALLED_APPROVAL_REQUIRED");
  const runnerRelative = profile === "PHYSICAL_GATEWAY" ? "scripts/run-persistent-home-gateway.mjs"
    : "Digital Observer.app/Contents/Resources/runtime/scripts/run-software-connector.mjs";
  const originalRunner = join(base, runnerRelative);
  const backupPath = join(root, "legacy-launchagent.plist");
  const domain = `gui/${process.getuid()}`;
  function originalPlist() { return existsSync(backupPath) ? readFileSync(backupPath, "utf8") : readFileSync(plistPath, "utf8"); }
  function validateOriginal() {
    if (lstatSync(plistPath).isSymbolicLink() || !existsSync(originalRunner)) fail("EDGE_INSTALLED_LEGACY_MISSING");
    const value = originalPlist();
    if (!value.includes(`<string>${xml(originalRunner)}</string>`) || !value.includes(`<string>${label}</string>`)) fail("EDGE_INSTALLED_PLIST_MISMATCH");
    return value;
  }
  function service() {
    try { const text = run("/bin/launchctl", ["print", `${domain}/${label}`]);
      return { registered: true, running: text.includes("state = running"), pid: Number(/\bpid = (\d+)/.exec(text)?.[1] || 0) || null }; }
    catch { return { registered: false, running: false, pid: null }; }
  }
  function plan() {
    const source = validateOriginal();
    return { profile, label, service: service(), current_runner: originalRunner, current_plist_sha256: createHash("sha256").update(source).digest("hex"),
      managed_root: root, trust_root_path: "/Library/Application Support/Digital Observer/release-trust/root-pin.json",
      planned_files: [backupPath, join(root, "installed-bootstrap.json"), join(root, "bootstrap-journal.json"),
        join(root, "slots"), plistPath], writes: 0, qa };
  }
  function requireMutation(manifest) {
    // A live caller cannot substitute its own public key map for the protected
    // root-pinned registry. QA keys are accepted only inside an isolated tmp root.
    const keys = qa ? trustedPublicKeys : loadPinnedEdgeReleaseKeys({ registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys;
    if (!allowMutations || manifest.profile !== profile || !verifyEdgeUpdateManifest(manifest, keys).ok)
      fail("EDGE_INSTALLED_APPROVAL_MISMATCH");
  }
  async function verifyInstalled({ artifactPath, manifest }) {
    requireMutation(manifest);
    if (manifest.artifact_sha256 !== approvedArtifactSha256 || !verifyEdgeArtifact(readFileSync(artifactPath), manifest).ok)
      fail("EDGE_INSTALLED_BASELINE_NOT_APPROVED");
    const temp = mkdtempSync(join(tmpdir(), "observer-edge-installed-compare-"));
    try {
      inspectArchive(artifactPath);
      run("tar", ["-xzf", artifactPath, "-C", temp]);
      let compared = 0;
      function visit(directory) { for (const name of readdirSync(directory)) {
        const source = join(directory, name), rel = relative(temp, source), target = join(base, rel);
        const info = lstatSync(source);
        if (info.isDirectory()) { visit(source); continue; }
        // A derived QA Connector baseline re-seals the unchanged legacy app.
        // The original bundle seal/executable are not byte-identical.
        if (profile === "SOFTWARE_CONNECTOR" && manifest.release_id.startsWith("qa-legacy-connector-resigned-") &&
          (rel.includes("/_CodeSignature/") || rel.endsWith("/MacOS/DigitalObserver"))) continue;
        if (!existsSync(target)) return false;
        const other = lstatSync(target);
        if (info.isSymbolicLink() !== other.isSymbolicLink()) return false;
        if (info.isSymbolicLink() ? readlinkSync(source) !== readlinkSync(target) : fileDigest(source) !== fileDigest(target)) return false;
        compared += 1;
      } return true; }
      return visit(temp) && compared > 100;
    } finally { rmSync(temp, { recursive: true, force: true }); }
  }
  async function unpack({ artifactPath, staging, manifest }) {
    requireMutation(manifest);
    if (!verifyEdgeArtifact(readFileSync(artifactPath), manifest).ok) fail("EDGE_INSTALLED_ARTIFACT_TAMPERED");
    inspectArchive(artifactPath);
    const runtime = join(staging, "runtime"); mkdirSync(runtime, { recursive: true, mode: 0o700 });
    run("tar", ["-xzf", artifactPath, "-C", runtime]);
    if (!existsSync(join(runtime, runnerRelative))) fail("EDGE_INSTALLED_RUNNER_MISSING");
    if (profile === "SOFTWARE_CONNECTOR") run("/usr/bin/codesign", ["--verify", "--deep", "--strict", join(runtime, "Digital Observer.app")]);
  }
  async function health({ timeoutMs = 10_000 } = {}) {
    const until = Date.now() + timeoutMs;
    while (Date.now() < until) {
      try { const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1500) });
        if (response.ok) return { ok: true, body: await response.json(), service: service() }; } catch {}
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    return { ok: false, service: service() };
  }
  async function restart({ slot, manifest }) {
    const release = manifest || JSON.parse(readFileSync(join(resolve(slot), "release.json"), "utf8"));
    requireMutation(release);
    if (!verifyEdgeArtifact(readFileSync(join(resolve(slot), "artifact.bin")), release).ok) fail("EDGE_INSTALLED_SLOT_TAMPERED");
    const original = validateOriginal();
    const target = join(resolve(slot), "runtime", runnerRelative);
    if (!existsSync(target)) fail("EDGE_INSTALLED_TARGET_MISSING");
    if (profile === "SOFTWARE_CONNECTOR") run("/usr/bin/codesign", ["--verify", "--deep", "--strict", join(resolve(slot), "runtime", "Digital Observer.app")]);
    if (!existsSync(backupPath)) atomic(backupPath, original);
    const source = JSON.parse(run("/usr/bin/plutil", ["-convert", "json", "-o", "-", backupPath]));
    if (source.Label !== label || source.ProgramArguments?.[1] !== originalRunner) fail("EDGE_INSTALLED_PLIST_REWRITE_FAILED");
    source.ProgramArguments[1] = target;
    const appRuntime = join(resolve(slot), "runtime", "Digital Observer.app/Contents/Resources/runtime");
    source.WorkingDirectory = profile === "SOFTWARE_CONNECTOR" ? appRuntime : join(resolve(slot), "runtime");
    if (profile === "SOFTWARE_CONNECTOR") source.ProgramArguments[0] = join(resolve(slot), "runtime", "Digital Observer.app/Contents/Resources/bin/node");
    source.EnvironmentVariables ||= {};
    source.EnvironmentVariables.OBSERVER_EDGE_VERSION = release.version;
    source.EnvironmentVariables.OBSERVER_EDGE_BUILD_SHA = release.build_sha;
    source.EnvironmentVariables.OBSERVER_EDGE_DEVICE_TYPE = profile;
    const next = plistXml(source);
    try { run("/bin/launchctl", ["bootout", domain, plistPath]); } catch {}
    const until = Date.now() + 10_000;
    let oldResponding = true;
    while (Date.now() < until) {
      try { await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(500) }); }
      catch { oldResponding = false; break; }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    if (oldResponding) { await restoreLegacy(); fail("EDGE_INSTALLED_OLD_PROCESS_STILL_ACTIVE"); }
    atomic(plistPath, next);
    try { run("/bin/launchctl", ["bootstrap", domain, plistPath]); }
    catch (error) { await restoreLegacy(); throw error; }
    return service();
  }
  async function restoreLegacy() {
    if (!allowMutations) fail("EDGE_INSTALLED_MUTATION_FORBIDDEN");
    if (!existsSync(backupPath)) {
      if (service().running && validateOriginal()) return service();
      fail("EDGE_INSTALLED_LEGACY_BACKUP_MISSING");
    }
    try { run("/bin/launchctl", ["bootout", domain, plistPath]); } catch {}
    atomic(plistPath, readFileSync(backupPath));
    run("/bin/launchctl", ["bootstrap", domain, plistPath]);
    return service();
  }
  return { plan, status: service, verifyInstalled, stageBaseline: unpack, install: unpack, restart, restoreLegacy, health };
}
