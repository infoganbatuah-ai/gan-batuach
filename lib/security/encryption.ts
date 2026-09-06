import crypto from "node:crypto";

const algorithm = "aes-256-gcm";
const cbcAlgorithm = "aes-256-cbc";

function key() {
  const raw = process.env.FIELD_ENCRYPTION_KEY_CURRENT || process.env.FIELD_ENCRYPTION_KEY || "";
  if (!raw) throw new Error("Dedicated field encryption key is required for sensitive field encryption");
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptField(value: string | undefined | null) {
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptField(value: string | undefined | null) {
  if (!value) return null;
  const [ivRaw, tagRaw, encryptedRaw] = value.split(".");
  const decipher = crypto.createDecipheriv(algorithm, key(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedRaw, "base64url")), decipher.final()]);
  return decrypted.toString("utf8");
}

export function encryptSensitiveFieldCbc(value: string | undefined | null) {
  if (!value) return null;
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(cbcAlgorithm, key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `cbc.v1.${iv.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSensitiveField(value: string | undefined | null) {
  if (!value) return null;
  if (value.startsWith("cbc.v1.")) {
    const [, , ivRaw, encryptedRaw] = value.split(".");
    const decipher = crypto.createDecipheriv(cbcAlgorithm, key(), Buffer.from(ivRaw, "base64url"));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encryptedRaw, "base64url")), decipher.final()]);
    return decrypted.toString("utf8");
  }
  return decryptField(value);
}
