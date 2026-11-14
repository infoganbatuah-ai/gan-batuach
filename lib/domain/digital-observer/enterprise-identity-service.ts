/* eslint-disable @typescript-eslint/no-explicit-any -- PUSH 41 tables precede generated Supabase types. */
import "server-only";

import crypto from "node:crypto";
import type { createAdminClient } from "@/lib/supabase/admin";
import {
  assertDelegatedGrant,
  invitationPolicy,
  issueEnterpriseCredential,
  serviceAccountPolicy,
  validateSsoConfiguration,
  type EnterprisePermission,
  type EnterpriseRole,
  type EnterpriseSsoMode,
  type EnterpriseSsoProtocol
} from "@/lib/domain/digital-observer/enterprise-identity";

type AdminClient = ReturnType<typeof createAdminClient>;

function credentialPepper() {
  const value = process.env.DIGITAL_OBSERVER_ENTERPRISE_CREDENTIAL_PEPPER;
  if (!value || value.length < 16) throw new Error("ENTERPRISE_CREDENTIAL_PEPPER_REQUIRED");
  return value;
}

function digest(value: string) {
  return crypto.createHmac("sha256", credentialPepper()).update(value).digest("hex");
}

function emailHint(email: string) {
  const [local, domain] = email.toLowerCase().split("@");
  return `${local.slice(0, 2)}***@${domain}`;
}

