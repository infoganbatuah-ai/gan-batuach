import { CH1 } from "./push44-ch1-private-media.mjs";

// Token custody/HttpOnly-cookie lookup belongs to the trusted operator, not a
// media URL or a client device-ID header. This adapter never uses service_role.
// The canonical Product endpoint performs strict server-side session validation.
export function createCh1DevelopmentAuthenticator({ expectedRuntimeSha, readSessionToken,
  readApprovedSession, fetcher = fetch } = {}) {
  if (!/^[0-9a-f]{40}$/.test(expectedRuntimeSha || "") ||
    typeof readSessionToken !== "function" || typeof readApprovedSession !== "function")
    throw new Error("CH1_SESSION_ADAPTER_REQUIRED");
  return async request => {
    const token = await readSessionToken(request);
    if (typeof token !== "string" || token.length < 32 || token.length > 8192) return null;
    const version = await fetcher("http://127.0.0.1:3000/api/development/version", {
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(3000)
    });
    if (!version.ok) return null;
    const runtime = await version.json();
    if (runtime.environment !== "DEVELOPMENT / INTEGRATION" || runtime.backend !== "LOCAL_SUPABASE" ||
      runtime.production !== false || runtime.commit !== expectedRuntimeSha) return null;
    const result = await fetcher("http://127.0.0.1:3000/api/digital-observer/mobile/runtime", {
      headers: { authorization: `Bearer ${token}` }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(3000)
    });
    if (!result.ok) return null;
    const payload = await result.json();
    if (payload?.data?.session?.active !== true || payload.data.session.profile_id !== CH1.viewerId) return null;
    // Decode ONLY after canonical server verification, never to authorize an
    // unverified JWT. Use its server-validated session ID to pin the approved
    // owner phone session; expiry and revocation are checked on every request.
    let claims;
    try { claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()); } catch { return null; }
    const approved = await readApprovedSession();
    if (!approved || approved.revoked !== false || approved.sessionId !== claims.session_id ||
      claims.sub !== CH1.viewerId || !Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now() ||
      typeof approved.deviceId !== "string" || approved.deviceId.length < 8) return null;
    return { verified: true, active: true, environment: CH1.viewerEnvironment,
      viewerId: CH1.viewerId, sessionId: claims.session_id, deviceId: approved.deviceId };
  };
}
