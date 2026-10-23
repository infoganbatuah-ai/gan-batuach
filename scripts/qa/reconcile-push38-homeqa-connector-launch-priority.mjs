// Reconcile only the managed Connector launch priority. The exact signed
// CURRENT/KNOWN_GOOD slot remains unchanged; no release is selected, installed
// or promoted. If the existing runtime cannot become healthy, restore the
// byte-identical plist and service registration.
import "../../services/video-gateway/http-runtime.mjs";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { chmodSync, existsSync, lstatSync, readFileSync, realpathSync,
  renameSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { managedEdgeLaunchAgent, plistXml } from "../../services/video-gateway/edge-macos-installed-adapter.mjs";
import { verifyEdgeArtifact, verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { loadPinnedEdgeReleaseKeys,
  PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";

const RELEASE_ID = "qa-p38-health-connector-rtsp-cadence-559bb01f78a2";
const VERSION = "0.2.26-p38-health";
const BUILD_SHA = "13800362678e3c9145cf7a1dd80fc9f32eccfae9";
const ARTIFACT_SHA256 = "559bb01f78a2275f6dfc05723673250318803fbf68a8fd111f93084cbb47e02f";
const LABEL = "com.ganbatuach.software-connector.tapo";
const ROOT = join(homedir(), "Library/Application Support/Digital Observer/observer-connector/ota");
const SLOT = join(ROOT, "slots", VERSION);
const PLIST = join(homedir(), "Library/LaunchAgents", `${LABEL}.plist`);
const RESTRICTED = `${realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const output = resolve(option("output") || ".");
if (!process.argv.includes("--apply") || output === resolve(".") || !output.startsWith(RESTRICTED) || existsSync(output))
  throw new Error("P38_CONNECTOR_PRIORITY_EXPLICIT_NEW_OUTPUT_REQUIRED");

const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const protectedFile = path => {
  if (!existsSync(path) || lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile() ||
    realpathSync(path) !== path || (statSync(path).mode & 0o077) !== 0)
    throw new Error("P38_CONNECTOR_PRIORITY_PROTECTED_FILE_REQUIRED");
  return readFileSync(path);
};
const run = (binary, args) => execFileSync(binary, args,
  { encoding: "utf8", timeout: 120_000, stdio: ["ignore", "pipe", "pipe"] });
const atomic = (path, bytes) => {
  const temporary = join(dirname(path), `.${LABEL}.${process.pid}.${randomUUID()}.staging`);
  writeFileSync(temporary, bytes, { mode: 0o600, flag: "wx" });
  renameSync(temporary, path);
};
const service = () => {
  const text = run("/bin/launchctl", ["print", `gui/${process.getuid()}/${LABEL}`]);
  return { running: text.includes("state = running"), pid: Number(/\bpid = (\d+)/.exec(text)?.[1] || 0) || null };
};
const health = async timeoutMs => {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      const response = await fetch("http://127.0.0.1:18083/health", { signal: AbortSignal.timeout(2_000) });
      if (response.ok) return { ok: true, body: await response.json(), service: service() };
    } catch { /* bounded retry while launchd starts the exact current slot */ }
    await new Promise(resolveWait => setTimeout(resolveWait, 1_000));
  }
  return { ok: false, service: service() };
};

for (const path of [join(ROOT, "current.json"), join(ROOT, "known-good.json"),
  join(SLOT, "release.json"), join(SLOT, "artifact.bin")]) protectedFile(path);
const current = JSON.parse(readFileSync(join(ROOT, "current.json"), "utf8"));
const knownGood = JSON.parse(readFileSync(join(ROOT, "known-good.json"), "utf8"));
const manifest = JSON.parse(readFileSync(join(SLOT, "release.json"), "utf8"));
const artifact = readFileSync(join(SLOT, "artifact.bin"));
const trusted = loadPinnedEdgeReleaseKeys({ registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys;
if (current.release_id !== RELEASE_ID || current.version !== VERSION || current.build_sha !== BUILD_SHA ||
  current.artifact_sha256 !== ARTIFACT_SHA256 || current.slot !== SLOT ||
  !knownGood.some(item => item.release_id === RELEASE_ID && item.artifact_sha256 === ARTIFACT_SHA256) ||
  manifest.release_id !== RELEASE_ID || manifest.version !== VERSION || manifest.build_sha !== BUILD_SHA ||
  manifest.artifact_sha256 !== ARTIFACT_SHA256 || !verifyEdgeUpdateManifest(manifest, trusted).ok ||
  !verifyEdgeArtifact(artifact, manifest).ok || sha(artifact) !== ARTIFACT_SHA256)
  throw new Error("P38_CONNECTOR_PRIORITY_SIGNED_CURRENT_MISMATCH");
if (!existsSync(PLIST) || lstatSync(PLIST).isSymbolicLink() || realpathSync(PLIST) !== PLIST)
  throw new Error("P38_CONNECTOR_PRIORITY_PLIST_UNSAFE");
const beforeBytes = readFileSync(PLIST);
const before = JSON.parse(run("/usr/bin/plutil", ["-convert", "json", "-o", "-", PLIST]));
const expectedRunner = join(SLOT,
  "runtime/Digital Observer.app/Contents/Resources/runtime/scripts/run-software-connector.mjs");
if (before.Label !== LABEL || before.ProcessType !== "Background" ||
  before.ProgramArguments?.at(-1) !== expectedRunner)
  throw new Error("P38_CONNECTOR_PRIORITY_PLIST_SCOPE_MISMATCH");
const after = managedEdgeLaunchAgent(before);
const afterBytes = Buffer.from(plistXml(after));
if (after.ProcessType !== undefined || after.ProgramArguments?.at(-1) !== expectedRunner ||
  after.Label !== LABEL || after.EnvironmentVariables?.OBSERVER_EDGE_VERSION !== VERSION ||
  after.EnvironmentVariables?.OBSERVER_EDGE_BUILD_SHA !== BUILD_SHA)
  throw new Error("P38_CONNECTOR_PRIORITY_RECONCILIATION_INVALID");

const backup = `${output}.launchagent-backup.plist`;
writeFileSync(backup, beforeBytes, { mode: 0o600, flag: "wx" });
chmodSync(backup, 0o600);
try {
  try { run("/bin/launchctl", ["bootout", `gui/${process.getuid()}/${LABEL}`]); } catch {}
  atomic(PLIST, afterBytes);
  run("/bin/launchctl", ["bootstrap", `gui/${process.getuid()}`, PLIST]);
  const observed = await health(180_000);
  const runtime = observed.body?.edgeRuntime || {};
  if (!observed.ok || !observed.service.running || !observed.service.pid ||
    runtime.software_version !== VERSION || runtime.build_sha !== BUILD_SHA)
    throw new Error("P38_CONNECTOR_PRIORITY_HEALTH_FAILED");
  const result = { protocol: "observer-push38-connector-launch-priority-v1",
    generated_at: new Date().toISOString(), release_id: RELEASE_ID, version: VERSION,
    build_sha: BUILD_SHA, artifact_sha256: ARTIFACT_SHA256, signed_current_verified: true,
    signed_known_good_verified: true, live_trust_verified: true,
    plist_before_sha256: sha(beforeBytes), plist_after_sha256: sha(afterBytes),
    process_type_before: "Background", process_type_after: null,
    launchd_pid: observed.service.pid, runtime_health: observed.body?.status || null,
    expected: observed.body?.lastDiscovery?.channelCount ?? null,
    connected: observed.body?.lastDiscovery?.connectedCount ?? null,
    progressing: observed.body?.mediaHeartbeat?.progressingRelays ?? null,
    backup_path: backup, runtime_bytes_changed: false, release_installed: false,
    release_promoted: false };
  writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  chmodSync(output, 0o600);
  console.log(JSON.stringify({ status: "CONNECTOR_MANAGED_PRIORITY_RECONCILED",
    release_id: RELEASE_ID, pid: observed.service.pid, runtime_bytes_changed: false,
    release_installed: false, release_promoted: false, evidence_sha256: sha(readFileSync(output)) }));
} catch (error) {
  try { run("/bin/launchctl", ["bootout", `gui/${process.getuid()}/${LABEL}`]); } catch {}
  atomic(PLIST, beforeBytes);
  run("/bin/launchctl", ["bootstrap", `gui/${process.getuid()}`, PLIST]);
  throw error;
}
