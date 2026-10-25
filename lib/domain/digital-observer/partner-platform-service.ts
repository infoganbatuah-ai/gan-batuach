/* eslint-disable @typescript-eslint/no-explicit-any -- PUSH 43 schema precedes generated Supabase types. */
import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { assertDelegatedGrant, type EnterpriseRole } from "./enterprise-identity";
import { brandProfileSchema, customerReference, hashEmbeddedToken, issueEmbeddedToken, partnerCustomerTransition, publicBrandProfile, validateEmbedOrigin, verifyEmbeddedAudience, type EmbeddedScope } from "./partner-platform";
import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;
const partnerRoles: EnterpriseRole[] = ["platform_admin", "organization_owner", "organization_admin"];
const pepper = () => {
  const value = process.env.DIGITAL_OBSERVER_ENTERPRISE_CREDENTIAL_PEPPER;
  if (!value || value.length < 16) throw new Error("PARTNER_TOKEN_PEPPER_REQUIRED");
  return value;
};
function assertPartnerRole(role: EnterpriseRole) { if (!partnerRoles.includes(role)) throw new Error("PARTNER_MANAGEMENT_DENIED"); }
async function audit(admin: Admin, input: { organizationId: string; actorId?: string; serviceAccountId?: string; resourceType: string; resourceId?: string; action: string; correlationId: string; metadata?: Record<string, unknown> }) {
  const result = await (admin as any).from("digital_observer_enterprise_audit_events").insert({ organization_id: input.organizationId,
    actor_profile_id: input.actorId ?? null, service_account_id: input.serviceAccountId ?? null, resource_type: input.resourceType,
    resource_id: input.resourceId ?? null, action: input.action, authorization_decision: "allowed", result_status: "success",
    correlation_id: input.correlationId, safe_metadata: input.metadata ?? {} });
  if (result.error) throw new Error("PARTNER_AUDIT_FAILED");
}

export async function partnerState(admin: Admin, organizationId: string) {
  const partner = await (admin as any).from("digital_observer_partners").select("id,organization_id,partner_key,partner_type,partner_status,billing_account_id,sso_connection_id,retail_pricing_controlled_by_partner,allowed_embed_origins,created_at,updated_at").eq("organization_id", organizationId).maybeSingle();
  if (partner.error) throw new Error("PARTNER_STATE_UNAVAILABLE");
  if (!partner.data) return { partner: null, customers: [], brand: null, serviceAccounts: [], usage: [], externalProof: "NOT_PROVEN" };
  const [customers, brand, services] = await Promise.all([
    (admin as any).from("digital_observer_partner_customers").select("id,customer_organization_id,external_customer_reference_hint,customer_status,activated_at,suspended_at,deprovisioned_at,created_at").eq("partner_id", partner.data.id).order("created_at", { ascending: false }).limit(1000),
    (admin as any).from("digital_observer_partner_brand_profiles").select("partner_id,brand_name,product_name,logo_url,primary_color,accent_color,support_url,privacy_url,terms_url,customer_domain,domain_status,notification_sender_label,legally_required_notices,updated_at").eq("partner_id", partner.data.id).maybeSingle(),
    (admin as any).from("digital_observer_partner_service_accounts").select("partner_id,service_account_id,partner_customer_id,access_kind,created_at").eq("partner_id", partner.data.id).limit(1000)
  ]);
  if (customers.error || brand.error || services.error) throw new Error("PARTNER_STATE_UNAVAILABLE");
  return { partner: partner.data, customers: customers.data ?? [], brand: brand.data ? publicBrandProfile(brand.data) : null,
    serviceAccounts: services.data ?? [], externalProof: "NOT_PROVEN", productionActivated: false };
}

