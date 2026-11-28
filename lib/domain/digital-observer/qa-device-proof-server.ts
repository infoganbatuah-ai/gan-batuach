import { createPublicKey, verify } from "node:crypto";

// Dormant server-side primitive. A future route must load a server-issued,
// durable challenge and atomically consume it after this check succeeds.
export type QaDeviceChallenge = {
  nonce: string;
  accountId: string;
  sessionId: string;
  installationId: string;
  audience: string;
  issuedAt: number;
  expiresAt: number;
  consumedAt: number | null;
  revokedAt: number | null;
  publicKeySpkiBase64: string;
};

export const QA_DEVICE_AUDIENCES = Object.freeze({
  gan: "com.ganbatuach.app.qa",
  observer: "com.digitalobserver.app.qa"
} as const);
export type QaDeviceAudience = typeof QA_DEVICE_AUDIENCES[keyof typeof QA_DEVICE_AUDIENCES];
export const isQaDeviceAudience = (value: unknown): value is QaDeviceAudience =>
  value === QA_DEVICE_AUDIENCES.gan || value === QA_DEVICE_AUDIENCES.observer;
const bounded = (value: unknown) => typeof value === "string" && value.length > 0 && value.length <= 256;
const canonicalBase64 = (value: unknown, maxLength: number) => typeof value === "string"
  && value.length > 0 && value.length <= maxLength
  && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
  && Buffer.from(value, "base64").toString("base64") === value;

export function qaDeviceProofMessage(challenge: QaDeviceChallenge): Buffer {
  if (!/^[a-f0-9]{64}$/.test(challenge.nonce)
    || !bounded(challenge.accountId) || !bounded(challenge.sessionId)
    || !bounded(challenge.installationId) || !isQaDeviceAudience(challenge.audience)
    || !Number.isSafeInteger(challenge.issuedAt) || !Number.isSafeInteger(challenge.expiresAt)
    || challenge.expiresAt <= challenge.issuedAt
    || challenge.expiresAt - challenge.issuedAt > 60_000) {
    throw new Error("Invalid QA device challenge context");
  }
  return Buffer.from(JSON.stringify([
    "digital-observer-qa-device-proof-v1", challenge.nonce, challenge.accountId,
    challenge.sessionId, challenge.installationId, challenge.audience, challenge.expiresAt
  ]), "utf8");
}

export function verifyQaDeviceProof(challenge: QaDeviceChallenge, signatureBase64: string, now: number,
  expectedAudience: QaDeviceAudience): boolean {
  if (!isQaDeviceAudience(expectedAudience) || challenge?.audience !== expectedAudience
    || !Number.isSafeInteger(now) || !challenge || challenge.consumedAt !== null
    || challenge.revokedAt !== null || now < challenge.issuedAt || now >= challenge.expiresAt
    || !canonicalBase64(signatureBase64, 256)
    || !canonicalBase64(challenge.publicKeySpkiBase64, 512)) return false;
  try {
    const key = createPublicKey({ key: Buffer.from(challenge.publicKeySpkiBase64, "base64"), format: "der", type: "spki" });
    if (key.asymmetricKeyType !== "ec" || key.asymmetricKeyDetails?.namedCurve !== "prime256v1") return false;
    return verify("sha256", qaDeviceProofMessage(challenge), key, Buffer.from(signatureBase64, "base64"));
  } catch {
    return false;
  }
}
