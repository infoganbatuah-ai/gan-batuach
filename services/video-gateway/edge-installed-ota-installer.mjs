// Installs management code from a verified release without switching the
// functional Gateway/Connector runtime. Never called during read-only plan.
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { verifyEdgeArtifact, verifyEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { inspectArchive, plistXml } from "./edge-macos-installed-adapter.mjs";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "./edge-release-trust.mjs";

function fail(code) { throw Object.assign(new Error(code), { code }); }
function atomic(path, data) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temp = `${path}.${process.pid}.${randomUUID()}.staging`;
  writeFileSync(temp, data, { mode: 0o600, flag: "wx" }); renameSync(temp, path);
}
const run = (binary, args) => execFileSync(binary, args, { encoding: "utf8", timeout: 120_000, stdio: ["ignore", "pipe", "pipe"] });

export function planInstalledOtaAgent({ profile, managedRoot, agentPlistPath, agentLabel,
  qaIsolationRoot = "" }) {
  if (!["PHYSICAL_GATEWAY", "SOFTWARE_CONNECTOR"].includes(profile)) fail("EDGE_OTA_INSTALL_PROFILE_INVALID");
  const root = resolve(managedRoot), plist = resolve(agentPlistPath);
  if (qaIsolationRoot) {
    const scope = resolve(qaIsolationRoot);
    if (!scope.startsWith(`${tmpdir()}/`) || ![root, plist].every(path => path.startsWith(`${scope}/`)) ||
      !/^com\.digitalobserver\.qa\.push38i\.agent\.[a-z0-9.-]+$/.test(agentLabel)) fail("EDGE_OTA_INSTALL_QA_SCOPE_INVALID");
  } else {
    const gateway = profile === "PHYSICAL_GATEWAY";
    const expectedRoot = join(homedir(), "Library/Application Support/Digital Observer",
      gateway ? "observer-gateway" : "observer-connector", "ota");
    const expectedLabel = gateway ? "com.ganbatuach.video-gateway.ota-agent" : "com.ganbatuach.software-connector.tapo.ota-agent";
    if (root !== expectedRoot || agentLabel !== expectedLabel ||
      plist !== join(homedir(), "Library/LaunchAgents", `${expectedLabel}.plist`)) fail("EDGE_OTA_INSTALL_LIVE_SCOPE_INVALID");
  }
  return { profile, managed_root: root, agent_plist: plist, agent_label: agentLabel,
    management_code: join(root, "agent", "edge-installed-ota-service.mjs"),
    config: join(root, "agent-config.json"), trust: qaIsolationRoot ? "QA_ROOT_PIN" : "PROTECTED_ROOT_PIN",
    writes: 0, qa: Boolean(qaIsolationRoot) };
}