export async function configurePartner(admin: Admin, input: { organizationId: string; actorId: string; actorRole: EnterpriseRole; partnerKey: string; partnerType: string; billingAccountId?: string | null; ssoConnectionId?: string | null; allowedOrigins: string[]; correlationId: string }) {
  assertPartnerRole(input.actorRole);
  const org = await (admin as any).from("digital_observer_organizations").select("id,organization_type,status").eq("id", input.organizationId).maybeSingle();
  if (!org.data || org.data.status !== "active" || !["manufacturer","monitoring_center","security_company","oem_partner","white_label_partner","enterprise"].includes(org.data.organization_type)) throw new Error("PARTNER_ORGANIZATION_INELIGIBLE");
  const origins = [...new Set(input.allowedOrigins.map((origin) => new URL(origin).origin))];
  const result = await (admin as any).from("digital_observer_partners").upsert({ organization_id: input.organizationId,
    partner_key: input.partnerKey, partner_type: input.partnerType, partner_status: "sandbox", billing_account_id: input.billingAccountId ?? null,
    sso_connection_id: input.ssoConnectionId ?? null, allowed_embed_origins: origins, created_by: input.actorId,
    metadata: { environment: "DEVELOPMENT", external_proof: false, production_activation_authorized: false } }, { onConflict: "organization_id" })
    .select("id,organization_id,partner_key,partner_type,partner_status,allowed_embed_origins").single();
  if (result.error) throw new Error("PARTNER_CONFIGURATION_FAILED");
  await audit(admin, { organizationId: input.organizationId, actorId: input.actorId, resourceType: "partner", resourceId: result.data.id,
    action: "partner.configure_sandbox", correlationId: input.correlationId, metadata: { partner_type: input.partnerType, origin_count: origins.length } });
  return { partner: result.data, productionActivated: false, realPartnerProof: false };
}

