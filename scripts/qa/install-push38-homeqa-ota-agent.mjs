// Installs only the signed management agent after a signed known-good baseline.
// HOME_QA remediation stays ineligible until the running agent proves its own
// isolated Ed25519 key and the QA rollout is explicitly promoted.
import { execFileSync } from "node:child_process";
import { createHash, createPrivateKey, createPublicKey } from "node:crypto";
import { createWriteStream, existsSync, lstatSync, mkdtempSync, readFileSync, rmSync, statSync,
  writeFileSync } from "node:fs";
import { once } from "node:events";
import { homedir, tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { authorizeHomeQaR2Download } from "../../services/video-gateway/edge-r2-download.mjs";
import { verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from "../../services/video-gateway/edge-release-trust.mjs";
import { installInstalledOtaAgent, planInstalledOtaAgent, validateHomeQaOtaIdentityScope } from "../../services/video-gateway/edge-installed-ota-installer.mjs";
import { createEdgeSecretStoreSync } from "../../services/video-gateway/edge-secret-store-sync.mjs";
import { readR2KeychainCredentials } from "../release/macos-r2-keychain.mjs";

const profile = process.argv.find(arg => arg.startsWith("--profile="))?.slice(10);
const apply = process.argv.includes("--apply"), dryRun = process.argv.includes("--dry-run");
const recoveryUpgrade = process.argv.includes("--health-recovery-upgrade");
const startupRecoveryUpgrade = process.argv.includes("--startup-recovery-upgrade");
const livenessRecoveryUpgrade = process.argv.includes("--liveness-recovery-upgrade");
const parentExitRecoveryUpgrade = process.argv.includes("--parent-exit-recovery-upgrade");
const rtspSessionRecoveryUpgrade = process.argv.includes("--rtsp-session-recovery-upgrade");
const connectorHostContinuityUpgrade = process.argv.includes("--connector-host-continuity-upgrade");
const connectorDeviceSessionUpgrade = process.argv.includes("--connector-device-session-upgrade");
const connectorRuntimePidUpgrade = process.argv.includes("--connector-runtime-pid-upgrade");
const connectorGuardRetryUpgrade = process.argv.includes("--connector-guard-retry-upgrade");
const gatewayAuthRecoveryUpgrade = process.argv.includes("--gateway-auth-recovery-upgrade");
const gatewaySessionStabilityUpgrade = process.argv.includes("--gateway-session-stability-upgrade");
const gatewayCommonCauseRecoveryUpgrade = process.argv.includes("--gateway-common-cause-recovery-upgrade");
const gatewayFiniteStreamHandoffUpgrade = process.argv.includes("--gateway-finite-stream-handoff-upgrade");
if ([recoveryUpgrade, startupRecoveryUpgrade, livenessRecoveryUpgrade, parentExitRecoveryUpgrade,
  rtspSessionRecoveryUpgrade, gatewayAuthRecoveryUpgrade, gatewaySessionStabilityUpgrade,
  gatewayCommonCauseRecoveryUpgrade, gatewayFiniteStreamHandoffUpgrade,
  connectorHostContinuityUpgrade, connectorDeviceSessionUpgrade, connectorRuntimePidUpgrade,
  connectorGuardRetryUpgrade].filter(Boolean).length > 1)
  throw new Error("P38_HOME_QA_AGENT_UPGRADE_MODE_INVALID");
const managementUpgrade = process.argv.includes("--management-upgrade") || recoveryUpgrade ||
  startupRecoveryUpgrade || livenessRecoveryUpgrade || parentExitRecoveryUpgrade ||
  rtspSessionRecoveryUpgrade || gatewayAuthRecoveryUpgrade || gatewaySessionStabilityUpgrade ||
  gatewayCommonCauseRecoveryUpgrade || gatewayFiniteStreamHandoffUpgrade || connectorHostContinuityUpgrade ||
  connectorDeviceSessionUpgrade || connectorRuntimePidUpgrade || connectorGuardRetryUpgrade;
if (apply === dryRun || !["SOFTWARE_CONNECTOR", "PHYSICAL_GATEWAY"].includes(profile))
  throw new Error("P38_HOME_QA_AGENT_MODE_OR_PROFILE_INVALID");
if (managementUpgrade && profile !== "SOFTWARE_CONNECTOR" &&
  !gatewayAuthRecoveryUpgrade && !gatewaySessionStabilityUpgrade && !gatewayCommonCauseRecoveryUpgrade &&
  !gatewayFiniteStreamHandoffUpgrade)
  throw new Error("P38_HOME_QA_AGENT_UPGRADE_PROFILE_INVALID");
if ((gatewayAuthRecoveryUpgrade || gatewaySessionStabilityUpgrade || gatewayCommonCauseRecoveryUpgrade ||
  gatewayFiniteStreamHandoffUpgrade) &&
  profile !== "PHYSICAL_GATEWAY")
  throw new Error("P38_HOME_QA_AGENT_UPGRADE_PROFILE_INVALID");
const connector = profile === "SOFTWARE_CONNECTOR";
const spec = connector ? {
  deviceId: "db267b52-6282-4944-bcee-5d4857698fb0",
  baselineRelease: "qa-connector-legacy-transition-v2-6e7988808b05",
  baselineSha: "6e7988808b05956d58416a6ce60638f52b19aa732918ac0e1cdafcc5fc9f130a",
  remediationRelease: connectorGuardRetryUpgrade ? "qa-p38-management-guard-retry-bc310bf7605c" :
    connectorRuntimePidUpgrade ? "qa-p38-management-runtime-pid-95c3b60ed951" :
    connectorDeviceSessionUpgrade ? "qa-p38-health-connector-device-session-23a104eb2a64" :
    connectorHostContinuityUpgrade ? "qa-p38-health-connector-host-continuity-8b8ec21e41c2" :
    rtspSessionRecoveryUpgrade ? "qa-p38-health-connector-rtsp-session-fb790d87cf53" :
    parentExitRecoveryUpgrade ? "qa-p38-health-connector-parent-exit-f7dba974e80f" :
    livenessRecoveryUpgrade ? "qa-p38-health-connector-liveness-bb89862c6352" :
    startupRecoveryUpgrade ? "qa-p38-health-connector-startup-d44b7e4262f9" :
    recoveryUpgrade ? "qa-p38-health-connector-recovery-9bb5db251379" :
    managementUpgrade ? "qa-p38-health-connector-pidfix-1b9e9499ffa7" :
    "qa-p38-health-connector-1b076f596574",
  bundleName: connectorGuardRetryUpgrade ? "connector_management_guard_retry.json" :
    connectorRuntimePidUpgrade ? "connector_management_runtime_pid.json" :
    connectorDeviceSessionUpgrade ? "connector_remediation_device_session.json" :
    connectorHostContinuityUpgrade ? "connector_remediation_host_continuity.json" :
    rtspSessionRecoveryUpgrade ? "connector_remediation_rtsp_session.json" :
    parentExitRecoveryUpgrade ? "connector_remediation_parent_exit.json" :
    livenessRecoveryUpgrade ? "connector_remediation_liveness.json" :
    startupRecoveryUpgrade ? "connector_remediation_startup.json" :
    recoveryUpgrade ? "connector_remediation_recovery.json" :
    managementUpgrade ? "connector_remediation_pidfix.json" : "connector_remediation.json",
  priorManagement: connectorGuardRetryUpgrade ? {
    release_id: "qa-p38-management-runtime-pid-95c3b60ed951",
    artifact_sha256: "95c3b60ed951427d527d884af3b8d51ec2a24058a0f8b2672cdc28826d892dc3" } :
    connectorRuntimePidUpgrade ? {
    release_id: "qa-p38-health-connector-device-session-23a104eb2a64",
    artifact_sha256: "23a104eb2a643e9e03c995d991455f137fb583d487f377b9fb29d226312213ba" } :
    connectorDeviceSessionUpgrade ? {
    release_id: "qa-p38-health-connector-host-continuity-8b8ec21e41c2",
    artifact_sha256: "8b8ec21e41c2044ee0201960ed662fe795527f6e1eed3abeeded5560e2921da9" } :
    connectorHostContinuityUpgrade ? {
    release_id: "qa-p38-health-connector-rtsp-session-fb790d87cf53",
    artifact_sha256: "fb790d87cf5378fac92eb4ed2650ad2227a4851d959df84f400f67931e485e7f" } :
    rtspSessionRecoveryUpgrade ? {
    release_id: "qa-p38-health-connector-parent-exit-f7dba974e80f",
    artifact_sha256: "f7dba974e80fc7e70bef0584744379b09ef4c0e8161eb13c32cea6118a4a55fd" } :
    parentExitRecoveryUpgrade ? { release_id: "qa-p38-health-connector-liveness-bb89862c6352",
    artifact_sha256: "bb89862c63522d3014a435e46c857cb56e58d8d72949606d0ef081f8907f900f" } :
    livenessRecoveryUpgrade ? { release_id: "qa-p38-health-connector-startup-d44b7e4262f9",
    artifact_sha256: "d44b7e4262f9a7c9051a8c3e15258c612791546b1bfeaddf6f95c04ee706d388" } :
    startupRecoveryUpgrade ? { release_id: "qa-p38-health-connector-recovery-9bb5db251379",
    artifact_sha256: "9bb5db251379a3fcc961a8b1ce950eb2acb4554f00ae6a9717b83b4af803077c" } :
    recoveryUpgrade ? { release_id: "qa-p38-health-connector-pidfix-1b9e9499ffa7",
    artifact_sha256: "1b9e9499ffa7d1c2a177a1fa3c657124c4ab803879ccbe220f28a3a6c835d22b" } :
    managementUpgrade ? { release_id: "qa-p38-health-connector-1b076f596574",
      artifact_sha256: "1b076f5965744a903c3c601d8c424c7b127bdcb0d06f49c72eff8b9345bdfc27" } : null,
  rootName: "observer-connector", label: "com.ganbatuach.software-connector.tapo", port: 18083,
  installedBase: join(homedir(), "Applications"), expected: 1
} : {
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  baselineRelease: "qa-legacy-gateway-91bf6814075f",
  baselineSha: "91bf6814075f74e703cbc0b85d30673237531247ec46633c54576d5a4627144d",
  remediationRelease: gatewayFiniteStreamHandoffUpgrade ? "qa-p38-health-gateway-finite-handoff-76781a8e0832" :
    gatewayCommonCauseRecoveryUpgrade ? "qa-p38-health-gateway-common-cause-189e548bc104" :
    gatewaySessionStabilityUpgrade ? "qa-p38-health-gateway-session-e354546bdbf8" :
    gatewayAuthRecoveryUpgrade ? "qa-p38-health-gateway-auth-4197f1a246f1" :
    "qa-p38-health-gateway-6c9d08327ec6",
  bundleName: gatewayFiniteStreamHandoffUpgrade ? "gateway_remediation_finite_stream_handoff.json" :
    gatewayCommonCauseRecoveryUpgrade ? "gateway_remediation_common_cause_recovery.json" :
    gatewaySessionStabilityUpgrade ? "gateway_remediation_session_stability.json" :
    gatewayAuthRecoveryUpgrade ? "gateway_remediation_auth.json" : "gateway_remediation.json",
  priorManagement: gatewayFiniteStreamHandoffUpgrade ? {
    release_id: "qa-p38-health-gateway-common-cause-189e548bc104",
    artifact_sha256: "189e548bc10428ac49615fd2e9f6da60553df24e9da960db9afe40678c15b6eb" } :
    gatewayCommonCauseRecoveryUpgrade ? {
    release_id: "qa-p38-health-gateway-session-e354546bdbf8",
    artifact_sha256: "e354546bdbf8a222f98b9af5166de1b91ee353ff7d5e54111b4c5c931901cd0a" } :
    gatewaySessionStabilityUpgrade ? {
    release_id: "qa-p38-health-gateway-auth-4197f1a246f1",
    artifact_sha256: "4197f1a246f1cf4dcb909d8b6e03651a05753c1b6fffdc727484e5410686bdef" } :
    gatewayAuthRecoveryUpgrade ? { release_id: "qa-p38-health-gateway-6c9d08327ec6",
      artifact_sha256: "6c9d08327ec6f38db3fc55c4c344f4db6fc0d0adab5c68e3ec3f1c1164f11c95" } : null,
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
const bundleOverride = process.argv.find(arg => arg.startsWith("--bundle="))?.slice(9);
const bundle = resolve(bundleOverride || (connectorGuardRetryUpgrade
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-homeqa-connector-guard-retry.zip"
  : connectorRuntimePidUpgrade
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-homeqa-connector-runtime-pid.zip"
  : connectorDeviceSessionUpgrade
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-homeqa-connector-device-session.zip"
  : connectorHostContinuityUpgrade
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-homeqa-connector-host-continuity.zip"
  : rtspSessionRecoveryUpgrade
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-homeqa-connector-rtsp-session.zip"
  : parentExitRecoveryUpgrade
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-homeqa-connector-parent-exit-35811312200.zip"
  : livenessRecoveryUpgrade
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-homeqa-connector-liveness-35806083284.zip"
  : startupRecoveryUpgrade
  ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-homeqa-connector-startup.zip"
  : recoveryUpgrade
    ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-homeqa-connector-recovery.zip"
  : gatewayFiniteStreamHandoffUpgrade
    ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-homeqa-gateway-finite-stream-handoff.zip"
  : gatewayCommonCauseRecoveryUpgrade
    ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-homeqa-gateway-common-cause-recovery.zip"
  : gatewaySessionStabilityUpgrade
    ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-homeqa-gateway-session-stability.zip"
  : gatewayAuthRecoveryUpgrade
    ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-homeqa-gateway-auth.zip"
  : managementUpgrade
    ? "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-homeqa-connector-pidfix-35704990843.zip"
    : "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted/push38-homeqa-signed-manifests-35482295860.zip"));
const restrictedRoot = "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted";
const bundleRelative = relative(restrictedRoot, bundle);
if (!bundleRelative || bundleRelative === ".." || bundleRelative.startsWith(`..${sep}`) ||
  isAbsolute(bundleRelative) || !existsSync(bundle) || lstatSync(bundle).isSymbolicLink() || !lstatSync(bundle).isFile())
  throw new Error("P38_HOME_QA_AGENT_BUNDLE_SCOPE_INVALID");
const manifest = JSON.parse(execFileSync("unzip", ["-p", bundle, spec.bundleName],
  { encoding: "utf8", timeout: 15_000, maxBuffer: 8192 }));
const keys = loadPinnedEdgeReleaseKeys({ registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys;
if (!verifyEdgeUpdateManifest(manifest, keys).ok || manifest.release_id !== spec.remediationRelease ||
  manifest.profile !== profile || manifest.channel !== "HOME_QA" ||
  JSON.stringify(manifest.rollout?.explicit_device_ids) !== JSON.stringify([spec.deviceId]))
  throw new Error("P38_HOME_QA_AGENT_SIGNED_RELEASE_INVALID");
function managedRuntimeSeed(store) {
  if (!connectorDeviceSessionUpgrade) return null;
  const sql = `select json_build_object(
    'gateway_id',e.gateway_id,
    'runtime_instance_id',e.active_runtime_instance_id,
    'runtime_sequence',e.active_runtime_sequence,
    'last_seen_at',e.last_seen_at,
    'public_key_spki',c.public_key_spki)
  from public.video_gateway_device_enrollments e
  join public.observer_managed_device_credentials c
    on c.enrollment_id=e.id and c.credential_version=e.credential_version
  where e.gateway_id='${spec.deviceId}' and e.deployment_profile='SOFTWARE_CONNECTOR'
    and e.status='delivered' and e.lifecycle_state='ACTIVE' and e.identity_scheme='ED25519_V1'
    and c.credential_state='ACTIVE' and c.revoked_at is null;`;
  const raw = execFileSync("docker", ["--context", "colima-push38t", "exec",
    "supabase_db_gan-batuach-push38t", "psql", "-X", "-tA", "-U", "postgres", "-d", "postgres",
    "-c", sql], { encoding: "utf8", timeout: 15_000, maxBuffer: 16_384 }).trim();
  const state = JSON.parse(raw || "null");
  if (!state || state.gateway_id !== spec.deviceId ||
    !/^[A-Za-z0-9._-]+:[0-9a-f-]{36}$/i.test(state.runtime_instance_id || "") ||
    !Number.isSafeInteger(Number(state.runtime_sequence)) || Number(state.runtime_sequence) < 0 ||
    !Number.isFinite(Date.parse(state.last_seen_at)) || Date.now() - Date.parse(state.last_seen_at) > 120_000)
    throw new Error("P38_HOME_QA_AGENT_MANAGED_RUNTIME_STATE_INVALID");
  const privateKey = createPrivateKey({ key: Buffer.from(store.read("device_private_key_pkcs8"), "base64url"),
    format: "der", type: "pkcs8" });
  const localPublic = createPublicKey(privateKey).export({ format: "der", type: "spki" });
  if (!localPublic.equals(Buffer.from(state.public_key_spki, "base64url")))
    throw new Error("P38_HOME_QA_AGENT_MANAGED_RUNTIME_KEY_MISMATCH");
  const installedRuntime = store.read("device_runtime_instance_id");
  if (installedRuntime && installedRuntime !== state.runtime_instance_id)
    throw new Error("P38_HOME_QA_AGENT_MANAGED_RUNTIME_SEED_CONFLICT");
  return { runtimeInstanceId: state.runtime_instance_id, sequence: Number(state.runtime_sequence) };
}
const sessionStore = connectorDeviceSessionUpgrade || connectorRuntimePidUpgrade || connectorGuardRetryUpgrade
  ? createEdgeSecretStoreSync({ secretDir: secrets }) : null;
const sessionSeed = sessionStore ? managedRuntimeSeed(sessionStore) : null;
if (dryRun) {
  if (managementUpgrade) {
    const priorPath = join(root, "agent", "agent-release.json");
    if (!existsSync(priorPath) || lstatSync(priorPath).isSymbolicLink())
      throw new Error("P38_HOME_QA_AGENT_UPGRADE_PRIOR_MISSING");
    const prior = JSON.parse(readFileSync(priorPath, "utf8"));
    if (prior.release_id !== spec.priorManagement.release_id ||
      prior.artifact_sha256 !== spec.priorManagement.artifact_sha256)
      throw new Error("P38_HOME_QA_AGENT_UPGRADE_PRIOR_MISMATCH");
    const domain = `gui/${process.getuid()}/${agentLabel}`;
    if (!execFileSync("/bin/launchctl", ["print", domain], { encoding: "utf8" }).includes("state = running"))
      throw new Error("P38_HOME_QA_AGENT_UPGRADE_SERVICE_NOT_RUNNING");
  }
  console.log(JSON.stringify({ status: "AGENT_INSTALL_PLAN_PASS", profile, release_id: manifest.release_id,
    signed_manifest: true, isolated_identity_store: true, tls_certificate_sha256: certSha,
    management_code: plan.management_code, tls_certificate_install_path: installedCertPath,
    management_upgrade: managementUpgrade,
    managed_runtime_session_seed: sessionSeed ? "PASS" : "NOT_REQUIRED", functional_runtime_writes: 0 }));
  process.exit(0);
}
const store = createEdgeSecretStoreSync({ secretDir: secrets });
if (store.read("device_gateway_id") !== spec.deviceId ||
  store.read("device_observer_site_id") !== "cc1673b8-3eb0-4785-a12c-1fb88f425a41" ||
  store.read("device_credential_version") !== "1" ||
  store.read("device_cloud_base_url") !== "https://127.0.0.1:3101" ||
  !store.read("device_private_key_pkcs8"))
  throw new Error("P38_HOME_QA_AGENT_MANAGED_IDENTITY_NOT_PREPARED");
if (sessionSeed) {
  store.write("device_runtime_instance_id", sessionSeed.runtimeInstanceId);
  const storedSequence = Number(store.read("device_runtime_sequence") || 0);
  store.write("device_runtime_sequence", String(Math.max(storedSequence, sessionSeed.sequence)));
}
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
    nodePath, manifest, artifactPath, baselineReleaseId: spec.baselineRelease, runtimeConfig,
    managementUpgradeFrom: spec.priorManagement });
  console.log(JSON.stringify({ status: "SIGNED_MANAGEMENT_AGENT_INSTALLED", profile,
    management_release_id: installed.release_id, artifact_sha256: installed.artifact_sha256,
    management_upgraded: installed.management_upgraded, functional_runtime_changed: false,
    qa_identity_store: "SEPARATE_FROM_PRODUCT_LEGACY" }));
} finally { rmSync(temp, { recursive: true, force: true }); }
