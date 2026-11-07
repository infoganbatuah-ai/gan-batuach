import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import ts from "typescript";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) return next(`${specifier}.ts`, context);
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".ts")) return { format: "module", shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText };
    return next(url, context);
  }
});

const identity = await import("../../lib/domain/digital-observer/enterprise-identity.ts");
const migration = readFileSync(new URL("../../supabase/migrations/20261019020000_digital_observer_push41_enterprise_identity.sql", import.meta.url), "utf8");
const enterpriseRoute = readFileSync(new URL("../../app/api/digital-observer/enterprise/route.ts", import.meta.url), "utf8");
const scimRoute = readFileSync(new URL("../../app/api/digital-observer/enterprise/scim/v2/Users/route.ts", import.meta.url), "utf8");
const enterprisePage = readFileSync(new URL("../../app/digital-observer/enterprise/page.tsx", import.meta.url), "utf8");
const enterpriseUi = readFileSync(new URL("../../components/digital-observer/enterprise-identity-center.tsx", import.meta.url), "utf8");
const access = readFileSync(new URL("../../lib/domain/digital-observer/access.ts", import.meta.url), "utf8");
const shell = readFileSync(new URL("../../components/digital-observer/observer-app-shell.tsx", import.meta.url), "utf8");
const push39Migration = readFileSync(new URL("../../supabase/migrations/20261018010000_digital_observer_push39_orchestration.sql", import.meta.url), "utf8");
const push40Migration = readFileSync(new URL("../../supabase/migrations/20261019010000_digital_observer_push40_commercial_billing.sql", import.meta.url), "utf8");
const phoneRequestRoute = readFileSync(new URL("../../app/api/auth/verification/phone/request/route.ts", import.meta.url), "utf8");
const phoneConfirmRoute = readFileSync(new URL("../../app/api/auth/verification/phone/confirm/route.ts", import.meta.url), "utf8");
const developmentFixtures = readFileSync(new URL("../../development/database/qa-fixtures.sql", import.meta.url), "utf8");
const push41FixtureSeeder = readFileSync(new URL("../development/seed-push41-fixtures.mjs", import.meta.url), "utf8");

assert.equal(identity.enterpriseRoles.length, 9);
assert.equal(new Set(identity.enterpriseRoles).size, 9);
assert.equal(identity.digitalObserverAuthenticationPolicy.smsAuthentication, "disabled");
assert.equal(identity.digitalObserverAuthenticationPolicy.automaticSmsFallback, false);
assert.equal(identity.digitalObserverAuthenticationPolicy.twilioSmsAuthentication, false);
assert.equal(identity.digitalObserverAuthenticationPolicy.genericSmsDeliveryContractPreserved, true);
assert.equal(identity.digitalObserverAuthenticationPolicy.emailVerification, "enabled");
assert.equal(identity.digitalObserverAuthenticationPolicy.whatsappSoleRecoveryFactor, false);
assert(phoneRequestRoute.includes("אימות משתמשים באמצעות SMS מושבת") && !phoneRequestRoute.includes("auth.updateUser"));
assert(phoneConfirmRoute.includes("קודי SMS קיימים אינם מתקבלים עוד") && !phoneConfirmRoute.includes("auth.verifyOtp"));

const organizationId = "00000000-0000-4000-8000-000000000401";
const siteA = "00000000-0000-4000-8000-000000000411";
const siteB = "00000000-0000-4000-8000-000000000412";
assert.deepEqual(identity.evaluateEnterpriseAuthorization({ actorOrganizationId: organizationId, targetOrganizationId: organizationId,
  role: "security_operator", permission: "camera.live.view", active: true,
  scope: { organizationId, allSites: false, siteIds: [siteA] }, targetSiteId: siteA }), { allowed: true, reason: "authorized" });
assert.equal(identity.evaluateEnterpriseAuthorization({ actorOrganizationId: organizationId, targetOrganizationId: organizationId,
  role: "security_operator", permission: "camera.live.view", active: true,
  scope: { organizationId, allSites: false, siteIds: [siteA] }, targetSiteId: siteB }).reason, "site_scope_mismatch");
assert.equal(identity.evaluateEnterpriseAuthorization({ actorOrganizationId: organizationId, targetOrganizationId: "other",
  role: "organization_owner", permission: "users.manage", active: true,
  scope: { organizationId, allSites: true, siteIds: [] } }).reason, "organization_scope_mismatch");
