/* eslint-disable @typescript-eslint/no-explicit-any -- PUSH 43 rows precede generated Supabase types. */
import { NextResponse } from "next/server";
import { z } from "zod";
import { embeddedScopes, partnerProvisioningSchema } from "@/lib/domain/digital-observer/partner-platform";
import { issuePartnerEmbeddedSession, partnerCorrelationId, partnerState, provisionPartnerCustomer } from "@/lib/domain/digital-observer/partner-platform-service";
import { authenticateExternalApiRequest, completeExternalApiReceipt, externalApiMeta } from "@/lib/domain/digital-observer/external-api-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ segments: string[] }> };
const embedded = z.object({ partner_customer_id: z.string().uuid(), site_id: z.string().uuid(), audience: z.string().trim().min(3).max(200),
  allowed_origin: z.string().url().max(1000), scopes: z.array(z.enum(embeddedScopes)).min(1).max(embeddedScopes.length), ttl_minutes: z.number().int().min(1).max(60).default(15) }).strict();

function json(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } }); }
function code(error: unknown) {
  const message = error instanceof Error ? error.message : "PARTNER_API_FAILED";
  return [/AUTH|CREDENTIAL/.test(message) ? 401 : /DENIED|SCOPE/.test(message) ? 403 : /CONFLICT/.test(message) ? 409 : 400, message] as const;
}
async function partnerActor(admin: any, serviceAccountId: string, organizationId: string) {
  const mapping = await admin.from("digital_observer_partner_service_accounts")
    .select("partner_id,access_kind,digital_observer_partners!inner(id,organization_id,partner_status)")
    .eq("service_account_id", serviceAccountId).eq("access_kind", "partner_control").maybeSingle();
  const partner = mapping.data?.digital_observer_partners;
  if (!mapping.data || !partner || partner.organization_id !== organizationId || partner.partner_status !== "sandbox") throw new Error("PARTNER_CONTROL_SCOPE_DENIED");
  return { partnerId: mapping.data.partner_id as string };
}

async function dispatch(request: Request, context: Context) {
  const body = request.method === "GET" ? "" : await request.text();
  const { admin, actor } = await authenticateExternalApiRequest(request, body);
  const { partnerId } = await partnerActor(admin as any, actor.serviceAccountId, actor.organizationId);
  const path = (await context.params).segments.join("/");
  if (request.method === "GET" && path === "profile") {
    const state = await partnerState(admin, actor.organizationId); await completeExternalApiReceipt(admin, actor, { status: 200 });
    return json({ partner: state.partner, brand: state.brand, external_proof: state.externalProof, ...externalApiMeta(actor) });
  }
  if (request.method === "GET" && path === "customers") {
    const state = await partnerState(admin, actor.organizationId); await completeExternalApiReceipt(admin, actor, { status: 200 });
    return json({ data: state.customers, pagination: { next_cursor: null }, ...externalApiMeta(actor) });
  }
  if (request.method === "POST" && path === "customers") {
    const input = partnerProvisioningSchema.parse(JSON.parse(body));
    const result = await provisionPartnerCustomer(admin, { partnerId, organizationId: actor.organizationId, serviceAccountId: actor.serviceAccountId,
      actorRole: "organization_admin", customerOrganizationId: input.customer_organization_id, externalReference: input.external_customer_reference,
      siteIds: input.site_ids, entitlementGrantIds: input.entitlement_grant_ids, idempotencyKey: input.idempotency_key, correlationId: partnerCorrelationId() });
    await completeExternalApiReceipt(admin, actor, { status: 201 }); return json({ ...result, ...externalApiMeta(actor) }, 201);
  }
  if (request.method === "POST" && path === "embedded-sessions") {
    const input = embedded.parse(JSON.parse(body));
    const result = await issuePartnerEmbeddedSession(admin, { partnerId, organizationId: actor.organizationId, serviceAccountId: actor.serviceAccountId,
      actorRole: "organization_admin", customerId: input.partner_customer_id, siteId: input.site_id, audience: input.audience,
      origin: input.allowed_origin, scopes: input.scopes, ttlMinutes: input.ttl_minutes, correlationId: partnerCorrelationId() });
    await completeExternalApiReceipt(admin, actor, { status: 201 }); return json({ ...result, ...externalApiMeta(actor) }, 201);
  }
  await completeExternalApiReceipt(admin, actor, { status: 404, failed: true }); return json({ error: { code: "PARTNER_API_ROUTE_NOT_FOUND" } }, 404);
}

async function handle(request: Request, context: Context) {
  try { return await dispatch(request, context); }
  catch (error) { const [status, message] = code(error); return json({ error: { code: message } }, status); }
}
export const GET = handle;
export const POST = handle;