export async function provisionPartnerCustomer(admin: Admin, input: { partnerId: string; organizationId: string; actorId?: string; serviceAccountId?: string; actorRole: EnterpriseRole; customerOrganizationId: string; externalReference: string; siteIds: string[]; entitlementGrantIds: string[]; idempotencyKey: string; correlationId: string }) {
  assertPartnerRole(input.actorRole);
  if (input.organizationId === input.customerOrganizationId) throw new Error("PARTNER_CUSTOMER_ORGANIZATION_REQUIRED");
  const ref = customerReference(input.externalReference);
  // Version the hash input so receipts from the earlier, narrower identity never replay as v2 success.
  const requestHash = createHash("sha256").update(JSON.stringify({ version: 2, partnerId: input.partnerId,
    organizationId: input.organizationId, actorId: input.actorId ?? null, serviceAccountId: input.serviceAccountId ?? null,
    customerOrganizationId: input.customerOrganizationId, externalReferenceHash: ref.hash,
    siteIds: [...new Set(input.siteIds)].sort(), entitlementGrantIds: [...new Set(input.entitlementGrantIds)].sort() })).digest("hex");
  const completedReplay = async () => {
    const existing = await (admin as any).from("digital_observer_partner_provisioning_receipts")
      .select("request_hash,service_account_id,resource_type,resource_id,result_status,response_status")
      .eq("partner_id", input.partnerId).eq("operation", "customer.provision").eq("idempotency_key", input.idempotencyKey).single();
    if (existing.error || !existing.data) throw new Error("PARTNER_RECEIPT_RECOVERY_REQUIRED");
    if (existing.data.request_hash !== requestHash || existing.data.service_account_id !== (input.serviceAccountId ?? null)) {
      throw new Error("PARTNER_IDEMPOTENCY_CONFLICT");
    }
    if (existing.data.result_status !== "completed" || existing.data.resource_type !== "partner_customer"
      || !existing.data.resource_id || existing.data.response_status !== 201) throw new Error("PARTNER_RECEIPT_RECOVERY_REQUIRED");
    const [customer, sites, grants] = await Promise.all([
      (admin as any).from("digital_observer_partner_customers").select("id,customer_status,external_customer_reference_hash,idempotency_key")
        .eq("id", existing.data.resource_id).eq("partner_id", input.partnerId)
        .eq("customer_organization_id", input.customerOrganizationId).maybeSingle(),
      (admin as any).from("digital_observer_partner_customer_sites").select("observer_site_id").eq("partner_customer_id", existing.data.resource_id),
      (admin as any).from("digital_observer_partner_customer_entitlements").select("entitlement_grant_id").eq("partner_customer_id", existing.data.resource_id)
    ]);
    const sameSet = (actual: string[], expected: string[]) => actual.length === expected.length
      && actual.every((value, index) => value === expected[index]);
    if (customer.error || sites.error || grants.error || !customer.data || customer.data.customer_status !== "active"
      || customer.data.external_customer_reference_hash !== ref.hash || customer.data.idempotency_key !== input.idempotencyKey
      || !Array.isArray(sites.data) || !Array.isArray(grants.data)
      || !sameSet(sites.data.map((row: any) => row.observer_site_id).sort(), [...new Set(input.siteIds)].sort())
      || !sameSet(grants.data.map((row: any) => row.entitlement_grant_id).sort(), [...new Set(input.entitlementGrantIds)].sort())) {
      throw new Error("PARTNER_RECEIPT_RECOVERY_REQUIRED");
    }
    return { customerId: existing.data.resource_id, idempotentReplay: true, status: existing.data.result_status };
  };
  // A new key is not permission to re-provision an existing customer. This read is only a preflight;
  // the unique constraints and insert-only write below handle a concurrent insert without overwriting it.
  const priorCustomer = await (admin as any).from("digital_observer_partner_customers").select("id,idempotency_key")
    .eq("partner_id", input.partnerId).eq("customer_organization_id", input.customerOrganizationId).maybeSingle();
  if (priorCustomer.error) throw new Error("PARTNER_CUSTOMER_LOOKUP_FAILED");
  if (priorCustomer.data) {
    if (!priorCustomer.data.id || priorCustomer.data.idempotency_key !== input.idempotencyKey) throw new Error("PARTNER_CUSTOMER_CONFLICT");
    return completedReplay();
  }
  const receipt = await (admin as any).from("digital_observer_partner_provisioning_receipts").insert({ partner_id: input.partnerId,
    service_account_id: input.serviceAccountId ?? null, idempotency_key: input.idempotencyKey, operation: "customer.provision", request_hash: requestHash }).select("id").single();
  if (receipt.error?.code === "23505") return completedReplay();
  if (receipt.error || !receipt.data?.id) throw new Error("PARTNER_RECEIPT_FAILED");
  const [sites, grants] = await Promise.all([
    (admin as any).from("observer_sites").select("id,digital_observer_organization_id,site_type,garden_id").in("id", input.siteIds).eq("digital_observer_organization_id", input.customerOrganizationId).is("garden_id", null).neq("site_type", "kindergarten"),
    (admin as any).from("digital_observer_entitlement_grants").select("id,observer_site_id,entitlement_key,grant_status,boolean_value,effective_until").in("id", input.entitlementGrantIds).in("observer_site_id", input.siteIds).eq("grant_status", "active")
  ]);
  if (sites.error || sites.data?.length !== new Set(input.siteIds).size) throw new Error("PARTNER_CUSTOMER_SITE_SCOPE_DENIED");
  if (grants.error || grants.data?.length !== new Set(input.entitlementGrantIds).size) throw new Error("PARTNER_CUSTOMER_ENTITLEMENT_DENIED");
  const customer = await (admin as any).from("digital_observer_partner_customers").insert({ partner_id: input.partnerId,
    customer_organization_id: input.customerOrganizationId, external_customer_reference_hash: ref.hash, external_customer_reference_hint: ref.hint,
    idempotency_key: input.idempotencyKey, customer_status: "active", activated_at: new Date().toISOString(), created_by: input.actorId ?? null,
    metadata: { external_reference_stored: false, production_customer: false } })
    .select("id,customer_organization_id,external_customer_reference_hint,customer_status,activated_at").single();
  if (customer.error?.code === "23505") throw new Error("PARTNER_CUSTOMER_CONFLICT");
  if (customer.error || !customer.data?.id) throw new Error("PARTNER_CUSTOMER_CREATE_FAILED");
  const [siteLinks, entitlementLinks] = await Promise.all([
    (admin as any).from("digital_observer_partner_customer_sites").insert(input.siteIds.map((siteId) => ({ partner_customer_id: customer.data.id, observer_site_id: siteId }))),
    (admin as any).from("digital_observer_partner_customer_entitlements").insert(input.entitlementGrantIds.map((grantId) => ({ partner_customer_id: customer.data.id, entitlement_grant_id: grantId, assigned_by: input.actorId ?? null })))
  ]);
  if (siteLinks.error || entitlementLinks.error) throw new Error("PARTNER_CUSTOMER_SCOPE_LINK_FAILED");
  await audit(admin, { organizationId: input.organizationId, actorId: input.actorId, serviceAccountId: input.serviceAccountId,
    resourceType: "partner_customer", resourceId: customer.data.id, action: "partner_customer.provision", correlationId: input.correlationId,
    metadata: { site_count: input.siteIds.length, entitlement_count: input.entitlementGrantIds.length, external_reference_stored: false } });
  const completed = await (admin as any).from("digital_observer_partner_provisioning_receipts")
    .update({ result_status: "completed", resource_type: "partner_customer", resource_id: customer.data.id, response_status: 201 })
    .eq("id", receipt.data.id).eq("result_status", "accepted").eq("request_hash", requestHash)
    .select("id,result_status,resource_type,resource_id,response_status").single();
  if (completed.error || completed.data?.id !== receipt.data.id || completed.data.result_status !== "completed"
    || completed.data.resource_type !== "partner_customer" || completed.data.resource_id !== customer.data.id
    || completed.data.response_status !== 201) throw new Error("PARTNER_RECEIPT_FINALIZATION_FAILED");
  return { customer: customer.data, idempotentReplay: false, realCustomerProvisioned: false };
}

