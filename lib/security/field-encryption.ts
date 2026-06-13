import "server-only";

import crypto from "node:crypto";

const algorithm = "aes-256-gcm";
const outputVersion = "gcm.v1";

function currentKeyVersion() {
  return process.env.FIELD_ENCRYPTION_KEY_VERSION || "v1";
}

function keyMaterial(version = currentKeyVersion()) {
  if (version === currentKeyVersion()) {
    return process.env.FIELD_ENCRYPTION_KEY_CURRENT || process.env.FIELD_ENCRYPTION_KEY || "";
  }
  return process.env.FIELD_ENCRYPTION_KEY_PREVIOUS || "";
}

function deriveKey(secret: string) {
  if (!secret) throw new Error("FIELD_ENCRYPTION_KEY_CURRENT is required for field encryption");
  return crypto.createHash("sha256").update(secret).digest();
}

function encode(buffer: Buffer) {
  return buffer.toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url");
}

export function getCurrentKeyVersion() {
  return currentKeyVersion();
}

export function isEncryptedField(value: string | null | undefined) {
  return typeof value === "string" && value.startsWith(`${outputVersion}:`);
}

export function encryptField(value: string | number | boolean | object | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const keyVersion = currentKeyVersion();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, deriveKey(keyMaterial(keyVersion)), iv);
  const plaintext = typeof value === "string" ? value : JSON.stringify(value);
  const cipherText = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [outputVersion, keyVersion, encode(iv), encode(authTag), encode(cipherText)].join(":");
}

export function decryptField(value: string | null | undefined) {
  if (!value) return null;
  if (!isEncryptedField(value)) throw new Error("Unsupported encrypted field format");
  const [, keyVersion, ivRaw, authTagRaw, cipherTextRaw] = value.split(":");
  const secret = keyMaterial(keyVersion);
  if (!secret) throw new Error(`Missing field encryption key for version ${keyVersion}`);
  const decipher = crypto.createDecipheriv(algorithm, deriveKey(secret), decode(ivRaw));
  decipher.setAuthTag(decode(authTagRaw));
  const decrypted = Buffer.concat([decipher.update(decode(cipherTextRaw)), decipher.final()]);
  return decrypted.toString("utf8");
}

export function hashForLookup(value: string | null | undefined) {
  const normalized = String(value ?? "").replace(/\s+/g, "").trim();
  if (!normalized) return null;
  const pepper = process.env.FIELD_HASH_PEPPER || process.env.FIELD_ENCRYPTION_KEY_CURRENT || process.env.FIELD_ENCRYPTION_KEY || "";
  if (!pepper) throw new Error("FIELD_HASH_PEPPER or FIELD_ENCRYPTION_KEY_CURRENT is required for lookup hashes");
  return crypto.createHmac("sha256", pepper).update(normalized).digest("hex");
}

export function encryptionMetadata() {
  return {
    algorithm,
    format: outputVersion,
    key_version: currentKeyVersion()
  };
}