assert.equal(identity.evaluateEnterpriseAuthorization({ actorOrganizationId: organizationId, targetOrganizationId: organizationId,
  role: "billing_admin", permission: "camera.live.view", active: true,
  scope: { organizationId, allSites: true, siteIds: [] } }).reason, "permission_denied");
assert.equal(identity.evaluateEnterpriseAuthorization({ actorOrganizationId: organizationId, targetOrganizationId: organizationId,
  role: "investigator", permission: "investigation.run", active: false,
  scope: { organizationId, allSites: true, siteIds: [] } }).reason, "membership_inactive");

assert.equal(identity.canDelegateEnterpriseRole("organization_owner", "organization_admin"), true);
assert.equal(identity.canDelegateEnterpriseRole("organization_admin", "organization_owner"), false);
assert.throws(() => identity.assertDelegatedGrant({ actorRole: "site_admin", requestedRole: "organization_admin" }), /ENTERPRISE_ROLE_ESCALATION_DENIED/);
assert.throws(() => identity.serviceAccountPolicy({ actorRole: "site_admin", permissions: ["billing.manage"], siteIds: [], organizationSiteIds: [], expiresInDays: 90 }), /ENTERPRISE_PERMISSION_ESCALATION_DENIED/);
assert.throws(() => identity.invitationPolicy({ actorRole: "organization_admin", invitedRole: "viewer", organizationId,
  siteIds: [siteB], organizationSiteIds: [siteA], expiresInHours: 72 }), /INVITATION_SITE_SCOPE_DENIED/);
assert.equal(identity.invitationTransition("pending", "accepted"), "accepted");
assert.throws(() => identity.invitationTransition("cancelled", "accepted"), /INVITATION_TRANSITION_DENIED/);

const oidc = identity.validateSsoConfiguration({ protocol: "oidc", mode: "sandbox", issuer: "https://idp.example.com",
  audience: "digital-observer", redirectAllowlist: ["http://localhost:3000/api/auth/callback"] });
assert.equal(oidc.issuerValidation, true);
assert.equal(oidc.audienceValidation, true);
assert.equal(oidc.stateNonceValidation, true);
assert.throws(() => identity.validateSsoConfiguration({ protocol: "saml2", mode: "production", issuer: "https://idp.example.com",
  audience: "digital-observer", redirectAllowlist: ["https://app.example.com/callback"] }), /SSO_PRODUCTION_ACTIVATION_NOT_AUTHORIZED/);
const transaction = identity.createSsoTransaction({ redirectUri: "https://app.example.com/callback",
  redirectAllowlist: ["https://app.example.com/callback"], entropy: "fixed-safe-test-entropy" });
assert.notEqual(transaction.state, transaction.nonce);
assert.throws(() => identity.createSsoTransaction({ redirectUri: "https://attacker.example/callback",
  redirectAllowlist: ["https://app.example.com/callback"] }), /SSO_REDIRECT_NOT_ALLOWED/);

assert.equal(identity.evaluateScimOperation({ operation: "deprovision_user", connectionActive: true,
  organizationMatches: true, claimTrusted: true, requestedRole: "viewer", mappedRole: "viewer" }).reason, "revoke_effective_access");
assert.equal(identity.evaluateScimOperation({ operation: "create_user", connectionActive: true,
  organizationMatches: true, claimTrusted: false, requestedRole: "viewer", mappedRole: "viewer" }).allowed, false);
assert.equal(identity.evaluateScimOperation({ operation: "create_user", connectionActive: true,
  organizationMatches: false, claimTrusted: true, requestedRole: "viewer", mappedRole: "viewer" }).reason, "scim_organization_mismatch");

const credential = identity.issueEnterpriseCredential({ prefix: "dosvc", pepper: "safe-test-pepper-123456", ttlDays: 30,
  now: new Date("2026-10-19T00:00:00.000Z") });
assert.match(credential.raw, /^dosvc_/);
assert.equal(credential.hash, identity.hashEnterpriseCredential(credential.raw, "safe-test-pepper-123456"));
assert(!credential.hash.includes(credential.raw));
assert.equal(credential.expiresAt, "2026-11-18T00:00:00.000Z");

assert.equal(identity.sessionDecision({ activeMembership: false, sessionExpiresAt: "2027-01-01T00:00:00Z",
  now: new Date("2026-10-19T00:00:00Z") }).reason, "membership_revoked");
