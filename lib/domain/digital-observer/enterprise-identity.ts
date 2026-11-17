import crypto from "node:crypto";

export const ENTERPRISE_IDENTITY_CONTRACT = "digital-observer-enterprise-identity-v1";

export const enterpriseRoles = [
  "platform_admin",
  "organization_owner",
  "organization_admin",
  "site_admin",
  "security_operator",
  "investigator",
  "viewer",
  "billing_admin",
  "service_account"
] as const;

export const enterprisePermissions = [
  "camera.live.view",
  "recordings.view",
  "evidence.view",
  "evidence.export",
  "events.view",
  "incidents.manage",
  "investigation.run",
  "notifications.manage",
  "watch_rules.manage",
  "device_actions.execute",
  "camera.configure",
  "site.configure",
  "users.manage",
  "billing.read",
  "billing.manage",
  "api.credentials.manage",
  "audit.read",
  "sso.manage",
  "sessions.manage"
] as const;

export type EnterpriseRole = (typeof enterpriseRoles)[number];
export type EnterprisePermission = (typeof enterprisePermissions)[number];
export type EnterpriseResourceScope = {
  organizationId: string;
  allSites: boolean;
  siteIds: string[];
  cameraIds?: string[];
};

const roleRank: Record<EnterpriseRole, number> = {
  platform_admin: 100,
  organization_owner: 90,
  organization_admin: 80,
  site_admin: 70,
  security_operator: 60,
  investigator: 50,
  viewer: 40,
  billing_admin: 30,
  service_account: 20
};

export const enterpriseRolePermissions: Record<EnterpriseRole, readonly EnterprisePermission[]> = {
  platform_admin: enterprisePermissions,
  organization_owner: enterprisePermissions,
  organization_admin: enterprisePermissions.filter((permission) => permission !== "billing.manage"),
  site_admin: [
    "camera.live.view", "recordings.view", "evidence.view", "evidence.export", "events.view", "incidents.manage",
    "investigation.run", "notifications.manage", "watch_rules.manage", "device_actions.execute", "camera.configure",
    "site.configure", "users.manage", "audit.read", "sessions.manage"
  ],
  security_operator: [
    "camera.live.view", "recordings.view", "evidence.view", "events.view", "incidents.manage", "investigation.run",
    "notifications.manage", "watch_rules.manage", "device_actions.execute"
  ],
  investigator: ["recordings.view", "evidence.view", "evidence.export", "events.view", "investigation.run"],
  viewer: ["camera.live.view", "recordings.view", "evidence.view", "events.view"],
  billing_admin: ["billing.read", "billing.manage"],
  service_account: []
};

export const digitalObserverAuthenticationPolicy = {
  version: "do-auth-policy-2026-10-19",
  emailVerification: "enabled",
  passkeysWebAuthn: "enabled_when_supported",
  totpAuthenticator: "enabled",
  ssoMfa: "provider_and_policy_enforced",
  whatsappVerification: "requires_approved_provider_and_owner_activation",
  smsAuthentication: "disabled",
  automaticSmsFallback: false,
  twilioSmsAuthentication: false,
  whatsappSoleRecoveryFactor: false,
  genericSmsDeliveryContractPreserved: true
} as const;

export function isEnterpriseRole(value: unknown): value is EnterpriseRole {
  return typeof value === "string" && enterpriseRoles.includes(value as EnterpriseRole);
}

export function isEnterprisePermission(value: unknown): value is EnterprisePermission {
  return typeof value === "string" && enterprisePermissions.includes(value as EnterprisePermission);
}

export function canonicalRoleForSiteMembership(role: string): EnterpriseRole | null {
  return ({ owner: "organization_owner", admin: "site_admin", operator: "security_operator", reviewer: "investigator",
    viewer: "viewer", billing: "billing_admin" } as Record<string, EnterpriseRole>)[role] ?? null;
}

export function permissionsForRole(role: EnterpriseRole, explicitPermissions: readonly string[] = []) {
  const base = new Set<EnterprisePermission>(enterpriseRolePermissions[role]);
  if (role === "service_account") {
    for (const permission of explicitPermissions) if (isEnterprisePermission(permission)) base.add(permission);
  }
  return [...base];
}

export function evaluateEnterpriseAuthorization(input: {
  actorOrganizationId: string;
  targetOrganizationId: string;
  role: EnterpriseRole;
  permission: EnterprisePermission;
  active: boolean;
  revokedAt?: string | null;
  scope: EnterpriseResourceScope;
  targetSiteId?: string | null;
  targetCameraId?: string | null;
  explicitPermissions?: readonly string[];
}) {
  if (!input.active || input.revokedAt) return { allowed: false, reason: "membership_inactive" } as const;
  if (input.actorOrganizationId !== input.targetOrganizationId || input.scope.organizationId !== input.targetOrganizationId) {
    return { allowed: false, reason: "organization_scope_mismatch" } as const;
  }
  if (!permissionsForRole(input.role, input.explicitPermissions).includes(input.permission)) {
    return { allowed: false, reason: "permission_denied" } as const;
  }
  if (input.targetSiteId && !input.scope.allSites && !input.scope.siteIds.includes(input.targetSiteId)) {
    return { allowed: false, reason: "site_scope_mismatch" } as const;
  }
  if (input.targetCameraId && input.scope.cameraIds?.length && !input.scope.cameraIds.includes(input.targetCameraId)) {
    return { allowed: false, reason: "camera_scope_mismatch" } as const;
  }
  return { allowed: true, reason: "authorized" } as const;
}

