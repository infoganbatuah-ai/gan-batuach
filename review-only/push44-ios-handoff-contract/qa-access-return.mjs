import { randomBytes, timingSafeEqual } from "node:crypto";

// Dormant local contract only. No iOS, route, or browser code imports this.
export const QA_ACCESS_RETURN_ENABLED = false;
const callbackUrl = "https://qa-iphone-device-proof.ganbatuach.com/qa/device-proof/return";
const audience = "com.ganbatuach.app.qa";
const lifetimeMs = 120_000;

export function createQaAccessReturn({ enabled = QA_ACCESS_RETURN_ENABLED, now = Date.now,
  makeState = () => randomBytes(32).toString("hex") } = {}) {
  let pending = null;
  const begin = (accountId, installationId) => {
    if (!enabled || pending || !accountId || !installationId) return null;
    const state = makeState();
    if (!/^[a-f0-9]{64}$/.test(state)) return null;
    pending = { state, accountId, installationId, audience, expiresAt: now() + lifetimeMs };
    return { state, callbackUrl, audience, expiresAt: pending.expiresAt };
  };
  const consume = (rawUrl, accountId, installationId, appAudience) => {
    if (!enabled || !pending || typeof rawUrl !== "string" || rawUrl.length > 1024) return false;
    const expected = pending;
    pending = null; // Every attempted return consumes the pending local state.
    if (now() >= expected.expiresAt || accountId !== expected.accountId
      || installationId !== expected.installationId || appAudience !== expected.audience) return false;
    try {
      const url = new URL(rawUrl);
      if (url.origin !== "https://qa-iphone-device-proof.ganbatuach.com"
        || url.pathname !== "/qa/device-proof/return" || url.hash
        || url.username || url.password || url.port) return false;
      const entries = [...url.searchParams.entries()];
      if (entries.length !== 1 || entries[0][0] !== "state" || !/^[a-f0-9]{64}$/.test(entries[0][1])) return false;
      return timingSafeEqual(Buffer.from(entries[0][1], "hex"), Buffer.from(expected.state, "hex"));
    } catch { return false; }
  };
  return Object.freeze({ begin, consume });
}
