import { randomBytes, randomUUID } from "node:crypto";

// Review-only contract. No active route imports this file, and the public
// entrypoint remains disabled independently of caller input.
export const OBSERVER_QA_AUDIENCE = "com.digitalobserver.app.qa";
export const OBSERVER_QA_ISSUER_ACTIVE = false;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (value) => typeof value === "string" && uuid.test(value);

export async function issueObserverQaChallenge() {
  return null;
}

// This seam is solely for disconnected contract tests. authenticate must be
// the trusted server verifier, never an identity copied from request JSON.
// reserve must atomically recheck auth.sessions and the product-bound approved
// installation before inserting a one-use receipt. A pre-read is insufficient.
export async function qualifyObserverQaChallengeIssuer(input, trusted) {
  if (!isUuid(input?.installationId) || typeof trusted?.authenticate !== "function"
    || typeof trusted?.reserve !== "function") return null;
  try {
    const identity = await trusted.authenticate();
    if (!isUuid(identity?.accountId) || !isUuid(identity?.sessionId)) return null;
    const issuedAt = (trusted.now ?? Date.now)();
    if (!Number.isSafeInteger(issuedAt) || issuedAt < 0) return null;
    const receipt = {
      id: (trusted.newId ?? randomUUID)(),
      nonce: (trusted.newNonce ?? (() => randomBytes(32).toString("hex")))(),
      accountId: identity.accountId,
      sessionId: identity.sessionId,
      installationId: input.installationId,
      audience: OBSERVER_QA_AUDIENCE,
      issuedAt,
      expiresAt: issuedAt + 60_000
    };
    if (!isUuid(receipt.id) || !/^[a-f0-9]{64}$/.test(receipt.nonce)
      || !Number.isSafeInteger(receipt.expiresAt)) return null;
    const reserved = await trusted.reserve(receipt);
    if (reserved !== true) return null;
    return { challengeId: receipt.id, nonce: receipt.nonce,
      audience: receipt.audience, expiresAt: receipt.expiresAt };
  } catch {
    return null;
  }
}