assert.equal(identity.sessionDecision({ activeMembership: true, sessionExpiresAt: "2026-10-18T00:00:00Z",
  now: new Date("2026-10-19T00:00:00Z") }).reason, "session_expired");
assert.equal(identity.sessionDecision({ activeMembership: true, sessionExpiresAt: "2027-01-01T00:00:00Z", suspicious: true,
  now: new Date("2026-10-19T00:00:00Z") }).reason, "suspicious_session_reauthentication_required");
assert.equal(identity.enterpriseSloFoundation({ targetAvailabilityPercent: 99.9, responseMinutes: 15, resolutionHours: 4 }).realWorldProofRequired, true);
for (const users of [10, 100, 1000, 10000]) for (const sites of [1, 10, 100, 1000]) {
  const profile = identity.boundedEnterpriseScaleProfile({ users, sites });
  assert.equal(profile.productionScaleClaim, false);
  assert(profile.membershipChecks <= 100000);
}

for (const required of [
  "digital_observer_organization_memberships", "digital_observer_organization_member_sites", "digital_observer_enterprise_invitations",
  "digital_observer_auth_policies", "digital_observer_sso_connections", "digital_observer_sso_transactions",
  "digital_observer_scim_connections", "digital_observer_scim_subjects", "digital_observer_scim_event_receipts",
  "digital_observer_service_accounts", "digital_observer_service_account_credentials", "digital_observer_enterprise_sessions",
  "digital_observer_enterprise_audit_events", "digital_observer_slo_policies", "enable row level security",
  "do_auth_policy_sms_disabled", "provider_mode in ('disabled','sandbox')", "block_digital_observer_enterprise_audit_mutation",
  "revoke select on public.digital_observer_service_account_credentials", "billing.read", "site.configure"
]) assert(migration.includes(required), `migration missing ${required}`);
assert(migration.includes("member_role in ('owner','admin','operator','viewer','reviewer')"));
assert(!migration.match(/sms_authentication_enabled boolean not null default true/));
assert(!migration.match(/provider_mode in \('disabled','sandbox','production'\)/));

assert(enterpriseRoute.includes("resolveEnterpriseActor") && enterpriseRoute.includes("createEnterpriseServiceAccount"));
assert(enterpriseRoute.includes("configureEnterpriseSso") && enterpriseRoute.includes("configureEnterpriseScim"));
assert(scimRoute.includes("hashEnterpriseCredential") && scimRoute.includes("digital_observer_scim_event_receipts"));
assert(scimRoute.includes("deprovision_user") && scimRoute.includes("active: !deprovision && !suspend"));
assert(access.includes("digital_observer_organization_memberships") && access.includes("digital_observer_has_org_permission"));
assert(shell.includes("/digital-observer/enterprise") && enterprisePage.includes("EnterpriseIdentityCenter"));
assert(enterpriseUi.includes("SMS / Twilio לאימות") && enterpriseUi.includes("סוד חד־פעמי"));

for (const preserved of ["push", "email", "sms", "whatsapp", "webhook", "phone"]) assert(push39Migration.includes(`'${preserved}'`));
for (const preserved of ["digital_observer_plan_versions", "digital_observer_entitlement_grants", "digital_observer_partner_billing_accounts"]) assert(push40Migration.includes(preserved));
for (const fixtureSource of [developmentFixtures, push41FixtureSeeder]) {
  assert(fixtureSource.includes("00000000-0000-4000-8000-000000000d41"));
  assert(fixtureSource.includes("payment_provider_mode"));
  assert(fixtureSource.includes("'disabled'"));
  assert(fixtureSource.includes('"real_charge_performed":false'));
  assert(fixtureSource.includes('"provider_contacted":false'));
  assert(fixtureSource.includes("'notifications'"));
}
assert(push41FixtureSeeder.includes("synthetic QA must not overwrite it"));
assert(push41FixtureSeeder.includes("config.productionAllowed, false"));

console.log("PUSH 41 deterministic QA passed: org/Site isolation, least-privilege RBAC, delegated-admin denial, expiring invitations, OIDC/SAML guards, governed SCIM/deprovisioning, hashed expiring service credentials, session revocation decisions, billing separation, SMS-auth disablement, bounded synthetic scale and PUSH 39/40 preservation.");
