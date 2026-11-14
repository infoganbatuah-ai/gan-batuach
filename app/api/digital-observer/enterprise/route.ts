/* eslint-disable @typescript-eslint/no-explicit-any -- PUSH 41 tables precede generated Supabase types. */
import crypto from "node:crypto";
import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser } from "@/lib/domain/digital-observer/access";
import {
  configureEnterpriseScim,
  configureEnterpriseSso,
  createEnterpriseInvitation,
  createEnterpriseServiceAccount,
  resolveEnterpriseActor,
  revokeEnterpriseInvitation,
  revokeEnterpriseServiceAccount,
  revokeEnterpriseSession,
  rotateEnterpriseServiceCredential
} from "@/lib/domain/digital-observer/enterprise-identity-service";
import { enterprisePermissions, enterpriseRoles } from "@/lib/domain/digital-observer/enterprise-identity";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const organizationId = z.string().uuid();
const role = z.enum(enterpriseRoles);
const permission = z.enum(enterprisePermissions);
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("invite"), organization_id: organizationId, email: z.string().email().max(320), role,
    site_ids: z.array(z.string().uuid()).max(1000).default([]), expires_in_hours: z.number().int().min(1).max(720).default(72) }).strict(),
  z.object({ action: z.literal("revoke_invitation"), organization_id: organizationId, invitation_id: z.string().uuid() }).strict(),
  z.object({ action: z.literal("create_service_account"), organization_id: organizationId, display_name: z.string().trim().min(2).max(100),
    permissions: z.array(permission).min(1).max(18), site_ids: z.array(z.string().uuid()).max(1000).default([]),
    expires_in_days: z.number().int().min(1).max(365).default(90) }).strict(),
  z.object({ action: z.literal("rotate_service_credential"), organization_id: organizationId, service_account_id: z.string().uuid(),
    expires_in_days: z.number().int().min(1).max(365).default(90), reason: z.string().trim().min(3).max(160) }).strict(),
  z.object({ action: z.literal("revoke_service_account"), organization_id: organizationId, service_account_id: z.string().uuid(),
    reason: z.string().trim().min(3).max(160) }).strict(),
  z.object({ action: z.literal("configure_sso"), organization_id: organizationId, connection_key: z.string().regex(/^[a-z0-9][a-z0-9_-]{1,63}$/),
    protocol: z.enum(["oidc", "saml2"]), mode: z.enum(["disabled", "sandbox"]), issuer: z.string().trim().min(3).max(500),
    audience: z.string().trim().min(1).max(500), metadata_url: z.string().url().max(1000).nullable().optional(),
    redirect_allowlist: z.array(z.string().url().max(1000)).min(1).max(20) }).strict(),
  z.object({ action: z.literal("configure_scim"), organization_id: organizationId, connection_key: z.string().regex(/^[a-z0-9][a-z0-9_-]{1,63}$/),
    mode: z.enum(["disabled", "sandbox"]), group_role_mapping: z.record(z.string().max(160), role).default({}) }).strict(),
  z.object({ action: z.literal("revoke_session"), organization_id: organizationId, session_id: z.string().uuid(),
    reason: z.string().trim().min(3).max(160) }).strict()
]);

function enterpriseError(error: unknown) {
  const message = error instanceof Error ? error.message : "ENTERPRISE_OPERATION_FAILED";
  if (/DENIED|ESCALATION|MISMATCH|UNAUTHORIZED/.test(message)) return fail(message, 403);
  if (/REQUIRED|INVALID|NOT_ACTIVE|NOT_PENDING|UNAVAILABLE|FAILED/.test(message)) return fail(message, 409);
  return null;
}

function platformAdmin(session: NonNullable<Awaited<ReturnType<typeof getDigitalObserverApiUser>>>) {
  return session.profile.role === "admin" || session.user.app_metadata?.digital_observer_admin === true;
}

