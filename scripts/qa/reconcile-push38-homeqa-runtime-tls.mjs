// Add the already-pinned loopback QA CA to the two exact managed runtime
// LaunchAgents. Runtime bytes, release pointers and device credentials stay
// unchanged. Each service is restored byte-for-byte if its exact signed
// CURRENT slot does not return after the bounded restart.
import "../../services/video-gateway/http-runtime.mjs";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { chmodSync, existsSync, lstatSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { plistXml, trustedHomeQaRuntimeCertificate } from "../../services/video-gateway/edge-macos-installed-adapter.mjs";
import { verifyEdgeArtifact, verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";

const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const restricted = `${realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
const output = resolve(option("output") || ".");
if (!process.argv.includes("--apply") || output === resolve(".") || !output.startsWith(restricted) || existsSync(output))
  throw new Error("P38_RUNTIME_TLS_EXPLICIT_NEW_OUTPUT_REQUIRED");
const run = (binary, args) => execFileSync(binary, args,
  { encoding: "utf8", timeout: 120_000, stdio: ["ignore", "pipe", "pipe"] });
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const atomic = (path, bytes) => {
  const temporary = join(dirname(path), `.push38-runtime-tls.${process.pid}.${randomUUID()}.staging`);
  writeFileSync(temporary, bytes, { mode: 0o600, flag: "wx" });
  renameSync(temporary, path); chmodSync(path, 0o600);
};
const specs = [
  { profile: "PHYSICAL_GATEWAY", label: "com.ganbatuach.video-gateway", rootName: "observer-gateway", port: 18082 },
  { profile: "SOFTWARE_CONNECTOR", label: "com.ganbatuach.software-connector.tapo", rootName: "observer-connector", port: 18083 }
];
const domain = `gui/${process.getuid()}`;
const trusted = loadPinnedEdgeReleaseKeys({ registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys;
const stopAndWait = async item => {
  try { run("/bin/launchctl", ["bootout", `${domain}/${item.label}`]); } catch {}
  for (let attempt = 0; attempt < 40; attempt++) {
    try { run("/bin/launchctl", ["print", `${domain}/${item.label}`]); }
    catch { return; }
    await new Promise(resolveWait => setTimeout(resolveWait, 250));
  }
  throw new Error(`P38_RUNTIME_TLS_BOOTOUT_TIMEOUT_${item.profile}`);
};
const prepared = specs.map(spec => {
  const root = join(homedir(), "Library/Application Support/Digital Observer", spec.rootName, "ota");
  const plist = join(homedir(), "Library/LaunchAgents", `${spec.label}.plist`);
  const current = JSON.parse(readFileSync(join(root, "current.json"), "utf8"));
  const slot = realpathSync(current.slot);
  const slots = `${realpathSync(join(root, "slots"))}${sep}`;
  if (!slot.startsWith(slots) || !existsSync(plist) || lstatSync(plist).isSymbolicLink() || realpathSync(plist) !== plist)
    throw new Error("P38_RUNTIME_TLS_SCOPE_INVALID");
  const manifest = JSON.parse(readFileSync(join(slot, "release.json"), "utf8"));
  const artifact = readFileSync(join(slot, "artifact.bin"));
  if (manifest.release_id !== current.release_id || manifest.version !== current.version ||
    manifest.artifact_sha256 !== current.artifact_sha256 || manifest.profile !== spec.profile ||
    !verifyEdgeUpdateManifest(manifest, trusted).ok || !verifyEdgeArtifact(artifact, manifest).ok)
    throw new Error("P38_RUNTIME_TLS_SIGNED_CURRENT_INVALID");
  const certificate = trustedHomeQaRuntimeCertificate(root, spec.profile);
  const beforeBytes = readFileSync(plist);
  const before = JSON.parse(run("/usr/bin/plutil", ["-convert", "json", "-o", "-", plist]));
  if (before.Label !== spec.label || !before.ProgramArguments?.at(-1)?.startsWith(`${slot}${sep}`) ||
    before.EnvironmentVariables?.OBSERVER_EDGE_VERSION !== manifest.version ||
    before.EnvironmentVariables?.OBSERVER_EDGE_BUILD_SHA !== manifest.build_sha)
    throw new Error("P38_RUNTIME_TLS_LAUNCH_AGENT_MISMATCH");
  const after = { ...before, EnvironmentVariables: { ...(before.EnvironmentVariables || {}),
    NODE_EXTRA_CA_CERTS: certificate } };
  return { ...spec, root, plist, current, manifest, certificate, beforeBytes, afterBytes: Buffer.from(plistXml(after)) };
});

const changed = [];
const touched = [];
async function health(item, timeoutMs = 180_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const status = run("/bin/launchctl", ["print", `${domain}/${item.label}`]);
      const pid = Number(/\bpid = (\d+)/.exec(status)?.[1] || 0);
      const response = await fetch(`http://127.0.0.1:${item.port}/health`, { signal: AbortSignal.timeout(2_000) });
      const body = response.ok ? await response.json() : {};
      if (pid > 1 && body.edgeRuntime?.software_version === item.manifest.version &&
        body.edgeRuntime?.build_sha === item.manifest.build_sha) return { pid, status: body.status || null };
    } catch { /* bounded restart wait */ }
    await new Promise(resolveWait => setTimeout(resolveWait, 1_000));
  }
  throw new Error(`P38_RUNTIME_TLS_HEALTH_FAILED_${item.profile}`);
}
try {
  for (const item of prepared) {
    const backup = `${output}.${item.profile.toLowerCase()}.launchagent-backup.plist`;
    writeFileSync(backup, item.beforeBytes, { mode: 0o600, flag: "wx" }); chmodSync(backup, 0o600);
    if (!item.beforeBytes.equals(item.afterBytes)) {
      touched.push(item);
      await stopAndWait(item);
      atomic(item.plist, item.afterBytes);
      run("/bin/launchctl", ["bootstrap", domain, item.plist]);
    }
    const observed = await health(item);
    changed.push({ item, backup, observed });
  }
  const result = { protocol: "observer-push38-runtime-loopback-tls-v1", generated_at: new Date().toISOString(),
    status: "PASS", profiles: changed.map(({ item, observed }) => ({ profile: item.profile,
      release_id: item.manifest.release_id, version: item.manifest.version, build_sha: item.manifest.build_sha,
      plist_before_sha256: sha(item.beforeBytes), plist_after_sha256: sha(item.afterBytes), pid: observed.pid,
      health: observed.status, runtime_bytes_changed: false, release_pointer_changed: false,
      device_credentials_changed: false, loopback_ca_inherited: true })) };
  writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600, flag: "wx" }); chmodSync(output, 0o600);
  console.log(JSON.stringify({ status: "PUSH38_RUNTIME_TLS_RECONCILED", profiles: result.profiles.length,
    runtime_bytes_changed: false, release_pointer_changed: false, evidence_sha256: sha(readFileSync(output)) }));
} catch (error) {
  for (const item of touched.reverse()) {
    await stopAndWait(item).catch(() => null);
    atomic(item.plist, item.beforeBytes);
    try { run("/bin/launchctl", ["bootstrap", domain, item.plist]); } catch {}
  }
  throw error;
}
