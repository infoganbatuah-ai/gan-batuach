import { createClient } from "@supabase/supabase-js";
import { SYNTHETIC_QA } from "./push44-ch1-private-media.mjs";

const deny = () => { throw new Error("QA_DEVELOPMENT_OWNER_DENIED"); };

// A second, host-held Development Auth session is required. The QA iPhone's
// parent account cannot approve itself. The host pins the verified owner's
// profile ID/email. The server-held, expiring Auth app_metadata capability is
// specific to this enrollment ceremony; the global profiles.role=admin is
// deliberately not granted. No service-role key is used by this reader.
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
  return async ({ keyId, enrollmentRequestId, operation } = {}) => {
    try {
      // The operator must present the exact pending installation and key. A
      // general owner session, email, or unscoped capability is insufficient.
      if (!["AUTHORIZE_ENROLLMENT", "REVOKE_APPROVAL", "REVOKE"].includes(operation) ||
        (operation !== "REVOKE_APPROVAL" && !/^[A-Za-z0-9_-]{43}$/.test(keyId || "")) ||
        (operation === "AUTHORIZE_ENROLLMENT" &&
          !/^[A-Za-z0-9_-]{16,96}$/.test(enrollmentRequestId || ""))) deny();
      const token = await readOwnerToken();
      if (typeof token !== "string" || token.length < 32 || token.length > 8192) deny();
      const client = clientFactory(supabaseUrl, publishableKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
      });
      const { data: { user }, error: userError } = await client.auth.getUser(token);
      if (userError || user?.id !== expectedOwnerProfileId ||
        user.email?.toLowerCase() !== expectedOwnerEmail || !user.email_confirmed_at) deny();
      const approval = user.app_metadata?.push44_qa_enrollment_approver;
      if (user.app_metadata?.role === "admin" ||
        approval?.version !== 1 || approval.ownerId !== expectedOwnerProfileId ||
        approval.environment !== SYNTHETIC_QA.viewerEnvironment ||
        approval.tenantId !== SYNTHETIC_QA.tenantId ||
        approval.siteId !== SYNTHETIC_QA.siteId ||
        approval.viewerId !== SYNTHETIC_QA.viewerId ||
        approval.capability !== "observer.qa_device_enrollment.approve" ||
        (operation !== "REVOKE_APPROVAL" && approval.keyId !== keyId) ||
        (operation === "AUTHORIZE_ENROLLMENT" &&
          approval.enrollmentRequestId !== enrollmentRequestId) ||
        approval.purpose !== "APPROVE_ONE_QA_DEVICE_ENROLLMENT" ||
        !Number.isSafeInteger(approval.issuedAt) ||
        !Number.isSafeInteger(approval.expiresAt) ||
        approval.issuedAt > now() || approval.expiresAt <= now() ||
        approval.expiresAt - approval.issuedAt > 30 * 60_000) deny();
      const { data: active, error: activeError } = await client.rpc("digital_observer_current_session_active");
      if (activeError || active !== true) deny();
      const { data: profile, error: profileError } = await client.from("profiles")
        .select("id,email,role,active,garden_id").eq("id", expectedOwnerProfileId).maybeSingle();
      if (profileError || profile?.id !== expectedOwnerProfileId || profile.active !== true ||
        profile.role !== "parent" || profile.garden_id !== null ||
        profile.email?.toLowerCase() !== expectedOwnerEmail) deny();
      // Claims are read only after getUser and the server-side session RPC.
      const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
      if (claims.sub !== expectedOwnerProfileId || typeof claims.session_id !== "string" ||
        claims.session_id.length < 16 || !Number.isFinite(claims.exp) || claims.exp * 1000 <= now()) deny();
      return { verified: true, active: true, owner: true,
        environment: SYNTHETIC_QA.viewerEnvironment, profileId: expectedOwnerProfileId,
        sessionId: claims.session_id, tenantId: SYNTHETIC_QA.tenantId,
        siteId: SYNTHETIC_QA.siteId,
        expiresAt: Math.min(claims.exp * 1000, approval.expiresAt, now() + 30_000) };
    } catch { deny(); }
  };
}
