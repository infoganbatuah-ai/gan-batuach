import { createHash } from "node:crypto";
import { closeSync, openSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { productIdPattern } from "./edge-command-policy.mjs";
import { verifyProductDeviceIdentity } from "./product-device-identity.mjs";
import { verifyEdgeArtifact, verifyEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { edgeHealthGate } from "./edge-update-manager.mjs";
import { confirmProductDeviceMigration } from "./product-device-migration.mjs";

export function productCameraBindingsDigest(rows, siteId) {
  if (!Array.isArray(rows) || !productIdPattern.test(siteId || "") || rows.length < 1 || rows.length > 200)
    throw new Error("PRODUCT_CAMERA_BINDINGS_INVALID");
  const ids = new Set(), routes = new Set(), canonical = [];
  for (const row of rows) {
    if (!productIdPattern.test(row?.cameraId || "") || row.siteId !== siteId ||
      !productIdPattern.test(row.gatewayId || "") ||
      typeof row.streamId !== "string" || !row.streamId.trim() || row.streamId.length > 200) {
      throw new Error("PRODUCT_CAMERA_BINDINGS_INVALID");
    }
    const route = JSON.stringify([row.gatewayId, row.streamId]);
    if (ids.has(row.cameraId) || routes.has(route)) throw new Error("PRODUCT_CAMERA_BINDINGS_DUPLICATE");
    ids.add(row.cameraId);
    routes.add(route);
    canonical.push(JSON.stringify([row.cameraId, row.siteId, row.gatewayId, row.streamId]));
  }
  return createHash("sha256").update(canonical.sort().join("\n")).digest("hex");
}

// The caller pins the local device's verified stream ID. Reconstruct the
// original digest by changing that one route back. Any other mapping change,
// new camera or duplicate is rejected before the failed release is admitted.
export function qualifyProductRouteCorrection(rows, { siteId, gatewayId, cameraId, before, after, originalDigest }) {
  const correctedDigest = productCameraBindingsDigest(rows, siteId);
  const camera = rows.find(row => row.cameraId === cameraId);
  if (!camera || camera.gatewayId !== gatewayId || camera.streamId !== after || before === after ||
    ![before, after].every(value => /^dvr_[a-f0-9]{18}_[1-9]\d*$/.test(value))) {
    throw new Error("PRODUCT_ROUTE_CORRECTION_INVALID");
  }
  const original = rows.map(row => row.cameraId === cameraId ? { ...row, streamId: before } : row);
  if (productCameraBindingsDigest(original, siteId) !== originalDigest) throw new Error("PRODUCT_ROUTE_CORRECTION_INVALID");
  return { correctedDigest, proofSha256: createHash("sha256").update(JSON.stringify({
    siteId, gatewayId, cameraId, before, after, originalDigest, correctedDigest
  })).digest("hex") };
}

// Only the approved controller may start the handoff. A killed controller
// leaves a durable lock for the operator to reconcile against its PID and slot.
export async function recoverProductDevice(input) {
  const lockPath = join(input.manager.root, "product-device-recovery.lock");
  const fd = openSync(lockPath, "wx", 0o600);
  try {
    writeFileSync(fd, JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() }));
    return await recoverLocked(input);
  } finally {
    closeSync(fd);
    unlinkSync(lockPath);
  }
}

// The approved controller supplies a bounded, account-scoped read of the
// existing camera mappings. No enrollment creation or mapping write exists here.
async function recoverLocked({
  manager, store, binding, release, readCameraBindings, expectedBindingsDigest, routeCorrection, fetcher
}) {
  const { gatewayId, siteId } = binding;
  const verified = verifyEdgeUpdateManifest(release.manifest, manager.trustedPublicKeys);
  if (!verified.ok || !verifyEdgeArtifact(release.artifactBytes, verified.manifest).ok ||
    gatewayId !== release.approval?.deviceId || gatewayId !== manager.device.deviceId || release.approval?.profile !== manager.device.profile ||
    verified.manifest.rollout.explicit_device_ids.length !== 1 ||
    verified.manifest.rollout.explicit_device_ids[0] !== gatewayId ||
    !/^[a-f0-9]{64}$/.test(expectedBindingsDigest || "")) throw new Error("PRODUCT_RECOVERY_BINDING_INVALID");

  async function checkBindings() {
    const rows = await readCameraBindings();
    if (productCameraBindingsDigest(rows, siteId) !== expectedBindingsDigest ||
      !rows.some(row => row.gatewayId === gatewayId)) {
      throw Object.assign(new Error("PRODUCT_CAMERA_BINDINGS_CHANGED"), { code: "PRODUCT_CAMERA_BINDINGS_CHANGED" });
    }
    if (routeCorrection && qualifyProductRouteCorrection(rows, { ...routeCorrection, siteId, gatewayId }).proofSha256 !==
      release.approval.routeCorrectionSha256) throw new Error("PRODUCT_ROUTE_CORRECTION_INVALID");
  }

  if (Boolean(routeCorrection) !== Boolean(release.approval.routeCorrectionSha256)) throw new Error("PRODUCT_ROUTE_CORRECTION_REQUIRED");
  const current = manager.current(), state = manager.status();
  const sameRelease = current.release_id === verified.manifest.release_id;
  const resumed = ["RESTARTING", "VERIFYING_HEALTH"].includes(state.state) && sameRelease;
  const alreadyHealthy = state.state === "HEALTHY" && sameRelease;
  if (resumed || alreadyHealthy) {
    const proof = state.product_identity_recovery;
    const currentRelease = manager.verifySlot(current);
    if (currentRelease.artifact_sha256 !== verified.manifest.artifact_sha256 ||
      currentRelease.artifact_sha256 !== release.approval.targetSha256 ||
      proof?.target_release_id !== current.release_id ||
      proof.evidence_sha256 !== release.approval.evidenceSha256) {
      throw new Error("PRODUCT_RECOVERY_RESUME_INVALID");
    }
    verifyProductDeviceIdentity(store, binding);
  } else {
    manager.planProductIdentityRecovery(release);
  }

  await checkBindings();
  if (alreadyHealthy) {
    const health = edgeHealthGate(await manager.healthCheck({ version: current.version, resumed: true }));
    if (!health.healthy) throw new Error(health.reason);
    return state;
  }
  if (!resumed && !routeCorrection) await confirmProductDeviceMigration(store, binding, { fetcher });
  verifyProductDeviceIdentity(store, binding);
  await checkBindings();

  // Check the mapping again inside the health gate, before any promotion.
  const previousHealth = manager.healthCheck;
  manager.healthCheck = async function (input) {
    const health = await previousHealth.call(this, input);
    if (!input.rollback) await checkBindings();
    return health;
  };
  try {
    if (!resumed) return await manager.applyProductIdentityRecovery(release);
    if (state.state === "RESTARTING") return await manager.resumeProductIdentityRestart();
    return await manager.recoverInterruptedHealthVerification();
  } finally {
    manager.healthCheck = previousHealth;
  }
}
