import { createHmac, timingSafeEqual } from "node:crypto";

// This verifies only the legacy generic HMAC transport. A gateway-specific
// adapter must additionally verify its actual signature format and account.
export function verifyLegacyHmacSignature(body: string, signature: string | null, secret?: string) {
  if (!secret || !signature) return false;
  const received = signature.startsWith("sha256=") ? signature.slice(7) : signature;
  if (!/^[a-fA-F0-9]{64}$/.test(received)) return false;
  const expected = createHmac("sha256", secret).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(received, "hex"));
}
