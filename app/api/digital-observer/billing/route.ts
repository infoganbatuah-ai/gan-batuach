/* eslint-disable @typescript-eslint/no-explicit-any -- PUSH 40 tables precede generated Supabase types. */
import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { activateControlledTrial, cancelSubscription, createCheckoutIntent, requestRefund, runCommercialReconciliation, schedulePlanChange } from "@/lib/domain/digital-observer/commercial-billing-service";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";
const base = z.object({ observer_site_id: z.string().uuid() });
const schema = z.discriminatedUnion("action", [
  base.extend({ action: z.literal("checkout"), package_id: z.string().uuid(), billing_cycle: z.enum(["monthly", "annual"]), idempotency_key: z.string().min(12).max(160) }).strict(),
  base.extend({ action: z.literal("trial"), package_id: z.string().uuid(), duration_days: z.number().int().min(1).max(30).default(14) }).strict(),
  base.extend({ action: z.literal("change_plan"), package_id: z.string().uuid(), billing_cycle: z.enum(["monthly", "annual"]), idempotency_key: z.string().min(12).max(160) }).strict(),
  base.extend({ action: z.literal("cancel"), reason: z.string().trim().min(3).max(240), idempotency_key: z.string().min(12).max(160) }).strict(),
  base.extend({ action: z.literal("refund"), payment_event_id: z.string().uuid(), amount_minor: z.number().int().positive(), currency: z.string().regex(/^[A-Z]{3}$/), reason: z.string().trim().min(3).max(240), idempotency_key: z.string().min(12).max(160) }).strict(),
  base.extend({ action: z.literal("reconcile"), period_start: z.string().datetime(), period_end: z.string().datetime() }).strict()
]);

function billingError(error: unknown) {
  const message = error instanceof Error ? error.message : "BILLING_OPERATION_FAILED";
  if (message.includes("ENTITLEMENT_DENIED") || message.includes("DENIED")) return fail(message, 403);
  if (message.includes("NOT_OWNER_APPROVED") || message.includes("REQUIRED") || message.includes("INVALID")
    || message.includes("CONFLICT") || message.includes("NOT_ELIGIBLE") || message.includes("UNAVAILABLE")) return fail(message, 409);
  return null;
}

async function authorizePackage(admin: any, siteType: string, packageId: string) {
  const result = await admin.from("observer_monitoring_packages").select("id,package_type,active").eq("id", packageId).eq("active", true).maybeSingle();
  if (result.error || !result.data) throw new Error("PACKAGE_UNAVAILABLE");
  const expected = siteType === "home" ? ["home"] : ["business", "enterprise", "custom"];
  if (!expected.includes(result.data.package_type)) throw new Error("PACKAGE_NOT_ELIGIBLE_FOR_SITE");
}

export async function GET(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("Digital Observer authentication is required.", 401);
    const siteId = new URL(request.url).searchParams.get("observer_site_id");
    if (!siteId || !z.string().uuid().safeParse(siteId).success) return fail("A valid Site is required.", 400);
    const site = await getObserverSiteAccess(session.supabase, session.profile, siteId, { billing: true });
    if (!site) return fail("Billing access is unavailable for this Site.", 403);
    const supabase = session.supabase as any;
    const [subscription, entitlements, usage, invoices, checkouts, payments, refunds, changes] = await Promise.all([
      supabase.from("observer_site_subscriptions").select("id,package_id,commercial_state,subscription_status,billing_cycle,trial_start,trial_end,renewal_date,grace_period_ends_at,payment_provider_mode,provider_outcome,entitlement_snapshot,scheduled_change,updated_at").eq("observer_site_id", siteId).maybeSingle(),
      supabase.from("digital_observer_entitlement_grants").select("entitlement_key,limit_value,boolean_value,grant_status,effective_from,effective_until").eq("observer_site_id", siteId),
      supabase.from("digital_observer_commercial_usage_events").select("service,usage_category,quantity,unit,evidence_class,billing_period_start,billing_period_end,occurred_at").eq("observer_site_id", siteId).order("occurred_at", { ascending: false }).limit(100),
      supabase.from("observer_invoices").select("id,immutable_invoice_id,invoice_number,invoice_state,status,amount,currency,billing_cycle,tax_document_status,issued_at,due_at,paid_at,credited_amount_minor,credit_reference").eq("observer_site_id", siteId).order("created_at", { ascending: false }).limit(50),
      supabase.from("digital_observer_checkout_intents").select("id,stable_checkout_id,checkout_status,amount_minor,currency,provider_mode,provider_outcome,quote_expires_at,created_at").eq("observer_site_id", siteId).order("created_at", { ascending: false }).limit(20),
      supabase.from("digital_observer_payment_events").select("id,event_type,payment_outcome,amount_minor,currency,provider_mode,occurred_at,created_at").eq("observer_site_id", siteId).order("created_at", { ascending: false }).limit(50),
      supabase.from("digital_observer_refunds").select("id,refund_status,amount_minor,currency,safe_reason,created_at,updated_at").eq("observer_site_id", siteId).order("created_at", { ascending: false }).limit(20),
      supabase.from("observer_subscription_change_requests").select("id,change_type,status,effective_at,reason,created_at,updated_at").eq("observer_site_id", siteId).order("created_at", { ascending: false }).limit(20)
    ]);
    const firstError = [subscription, entitlements, usage, invoices, checkouts, payments, refunds, changes].find((item) => item.error)?.error;
    if (firstError) return fail("Billing history is temporarily unavailable.", 503);
    return ok({ site, subscription: subscription.data, entitlements: entitlements.data ?? [], usage: usage.data ?? [], invoices: invoices.data ?? [],
      checkouts: checkouts.data ?? [], payments: payments.data ?? [], refunds: refunds.data ?? [], changes: changes.data ?? [],
      providerMode: process.env.DIGITAL_OBSERVER_PAYMENT_PROVIDER_MODE === "sandbox" ? "sandbox" : "disabled", productionPaymentsEnabled: false });
  } catch (error) { return handleRouteError(error); }
}

