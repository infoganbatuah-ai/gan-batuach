import { randomUUID } from "node:crypto";
import { getDigitalObserverApiUser } from "./access.js";
import type { TrustedHomeOwnerSessionReader } from "./home-registration-ownership.js";

/** Request-bound, Bearer-only adapter. It is deliberately not wired to a
 * registration endpoint or transaction. The existing API helper verifies
 * auth.getUser, the current Auth session and the canonical profile; its Bearer
 * path disables session persistence and refresh. Cookie fallback is excluded. */
export function createVerifiedHomeOwnerSessionReader(request: Request): TrustedHomeOwnerSessionReader {
  return {
    async sessionForActor(actorId) {
      const authorization = request.headers.get("authorization") ?? "";
      const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
      if (!actorId || actorId.trim() !== actorId || !token || /\s/.test(token)) return null;
      try {
        const session = await getDigitalObserverApiUser(request);
        if (!session || !session.accessToken || session.user.id !== actorId
          || session.profile.id !== actorId || session.profile.active !== true) return null;
        const observedAtMs = Date.now();
        return Object.freeze({ authenticatedUserId: actorId, sessionAuthenticated: true,
          sessionActive: true, profileId: actorId, profileActive: true,
          observedAtMs, expiresAtMs: observedAtMs + 5_000,
          // Ephemeral observation marker, not a durable approval or audit receipt.
          evidenceRef: `SESSION_VERIFIED_ONLY:request-local:${randomUUID()}` });
      } catch {
        return null;
      }
    }
  };
}
