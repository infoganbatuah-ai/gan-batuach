// One-time Connector migration. The exact, improperly sealed app is recovery
// material only; it never becomes a managed release or normal OTA target.
import { createHash, createPublicKey, randomUUID, verify } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { edgeHealthGate } from "./edge-update-manager.mjs";
import { verifyEdgeArtifact, verifyEdgeUpdateManifest } from "./edge-update-contract.mjs";

const sha = bytes => createHash("sha256").update(bytes).digest("hex");
function fail(code) { throw Object.assign(new Error(code), { code }); }
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value)
    .sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stable(v)]));
  return value;
}
export function canonicalLegacyTransitionRecord(record) {
  const copy = structuredClone(record); delete copy.signature; return JSON.stringify(stable(copy));
}
export function verifyLegacyTransitionRecord(record, { trustedPublicKeys, device, legacyManifest, transitionManifest }) {
  try {
    const keys = ["protocol", "purpose", "device_id", "profile", "platform", "architecture",
      "legacy_release_id", "legacy_artifact_sha256", "transition_release_id", "transition_artifact_sha256",
      "payload_equivalence_sha256", "resource_inventory_sha256", "source_lineage",
      "configuration_expectation", "runtime_dependencies", "intentional_signing_paths",
      "signing_key_id", "created_at", "signature"];
    if (!record || Object.keys(record).sort().join("|") !== keys.sort().join("|") ||
      record.protocol !== "observer-connector-legacy-transition-v2" ||
      record.purpose !== "CONNECTOR_LEGACY_TO_MANAGED_TRANSITION" ||
      record.device_id !== device.deviceId || record.profile !== "SOFTWARE_CONNECTOR" ||
      device.profile !== "SOFTWARE_CONNECTOR" || record.platform !== device.platform ||
      record.architecture !== device.architecture || record.legacy_release_id !== legacyManifest.release_id ||
      record.legacy_artifact_sha256 !== legacyManifest.artifact_sha256 ||
      record.transition_release_id !== transitionManifest.release_id ||
      record.transition_artifact_sha256 !== transitionManifest.artifact_sha256 ||
      !/^[a-f0-9]{64}$/.test(record.payload_equivalence_sha256) ||
      !/^[a-f0-9]{64}$/.test(record.resource_inventory_sha256) ||
      record.source_lineage?.category !== "CAPTURED_LEGACY_MIXED_GIT_BLOBS" ||
      record.source_lineage?.single_build_commit !== null ||
      !Array.isArray(record.source_lineage?.verified_blobs) ||
      record.source_lineage.verified_blobs.length !== 3 ||
      record.configuration_expectation !== "IDENTITY_CREDENTIALS_SITE_SOURCES_AND_QUEUES_EXTERNAL" ||
      JSON.stringify(record.runtime_dependencies) !== JSON.stringify([
        "Contents/Resources/bin/node", "Contents/Resources/bin/ffmpeg",
        "Contents/Resources/bin/ffprobe", "Contents/Resources/models/ssd_mobilenet_v1_10.onnx",
        "Contents/Resources/runtime/node_modules"
      ]) ||
      JSON.stringify(record.intentional_signing_paths) !== JSON.stringify([
        "Contents/MacOS/DigitalObserver", "Contents/_CodeSignature/CodeResources"
      ]) ||
      !Number.isFinite(Date.parse(record.created_at)) || Date.parse(record.created_at) > Date.now() + 300_000)
      fail("EDGE_LEGACY_TRANSITION_RECORD_INVALID");
    const encoded = trustedPublicKeys?.[record.signing_key_id];
    if (!encoded) fail("EDGE_LEGACY_TRANSITION_SIGNER_UNTRUSTED");
    const key = createPublicKey({ key: Buffer.from(encoded, "base64url"), format: "der", type: "spki" });
    if (key.asymmetricKeyType !== "ed25519" ||
      !verify(null, Buffer.from(canonicalLegacyTransitionRecord(record)), key, Buffer.from(record.signature, "base64url")))
      fail("EDGE_LEGACY_TRANSITION_SIGNATURE_INVALID");
    return { ok: true };
  } catch (error) { return { ok: false, reason: error.code || "EDGE_LEGACY_TRANSITION_RECORD_INVALID" }; }
}
function atomicJson(path, value) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  renameSync(temporary, path);
}