export async function transitionPartnerCustomer(admin: Admin, input: { partnerId: string; organizationId: string; actorId: string; actorRole: EnterpriseRole; customerId: string; status: "active"|"suspended"|"deprovisioned"; reason: string; correlationId: string }) {
  assertPartnerRole(input.actorRole);
  const [partner, current] = await Promise.all([
    (admin as any).from("digital_observer_partners").select("id,organization_id,partner_status")
      .eq("id", input.partnerId).eq("organization_id", input.organizationId).maybeSingle(),
    (admin as any).from("digital_observer_partner_customers")
      .select("id,partner_id,customer_organization_id,customer_status,activated_at,suspended_at,deprovisioned_at")
      .eq("id", input.customerId).eq("partner_id", input.partnerId).maybeSingle()
  ]);
  if (partner.error || current.error) throw new Error("PARTNER_CUSTOMER_LOOKUP_FAILED");
  if (partner.data?.id !== input.partnerId || partner.data.organization_id !== input.organizationId
    || !["sandbox", "suspended"].includes(partner.data.partner_status)
    || current.data?.id !== input.customerId || current.data.partner_id !== input.partnerId
    || !current.data.customer_organization_id || current.data.customer_organization_id === input.organizationId) {
    throw new Error("PARTNER_CUSTOMER_SCOPE_DENIED");
  }
  const organizations = await (admin as any).from("digital_observer_organizations").select("id,status")
    .in("id", [input.organizationId, current.data.customer_organization_id]).limit(2);
  if (organizations.error || !Array.isArray(organizations.data) || organizations.data.length !== 2
    || ![input.organizationId, current.data.customer_organization_id]
      .every((id) => organizations.data.some((row: any) => row.id === id && row.status === "active"))) {
    throw new Error("PARTNER_CUSTOMER_SCOPE_DENIED");
  }
  const repeatRevocation = current.data.customer_status === input.status && input.status !== "active";
  if (!repeatRevocation) partnerCustomerTransition(current.data.customer_status, input.status);
  // Each activation is a distinct generation, even when suspension and reactivation share a millisecond.
  const priorActivation = typeof current.data.activated_at === "string" ? new Date(current.data.activated_at).getTime() : NaN;
  const now = new Date(input.status === "active" && Number.isFinite(priorActivation)
    ? Math.max(Date.now(), priorActivation + 1) : Date.now()).toISOString();
  const fields = input.status === "active" ? { customer_status: input.status, activated_at: now, suspended_at: null, suspension_reason: null }
    : input.status === "suspended" ? { customer_status: input.status, suspended_at: now, suspension_reason: input.reason }
      : { customer_status: input.status, deprovisioned_at: now, suspension_reason: input.reason };
  const changed = repeatRevocation ? { data: current.data, error: null } : await (admin as any)
    .from("digital_observer_partner_customers").update(fields)
    .eq("id", input.customerId).eq("partner_id", input.partnerId)
    .eq("customer_organization_id", current.data.customer_organization_id)
    .eq("customer_status", current.data.customer_status)
    .select("id,customer_status,activated_at,suspended_at,deprovisioned_at").single();
  if (changed.error || changed.data?.id !== input.customerId || changed.data.customer_status !== input.status) {
    throw new Error("PARTNER_CUSTOMER_TRANSITION_FAILED");
  }
  if (input.status !== "active") {
    // Leave a failed revocation in the non-active state. A retry can repair it without a second status write.
    const revoked = await (admin as any).from("digital_observer_embedded_sessions")
      .update({ revoked_at: now, revocation_reason: input.reason })
      .eq("partner_id", input.partnerId).eq("partner_customer_id", input.customerId).is("revoked_at", null).select("id");
    if (revoked.error || !Array.isArray(revoked.data)) throw new Error("PARTNER_EMBED_REVOCATION_FAILED");
    if (repeatRevocation && revoked.data.length === 0) return changed.data;
  }
  await audit(admin, { organizationId: input.organizationId, actorId: input.actorId, resourceType: "partner_customer", resourceId: input.customerId,
    action: `partner_customer.${input.status}`, correlationId: input.correlationId, metadata: { reason: input.reason.slice(0, 120) } });
  return changed.data;
}

