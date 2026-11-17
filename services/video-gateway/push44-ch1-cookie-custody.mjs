import { randomBytes, timingSafeEqual } from "node:crypto";
import { CH1, CH1_LIMITS } from "./push44-ch1-private-media.mjs";

// Transport adapter, not a second identity system. A trusted local operator
// binds ONE already approved canonical session. No HTTP enrollment endpoint.
// Raw Development tokens remain host-memory-only, never playlist URLs/files.
export function createCh1CookieCustody({ verifySession, now = Date.now } = {}) {
  if (typeof verifySession !== "function") throw new Error("CH1_SESSION_VERIFIER_REQUIRED");
  let binding = null, used = false, timer;
  const clear = () => { binding = null; clearTimeout(timer); };
  return Object.freeze({
    async bind(accessToken) {
      if (used) throw new Error("CH1_CUSTODY_ALREADY_USED");
      used = true;
      const principal = await verifySession(accessToken);
      if (principal?.verified !== true || principal.active !== true || principal.viewerId !== CH1.viewerId ||
        principal.environment !== CH1.viewerEnvironment || !principal.sessionId || !principal.deviceId)
        throw new Error("CH1_OWNER_SESSION_DENIED");
      const cookie = randomBytes(32).toString("base64url");
      binding = { cookie, accessToken, sessionId: principal.sessionId, deviceId: principal.deviceId,
        deadline: now() + CH1_LIMITS.durationMs };
      timer = setTimeout(clear, CH1_LIMITS.durationMs); timer.unref();
      return `__Host-DOCH1QA=${cookie}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=300`;
    },
    async authenticate(request) {
      if (!binding || now() >= binding.deadline) { clear(); return null; }
      const header = String(request.headers?.cookie || "");
      if (header.length > 8192) return null;
      const matches = header.split(";").map(x => x.trim())
        .filter(x => x.startsWith("__Host-DOCH1QA="));
      if (matches.length !== 1) return null;
      const value = matches[0].slice("__Host-DOCH1QA=".length);
      if (!/^[A-Za-z0-9_-]{43}$/.test(value) ||
        !timingSafeEqual(Buffer.from(value), Buffer.from(binding.cookie))) return null;
      const current = binding;
      let principal;
      try { principal = await verifySession(current.accessToken); } catch { clear(); return null; }
      if (binding !== current || now() >= current.deadline || principal?.verified !== true || principal.active !== true ||
        principal.viewerId !== CH1.viewerId || principal.environment !== CH1.viewerEnvironment ||
        principal.sessionId !== current.sessionId || principal.deviceId !== current.deviceId) {
        clear(); return null;
      }
      return principal;
    },
    revoke: clear,
    clearCookie: () => "__Host-DOCH1QA=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0"
  });
}