export function createConnectorLegacyTransition({ manager, adapter, inspect, verifyContinuity }) {
  if (manager?.device?.profile !== "SOFTWARE_CONNECTOR" || !adapter?.verifyLegacyInstalled ||
    !adapter?.install || !adapter?.restart || !adapter?.restoreLegacy || !inspect || !verifyContinuity)
    fail("EDGE_LEGACY_TRANSITION_SCOPE_INVALID");
  const root = manager.root, journalPath = join(root, "legacy-transition.json");
  const recoveryDir = join(root, "legacy-recovery-only"), recoveryArtifact = join(recoveryDir, "artifact.bin");
  const read = () => manager.readJson(journalPath, null);
  async function recover() {
    const prior = read();
    if (!prior || prior.device_id !== manager.device.deviceId) fail("EDGE_LEGACY_RECOVERY_MISSING");
    if (prior.state === "RETIRED") fail("EDGE_LEGACY_RECOVERY_RETIRED");
    if (prior.state === "ACTION_REQUIRED") return { state: "ACTION_REQUIRED",
      legacy_recovered: prior.recovery_used === true };
    if (manager.current().slot || manager.knownGood().length) {
      if (manager.current().release_id !== prior.transition_release_id ||
        manager.knownGood().at(-1)?.release_id !== prior.transition_release_id)
        fail("EDGE_LEGACY_RECOVERY_MANAGED");
      manager.verifySlot(manager.current());
      const health = edgeHealthGate(await manager.healthCheck({ version: manager.current().version,
        transition_reconcile: true }));
      if (!health.healthy) fail("EDGE_LEGACY_TRANSITION_RECONCILE_UNHEALTHY");
      atomicJson(journalPath, { ...prior, state: "RETIRED", retired_at: new Date().toISOString(),
        updated_at: new Date().toISOString() });
      return { state: "RETIRED", legacy_recovered: false };
    }
    if (!existsSync(recoveryArtifact) || sha(readFileSync(recoveryArtifact)) !== prior.legacy_artifact_sha256)
      fail("EDGE_LEGACY_RECOVERY_ARTIFACT_CHANGED");
    await adapter.restoreLegacy();
    if (!await adapter.verifyLegacyInstalled({ artifactPath: recoveryArtifact,
      manifest: manager.readJson(join(recoveryDir, "release.json"), null), legacyRecoveryOnly: true }))
      fail("EDGE_LEGACY_RECOVERY_CONTENT_MISMATCH");
    const after = await inspect();
    if (!after.legacy_running || after.identity_fingerprint !== prior.identity_fingerprint ||
      after.binding_fingerprint !== prior.binding_fingerprint) fail("EDGE_LEGACY_RECOVERY_UNHEALTHY");
    atomicJson(journalPath, { ...prior, state: "ACTION_REQUIRED", recovery_used: true,
      failure_category: prior.failure_category || "EDGE_LEGACY_TRANSITION_INTERRUPTED",
      updated_at: new Date().toISOString() });
    return { state: "ACTION_REQUIRED", legacy_recovered: true };
  }
  async function run({ legacyManifest, legacyBytes, transitionManifest, transitionBytes, derivationRecord },
    { retryRecoveredFailure = false } = {}) {
    const prior = read();
    // A recovered live attempt may be retried only for the two exact,
    // pre-remediation ordering defects observed during PUSH 38. This is a
    // finite allow-list, not a generic retry switch: attempt four and every
    // other failure category remain permanently fail closed.
    const retryFailureChain = Array.isArray(prior?.retry_failures)
      ? prior.retry_failures
      : [prior?.retry_of_failure].filter(Boolean);
    const approvedRecoveredFailure = (prior?.attempts === 1 &&
      prior.failure_category === "EDGE_UPDATE_HEALTH_DEVICE_AUTHENTICATED_FAILED") ||
      (prior?.attempts === 2 && prior.retry_of_failure === "EDGE_UPDATE_HEALTH_DEVICE_AUTHENTICATED_FAILED" &&
      prior.failure_category === "EDGE_UPDATE_HEALTH_CONFIG_RETRIEVED_FAILED");
    const recoveredRetry = retryRecoveredFailure && prior?.state === "ACTION_REQUIRED" &&
      prior.recovery_used === true && approvedRecoveredFailure &&
      prior.device_id === manager.device.deviceId && prior.legacy_release_id === legacyManifest.release_id &&
      prior.legacy_artifact_sha256 === legacyManifest.artifact_sha256 &&
      prior.transition_release_id === transitionManifest.release_id &&
      prior.transition_artifact_sha256 === transitionManifest.artifact_sha256;
    if ((prior && !recoveredRetry) || manager.current().slot || manager.knownGood().length ||
      manager.status().state !== "IDLE") fail("EDGE_LEGACY_TRANSITION_ONE_TIME_ONLY");
    if (manager.device.revoked || manager.device.channel !== "INTERNAL") fail("EDGE_LEGACY_TRANSITION_DEVICE_INELIGIBLE");
    for (const [manifest, bytes] of [[legacyManifest, legacyBytes], [transitionManifest, transitionBytes]]) {
      const checked = verifyEdgeUpdateManifest(manifest, manager.trustedPublicKeys);
      if (!checked.ok || !verifyEdgeArtifact(bytes, manifest).ok ||
        manifest.profile !== "SOFTWARE_CONNECTOR" || manifest.platform !== manager.device.platform ||
        manifest.architecture !== manager.device.architecture || manifest.channel !== manager.device.channel)
        fail("EDGE_LEGACY_TRANSITION_RELEASE_UNTRUSTED");
    }
    const record = verifyLegacyTransitionRecord(derivationRecord, { trustedPublicKeys: manager.trustedPublicKeys,
      device: manager.device, legacyManifest, transitionManifest });
    if (!record.ok) fail(record.reason);
    if (legacyManifest.artifact_sha256 === transitionManifest.artifact_sha256 ||
      legacyManifest.release_id === transitionManifest.release_id) fail("EDGE_LEGACY_TRANSITION_ARTIFACTS_NOT_DISTINCT");
    const before = await inspect();
    if (!before.legacy_running || !before.identity_fingerprint || !before.binding_fingerprint)
      fail("EDGE_LEGACY_TRANSITION_LEGACY_UNHEALTHY");
    const legacyTemp = join(root, `.legacy-verify-${randomUUID()}.bin`);
    writeFileSync(legacyTemp, legacyBytes, { mode: 0o600, flag: "wx" });
    try {
      if (!await adapter.verifyLegacyInstalled({ artifactPath: legacyTemp, manifest: legacyManifest,
        legacyRecoveryOnly: true })) fail("EDGE_LEGACY_TRANSITION_LIVE_MISMATCH");
    } finally { rmSync(legacyTemp, { force: true }); }
    mkdirSync(recoveryDir, { recursive: true, mode: 0o700 });
    if (existsSync(recoveryArtifact)) {
      if (sha(readFileSync(recoveryArtifact)) !== legacyManifest.artifact_sha256)
        fail("EDGE_LEGACY_RECOVERY_ARTIFACT_CONFLICT");
    } else writeFileSync(recoveryArtifact, legacyBytes, { mode: 0o600, flag: "wx" });
    atomicJson(join(recoveryDir, "release.json"), legacyManifest);
    if (recoveredRetry && (before.identity_fingerprint !== prior.identity_fingerprint ||
      before.binding_fingerprint !== prior.binding_fingerprint)) fail("EDGE_LEGACY_TRANSITION_RETRY_BINDING_CHANGED");
    atomicJson(journalPath, { protocol: "observer-connector-legacy-migration-v1", state: "LEGACY_RECOVERY_ONLY",
      device_id: manager.device.deviceId, legacy_release_id: legacyManifest.release_id,
      legacy_artifact_sha256: legacyManifest.artifact_sha256, transition_release_id: transitionManifest.release_id,
      transition_artifact_sha256: transitionManifest.artifact_sha256,
      derivation_sha256: sha(Buffer.from(canonicalLegacyTransitionRecord(derivationRecord))),
      identity_fingerprint: before.identity_fingerprint, binding_fingerprint: before.binding_fingerprint,
      attempts: recoveredRetry ? prior.attempts + 1 : 1, recovery_used: recoveredRetry,
      retry_of_failure: recoveredRetry ? prior.failure_category : null, updated_at: new Date().toISOString() });
    if (recoveredRetry) atomicJson(journalPath, { ...read(),
      retry_failures: [...retryFailureChain, prior.failure_category], updated_at: new Date().toISOString() });
    const slot = join(root, "slots", transitionManifest.version);
    if (existsSync(slot)) {
      if (!recoveredRetry || !existsSync(join(slot, "artifact.bin")) || !existsSync(join(slot, "release.json")) ||
        sha(readFileSync(join(slot, "artifact.bin"))) !== transitionManifest.artifact_sha256 ||
        JSON.parse(readFileSync(join(slot, "release.json"), "utf8")).release_id !== transitionManifest.release_id)
        fail("EDGE_LEGACY_TRANSITION_SLOT_CONFLICT");
      rmSync(slot, { recursive: true });
    }
    const staging = join(root, "slots", `.transition-${randomUUID()}.staging`);
    mkdirSync(staging, { recursive: true, mode: 0o700 });
    try {
      const artifactPath = join(staging, "artifact.bin");
      writeFileSync(artifactPath, transitionBytes, { mode: 0o600, flag: "wx" });
      await adapter.install({ artifactPath, staging, manifest: transitionManifest });
      atomicJson(join(staging, "release.json"), transitionManifest);
      renameSync(staging, slot);
      atomicJson(journalPath, { ...read(), state: "INSTALLING", updated_at: new Date().toISOString() });
      await adapter.restart({ slot, manifest: transitionManifest });
      const health = edgeHealthGate(await manager.healthCheck({ version: transitionManifest.version, transition: true }));
      if (!health.healthy || !await verifyContinuity({ before, transitionManifest }))
        fail(health.healthy ? "EDGE_LEGACY_TRANSITION_CONTINUITY_FAILED" : health.reason);
      const pointer = { version: transitionManifest.version, build_sha: transitionManifest.build_sha,
        slot, release_id: transitionManifest.release_id, artifact_sha256: transitionManifest.artifact_sha256,
        signing_key_id: transitionManifest.signing_key_id, channel: transitionManifest.channel,
        promoted_at: new Date().toISOString(), trusted: true };
      manager.verifySlot(pointer);
      atomicJson(manager.bootstrapPath, { protocol: "observer-installed-bootstrap-v1", pointer, health });
      atomicJson(manager.statePath, { state: "HEALTHY", current_version: pointer.version,
        known_good_version: pointer.version, history: [{ state: "HEALTHY", at: new Date().toISOString(),
          category: "EDGE_LEGACY_TRANSITION_PROMOTED" }] });
      atomicJson(journalPath, { ...read(), state: "RETIRED", retired_at: new Date().toISOString(),
        updated_at: new Date().toISOString() });
      return { state: "HEALTHY", current_release: pointer.release_id, known_good_release: pointer.release_id,
        legacy_state: "RETIRED" };
    } catch (error) {
      atomicJson(journalPath, { ...read(), failure_category: error.code || "EDGE_LEGACY_TRANSITION_FAILED",
        updated_at: new Date().toISOString() });
      await recover();
      throw error;
    }
  }
  return { run, recover, status: read };
}