export async function savePartnerBrand(admin: Admin, input: { partnerId: string; organizationId: string; actorId: string; actorRole: EnterpriseRole; brand: Record<string, unknown>; correlationId: string }) {
  assertPartnerRole(input.actorRole);
  const brand = brandProfileSchema.parse(input.brand);
  const organization = await (admin as any).from("digital_observer_organizations")
    .select("id,status").eq("id", input.organizationId).maybeSingle();
  if (organization.error || organization.data?.id !== input.organizationId
    || organization.data.status !== "active") throw new Error("PARTNER_BRAND_SCOPE_DENIED");
  const ownedPartner = async () => {
    const result = await (admin as any).from("digital_observer_partners").select("id,organization_id,partner_status")
      .eq("id", input.partnerId).eq("organization_id", input.organizationId).maybeSingle();
    if (result.error) throw new Error("PARTNER_BRAND_PARTNER_LOOKUP_FAILED");
    if (result.data?.id !== input.partnerId || result.data.organization_id !== input.organizationId
      || result.data.partner_status !== "sandbox") throw new Error("PARTNER_BRAND_SCOPE_DENIED");
  };
  await ownedPartner();
  const previous = await (admin as any).from("digital_observer_partner_brand_profiles")
    .select("partner_id,customer_domain,domain_status,updated_at").eq("partner_id", input.partnerId).maybeSingle();
  if (previous.error || (previous.data && (previous.data.partner_id !== input.partnerId
    || !["unverified", "verification_pending", "verified_sandbox"].includes(previous.data.domain_status)
    || !previous.data.updated_at))) throw new Error("PARTNER_BRAND_LOOKUP_FAILED");
  // Re-check immediately before the write. The current schema has no organization_id on the
  // brand row, so PostgreSQL must still qualify the ownership/write race before activation.
  await ownedPartner();
  const customerDomain = Object.hasOwn(brand, "customer_domain")
    ? brand.customer_domain : previous.data?.customer_domain ?? null;
  const domainStatus = previous.data && customerDomain === previous.data.customer_domain
    ? previous.data.domain_status : "unverified";
  const priorUpdate = previous.data ? new Date(previous.data.updated_at).getTime() : NaN;
  if (previous.data && !Number.isFinite(priorUpdate)) throw new Error("PARTNER_BRAND_LOOKUP_FAILED");
  const values = { ...brand, domain_status: domainStatus, updated_by: input.actorId,
    updated_at: new Date(Number.isFinite(priorUpdate) ? Math.max(Date.now(), priorUpdate + 1) : Date.now()).toISOString() };
  const query = previous.data
    ? (admin as any).from("digital_observer_partner_brand_profiles").update(values)
      .eq("partner_id", input.partnerId).eq("updated_at", previous.data.updated_at)
    : (admin as any).from("digital_observer_partner_brand_profiles").insert({ partner_id: input.partnerId, ...values });
  const saved = await query.select("*").single();
  if (saved.error || saved.data?.partner_id !== input.partnerId || saved.data.domain_status !== domainStatus) {
    throw new Error("PARTNER_BRAND_SAVE_FAILED");
  }
  await ownedPartner();
  await audit(admin, { organizationId: input.organizationId, actorId: input.actorId, resourceType: "partner_brand", resourceId: input.partnerId,
    action: "partner_brand.update", correlationId: input.correlationId, metadata: { domain_verified: domainStatus === "verified_sandbox" } });
  return publicBrandProfile(saved.data);
}

