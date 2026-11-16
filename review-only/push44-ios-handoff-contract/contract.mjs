// Review-only authorization contract. The caller must supply server-verified
// Development session and device-proof results; this module is not an endpoint.
import { createHash, timingSafeEqual } from "node:crypto";
const nonempty = (value) => typeof value === "string" && value.length > 0;
const codePattern = /^[a-f0-9]{64}$/;
const observerAudience = "com.digitalobserver.app.qa";

function codeHash(code) { return createHash("sha256").update(code, "utf8").digest("hex"); }
function sameHash(a, b) {
  return typeof a === "string" && /^[a-f0-9]{64}$/.test(a)
    && timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

export async function redeemQaHandoff(store, input) {
  if (!store || typeof store.load !== "function" || typeof store.consumeIfCurrent !== "function"
    || !input || !nonempty(input.receiptId) || !nonempty(input.accountId)
    || !nonempty(input.installationId) || !nonempty(input.sessionId)
    || !nonempty(input.audience) || input.audience === observerAudience || !nonempty(input.callback)
    || !codePattern.test(input.code) || !codePattern.test(input.nonce)
    || !Number.isSafeInteger(input.now)
    || input.activeSession !== true || input.deviceProofValid !== true) return false;

  try {
    const receipt = await store.load(input.receiptId);
    if (!receipt || receipt.id !== input.receiptId || receipt.accountId !== input.accountId
      || receipt.installationId !== input.installationId || receipt.sessionId !== input.sessionId
      || receipt.audience !== input.audience || receipt.callback !== input.callback
      || receipt.nonce !== input.nonce || !sameHash(receipt.codeSha256, codeHash(input.code))
      || receipt.consumedAt !== null
      || receipt.revokedAt !== null || !Number.isSafeInteger(receipt.expiresAt)
      || !Number.isSafeInteger(receipt.issuedAt) || receipt.issuedAt > input.now
      || receipt.expiresAt <= input.now || receipt.expiresAt - receipt.issuedAt > 120_000) return false;

    // A real adapter must compare these fields and mark consumed in one durable
    // transaction. The pre-read is not a fence against concurrent redemption.
    return (await store.consumeIfCurrent(receipt.id, {
      now: input.now,
      accountId: input.accountId,
      installationId: input.installationId,
      sessionId: input.sessionId,
      audience: input.audience, callback: input.callback,
      codeSha256: codeHash(input.code), nonce: input.nonce
    })) === true;
  } catch {
    return false;
  }
}

// No Observer HTTPS/AASA origin is approved. Refuse even if a caller supplies
// a feature flag or the existing Gan-only host; no active route imports this.
export function redeemObserverQaCode() {
  return Promise.resolve(false);
}
