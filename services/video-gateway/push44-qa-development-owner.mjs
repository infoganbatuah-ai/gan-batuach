import { createClient } from "@supabase/supabase-js";
import { SYNTHETIC_QA } from "./push44-ch1-private-media.mjs";

const deny = () => { throw new Error("QA_DEVELOPMENT_OWNER_DENIED"); };

// A second, host-held Development Auth session is required. The QA iPhone's
// parent account cannot approve itself. The host must pin the separately
// verified owner's profile ID and email; a generic admin fixture is not enough.
// No service-role key is used.
export function createPush44QaDevelopmentOwnerReader({ supabaseUrl, publishableKey,
  expectedOwnerProfileId, expectedOwnerEmail, readOwnerToken, clientFactory = createClient,
  now = Date.now } = {}) {
  let url;
  try { url = new URL(supabaseUrl); } catch { deny(); }
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" ||
    url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
    !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(expectedOwnerProfileId || "") ||
    expectedOwnerProfileId === SYNTHETIC_QA.viewerId ||
    typeof expectedOwnerEmail !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(expectedOwnerEmail) ||
    expectedOwnerEmail !== expectedOwnerEmail.toLowerCase() ||
    expectedOwnerEmail.endsWith(".invalid") ||
    typeof publishableKey !== "string" || publishableKey.length < 20 ||
    ![readOwnerToken, clientFactory, now].every(fn => typeof fn === "function")) deny();
  return async () => {
    try {
      const token = await readOwnerToken();
      if (typeof token !== "string" || token.length < 32 || token.length > 8192) deny();
      const client = clientFactory(supabaseUrl, publishableKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
      });
      const { data: { user }, error: userError } = await client.auth.getUser(token);
      if (userError || user?.id !== expectedOwnerProfileId ||
        user.email?.toLowerCase() !== expectedOwnerEmail || !user.email_confirmed_at) deny();
      const { data: active, error: activeError } = await client.rpc("digital_observer_current_session_active");
      if (activeError || active !== true) deny();
      const { data: profile, error: profileError } = await client.from("profiles")
        .select("id,email,role,active").eq("id", expectedOwnerProfileId).maybeSingle();
      if (profileError || profile?.id !== expectedOwnerProfileId || profile.active !== true ||
        profile.role !== "admin" || profile.email?.toLowerCase() !== expectedOwnerEmail) deny();
      // Claims are read only after getUser and the server-side session RPC.
      const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
      if (claims.sub !== expectedOwnerProfileId || typeof claims.session_id !== "string" ||
        claims.session_id.length < 16 || !Number.isFinite(claims.exp) || claims.exp * 1000 <= now()) deny();
      return { verified: true, active: true, owner: true,
        environment: SYNTHETIC_QA.viewerEnvironment, profileId: expectedOwnerProfileId,
        sessionId: claims.session_id, tenantId: SYNTHETIC_QA.tenantId,
        siteId: SYNTHETIC_QA.siteId, expiresAt: Math.min(claims.exp * 1000, now() + 30_000) };
    } catch { deny(); }
  };
}