async function currentEmbeddedSiteScope(admin: Admin, input: { partnerId: string; customerId: string; siteId: string; organizationId?: string }) {
  const [partner, customer, site, linked] = await Promise.all([
    (admin as any).from("digital_observer_partners").select("id,organization_id,partner_status,allowed_embed_origins")
      .eq("id", input.partnerId).maybeSingle(),
    (admin as any).from("digital_observer_partner_customers").select("id,partner_id,customer_organization_id,customer_status,activated_at")
      .eq("id", input.customerId).eq("partner_id", input.partnerId).maybeSingle(),
    (admin as any).from("observer_sites").select("id,digital_observer_organization_id,site_type,garden_id")
      .eq("id", input.siteId).is("garden_id", null).neq("site_type", "kindergarten").maybeSingle(),
    (admin as any).from("digital_observer_partner_customer_sites").select("partner_customer_id,observer_site_id")
      .eq("partner_customer_id", input.customerId).eq("observer_site_id", input.siteId).maybeSingle()
  ]);
  if (partner.error || customer.error || site.error || linked.error) return null;
  const p = partner.data; const c = customer.data; const s = site.data; const l = linked.data;
  if (p?.id !== input.partnerId || p.partner_status !== "sandbox" || !p.organization_id
    || (input.organizationId && p.organization_id !== input.organizationId)
    || c?.id !== input.customerId || c.partner_id !== p.id || c.customer_status !== "active"
    || !c.customer_organization_id || c.customer_organization_id === p.organization_id
    || s?.id !== input.siteId || s.digital_observer_organization_id !== c.customer_organization_id
    || s.garden_id !== null || !s.site_type || s.site_type === "kindergarten"
    || l?.partner_customer_id !== c.id || l.observer_site_id !== s.id) return null;
  const organizations = await (admin as any).from("digital_observer_organizations").select("id,status")
    .in("id", [p.organization_id, c.customer_organization_id]).limit(2);
  if (organizations.error || !Array.isArray(organizations.data) || organizations.data.length !== 2
    || ![p.organization_id, c.customer_organization_id].every((id) => organizations.data.some((org: any) => org.id === id && org.status === "active"))) return null;
  return { ...p, customerActivatedAt: c.activated_at } as { id: string; organization_id: string; allowed_embed_origins: string[]; customerActivatedAt: string | null };
}

export async function issuePartnerEmbeddedSession(admin: Admin, input: { partnerId: string; organizationId: string; actorId?: string; serviceAccountId?: string; actorRole: EnterpriseRole; customerId: string; siteId: string; audience: string; origin: string; scopes: EmbeddedScope[]; ttlMinutes: number; correlationId: string }) {
  assertDelegatedGrant({ actorRole: input.actorRole, requestedRole: "service_account" });
  const partner = await currentEmbeddedSiteScope(admin, { partnerId: input.partnerId, customerId: input.customerId,
    siteId: input.siteId, organizationId: input.organizationId });
  if (!partner) throw new Error("PARTNER_EMBED_SCOPE_DENIED");
  const customerActivation = typeof partner.customerActivatedAt === "string"
    ? new Date(partner.customerActivatedAt).getTime() : NaN;
  if (!Number.isFinite(customerActivation)) throw new Error("PARTNER_EMBED_SCOPE_DENIED");
  let origin: string;
  try { origin = validateEmbedOrigin(input.origin, Array.isArray(partner.allowed_embed_origins) ? partner.allowed_embed_origins : []); }
  catch { throw new Error("PARTNER_EMBED_ORIGIN_DENIED"); }
  const token = issueEmbeddedToken({ pepper: pepper(), ttlMinutes: input.ttlMinutes });
  const session = await (admin as any).from("digital_observer_embedded_sessions").insert({ partner_id: input.partnerId,
    partner_customer_id: input.customerId, observer_site_id: input.siteId, token_hash: token.hash, token_prefix: token.prefix,
    audience: input.audience, allowed_origin: origin, scopes: input.scopes, expires_at: token.expiresAt,
    issued_by_profile_id: input.actorId ?? null, issued_by_service_account_id: input.serviceAccountId ?? null,
    metadata: { production: false, long_lived_secret: false, customer_activation_epoch_ms: customerActivation } })
    .select("id,partner_customer_id,observer_site_id,audience,allowed_origin,scopes,expires_at").single();
  if (session.error) throw new Error("PARTNER_EMBED_SESSION_FAILED");
  await audit(admin, { organizationId: input.organizationId, actorId: input.actorId, serviceAccountId: input.serviceAccountId,
    resourceType: "embedded_session", resourceId: session.data.id, action: "embedded_session.issue", correlationId: input.correlationId,
    metadata: { ttl_minutes: input.ttlMinutes, scope_count: input.scopes.length, raw_token_stored: false } });
  return { session: session.data, token: token.raw, oneTimeSecret: true };
}

