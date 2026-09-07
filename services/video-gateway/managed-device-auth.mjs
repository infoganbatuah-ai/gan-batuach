import { createHash, createPrivateKey, generateKeyPairSync, randomBytes, sign } from "node:crypto";

export const managedDeviceIdentityProtocol = "observer-managed-device-v1";

export function generateManagedDeviceKeyPair() {
  const pair = generateKeyPairSync("ed25519");
  return {
    algorithm: "Ed25519",
    publicKeySpki: pair.publicKey.export({ format: "der", type: "spki" }).toString("base64url"),
    privateKeyPkcs8: pair.privateKey.export({ format: "der", type: "pkcs8" }).toString("base64url")
  };
}

export function createManagedDeviceProofHeaders({ method, pathname, body = "", deviceId, credentialVersion,
  privateKeyPkcs8, runtimeInstanceId, sequence, now = Date.now(), nonce = randomBytes(32).toString("base64url") }) {
  const timestamp = new Date(now).toISOString();
  const bodyHash = createHash("sha256").update(body).digest("hex");
  const canonical = [managedDeviceIdentityProtocol, method.toUpperCase(), pathname, bodyHash, deviceId,
    String(credentialVersion), timestamp, nonce, runtimeInstanceId, String(sequence)].join("\n");
  const signature = sign(null, Buffer.from(canonical), createPrivateKey({
    key: Buffer.from(privateKeyPkcs8, "base64url"), format: "der", type: "pkcs8"
  })).toString("base64url");
  return {
    "x-observer-device-protocol": managedDeviceIdentityProtocol,
    "x-observer-device-id": deviceId,
    "x-observer-device-credential-version": String(credentialVersion),
    "x-observer-device-timestamp": timestamp,
    "x-observer-device-nonce": nonce,
    "x-observer-device-runtime-instance": runtimeInstanceId,
    "x-observer-device-sequence": String(sequence),
    "x-observer-device-signature": signature
  };
}