async function audit(admin: AdminClient, input: {
  organizationId: string;
  actorId: string;
  resourceType: string;
  resourceId?: string | null;
  action: string;
  decision?: "allowed" | "denied";
  result?: "success" | "failed" | "blocked" | "unknown";
  correlationId: string;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await (admin as any).from("digital_observer_enterprise_audit_events").insert({
    organization_id: input.organizationId,
    actor_profile_id: input.actorId,
    resource_type: input.resourceType,
    resource_id: input.resourceId ?? null,
    action: input.action,
    authorization_decision: input.decision ?? "allowed",
    result_status: input.result ?? "success",
    correlation_id: input.correlationId,
    safe_metadata: input.metadata ?? {}
  });
  if (error) throw new Error(`ENTERPRISE_AUDIT_FAILED:${error.code ?? "unknown"}`);
}

export async function resolveEnterpriseActor(admin: AdminClient, input: {
  organizationId: string;
  profileId: string;
  platformAdmin?: boolean;
}) {
  if (input.platformAdmin) return { role: "platform_admin" as EnterpriseRole, allSites: true, siteIds: [] as string[] };
  const [organization, membership] = await Promise.all([
    (admin as any).from("digital_observer_organizations").select("id,owner_profile_id,status").eq("id", input.organizationId).maybeSingle(),
    (admin as any).from("digital_observer_organization_memberships")
      .select("id,enterprise_role,active,all_sites,revoked_at")
      .eq("organization_id", input.organizationId).eq("profile_id", input.profileId).maybeSingle()
  ]);
  if (organization.error || !organization.data || organization.data.status !== "active") throw new Error("ENTERPRISE_ORGANIZATION_UNAVAILABLE");
  if (organization.data.owner_profile_id === input.profileId) {
    return { role: "organization_owner" as EnterpriseRole, allSites: true, siteIds: [] as string[] };
  }
  if (membership.error || !membership.data || !membership.data.active || membership.data.revoked_at) throw new Error("ENTERPRISE_MEMBERSHIP_DENIED");
  const sites = membership.data.all_sites ? [] : await (admin as any).from("digital_observer_organization_member_sites")
    .select("observer_site_id").eq("membership_id", membership.data.id);
  if (sites.error) throw new Error("ENTERPRISE_SITE_SCOPE_UNAVAILABLE");
  return {
    role: membership.data.enterprise_role as EnterpriseRole,
    allSites: Boolean(membership.data.all_sites),
    siteIds: (sites.data ?? []).map((item: { observer_site_id: string }) => item.observer_site_id)
  };
}

export async function organizationSiteIds(admin: AdminClient, organizationId: string) {
  const result = await (admin as any).from("observer_sites").select("id")
    .eq("digital_observer_organization_id", organizationId).is("garden_id", null).neq("site_type", "kindergarten");
  if (result.error) throw new Error("ENTERPRISE_SITE_DIRECTORY_UNAVAILABLE");
  return (result.data ?? []).map((item: { id: string }) => item.id);
}

export async function createEnterpriseInvitation(admin: AdminClient, input: {
  organizationId: string;
  actorId: string;
  actorRole: EnterpriseRole;
  email: string;
  role: EnterpriseRole;
  siteIds: string[];
  expiresInHours: number;
  correlationId: string;
}) {
  const availableSites = await organizationSiteIds(admin, input.organizationId);
  const policy = invitationPolicy({ actorRole: input.actorRole, invitedRole: input.role, organizationId: input.organizationId,
    siteIds: input.siteIds, organizationSiteIds: availableSites, expiresInHours: input.expiresInHours });
  const rawToken = `doinv_${crypto.randomBytes(32).toString("base64url")}`;
  const expiresAt = new Date(Date.now() + policy.expiresInHours * 3_600_000).toISOString();
  const result = await (admin as any).from("digital_observer_enterprise_invitations").insert({
    organization_id: input.organizationId,
    invited_email_hash: digest(input.email.trim().toLowerCase()),
    invited_email_hint: emailHint(input.email),
    token_hash: digest(rawToken),
    enterprise_role: input.role,
    all_sites: input.siteIds.length === 0,
    site_scope: input.siteIds,
    expires_at: expiresAt,
    invited_by: input.actorId,
    metadata: { delivery: "not_sent", provider_activation_required: true }
  }).select("id,status,expires_at,invited_email_hint,enterprise_role,site_scope").single();
  if (result.error) throw new Error(`ENTERPRISE_INVITATION_CREATE_FAILED:${result.error.code ?? "unknown"}`);
  await audit(admin, { organizationId: input.organizationId, actorId: input.actorId, resourceType: "invitation",
    resourceId: result.data.id, action: "invitation.create", correlationId: input.correlationId,
    metadata: { role: input.role, site_count: input.siteIds.length, delivery: "not_sent" } });
  return { invitation: result.data, acceptanceToken: rawToken, oneTimeSecret: true, delivered: false };
}

export async function createEnterpriseServiceAccount(admin: AdminClient, input: {
  organizationId: string;
  actorId: string;
  actorRole: EnterpriseRole;
  displayName: string;
  permissions: EnterprisePermission[];
  siteIds: string[];
  expiresInDays: number;
  correlationId: string;
}) {
  const availableSites = await organizationSiteIds(admin, input.organizationId);
  const policy = serviceAccountPolicy({ actorRole: input.actorRole, permissions: input.permissions, siteIds: input.siteIds,
    organizationSiteIds: availableSites, expiresInDays: input.expiresInDays });
  const expiresAt = new Date(Date.now() + policy.expiresInDays * 86_400_000).toISOString();
  const account = await (admin as any).from("digital_observer_service_accounts").insert({
    organization_id: input.organizationId, display_name: input.displayName, permissions: policy.permissions,
    all_sites: policy.siteIds.length === 0, expires_at: expiresAt, created_by: input.actorId
  }).select("id,display_name,account_status,permissions,all_sites,expires_at").single();
  if (account.error) throw new Error(`SERVICE_ACCOUNT_CREATE_FAILED:${account.error.code ?? "unknown"}`);
  try {
    if (policy.siteIds.length) {
      const scopes = await (admin as any).from("digital_observer_service_account_sites").insert(
        policy.siteIds.map((siteId) => ({ service_account_id: account.data.id, observer_site_id: siteId }))
      );
      if (scopes.error) throw new Error(`SERVICE_ACCOUNT_SCOPE_FAILED:${scopes.error.code ?? "unknown"}`);
    }
    const credential = issueEnterpriseCredential({ prefix: "dosvc", pepper: credentialPepper(), ttlDays: policy.expiresInDays });
    const stored = await (admin as any).from("digital_observer_service_account_credentials").insert({
      service_account_id: account.data.id, credential_hash: credential.hash, credential_prefix: credential.prefix,
      expires_at: credential.expiresAt, created_by: input.actorId, rotation_reason: "initial_issue"
    }).select("id,credential_prefix,expires_at").single();
    if (stored.error) throw new Error(`SERVICE_ACCOUNT_CREDENTIAL_FAILED:${stored.error.code ?? "unknown"}`);
    await audit(admin, { organizationId: input.organizationId, actorId: input.actorId, resourceType: "service_account",
      resourceId: account.data.id, action: "service_account.create", correlationId: input.correlationId,
      metadata: { permission_count: policy.permissions.length, site_count: policy.siteIds.length } });
    return { account: account.data, credential: credential.raw, credentialMetadata: stored.data, oneTimeSecret: true };
  } catch (error) {
    await (admin as any).from("digital_observer_service_accounts").delete().eq("id", account.data.id);
    throw error;
  }
}

export async function revokeEnterpriseServiceAccount(admin: AdminClient, input: {
  organizationId: string; actorId: string; actorRole: EnterpriseRole; serviceAccountId: string; reason: string; correlationId: string;
}) {
  assertDelegatedGrant({ actorRole: input.actorRole, requestedRole: "service_account" });
  const now = new Date().toISOString();
  const account = await (admin as any).from("digital_observer_service_accounts")
    .update({ account_status: "revoked", revoked_at: now, metadata: { revocation_reason: input.reason } })
    .eq("id", input.serviceAccountId).eq("organization_id", input.organizationId).is("revoked_at", null).select("id").maybeSingle();
  if (account.error || !account.data) throw new Error("SERVICE_ACCOUNT_NOT_ACTIVE");
  const credentials = await (admin as any).from("digital_observer_service_account_credentials")
    .update({ revoked_at: now, rotation_reason: input.reason }).eq("service_account_id", input.serviceAccountId).is("revoked_at", null);
  if (credentials.error) throw new Error("SERVICE_ACCOUNT_CREDENTIAL_REVOKE_FAILED");
  await audit(admin, { organizationId: input.organizationId, actorId: input.actorId, resourceType: "service_account",
    resourceId: input.serviceAccountId, action: "service_account.revoke", correlationId: input.correlationId,
    metadata: { reason: input.reason.slice(0, 120) } });
  return { id: input.serviceAccountId, status: "revoked", effectiveAt: now };
}

export async function rotateEnterpriseServiceCredential(admin: AdminClient, input: {
  organizationId: string; actorId: string; actorRole: EnterpriseRole; serviceAccountId: string;
  expiresInDays: number; reason: string; correlationId: string;
}) {
  assertDelegatedGrant({ actorRole: input.actorRole, requestedRole: "service_account" });
  const account = await (admin as any).from("digital_observer_service_accounts").select("id,account_status,expires_at")
    .eq("id", input.serviceAccountId).eq("organization_id", input.organizationId).eq("account_status", "active").maybeSingle();
  if (account.error || !account.data) throw new Error("SERVICE_ACCOUNT_NOT_ACTIVE");
  const credential = issueEnterpriseCredential({ prefix: "dosvc", pepper: credentialPepper(), ttlDays: input.expiresInDays });
  const now = new Date().toISOString();
  const revoked = await (admin as any).from("digital_observer_service_account_credentials")
    .update({ revoked_at: now, rotation_reason: input.reason }).eq("service_account_id", input.serviceAccountId).is("revoked_at", null);
  if (revoked.error) throw new Error("SERVICE_ACCOUNT_CREDENTIAL_REVOKE_FAILED");
  const stored = await (admin as any).from("digital_observer_service_account_credentials").insert({
    service_account_id: input.serviceAccountId, credential_hash: credential.hash, credential_prefix: credential.prefix,
    expires_at: credential.expiresAt, created_by: input.actorId, rotation_reason: input.reason
  }).select("id,credential_prefix,expires_at").single();
  if (stored.error) throw new Error(`SERVICE_ACCOUNT_CREDENTIAL_ROTATION_FAILED:${stored.error.code ?? "unknown"}`);
  await audit(admin, { organizationId: input.organizationId, actorId: input.actorId, resourceType: "service_account_credential",
    resourceId: stored.data.id, action: "service_account.credential.rotate", correlationId: input.correlationId,
    metadata: { service_account_id: input.serviceAccountId, reason: input.reason.slice(0, 120) } });
  return { credential: credential.raw, credentialMetadata: stored.data, oneTimeSecret: true, previousCredentialRevoked: true };
}

export async function configureEnterpriseSso(admin: AdminClient, input: {
  organizationId: string; actorId: string; actorRole: EnterpriseRole; connectionKey: string;
  protocol: EnterpriseSsoProtocol; mode: EnterpriseSsoMode; issuer: string; audience: string;
  metadataUrl?: string | null; redirectAllowlist: string[]; correlationId: string;
}) {
  if (!["platform_admin", "organization_owner", "organization_admin"].includes(input.actorRole)) throw new Error("SSO_MANAGEMENT_DENIED");
  const config = validateSsoConfiguration(input);
  const result = await (admin as any).from("digital_observer_sso_connections").upsert({
    organization_id: input.organizationId, connection_key: input.connectionKey, protocol: input.protocol,
    provider_mode: input.mode, status: input.mode === "disabled" ? "draft" : "configured", issuer: input.issuer,
    audience: input.audience, metadata_url: input.metadataUrl ?? null, redirect_allowlist: config.redirectAllowlist,
    require_provider_mfa: true, created_by: input.actorId
  }, { onConflict: "organization_id,connection_key" }).select("id,connection_key,protocol,provider_mode,status,issuer,audience,redirect_allowlist").single();
  if (result.error) throw new Error(`SSO_CONFIGURATION_FAILED:${result.error.code ?? "unknown"}`);
  await audit(admin, { organizationId: input.organizationId, actorId: input.actorId, resourceType: "sso_connection",
    resourceId: result.data.id, action: "sso.configure", correlationId: input.correlationId,
    metadata: { protocol: input.protocol, mode: input.mode, provider_mfa_required: true } });
  return { connection: result.data, externallyVerified: false, productionActivated: false };
}

export async function configureEnterpriseScim(admin: AdminClient, input: {
  organizationId: string; actorId: string; actorRole: EnterpriseRole; connectionKey: string;
  mode: "disabled" | "sandbox"; groupRoleMapping: Record<string, EnterpriseRole>; correlationId: string;
}) {
  if (!["platform_admin", "organization_owner", "organization_admin"].includes(input.actorRole)) throw new Error("SCIM_MANAGEMENT_DENIED");
  for (const role of Object.values(input.groupRoleMapping)) {
    if (["platform_admin", "organization_owner", "service_account"].includes(role)) throw new Error("SCIM_PRIVILEGED_ROLE_MAPPING_DENIED");
    assertDelegatedGrant({ actorRole: input.actorRole, requestedRole: role });
  }
  const credential = input.mode === "sandbox" ? issueEnterpriseCredential({ prefix: "doscim", pepper: credentialPepper(), ttlDays: 90 }) : null;
  const result = await (admin as any).from("digital_observer_scim_connections").upsert({
    organization_id: input.organizationId, connection_key: input.connectionKey, provider_mode: input.mode,
    status: input.mode === "disabled" ? "draft" : "configured", credential_hash: credential?.hash ?? null,
    credential_prefix: credential?.prefix ?? null, credential_expires_at: credential?.expiresAt ?? null,
    group_role_mapping: input.groupRoleMapping, created_by: input.actorId, revoked_at: null
  }, { onConflict: "organization_id,connection_key" }).select("id,connection_key,provider_mode,status,credential_prefix,credential_expires_at,group_role_mapping").single();
  if (result.error) throw new Error(`SCIM_CONFIGURATION_FAILED:${result.error.code ?? "unknown"}`);
  await audit(admin, { organizationId: input.organizationId, actorId: input.actorId, resourceType: "scim_connection",
    resourceId: result.data.id, action: "scim.configure", correlationId: input.correlationId,
    metadata: { mode: input.mode, mapping_count: Object.keys(input.groupRoleMapping).length } });
  return { connection: result.data, credential: credential?.raw ?? null, oneTimeSecret: Boolean(credential), externallyVerified: false };
}

export async function revokeEnterpriseInvitation(admin: AdminClient, input: {
  organizationId: string; actorId: string; actorRole: EnterpriseRole; invitationId: string; correlationId: string;
}) {
  if (!["platform_admin", "organization_owner", "organization_admin", "site_admin"].includes(input.actorRole)) throw new Error("INVITATION_MANAGEMENT_DENIED");
  const now = new Date().toISOString();
  const result = await (admin as any).from("digital_observer_enterprise_invitations")
    .update({ status: "revoked", revoked_at: now }).eq("id", input.invitationId).eq("organization_id", input.organizationId)
    .eq("status", "pending").select("id").maybeSingle();
  if (result.error || !result.data) throw new Error("INVITATION_NOT_PENDING");
  await audit(admin, { organizationId: input.organizationId, actorId: input.actorId, resourceType: "invitation",
    resourceId: input.invitationId, action: "invitation.revoke", correlationId: input.correlationId });
  return { id: input.invitationId, status: "revoked", effectiveAt: now };
}

export async function revokeEnterpriseSession(admin: AdminClient, input: {
  organizationId: string; actorId: string; actorRole: EnterpriseRole; sessionId: string; reason: string; correlationId: string;
}) {
  if (!["platform_admin", "organization_owner", "organization_admin", "site_admin"].includes(input.actorRole)) throw new Error("SESSION_MANAGEMENT_DENIED");
  const now = new Date().toISOString();
  const result = await (admin as any).from("digital_observer_enterprise_sessions")
    .update({ revoked_at: now, revoked_by: input.actorId, revocation_reason: input.reason })
    .eq("id", input.sessionId).eq("organization_id", input.organizationId).is("revoked_at", null).select("id").maybeSingle();
  if (result.error || !result.data) throw new Error("ENTERPRISE_SESSION_NOT_ACTIVE");
  await audit(admin, { organizationId: input.organizationId, actorId: input.actorId, resourceType: "session",
    resourceId: input.sessionId, action: "session.revoke", correlationId: input.correlationId,
    metadata: { reason: input.reason.slice(0, 120) } });
  return { id: input.sessionId, status: "revoked", effectiveAt: now };
}