export async function linkPartnerServiceAccount(admin: Admin, input: { partnerId: string; organizationId: string; actorId: string; actorRole: EnterpriseRole; serviceAccountId: string; customerId?: string | null; correlationId: string }) {
  assertPartnerRole(input.actorRole);
  const [account, partner] = await Promise.all([
    (admin as any).from("digital_observer_service_accounts").select("id,organization_id,account_status")
      .eq("id", input.serviceAccountId).eq("organization_id", input.organizationId).eq("account_status", "active").maybeSingle(),
    (admin as any).from("digital_observer_partners").select("id,organization_id,partner_status")
      .eq("id", input.partnerId).eq("organization_id", input.organizationId).eq("partner_status", "sandbox").maybeSingle()
  ]);
  if (account.error || partner.error) throw new Error("PARTNER_SERVICE_ACCOUNT_LOOKUP_FAILED");
  if (account.data?.id !== input.serviceAccountId || account.data.organization_id !== input.organizationId
    || account.data.account_status !== "active" || partner.data?.id !== input.partnerId
    || partner.data.organization_id !== input.organizationId || partner.data.partner_status !== "sandbox") {
    throw new Error("PARTNER_SERVICE_ACCOUNT_DENIED");
  }
  if (input.customerId) {
    const customer = await (admin as any).from("digital_observer_partner_customers")
      .select("id,partner_id,customer_organization_id,customer_status")
      .eq("id", input.customerId).eq("partner_id", input.partnerId).eq("customer_status", "active").maybeSingle();
    if (customer.error) throw new Error("PARTNER_CUSTOMER_LOOKUP_FAILED");
    if (customer.data?.id !== input.customerId || customer.data.partner_id !== input.partnerId
      || customer.data.customer_status !== "active" || !customer.data.customer_organization_id
      || customer.data.customer_organization_id === input.organizationId) throw new Error("PARTNER_CUSTOMER_SCOPE_DENIED");
    const customerOrganization = await (admin as any).from("digital_observer_organizations").select("id,status")
      .eq("id", customer.data.customer_organization_id).eq("status", "active").maybeSingle();
    if (customerOrganization.error) throw new Error("PARTNER_CUSTOMER_LOOKUP_FAILED");
    if (customerOrganization.data?.id !== customer.data.customer_organization_id
      || customerOrganization.data.status !== "active") throw new Error("PARTNER_CUSTOMER_SCOPE_DENIED");
  }
  const desired = { partner_id: input.partnerId, service_account_id: input.serviceAccountId,
    partner_customer_id: input.customerId ?? null, access_kind: input.customerId ? "customer_resources" : "partner_control" };
  const sameMapping = (row: any) => row?.partner_id === desired.partner_id && row.service_account_id === desired.service_account_id
    && row.partner_customer_id === desired.partner_customer_id && row.access_kind === desired.access_kind;
  const readMapping = async () => (admin as any).from("digital_observer_partner_service_accounts")
    .select("partner_id,service_account_id,partner_customer_id,access_kind")
    .eq("service_account_id", input.serviceAccountId).maybeSingle();
  const existing = await readMapping();
  if (existing.error) throw new Error("PARTNER_SERVICE_ACCOUNT_LOOKUP_FAILED");
  if (existing.data) {
    if (!sameMapping(existing.data)) throw new Error("PARTNER_SERVICE_ACCOUNT_CONFLICT");
    return existing.data;
  }
  const mapping = await (admin as any).from("digital_observer_partner_service_accounts").insert(desired)
    .select("partner_id,service_account_id,partner_customer_id,access_kind").single();
  if (mapping.error?.code === "23505") {
    const raced = await readMapping();
    if (raced.error || !raced.data) throw new Error("PARTNER_SERVICE_ACCOUNT_LOOKUP_FAILED");
    if (!sameMapping(raced.data)) throw new Error("PARTNER_SERVICE_ACCOUNT_CONFLICT");
    return raced.data;
  }
  if (mapping.error || !sameMapping(mapping.data)) throw new Error("PARTNER_SERVICE_ACCOUNT_LINK_FAILED");
  await audit(admin, { organizationId: input.organizationId, actorId: input.actorId, resourceType: "partner_service_account",
    resourceId: input.serviceAccountId, action: "partner_service_account.link", correlationId: input.correlationId,
    metadata: { access_kind: mapping.data.access_kind } });
  return mapping.data;
}