export function canDelegateEnterpriseRole(actorRole: EnterpriseRole, requestedRole: EnterpriseRole) {
  if (requestedRole === "platform_admin") return actorRole === "platform_admin";
  if (requestedRole === "organization_owner") return actorRole === "platform_admin" || actorRole === "organization_owner";
  return roleRank[actorRole] > roleRank[requestedRole] && ["platform_admin", "organization_owner", "organization_admin", "site_admin"].includes(actorRole);
}

export function assertDelegatedGrant(input: {
  actorRole: EnterpriseRole;
  requestedRole: EnterpriseRole;
  actorPermissions?: readonly EnterprisePermission[];
  requestedPermissions?: readonly EnterprisePermission[];
}) {
  if (!canDelegateEnterpriseRole(input.actorRole, input.requestedRole)) throw new Error("ENTERPRISE_ROLE_ESCALATION_DENIED");
  const actor = new Set(input.actorPermissions ?? permissionsForRole(input.actorRole));
  for (const permission of input.requestedPermissions ?? permissionsForRole(input.requestedRole)) {
    if (!actor.has(permission)) throw new Error("ENTERPRISE_PERMISSION_ESCALATION_DENIED");
  }
  return true;
}

export function invitationPolicy(input: {
  actorRole: EnterpriseRole;
  invitedRole: EnterpriseRole;
  organizationId: string;
  siteIds: string[];
  organizationSiteIds: string[];
  expiresInHours: number;
}) {
  assertDelegatedGrant({ actorRole: input.actorRole, requestedRole: input.invitedRole });
  if (!input.organizationId) throw new Error("INVITATION_ORGANIZATION_REQUIRED");
  if (!Number.isInteger(input.expiresInHours) || input.expiresInHours < 1 || input.expiresInHours > 24 * 30) {
    throw new Error("INVITATION_EXPIRY_INVALID");
  }
  const allowedSites = new Set(input.organizationSiteIds);
  if (input.siteIds.some((siteId) => !allowedSites.has(siteId))) throw new Error("INVITATION_SITE_SCOPE_DENIED");
  return { oneTime: true, expiresInHours: input.expiresInHours, siteIds: [...new Set(input.siteIds)] };
}

export function invitationTransition(from: string, to: string) {
  const allowed: Record<string, string[]> = {
    pending: ["accepted", "cancelled", "revoked", "expired"],
    accepted: ["revoked"],
    cancelled: [], revoked: [], expired: []
  };
  if (!allowed[from]?.includes(to)) throw new Error("INVITATION_TRANSITION_DENIED");
  return to;
}

export type EnterpriseSsoMode = "disabled" | "sandbox" | "production";
export type EnterpriseSsoProtocol = "oidc" | "saml2";

function assertHttpsUrl(value: string, allowLocalhost = false) {
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(allowLocalhost && local && url.protocol === "http:")) throw new Error("SSO_HTTPS_REQUIRED");
  if (url.username || url.password || url.hash) throw new Error("SSO_URL_INVALID");
  return url;
}

export function validateSsoConfiguration(input: {
  protocol: EnterpriseSsoProtocol;
  mode: EnterpriseSsoMode;
  issuer: string;
  audience: string;
  metadataUrl?: string | null;
  redirectAllowlist: string[];
}) {
  if (input.mode === "production") throw new Error("SSO_PRODUCTION_ACTIVATION_NOT_AUTHORIZED");
  if (!input.issuer.trim() || !input.audience.trim()) throw new Error("SSO_ISSUER_AUDIENCE_REQUIRED");
  if (input.metadataUrl) assertHttpsUrl(input.metadataUrl, input.mode === "sandbox");
  if (!input.redirectAllowlist.length) throw new Error("SSO_REDIRECT_ALLOWLIST_REQUIRED");
  const normalizedRedirects = input.redirectAllowlist.map((value) => assertHttpsUrl(value, input.mode === "sandbox").toString());
  return {
    ...input,
    redirectAllowlist: [...new Set(normalizedRedirects)],
    signatureVerification: "delegated_to_established_identity_provider",
    issuerValidation: true,
    audienceValidation: true,
    stateNonceValidation: true
  } as const;
}

