// Installs only the signed management agent after a signed known-good baseline.
// HOME_QA remediation stays ineligible until the running agent proves its own
// isolated Ed25519 key and the QA rollout is explicitly promoted.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createWriteStream, existsSync, lstatSync, mkdtempSync, readFileSync, rmSync, statSync,
  writeFileSync } from "node:fs";
import { once } from "node:events";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { authorizeHomeQaR2Download } from "../../services/video-gateway/edge-r2-download.mjs";
import { verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";
import { installInstalledOtaAgent, planInstalledOtaAgent, validateHomeQaOtaIdentityScope } from "../../services/video-gateway/edge-installed-ota-installer.mjs";
import { createEdgeSecretStoreSync } from "../../services/video-gateway/edge-secret-store-sync.mjs";
import { readR2KeychainCredentials } from "../release/macos-r2-keychain.mjs";

const profile = process.argv.find(arg => arg.startsWith("--profile="))?.slice(10);
const apply = process.argv.includes("--apply"), dryRun = process.argv.includes("--dry-run");
if (apply === dryRun || !["SOFTWARE_CONNECTOR", "PHYSICAL_GATEWAY"].includes(profile))
  throw new Error("P38_HOME_QA_AGENT_MODE_OR_PROFILE_INVALID");
const connector = profile === "SOFTWARE_CONNECTOR";
const spec = connector ? {
  deviceId: "db267b52-6282-4944-bcee-5d4857698fb0",
  baselineRelease: "qa-connector-legacy-transition-v2-6e7988808b05",
  baselineSha: "6e7988808b05956d58416a6ce60638f52b19aa732918ac0e1cdafcc5fc9f130a",
  remediationRelease: "qa-p38-health-connector-1b076f596574", bundleName: "connector_remediation.json",
  rootName: "observer-connector", label: "com.ganbatuach.software-connector.tapo", port: 18083,
  installedBase: join(homedir(), "Applications"), expected: 1
} : {
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  baselineRelease: "qa-legacy-gateway-91bf6814075f",
  baselineSha: "91bf6814075f74e703cbc0b85d30673237531247ec46633c54576d5a4627144d",
  remediationRelease: "qa-p38-health-gateway-6c9d08327ec6", bundleName: "gateway_remediation.json",
  rootName: "observer-gateway", label: "com.ganbatuach.video-gateway", port: 18082,
  installedBase: join(homedir(), ".local/share/gan-batuach/video-gateway"), expected: 8, configured: 10
};
const root = join(homedir(), "Library/Application Support/Digital Observer", spec.rootName, "ota");
const secrets = join(root, "home-qa-device-secrets");
const agentLabel = `${spec.label}.ota-agent`;
const agentPlistPath = join(homedir(), "Library/LaunchAgents", `${agentLabel}.plist`);
const certPath = "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38t-ota-loopback-20260920.crt";
const certSha = createHash("sha256").update(readFileSync(certPath)).digest("hex");
const installedCertPath = join(root, "qa-control-plane-ca.crt");
if (apply) {
  if (!existsSync(installedCertPath))
    writeFileSync(installedCertPath, readFileSync(certPath), { mode: 0o600, flag: "wx" });
  if (lstatSync(installedCertPath).isSymbolicLink() || !lstatSync(installedCertPath).isFile() ||
    (lstatSync(installedCertPath).mode & 0o077) !== 0 ||
    createHash("sha256").update(readFileSync(installedCertPath)).digest("hex") !== certSha)
    throw new Error("P38_HOME_QA_AGENT_LOCAL_TLS_CERT_INVALID");
}
const runtimeConfig = { profile, managedRoot: root, installedBase: spec.installedBase,
  launchAgentPath: join(homedir(), "Library/LaunchAgents", `${spec.label}.plist`),
  label: spec.label, port: spec.port, deviceId: spec.deviceId, channel: "HOME_QA",
  configVersion: connector ? 4 : 1, expectedPhysicalCameras: spec.expected,
  configuredPhysicalCameras: spec.configured ?? spec.expected,
  baselineArtifactSha256: spec.baselineSha, secretDir: secrets,
  qaTlsCaPath: apply ? installedCertPath : certPath, qaTlsCaSha256: certSha, intervalMs: 60_000 };
const plan = planInstalledOtaAgent({ profile, managedRoot: root, agentPlistPath, agentLabel });
if (apply) validateHomeQaOtaIdentityScope({ managedRoot: root, runtimeConfig });
const bundle = "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-homeqa-signed-manifests-35482295860.zip";
const manifest = JSON.parse(execFileSync("unzip", ["-p", bundle, spec.bundleName],
  { encoding: "utf8", timeout: 15_000, maxBuffer: 8192 }));
const keys = loadPinnedEdgeReleaseKeys({ registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys;
if (!verifyEdgeUpdateManifest(manifest, keys).ok || manifest.release_id !== spec.remediationRelease ||
  manifest.profile !== profile || manifest.channel !== "HOME_QA" ||
  JSON.stringify(manifest.rollout?.explicit_device_ids) !== JSON.stringify([spec.deviceId]))
  throw new Error("P38_HOME_QA_AGENT_SIGNED_RELEASE_INVALID");
if (dryRun) {
  console.log(JSON.stringify({ status: "AGENT_INSTALL_PLAN_PASS", profile, release_id: manifest.release_id,
    signed_manifest: true, isolated_identity_store: true, tls_certificate_sha256: certSha,
    management_code: plan.management_code, tls_certificate_install_path: installedCertPath,
    runtime_writes: 0 }));
  process.exit(0);
}
const store = createEdgeSecretStoreSync({ secretDir: secrets });
if (store.read("device_gateway_id") !== spec.deviceId ||
  store.read("device_observer_site_id") !== "cc1673b8-3eb0-4785-a12c-1fb88f425a41" ||
  store.read("device_credential_version") !== "1" ||
  store.read("device_cloud_base_url") !== "https://127.0.0.1:3101" ||
  !store.read("device_private_key_pkcs8"))
  throw new Error("P38_HOME_QA_AGENT_MANAGED_IDENTITY_NOT_PREPARED");
const credentials = readR2KeychainCredentials({ service: "digital-observer-r2-home-qa-reader-20260922",
  keychain: join(homedir(), "Library/Keychains/login.keychain-db") });
const capability = await authorizeHomeQaR2Download(manifest, { accountId: "693f824a750afcc264fe6ee58c8a86ab",
  ...credentials });
const temp = mkdtempSync(join(tmpdir(), "observer-p38-agent-install-"));
const artifactPath = join(temp, "remediation.tar.gz");
try {
  const response = await fetch(capability.url, { redirect: "error", signal: AbortSignal.timeout(600_000) });
  if (!response.ok || !response.body || Number(response.headers.get("content-length")) !== manifest.artifact_size)
    throw new Error("P38_HOME_QA_AGENT_ARTIFACT_DOWNLOAD_FAILED");
  const writer = createWriteStream(artifactPath, { flags: "wx", mode: 0o600 });
  const digest = createHash("sha256"); let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > manifest.artifact_size) throw new Error("P38_HOME_QA_AGENT_ARTIFACT_OVERSIZE");
    digest.update(chunk); if (!writer.write(chunk)) await once(writer, "drain");
  }
  writer.end(); await once(writer, "finish");
  if (size !== manifest.artifact_size || statSync(artifactPath).size !== size ||
    digest.digest("hex") !== manifest.artifact_sha256)
    throw new Error("P38_HOME_QA_AGENT_ARTIFACT_HASH_MISMATCH");
  const nodePath = connector ? join(spec.installedBase, "Digital Observer.app/Contents/Resources/bin/node") : process.execPath;
  const installed = installInstalledOtaAgent({ profile, managedRoot: root, agentPlistPath, agentLabel,
    nodePath, manifest, artifactPath, baselineReleaseId: spec.baselineRelease, runtimeConfig });
  console.log(JSON.stringify({ status: "SIGNED_MANAGEMENT_AGENT_INSTALLED", profile,
    management_release_id: installed.release_id, artifact_sha256: installed.artifact_sha256,
    functional_runtime_changed: false, qa_identity_store: "SEPARATE_FROM_PRODUCT_LEGACY" }));
} finally { rmSync(temp, { recursive: true, force: true }); }
