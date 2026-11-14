import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser } from "@/lib/domain/digital-observer/access";
import { resolveEnterpriseActor } from "@/lib/domain/digital-observer/enterprise-identity-service";
import { brandProfileSchema, embeddedScopes, partnerProvisioningSchema, partnerTypes } from "@/lib/domain/digital-observer/partner-platform";
import { configurePartner, issuePartnerEmbeddedSession, linkPartnerServiceAccount, partnerCorrelationId, partnerState, provisionPartnerCustomer, savePartnerBrand, transitionPartnerCustomer } from "@/lib/domain/digital-observer/partner-platform-service";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";
const org = z.string().uuid();
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("configure_partner"), organization_id: org, partner_key: z.string().regex(/^[a-z0-9][a-z0-9_-]{1,63}$/),
    partner_type: z.enum(partnerTypes), billing_account_id: z.string().uuid().nullable().optional(), sso_connection_id: z.string().uuid().nullable().optional(),
    allowed_origins: z.array(z.string().url().max(1000)).max(20).default([]) }).strict(),
  z.object({ action: z.literal("provision_customer"), organization_id: org, partner_id: z.string().uuid() }).extend(partnerProvisioningSchema.shape).strict(),
  z.object({ action: z.literal("transition_customer"), organization_id: org, partner_id: z.string().uuid(), customer_id: z.string().uuid(),
    status: z.enum(["active", "suspended", "deprovisioned"]), reason: z.string().trim().min(3).max(160) }).strict(),
  z.object({ action: z.literal("save_brand"), organization_id: org, partner_id: z.string().uuid(), brand: brandProfileSchema }).strict(),
  z.object({ action: z.literal("link_service_account"), organization_id: org, partner_id: z.string().uuid(), service_account_id: z.string().uuid(), customer_id: z.string().uuid().nullable().optional() }).strict(),
  z.object({ action: z.literal("issue_embedded_session"), organization_id: org, partner_id: z.string().uuid(), partner_customer_id: z.string().uuid(),
    site_id: z.string().uuid(), audience: z.string().trim().min(3).max(200), allowed_origin: z.string().url().max(1000),
    scopes: z.array(z.enum(embeddedScopes)).min(1).max(embeddedScopes.length), ttl_minutes: z.number().int().min(1).max(60).default(15) }).strict()
]);
function isPlatformAdmin(session: NonNullable<Awaited<ReturnType<typeof getDigitalObserverApiUser>>>) {
  return session.profile.role === "admin" || session.user.app_metadata?.digital_observer_admin === true;
}
function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "PARTNER_OPERATION_FAILED";
  if (/DENIED|SCOPE|INELIGIBLE|UNAUTHORIZED/.test(message)) return fail(message, 403);
  if (/CONFLICT|NOT_FOUND|REQUIRED|INVALID|FAILED|UNAVAILABLE/.test(message)) return fail(message, 409);
  return handleRouteError(error);
}

export async function GET(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("Digital Observer authentication is required.", 401);
    if (!isAdminClientConfigured()) return fail("Partner platform is not configured.", 503);
    const organizationId = new URL(request.url).searchParams.get("organization_id");
    if (!organizationId || !org.safeParse(organizationId).success) return fail("A valid organization is required.", 400);
    const admin = createAdminClient();
    const actor = await resolveEnterpriseActor(admin, { organizationId, profileId: session.profile.id, platformAdmin: isPlatformAdmin(session) });
    return ok({ ...(await partnerState(admin, organizationId)), actor, contract: "digital-observer-partner-v1",
      zeroInstallFirst: true, gatewayRequiredByDefault: false, productionActivated: false });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("Digital Observer authentication is required.", 401);
    if (!isAdminClientConfigured()) return fail("Partner platform is not configured.", 503);
    const input = schema.parse(await request.json());
    const admin = createAdminClient();
    const actor = await resolveEnterpriseActor(admin, { organizationId: input.organization_id, profileId: session.profile.id, platformAdmin: isPlatformAdmin(session) });
    const common = { organizationId: input.organization_id, actorId: session.profile.id, actorRole: actor.role, correlationId: partnerCorrelationId() };
    if (input.action === "configure_partner") return ok(await configurePartner(admin, { ...common, partnerKey: input.partner_key,
      partnerType: input.partner_type, billingAccountId: input.billing_account_id, ssoConnectionId: input.sso_connection_id, allowedOrigins: input.allowed_origins }), 201);
    if (input.action === "provision_customer") return ok(await provisionPartnerCustomer(admin, { ...common, partnerId: input.partner_id,
      customerOrganizationId: input.customer_organization_id, externalReference: input.external_customer_reference,
      siteIds: input.site_ids, entitlementGrantIds: input.entitlement_grant_ids, idempotencyKey: input.idempotency_key }), 201);
    if (input.action === "transition_customer") return ok(await transitionPartnerCustomer(admin, { ...common, partnerId: input.partner_id,
      customerId: input.customer_id, status: input.status, reason: input.reason }));
    if (input.action === "save_brand") return ok(await savePartnerBrand(admin, { ...common, partnerId: input.partner_id, brand: input.brand }));
    if (input.action === "link_service_account") return ok(await linkPartnerServiceAccount(admin, { ...common, partnerId: input.partner_id,
      serviceAccountId: input.service_account_id, customerId: input.customer_id }));
    return ok(await issuePartnerEmbeddedSession(admin, { ...common, partnerId: input.partner_id, customerId: input.partner_customer_id,
      siteId: input.site_id, audience: input.audience, origin: input.allowed_origin, scopes: input.scopes, ttlMinutes: input.ttl_minutes }), 201);
  } catch (error) { return errorResponse(error); }
}