export async function authorizePartnerDelegatedSite(admin: Admin, input: { serviceAccountId: string; siteId: string }) {
  const [mapping, account, site] = await Promise.all([
    (admin as any).from("digital_observer_partner_service_accounts")
      .select("partner_id,partner_customer_id,access_kind,digital_observer_partner_customers!inner(id,customer_status,partner_id,customer_organization_id,digital_observer_partners!inner(id,organization_id,partner_status))")
      .eq("service_account_id", input.serviceAccountId).eq("access_kind", "customer_resources").maybeSingle(),
    (admin as any).from("digital_observer_service_accounts").select("id,organization_id,account_status")
      .eq("id", input.serviceAccountId).eq("account_status", "active").maybeSingle(),
    (admin as any).from("observer_sites").select("id,digital_observer_organization_id,site_type,garden_id")
      .eq("id", input.siteId).is("garden_id", null).neq("site_type", "kindergarten").maybeSingle()
  ]);
  if (mapping.error || account.error || site.error) return false;
  const customer = (mapping.data as any)?.digital_observer_partner_customers;
  const partner = customer?.digital_observer_partners;
  if (!customer || !partner || customer.customer_status !== "active" || partner.partner_status !== "sandbox"
    || !account.data || account.data.id !== input.serviceAccountId || account.data.account_status !== "active"
    || mapping.data.access_kind !== "customer_resources" || mapping.data.partner_customer_id !== customer.id
    || mapping.data.partner_id !== customer.partner_id || customer.partner_id !== partner.id
    || partner.organization_id !== account.data.organization_id || !site.data || site.data.id !== input.siteId
    || site.data.garden_id !== null || site.data.site_type === "kindergarten"
    || !customer.customer_organization_id || site.data.digital_observer_organization_id !== customer.customer_organization_id) return false;
  const linked = await (admin as any).from("digital_observer_partner_customer_sites").select("observer_site_id")
    .eq("partner_customer_id", mapping.data.partner_customer_id).eq("observer_site_id", input.siteId).maybeSingle();
  return !linked.error && linked.data?.observer_site_id === input.siteId;
}

export async function authenticateEmbeddedSession(admin: Admin, input: { token: string; origin: string | null; audience: string; requiredScope: EmbeddedScope }) {
  if (typeof input.token !== "string" || !input.token.startsWith("doemb_")) throw new Error("EMBEDDED_AUTH_REQUIRED");
  const result = await (admin as any).from("digital_observer_embedded_sessions")
    .select("id,partner_id,partner_customer_id,observer_site_id,audience,allowed_origin,scopes,expires_at,revoked_at,metadata")
    .eq("token_hash", hashEmbeddedToken(input.token, pepper())).maybeSingle();
  const row = result.data as any;
  const expiresAt = new Date(row?.expires_at).getTime();
  if (result.error || !row?.id || row.revoked_at || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    throw new Error("EMBEDDED_SESSION_INACTIVE");
  }
  if (typeof row.audience !== "string" || typeof input.audience !== "string"
    || !verifyEmbeddedAudience({ expected: row.audience, actual: input.audience })) throw new Error("EMBEDDED_AUDIENCE_DENIED");
  try { validateEmbedOrigin(input.origin ?? "", [row.allowed_origin]); }
  catch { throw new Error("EMBEDDED_ORIGIN_DENIED"); }
  if (!Array.isArray(row.scopes) || !row.scopes.includes(input.requiredScope)) throw new Error("EMBEDDED_SCOPE_DENIED");
  const partner = await currentEmbeddedSiteScope(admin, { partnerId: row.partner_id, customerId: row.partner_customer_id,
    siteId: row.observer_site_id });
  if (!partner || !Array.isArray(partner.allowed_embed_origins) || !partner.allowed_embed_origins.includes(row.allowed_origin)) {
    throw new Error("EMBEDDED_SESSION_INACTIVE");
  }
  // A token is bound to the customer's activation generation. Failed bulk revocation cannot
  // revive an older token after reactivation, nor can a stale issuance read mint a new valid one.
  const activatedAt = typeof partner.customerActivatedAt === "string" ? new Date(partner.customerActivatedAt).getTime() : NaN;
  if (!Number.isFinite(activatedAt) || !Number.isSafeInteger(row.metadata?.customer_activation_epoch_ms)
    || row.metadata.customer_activation_epoch_ms !== activatedAt) {
    throw new Error("EMBEDDED_SESSION_INACTIVE");
  }
  const usedAt = new Date().toISOString();
  const touch = await (admin as any).from("digital_observer_embedded_sessions").update({ last_used_at: usedAt })
    .eq("id", row.id).is("revoked_at", null).gt("expires_at", usedAt).select("id").single();
  if (touch.error || touch.data?.id !== row.id) throw new Error("EMBEDDED_SESSION_INACTIVE");
  return row as { id: string; partner_id: string; partner_customer_id: string; observer_site_id: string; scopes: EmbeddedScope[]; expires_at: string };
}

export function partnerCorrelationId() { return randomUUID(); }
