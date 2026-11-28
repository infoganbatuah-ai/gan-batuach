// Review-only authorization contract. The caller must supply server-verified
// Development session and device-proof results; this module is not an endpoint.
const nonempty = (value) => typeof value === "string" && value.length > 0;

export async function redeemQaHandoff(store, input) {
  if (!store || typeof store.load !== "function" || typeof store.consumeIfCurrent !== "function"
    || !input || !nonempty(input.receiptId) || !nonempty(input.accountId)
    || !nonempty(input.installationId) || !nonempty(input.sessionId)
    || !nonempty(input.audience) || !Number.isSafeInteger(input.now)
    || input.activeSession !== true || input.deviceProofValid !== true) return false;

  try {
    const receipt = await store.load(input.receiptId);
    if (!receipt || receipt.id !== input.receiptId || receipt.accountId !== input.accountId
      || receipt.installationId !== input.installationId || receipt.sessionId !== input.sessionId
      || receipt.audience !== input.audience || receipt.consumedAt !== null
      || receipt.revokedAt !== null || !Number.isSafeInteger(receipt.expiresAt)
      || receipt.expiresAt <= input.now) return false;

    // A real adapter must compare these fields and mark consumed in one durable
    // transaction. The pre-read is not a fence against concurrent redemption.
    return (await store.consumeIfCurrent(receipt.id, {
      now: input.now,
      accountId: input.accountId,
      installationId: input.installationId,
      sessionId: input.sessionId,
      audience: input.audience
    })) === true;
  } catch {
    return false;
  }
}