export async function POST(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("Digital Observer authentication is required.", 401);
    const input = schema.parse(await request.json());
    const site = await getObserverSiteAccess(session.supabase, session.profile, input.observer_site_id, { billing: true });
    if (!site) return fail("Billing access is unavailable for this Site.", 403);
    if (!isAdminClientConfigured()) return fail("The billing service is not configured.", 503);
    const admin = createAdminClient() as any;
    if ("package_id" in input) await authorizePackage(admin, site.site_type, input.package_id);
    if (input.action === "reconcile") {
      const observerAdmin = session.profile.role === "admin" || session.user.app_metadata?.digital_observer_admin === true;
      if (!observerAdmin) return fail("Commercial reconciliation requires platform administration.", 403);
      const result = await runCommercialReconciliation(admin, { siteId: input.observer_site_id,
        providerKey: process.env.DIGITAL_OBSERVER_PAYMENT_PROVIDER_KEY || "disabled", periodStart: input.period_start, periodEnd: input.period_end });
      return ok(result, result.duplicate ? 200 : 201);
    }
    if (input.action === "checkout") {
      const result = await createCheckoutIntent(admin, { siteId: input.observer_site_id, actorId: session.profile.id, packageId: input.package_id, billingPeriod: input.billing_cycle, idempotencyKey: input.idempotency_key });
      return ok({ ...result, charged: false, productionPaymentEnabled: false }, result.duplicate ? 200 : 201);
    }
    if (input.action === "trial") {
      const subscription = await activateControlledTrial(admin, { siteId: input.observer_site_id, actorId: session.profile.id, packageId: input.package_id, durationDays: input.duration_days });
      return ok({ subscription, charged: false }, 201);
    }
    if (input.action === "change_plan") {
      const result = await schedulePlanChange(admin, { siteId: input.observer_site_id, actorId: session.profile.id, packageId: input.package_id, billingPeriod: input.billing_cycle, idempotencyKey: input.idempotency_key });
      return ok({ ...result, charged: false }, 201);
    }
    if (input.action === "cancel") {
      const requestResult = await cancelSubscription(admin, { siteId: input.observer_site_id, actorId: session.profile.id, reason: input.reason, idempotencyKey: input.idempotency_key });
      return ok({ request: requestResult, immediate: false }, 201);
    }
    const refundMembership = site.owner_profile_id === session.profile.id || session.profile.role === "admin"
      ? { member_role: "owner" }
      : (await (session.supabase as any).from("observer_site_memberships").select("member_role").eq("observer_site_id", input.observer_site_id)
        .eq("profile_id", session.profile.id).eq("active", true).in("member_role", ["owner", "admin"]).maybeSingle()).data;
    if (!refundMembership) return fail("Refund authorization requires a Site owner or administrator.", 403);
    const result = await requestRefund(admin, { siteId: input.observer_site_id, actorId: session.profile.id, paymentEventId: input.payment_event_id, amountMinor: input.amount_minor, currency: input.currency, reason: input.reason, idempotencyKey: input.idempotency_key });
    return ok({ ...result, completed: false, providerConfirmationRequired: true }, result.duplicate ? 200 : 201);
  } catch (error) {
    const response = billingError(error);
    return response ?? handleRouteError(error);
  }
}
