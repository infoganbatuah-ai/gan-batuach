// Installs management code from a verified release without switching the
// functional Gateway/Connector runtime. Never called during read-only plan.
import { execFileSync } from "node:child_process";
import { createHash, randomUUID, X509Certificate } from "node:crypto";
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
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

// HOME_QA credentials belong to the OTA agent alone. The legacy functional
// Connector/Gateway must continue using its existing Product credential store.
export function validateHomeQaOtaIdentityScope({ managedRoot, runtimeConfig, qaIsolationRoot = "" }) {
  if (qaIsolationRoot || runtimeConfig?.channel !== "HOME_QA") return null;
  const root = resolve(managedRoot);
  const secrets = join(root, "home-qa-device-secrets");
  const certificate = runtimeConfig.qaTlsCaPath;
  if (runtimeConfig.secretDir !== secrets || runtimeConfig.keychainService ||
    !certificate || !isAbsolute(certificate) || !resolve(certificate).startsWith(`${root}/`) ||
    realpathSync(certificate) !== certificate ||
    lstatSync(certificate).isSymbolicLink() || !lstatSync(certificate).isFile() ||
    lstatSync(certificate).uid !== process.getuid() || (lstatSync(certificate).mode & 0o022) !== 0 ||
    (lstatSync(dirname(certificate)).mode & 0o022) !== 0 ||
    !/^[a-f0-9]{64}$/.test(runtimeConfig.qaTlsCaSha256 || "") ||
    createHash("sha256").update(readFileSync(certificate)).digest("hex") !== runtimeConfig.qaTlsCaSha256)
    fail("EDGE_OTA_HOME_QA_IDENTITY_SCOPE_INVALID");
  const tls = new X509Certificate(readFileSync(certificate));
  if (!tls.subjectAltName?.includes("IP Address:127.0.0.1") ||
    Date.parse(tls.validTo) < Date.now() + 26 * 60 * 60_000)
    fail("EDGE_OTA_HOME_QA_TLS_CERTIFICATE_INVALID");
  return { secretDir: secrets, certificate };
}

export function installInstalledOtaAgent({ profile, managedRoot, agentPlistPath, agentLabel, nodePath,
  manifest, artifactPath, baselineReleaseId, runtimeConfig, qaIsolationRoot = "" }) {
  const plan = planInstalledOtaAgent({ profile, managedRoot, agentPlistPath, agentLabel, qaIsolationRoot });
  const priorConfigBytes = existsSync(plan.config) ? readFileSync(plan.config) : null;
  const priorConfig = priorConfigBytes ? JSON.parse(priorConfigBytes.toString("utf8")) : null;
  const homeQaIdentity = validateHomeQaOtaIdentityScope({ managedRoot, runtimeConfig, qaIsolationRoot });
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
    const plist = plistXml({ Label: agentLabel, ProgramArguments: [nodePath, plan.management_code, plan.config],
      RunAtLoad: true, KeepAlive: true, ThrottleInterval: 10,
      ...(homeQaIdentity ? { EnvironmentVariables: { NODE_EXTRA_CA_CERTS: homeQaIdentity.certificate } } : {}),
      StandardOutPath: join(managedRoot, "agent.out.log"), StandardErrorPath: join(managedRoot, "agent.err.log") });
    const priorPlist = priorConfig && homeQaIdentity ? plistXml({ Label: agentLabel,
      ProgramArguments: [nodePath, plan.management_code, plan.config], RunAtLoad: true, KeepAlive: true,
      ThrottleInterval: 10, EnvironmentVariables: { NODE_EXTRA_CA_CERTS: priorConfig.qaTlsCaPath },
      StandardOutPath: join(managedRoot, "agent.out.log"), StandardErrorPath: join(managedRoot, "agent.err.log") }) : null;
    const existingPlist = existsSync(agentPlistPath) ? readFileSync(agentPlistPath, "utf8") : null;
    let restartForCertificateRelocation = false;
    if (existingPlist !== null && existingPlist !== plist) {
      const priorCertificate = priorConfig?.qaTlsCaPath;
      const equivalentConfig = JSON.stringify({ ...priorConfig, qaTlsCaPath: runtimeConfig.qaTlsCaPath }) ===
        JSON.stringify(runtimeConfig);
      const priorCertificateSafe = typeof priorCertificate === "string" && isAbsolute(priorCertificate) &&
        existsSync(priorCertificate) && !lstatSync(priorCertificate).isSymbolicLink() &&
        lstatSync(priorCertificate).isFile() && lstatSync(priorCertificate).uid === process.getuid() &&
        (lstatSync(priorCertificate).mode & 0o022) === 0 &&
        createHash("sha256").update(readFileSync(priorCertificate)).digest("hex") === runtimeConfig.qaTlsCaSha256;
      if (!homeQaIdentity || existingPlist !== priorPlist || !equivalentConfig || !priorCertificateSafe ||
        priorCertificate === runtimeConfig.qaTlsCaPath) fail("EDGE_OTA_INSTALL_PLIST_CONFLICT");
      restartForCertificateRelocation = true;
    }
    const domain = `gui/${process.getuid()}`;
    if (restartForCertificateRelocation) {
      try { run("/bin/launchctl", ["bootout", domain, agentPlistPath]); } catch {}
      try {
        atomic(plan.config, `${JSON.stringify(runtimeConfig)}\n`);
        atomic(agentPlistPath, plist);
        run("/bin/launchctl", ["bootstrap", domain, agentPlistPath]);
      } catch {
        if (priorConfigBytes) atomic(plan.config, priorConfigBytes);
        if (existingPlist) atomic(agentPlistPath, existingPlist);
        try { run("/bin/launchctl", ["bootstrap", domain, agentPlistPath]); } catch {}
        fail("EDGE_OTA_INSTALL_CERTIFICATE_RELOCATION_FAILED");
      }
    } else {
      atomic(plan.config, `${JSON.stringify(runtimeConfig)}\n`);
      if (existingPlist === null) atomic(agentPlistPath, plist);
      try { run("/bin/launchctl", ["bootstrap", domain, agentPlistPath]); }
      catch { if (!run("/bin/launchctl", ["print", `${domain}/${agentLabel}`]).includes("state = running")) fail("EDGE_OTA_INSTALL_SERVICE_FAILED"); }
    }
    return { ...plan, installed: true, release_id: manifest.release_id, artifact_sha256: artifactDigest };
  } finally { rmSync(temp, { recursive: true, force: true }); }
}
