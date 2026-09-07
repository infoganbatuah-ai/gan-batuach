import { randomUUID, sign, createPrivateKey } from "node:crypto";
import { createManagedDeviceProofHeaders, generateManagedDeviceKeyPair } from "./managed-device-auth.mjs";

const pendingRotationAccount = "device_rotation_pending";

function confirmation({ deviceId, credentialVersion, rotationId, challenge, privateKeyPkcs8 }) {
  const canonical = ["observer-managed-device-rotation-v1", deviceId, String(credentialVersion), rotationId, challenge].join("\n");
  return sign(null, Buffer.from(canonical), createPrivateKey({ key: Buffer.from(privateKeyPkcs8, "base64url"),
    format: "der", type: "pkcs8" })).toString("base64url");
}

export async function rotateManagedDeviceCredential({ store, cloudBaseUrl, fetcher = fetch }) {
  const deviceId = store.read("device_gateway_id");
  const oldVersion = Number(store.read("device_credential_version") || 0);
  const oldPrivateKey = store.read("device_private_key_pkcs8");
  if (!deviceId || !oldVersion || !oldPrivateKey) throw new Error("MANAGED_DEVICE_IDENTITY_REQUIRED");
  let pending = store.read(pendingRotationAccount);
  pending = pending ? JSON.parse(pending) : null;
  if (!pending) {
    const replacement = generateManagedDeviceKeyPair();
    const body = JSON.stringify({ action: "rotate_prepare", gateway_id: deviceId,
      new_credential_algorithm: "Ed25519", new_public_key_spki: replacement.publicKeySpki });
    const path = "/api/video-gateway/device-identity";
    const response = await fetcher(`${cloudBaseUrl}${path}`, { method: "POST", body,
      headers: { "content-type": "application/json", ...createManagedDeviceProofHeaders({ method: "POST", pathname: path,
        body, deviceId, credentialVersion: oldVersion, privateKeyPkcs8: oldPrivateKey,
        runtimeInstanceId: `rotation:${randomUUID()}`, sequence: 1 }) } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.data?.rotation_id || !payload.data?.challenge) throw new Error("MANAGED_DEVICE_ROTATION_PREPARE_FAILED");
    pending = { deviceId, oldVersion, newVersion: payload.data.new_credential_version,
      rotationId: payload.data.rotation_id, challenge: payload.data.challenge,
      publicKeySpki: replacement.publicKeySpki, privateKeyPkcs8: replacement.privateKeyPkcs8 };
    store.write(pendingRotationAccount, JSON.stringify(pending));
  }
  const body = JSON.stringify({ action: "rotate_confirm", gateway_id: pending.deviceId,
    rotation_id: pending.rotationId, new_credential_version: pending.newVersion, challenge: pending.challenge,
    signature: confirmation({ deviceId: pending.deviceId, credentialVersion: pending.newVersion,
      rotationId: pending.rotationId, challenge: pending.challenge, privateKeyPkcs8: pending.privateKeyPkcs8 }) });
  const response = await fetcher(`${cloudBaseUrl}/api/video-gateway/device-identity`, { method: "POST",
    headers: { "content-type": "application/json" }, body });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.data?.status !== "ROTATED") throw new Error("MANAGED_DEVICE_ROTATION_CONFIRM_FAILED");
  store.write("device_private_key_pkcs8", pending.privateKeyPkcs8);
  store.write("device_public_key_spki", pending.publicKeySpki);
  store.write("device_credential_version", String(pending.newVersion));
  store.remove(pendingRotationAccount);
  return { status: "ROTATED", credentialVersion: pending.newVersion };
}