async function enterpriseState(admin: ReturnType<typeof createAdminClient>, orgId: string) {
  const db = admin as any;
  const [organization, sites, memberships, invitations, serviceAccounts, sso, scim, sessions, audit, slo, authPolicy] = await Promise.all([
    db.from("digital_observer_organizations").select("id,name,organization_type,status,default_timezone,support_tier").eq("id", orgId).single(),
    db.from("observer_sites").select("id,name,site_type,timezone").eq("digital_observer_organization_id", orgId).is("garden_id", null).neq("site_type", "kindergarten").order("name").limit(1000),
    db.from("digital_observer_organization_memberships").select("id,profile_id,enterprise_role,active,all_sites,revoked_at,accepted_at,created_at").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(1000),
    db.from("digital_observer_enterprise_invitations").select("id,invited_email_hint,enterprise_role,all_sites,site_scope,status,expires_at,created_at").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(100),
    db.from("digital_observer_service_accounts").select("id,display_name,account_status,all_sites,permissions,expires_at,last_used_at,created_at").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(100),
    db.from("digital_observer_sso_connections").select("id,connection_key,protocol,provider_mode,status,issuer,audience,redirect_allowlist,require_provider_mfa,last_verified_at,last_error_code").eq("organization_id", orgId).limit(20),
    db.from("digital_observer_scim_connections").select("id,connection_key,provider_mode,status,credential_prefix,credential_expires_at,group_role_mapping,last_used_at,revoked_at").eq("organization_id", orgId).limit(20),
    db.from("digital_observer_enterprise_sessions").select("id,profile_id,device_label,user_agent_family,assurance_level,suspicious,last_seen_at,expires_at,revoked_at,revocation_reason").eq("organization_id", orgId).order("last_seen_at", { ascending: false }).limit(100),
    db.from("digital_observer_enterprise_audit_events").select("id,actor_profile_id,service_account_id,observer_site_id,resource_type,resource_id,action,authorization_decision,result_status,correlation_id,safe_metadata,created_at").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(100),
    db.from("digital_observer_slo_policies").select("id,policy_version,policy_status,availability_target,response_minutes,resolution_hours,contractual,effective_from").eq("organization_id", orgId).order("policy_version", { ascending: false }).limit(10),
    db.from("digital_observer_auth_policies").select("policy_version,email_verification_enabled,passkeys_enabled,totp_enabled,sso_mfa_enforced,whatsapp_verification_mode,sms_authentication_enabled,automatic_sms_fallback_enabled,recovery_factors,session_idle_minutes,session_absolute_hours").eq("organization_id", orgId).maybeSingle()
  ]);
  const results = [organization, sites, memberships, invitations, serviceAccounts, sso, scim, sessions, audit, slo, authPolicy];
  const failure = results.find((item) => item.error)?.error;
  if (failure) throw new Error(`ENTERPRISE_STATE_UNAVAILABLE:${failure.code ?? "unknown"}`);
  return { organization: organization.data, sites: sites.data ?? [], memberships: memberships.data ?? [], invitations: invitations.data ?? [],
    serviceAccounts: serviceAccounts.data ?? [], sso: sso.data ?? [], scim: scim.data ?? [], sessions: sessions.data ?? [],
    audit: audit.data ?? [], slo: slo.data ?? [], authPolicy: authPolicy.data };
}

export async function GET(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("Digital Observer authentication is required.", 401);
    const orgId = new URL(request.url).searchParams.get("organization_id");
    if (!orgId || !organizationId.safeParse(orgId).success) return fail("A valid organization is required.", 400);
    if (!isAdminClientConfigured()) return fail("The Enterprise identity service is not configured.", 503);
    const admin = createAdminClient();
    const actor = await resolveEnterpriseActor(admin, { organizationId: orgId, profileId: session.profile.id, platformAdmin: platformAdmin(session) });
    return ok({ ...(await enterpriseState(admin, orgId)), actor,
      authenticationPolicy: { email: true, passkeys: true, totp: true, ssoMfa: true, whatsapp: "approval_required",
        smsAuthentication: false, automaticSmsFallback: false, twilioSmsAuthentication: false },
      externalProof: { sso: "pending", scim: "pending", productionScale: "not_claimed" } });
  } catch (error) { return enterpriseError(error) ?? handleRouteError(error); }
}

export async function POST(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("Digital Observer authentication is required.", 401);
    if (!isAdminClientConfigured()) return fail("The Enterprise identity service is not configured.", 503);
    const input = schema.parse(await request.json());
    const admin = createAdminClient();
    const actor = await resolveEnterpriseActor(admin, { organizationId: input.organization_id, profileId: session.profile.id, platformAdmin: platformAdmin(session) });
    const common = { organizationId: input.organization_id, actorId: session.profile.id, actorRole: actor.role, correlationId: crypto.randomUUID() };
    if (input.action === "invite") return ok(await createEnterpriseInvitation(admin, { ...common, email: input.email, role: input.role,
      siteIds: input.site_ids, expiresInHours: input.expires_in_hours }), 201);
    if (input.action === "revoke_invitation") return ok(await revokeEnterpriseInvitation(admin, { ...common, invitationId: input.invitation_id }));
    if (input.action === "create_service_account") return ok(await createEnterpriseServiceAccount(admin, { ...common,
      displayName: input.display_name, permissions: input.permissions, siteIds: input.site_ids, expiresInDays: input.expires_in_days }), 201);
    if (input.action === "rotate_service_credential") return ok(await rotateEnterpriseServiceCredential(admin, { ...common,
      serviceAccountId: input.service_account_id, expiresInDays: input.expires_in_days, reason: input.reason }));
    if (input.action === "revoke_service_account") return ok(await revokeEnterpriseServiceAccount(admin, { ...common,
      serviceAccountId: input.service_account_id, reason: input.reason }));
    if (input.action === "configure_sso") return ok(await configureEnterpriseSso(admin, { ...common, connectionKey: input.connection_key,
      protocol: input.protocol, mode: input.mode, issuer: input.issuer, audience: input.audience,
      metadataUrl: input.metadata_url, redirectAllowlist: input.redirect_allowlist }));
    if (input.action === "configure_scim") return ok(await configureEnterpriseScim(admin, { ...common, connectionKey: input.connection_key,
      mode: input.mode, groupRoleMapping: input.group_role_mapping }));
    return ok(await revokeEnterpriseSession(admin, { ...common, sessionId: input.session_id, reason: input.reason }));
  } catch (error) { return enterpriseError(error) ?? handleRouteError(error); }
}
