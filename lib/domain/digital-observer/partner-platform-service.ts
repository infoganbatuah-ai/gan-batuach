/* eslint-disable @typescript-eslint/no-explicit-any -- PUSH 43 schema precedes generated Supabase types. */
import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { assertDelegatedGrant, type EnterpriseRole } from "./enterprise-identity";
import { customerReference, hashEmbeddedToken, issueEmbeddedToken, partnerCustomerTransition, publicBrandProfile, validateEmbedOrigin, verifyEmbeddedAudience, type EmbeddedScope } from "./partner-platform";
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
  const receipt = await (admin as any).from("digital_observer_partner_provisioning_receipts").insert({ partner_id: input.partnerId,
    service_account_id: input.serviceAccountId ?? null, idempotency_key: input.idempotencyKey, operation: "customer.provision", request_hash: requestHash }).select("id").single();
  if (receipt.error?.code === "23505") {
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
  }
  if (receipt.error || !receipt.data?.id) throw new Error("PARTNER_RECEIPT_FAILED");
  const [sites, grants] = await Promise.all([
    (admin as any).from("observer_sites").select("id,digital_observer_organization_id,site_type,garden_id").in("id", input.siteIds).eq("digital_observer_organization_id", input.customerOrganizationId).is("garden_id", null).neq("site_type", "kindergarten"),
    (admin as any).from("digital_observer_entitlement_grants").select("id,observer_site_id,entitlement_key,grant_status,boolean_value,effective_until").in("id", input.entitlementGrantIds).in("observer_site_id", input.siteIds).eq("grant_status", "active")
  ]);
  if (sites.error || sites.data?.length !== new Set(input.siteIds).size) throw new Error("PARTNER_CUSTOMER_SITE_SCOPE_DENIED");
  if (grants.error || grants.data?.length !== new Set(input.entitlementGrantIds).size) throw new Error("PARTNER_CUSTOMER_ENTITLEMENT_DENIED");
  const customer = await (admin as any).from("digital_observer_partner_customers").upsert({ partner_id: input.partnerId,
    customer_organization_id: input.customerOrganizationId, external_customer_reference_hash: ref.hash, external_customer_reference_hint: ref.hint,
    idempotency_key: input.idempotencyKey, customer_status: "active", activated_at: new Date().toISOString(), created_by: input.actorId ?? null,
    metadata: { external_reference_stored: false, production_customer: false } }, { onConflict: "partner_id,customer_organization_id" })
    .select("id,customer_organization_id,external_customer_reference_hint,customer_status,activated_at").single();
  if (customer.error) throw new Error("PARTNER_CUSTOMER_CREATE_FAILED");
  const [siteLinks, entitlementLinks] = await Promise.all([
    (admin as any).from("digital_observer_partner_customer_sites").upsert(input.siteIds.map((siteId) => ({ partner_customer_id: customer.data.id, observer_site_id: siteId })), { onConflict: "partner_customer_id,observer_site_id" }),
    (admin as any).from("digital_observer_partner_customer_entitlements").upsert(input.entitlementGrantIds.map((grantId) => ({ partner_customer_id: customer.data.id, entitlement_grant_id: grantId, assigned_by: input.actorId ?? null })), { onConflict: "partner_customer_id,entitlement_grant_id" })
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
  const current = await (admin as any).from("digital_observer_partner_customers").select("id,customer_status").eq("id", input.customerId).eq("partner_id", input.partnerId).maybeSingle();
  if (!current.data) throw new Error("PARTNER_CUSTOMER_NOT_FOUND");
  partnerCustomerTransition(current.data.customer_status, input.status);
  const now = new Date().toISOString();
  const fields = input.status === "active" ? { customer_status: input.status, activated_at: now, suspended_at: null, suspension_reason: null }
    : input.status === "suspended" ? { customer_status: input.status, suspended_at: now, suspension_reason: input.reason }
      : { customer_status: input.status, deprovisioned_at: now, suspension_reason: input.reason };
  const changed = await (admin as any).from("digital_observer_partner_customers").update(fields).eq("id", input.customerId).eq("partner_id", input.partnerId).select("id,customer_status,activated_at,suspended_at,deprovisioned_at").single();
  if (changed.error) throw new Error("PARTNER_CUSTOMER_TRANSITION_FAILED");
  if (input.status !== "active") await (admin as any).from("digital_observer_embedded_sessions").update({ revoked_at: now, revocation_reason: input.reason }).eq("partner_customer_id", input.customerId).is("revoked_at", null);
  await audit(admin, { organizationId: input.organizationId, actorId: input.actorId, resourceType: "partner_customer", resourceId: input.customerId,
    action: `partner_customer.${input.status}`, correlationId: input.correlationId, metadata: { reason: input.reason.slice(0, 120) } });
  return changed.data;
}

export async function savePartnerBrand(admin: Admin, input: { partnerId: string; organizationId: string; actorId: string; actorRole: EnterpriseRole; brand: Record<string, unknown>; correlationId: string }) {
  assertPartnerRole(input.actorRole);
  const saved = await (admin as any).from("digital_observer_partner_brand_profiles").upsert({ partner_id: input.partnerId, ...input.brand,
    domain_status: "unverified", updated_by: input.actorId }, { onConflict: "partner_id" }).select("*").single();
  if (saved.error) throw new Error("PARTNER_BRAND_SAVE_FAILED");
  await audit(admin, { organizationId: input.organizationId, actorId: input.actorId, resourceType: "partner_brand", resourceId: input.partnerId,
    action: "partner_brand.update", correlationId: input.correlationId, metadata: { domain_verified: false } });
  return publicBrandProfile(saved.data);
}

export async function issuePartnerEmbeddedSession(admin: Admin, input: { partnerId: string; organizationId: string; actorId?: string; serviceAccountId?: string; actorRole: EnterpriseRole; customerId: string; siteId: string; audience: string; origin: string; scopes: EmbeddedScope[]; ttlMinutes: number; correlationId: string }) {
  assertDelegatedGrant({ actorRole: input.actorRole, requestedRole: "service_account" });
  const [partner, linked] = await Promise.all([
    (admin as any).from("digital_observer_partners").select("allowed_embed_origins,partner_status").eq("id", input.partnerId).eq("organization_id", input.organizationId).maybeSingle(),
    (admin as any).from("digital_observer_partner_customer_sites").select("partner_customer_id,observer_site_id,digital_observer_partner_customers!inner(customer_status,partner_id)").eq("partner_customer_id", input.customerId).eq("observer_site_id", input.siteId).eq("digital_observer_partner_customers.partner_id", input.partnerId).maybeSingle()
  ]);
  if (!partner.data || partner.data.partner_status !== "sandbox" || !linked.data || (linked.data as any).digital_observer_partner_customers.customer_status !== "active") throw new Error("PARTNER_EMBED_SCOPE_DENIED");
  const origin = validateEmbedOrigin(input.origin, partner.data.allowed_embed_origins ?? []);
  const token = issueEmbeddedToken({ pepper: pepper(), ttlMinutes: input.ttlMinutes });
  const session = await (admin as any).from("digital_observer_embedded_sessions").insert({ partner_id: input.partnerId,
    partner_customer_id: input.customerId, observer_site_id: input.siteId, token_hash: token.hash, token_prefix: token.prefix,
    audience: input.audience, allowed_origin: origin, scopes: input.scopes, expires_at: token.expiresAt,
    issued_by_profile_id: input.actorId ?? null, issued_by_service_account_id: input.serviceAccountId ?? null,
    metadata: { production: false, long_lived_secret: false } }).select("id,partner_customer_id,observer_site_id,audience,allowed_origin,scopes,expires_at").single();
  if (session.error) throw new Error("PARTNER_EMBED_SESSION_FAILED");
  await audit(admin, { organizationId: input.organizationId, actorId: input.actorId, serviceAccountId: input.serviceAccountId,
    resourceType: "embedded_session", resourceId: session.data.id, action: "embedded_session.issue", correlationId: input.correlationId,
    metadata: { ttl_minutes: input.ttlMinutes, scope_count: input.scopes.length, raw_token_stored: false } });
  return { session: session.data, token: token.raw, oneTimeSecret: true };
}

export async function linkPartnerServiceAccount(admin: Admin, input: { partnerId: string; organizationId: string; actorId: string; actorRole: EnterpriseRole; serviceAccountId: string; customerId?: string | null; correlationId: string }) {
  assertPartnerRole(input.actorRole);
  const account = await (admin as any).from("digital_observer_service_accounts").select("id,organization_id,account_status").eq("id", input.serviceAccountId).eq("organization_id", input.organizationId).eq("account_status", "active").maybeSingle();
  if (!account.data) throw new Error("PARTNER_SERVICE_ACCOUNT_DENIED");
  const mapping = await (admin as any).from("digital_observer_partner_service_accounts").upsert({ partner_id: input.partnerId,
    service_account_id: input.serviceAccountId, partner_customer_id: input.customerId ?? null,
    access_kind: input.customerId ? "customer_resources" : "partner_control" }, { onConflict: "service_account_id" })
    .select("partner_id,service_account_id,partner_customer_id,access_kind").single();
  if (mapping.error) throw new Error("PARTNER_SERVICE_ACCOUNT_LINK_FAILED");
  await audit(admin, { organizationId: input.organizationId, actorId: input.actorId, resourceType: "partner_service_account",
    resourceId: input.serviceAccountId, action: "partner_service_account.link", correlationId: input.correlationId,
    metadata: { access_kind: mapping.data.access_kind } });
  return mapping.data;
}

export async function authorizePartnerDelegatedSite(admin: Admin, input: { serviceAccountId: string; siteId: string }) {
  const mapping = await (admin as any).from("digital_observer_partner_service_accounts")
    .select("partner_customer_id,access_kind,digital_observer_partner_customers!inner(id,customer_status,partner_id,digital_observer_partners!inner(partner_status))")
    .eq("service_account_id", input.serviceAccountId).eq("access_kind", "customer_resources").maybeSingle();
  const customer = (mapping.data as any)?.digital_observer_partner_customers;
  if (!customer || customer.customer_status !== "active" || customer.digital_observer_partners.partner_status !== "sandbox") return false;
  const linked = await (admin as any).from("digital_observer_partner_customer_sites").select("observer_site_id")
    .eq("partner_customer_id", mapping.data.partner_customer_id).eq("observer_site_id", input.siteId).maybeSingle();
  return Boolean(linked.data);
}

export async function authenticateEmbeddedSession(admin: Admin, input: { token: string; origin: string | null; audience: string; requiredScope: EmbeddedScope }) {
  if (!input.token.startsWith("doemb_")) throw new Error("EMBEDDED_AUTH_REQUIRED");
  const result = await (admin as any).from("digital_observer_embedded_sessions")
    .select("id,partner_id,partner_customer_id,observer_site_id,audience,allowed_origin,scopes,expires_at,revoked_at,digital_observer_partner_customers!inner(customer_status),digital_observer_partners!inner(partner_status)")
    .eq("token_hash", hashEmbeddedToken(input.token, pepper())).maybeSingle();
  const row = result.data as any;
  if (!row || row.revoked_at || new Date(row.expires_at).getTime() <= Date.now()
    || row.digital_observer_partner_customers.customer_status !== "active" || row.digital_observer_partners.partner_status !== "sandbox") {
    throw new Error("EMBEDDED_SESSION_INACTIVE");
  }
  if (!verifyEmbeddedAudience({ expected: row.audience, actual: input.audience })) throw new Error("EMBEDDED_AUDIENCE_DENIED");
  if (!input.origin || new URL(input.origin).origin !== row.allowed_origin) throw new Error("EMBEDDED_ORIGIN_DENIED");
  if (!Array.isArray(row.scopes) || !row.scopes.includes(input.requiredScope)) throw new Error("EMBEDDED_SCOPE_DENIED");
  await (admin as any).from("digital_observer_embedded_sessions").update({ last_used_at: new Date().toISOString() }).eq("id", row.id);
  return row as { id: string; partner_id: string; partner_customer_id: string; observer_site_id: string; scopes: EmbeddedScope[]; expires_at: string };
}

export function partnerCorrelationId() { return randomUUID(); }