export function createSsoTransaction(input: { redirectUri: string; redirectAllowlist: string[]; entropy?: string; now?: Date }) {
  const redirect = new URL(input.redirectUri).toString();
  if (!input.redirectAllowlist.map((value) => new URL(value).toString()).includes(redirect)) throw new Error("SSO_REDIRECT_NOT_ALLOWED");
  const entropy = input.entropy ?? crypto.randomBytes(32).toString("base64url");
  const nonce = crypto.createHash("sha256").update(`nonce:${entropy}`).digest("base64url");
  const state = crypto.createHash("sha256").update(`state:${entropy}`).digest("base64url");
  const createdAt = input.now ?? new Date();
  return { state, nonce, redirectUri: redirect, createdAt: createdAt.toISOString(), expiresAt: new Date(createdAt.getTime() + 10 * 60_000).toISOString() };
}

export type ScimOperation = "create_user" | "update_membership" | "suspend_user" | "deprovision_user" | "map_group";

export function evaluateScimOperation(input: {
  operation: ScimOperation;
  connectionActive: boolean;
  organizationMatches: boolean;
  claimTrusted: boolean;
  requestedRole?: EnterpriseRole | null;
  mappedRole?: EnterpriseRole | null;
}) {
  if (!input.connectionActive) return { allowed: false, reason: "scim_connection_inactive" } as const;
  if (!input.organizationMatches) return { allowed: false, reason: "scim_organization_mismatch" } as const;
  if (!input.claimTrusted) return { allowed: false, reason: "scim_claim_untrusted" } as const;
  if (input.requestedRole && input.requestedRole !== input.mappedRole) return { allowed: false, reason: "scim_role_mapping_denied" } as const;
  return { allowed: true, reason: input.operation === "deprovision_user" ? "revoke_effective_access" : "apply_governed_change" } as const;
}

export function hashEnterpriseCredential(raw: string, pepper: string) {
  if (raw.length < 32 || pepper.length < 16) throw new Error("ENTERPRISE_CREDENTIAL_CONFIGURATION_INVALID");
  return crypto.createHmac("sha256", pepper).update(raw).digest("hex");
}

export function issueEnterpriseCredential(input: { prefix: "dosvc" | "doscim"; pepper: string; now?: Date; ttlDays?: number }) {
  const secret = crypto.randomBytes(32).toString("base64url");
  const raw = `${input.prefix}_${secret}`;
  const now = input.now ?? new Date();
  const ttlDays = Math.max(1, Math.min(365, input.ttlDays ?? 90));
  return {
    raw,
    prefix: raw.slice(0, 14),
    hash: hashEnterpriseCredential(raw, input.pepper),
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlDays * 86_400_000).toISOString()
  };
}

export function serviceAccountPolicy(input: {
  actorRole: EnterpriseRole;
  permissions: EnterprisePermission[];
  siteIds: string[];
  organizationSiteIds: string[];
  expiresInDays: number;
}) {
  assertDelegatedGrant({ actorRole: input.actorRole, requestedRole: "service_account", requestedPermissions: input.permissions });
  if (!input.permissions.length) throw new Error("SERVICE_ACCOUNT_PERMISSION_REQUIRED");
  if (!Number.isInteger(input.expiresInDays) || input.expiresInDays < 1 || input.expiresInDays > 365) throw new Error("SERVICE_ACCOUNT_EXPIRY_INVALID");
  const organizationSites = new Set(input.organizationSiteIds);
  if (input.siteIds.some((siteId) => !organizationSites.has(siteId))) throw new Error("SERVICE_ACCOUNT_SITE_SCOPE_DENIED");
  return { permissions: [...new Set(input.permissions)], siteIds: [...new Set(input.siteIds)], expiresInDays: input.expiresInDays };
}

export function sessionDecision(input: {
  activeMembership: boolean;
  sessionExpiresAt: string;
  revokedAt?: string | null;
  lastSeenAt?: string | null;
  now?: Date;
  suspicious?: boolean;
}) {
  const now = input.now ?? new Date();
  if (!input.activeMembership) return { allowed: false, reason: "membership_revoked" } as const;
  if (input.revokedAt) return { allowed: false, reason: "session_revoked" } as const;
  if (new Date(input.sessionExpiresAt).getTime() <= now.getTime()) return { allowed: false, reason: "session_expired" } as const;
  if (input.suspicious) return { allowed: false, reason: "suspicious_session_reauthentication_required" } as const;
  return { allowed: true, reason: "session_active" } as const;
}

export function enterpriseSloFoundation(input: { targetAvailabilityPercent: number; responseMinutes: number; resolutionHours: number }) {
  if (input.targetAvailabilityPercent < 90 || input.targetAvailabilityPercent > 100) throw new Error("SLO_AVAILABILITY_INVALID");
  if (input.responseMinutes < 1 || input.resolutionHours < 1) throw new Error("SLO_RESPONSE_INVALID");
  return { ...input, contractual: false, realWorldProofRequired: true, status: "foundation" as const };
}

export function boundedEnterpriseScaleProfile(input: { users: 10 | 100 | 1000 | 10000; sites: 1 | 10 | 100 | 1000 }) {
  const membershipChecks = Math.min(input.users * Math.max(1, Math.ceil(input.sites / 10)), 100_000);
  return { ...input, membershipChecks, proofClass: "BOUNDED_SYNTHETIC", productionScaleClaim: false } as const;
}