export function installInstalledOtaAgent({ profile, managedRoot, agentPlistPath, agentLabel, nodePath,
  manifest, artifactPath, baselineReleaseId, runtimeConfig, qaIsolationRoot = "" }) {
  const plan = planInstalledOtaAgent({ profile, managedRoot, agentPlistPath, agentLabel, qaIsolationRoot });
  const trusted = loadPinnedEdgeReleaseKeys({ registryPath: qaIsolationRoot
    ? runtimeConfig.qaTrustRegistryPath : PROTECTED_EDGE_TRUST_REGISTRY_PATH,
    ...(qaIsolationRoot ? { rootPinPath: runtimeConfig.qaRootPinPath, qaOwnerAllowed: true } : {}) }).trustedPublicKeys;
  if (!verifyEdgeUpdateManifest(manifest, trusted).ok || manifest.profile !== profile ||
    manifest.platform !== "darwin" || manifest.architecture !== process.arch ||
    !verifyEdgeArtifact(readFileSync(artifactPath), manifest).ok) fail("EDGE_OTA_INSTALL_RELEASE_UNTRUSTED");
  const bootstrap = JSON.parse(readFileSync(join(managedRoot, "installed-bootstrap.json"), "utf8"));
  if (bootstrap.pointer.release_id !== baselineReleaseId || !baselineReleaseId ||
    bootstrap.pointer.artifact_sha256 !== runtimeConfig.baselineArtifactSha256) fail("EDGE_OTA_INSTALL_BASELINE_UNVERIFIED");
  const slotRoot = realpathSync(join(managedRoot, "slots"));
  const baselineSlot = realpathSync(resolve(bootstrap.pointer.slot));
  if (!baselineSlot.startsWith(`${slotRoot}/`) ||
    lstatSync(join(baselineSlot, "release.json")).isSymbolicLink() ||
    lstatSync(join(baselineSlot, "artifact.bin")).isSymbolicLink()) fail("EDGE_OTA_INSTALL_BASELINE_UNVERIFIED");
  const baselineManifest = JSON.parse(readFileSync(join(baselineSlot, "release.json"), "utf8"));
  if (!verifyEdgeUpdateManifest(baselineManifest, trusted).ok ||
    baselineManifest.release_id !== baselineReleaseId || baselineManifest.profile !== profile ||
    baselineManifest.platform !== "darwin" || baselineManifest.architecture !== process.arch ||
    baselineManifest.artifact_sha256 !== bootstrap.pointer.artifact_sha256 ||
    !verifyEdgeArtifact(readFileSync(join(baselineSlot, "artifact.bin")), baselineManifest).ok)
    fail("EDGE_OTA_INSTALL_BASELINE_UNVERIFIED");
  if (!existsSync(nodePath) || lstatSync(nodePath).isSymbolicLink()) fail("EDGE_OTA_INSTALL_NODE_UNTRUSTED");
  const managementDir = join(managedRoot, "agent");
  const temp = mkdtempSync(join(tmpdir(), "observer-ota-management-"));
  try {
    inspectArchive(artifactPath);
    run("tar", ["-xzf", artifactPath, "-C", temp]);
    const source = join(temp, profile === "SOFTWARE_CONNECTOR" ?
      "Digital Observer.app/Contents/Resources/runtime/services/video-gateway" : "services/video-gateway");
    const runtimeRoot = join(temp, profile === "SOFTWARE_CONNECTOR" ?
      "Digital Observer.app/Contents/Resources/runtime" : "");
    if (!existsSync(join(source, "edge-installed-ota-service.mjs"))) fail("EDGE_OTA_INSTALL_AGENT_MISSING");
    const undici = join(runtimeRoot, "node_modules/undici");
    if (!existsSync(join(undici, "package.json"))) fail("EDGE_OTA_INSTALL_HTTP_RUNTIME_MISSING");
    const artifactDigest = createHash("sha256").update(readFileSync(artifactPath)).digest("hex");
    if (existsSync(managementDir)) {
      const prior = JSON.parse(readFileSync(join(managementDir, "agent-release.json"), "utf8"));
      if (prior.release_id !== manifest.release_id || prior.artifact_sha256 !== artifactDigest) fail("EDGE_OTA_INSTALL_AGENT_CONFLICT");
    } else {
      const staging = `${managementDir}.${randomUUID()}.staging`;
      cpSync(source, staging, { recursive: true });
      cpSync(undici, join(staging, "node_modules/undici"), { recursive: true });
      writeFileSync(join(staging, "agent-release.json"), JSON.stringify({ release_id: manifest.release_id,
        artifact_sha256: artifactDigest, signing_key_id: manifest.signing_key_id }), { mode: 0o600 });
      renameSync(staging, managementDir);
    }
    atomic(plan.config, `${JSON.stringify(runtimeConfig)}\n`);
    const plist = plistXml({ Label: agentLabel, ProgramArguments: [nodePath, plan.management_code, plan.config],
      RunAtLoad: true, KeepAlive: true, ThrottleInterval: 10,
      StandardOutPath: join(managedRoot, "agent.out.log"), StandardErrorPath: join(managedRoot, "agent.err.log") });
    if (existsSync(agentPlistPath) && readFileSync(agentPlistPath, "utf8") !== plist) fail("EDGE_OTA_INSTALL_PLIST_CONFLICT");
    if (!existsSync(agentPlistPath)) atomic(agentPlistPath, plist);
    const domain = `gui/${process.getuid()}`;
    try { run("/bin/launchctl", ["bootstrap", domain, agentPlistPath]); }
    catch { if (!run("/bin/launchctl", ["print", `${domain}/${agentLabel}`]).includes("state = running")) fail("EDGE_OTA_INSTALL_SERVICE_FAILED"); }
    return { ...plan, installed: true, release_id: manifest.release_id, artifact_sha256: artifactDigest };
  } finally { rmSync(temp, { recursive: true, force: true }); }
}
