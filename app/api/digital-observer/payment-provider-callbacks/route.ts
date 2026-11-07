import { createHash } from "node:crypto";
import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { verifyPaymentWebhook } from "@/lib/domain/digital-observer/commercial-billing";
import { applyAuthenticatedPaymentEvent } from "@/lib/domain/digital-observer/commercial-billing-service";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";
const schema = z.object({
  event_type: z.enum(["checkout.payment_confirmed", "checkout.payment_failed", "checkout.payment_unknown", "payment.refunded", "payment.cancelled",
    "subscription.payment_failed", "subscription.grace_period_started", "subscription.payment_recovered", "subscription.payment_unknown", "subscription.cancelled"]),
  checkout_stable_id: z.string().min(32).max(128),
  outcome: z.enum(["confirmed", "failed", "unknown", "refunded", "cancelled"]),
  amount_minor: z.number().int().nonnegative().nullable().optional(),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable().optional(),
  refund_stable_id: z.string().length(64).nullable().optional(),
  occurred_at: z.string().datetime().nullable().optional()
}).strict();

export async function POST(request: Request) {
  try {
    if (process.env.DIGITAL_OBSERVER_PAYMENT_PROVIDER_MODE !== "sandbox") return fail("Payment provider callbacks are disabled.", 503);
    if (!isAdminClientConfigured()) return fail("Payment callback storage is unavailable.", 503);
    const secret = process.env.DIGITAL_OBSERVER_PAYMENT_WEBHOOK_SECRET;
    if (!secret) return fail("Payment callback verification is unavailable.", 503);
    const body = await request.text();
    const timestamp = Number(request.headers.get("x-do-payment-timestamp"));
    const providerEventId = request.headers.get("x-do-payment-event-id") || "";
    const signature = request.headers.get("x-do-payment-signature") || "";
    const providerKey = request.headers.get("x-do-payment-provider") || "deterministic-sandbox";
    const configuredProviderKey = process.env.DIGITAL_OBSERVER_PAYMENT_PROVIDER_KEY || "deterministic-sandbox";
    if (!Number.isInteger(timestamp) || !providerEventId || !signature) return fail("Payment callback authentication is incomplete.", 401);
    if (providerKey !== configuredProviderKey) return fail("Payment callback provider is not authorized.", 401);
    const verified = verifyPaymentWebhook({ body, timestamp, providerEventId, signature, secret });
    if (!verified.valid) return fail(`Payment callback rejected: ${verified.reason}.`, 401);
    const payload = schema.parse(JSON.parse(body));
    const expectedOutcome = {
      "checkout.payment_confirmed": "confirmed", "checkout.payment_failed": "failed", "checkout.payment_unknown": "unknown",
      "payment.refunded": "refunded", "payment.cancelled": "cancelled", "subscription.payment_failed": "failed",
      "subscription.grace_period_started": "failed", "subscription.payment_recovered": "confirmed",
      "subscription.payment_unknown": "unknown", "subscription.cancelled": "cancelled"
    }[payload.event_type];
    if (payload.outcome !== expectedOutcome) return fail("Payment callback event/outcome mismatch.", 422);
    if (payload.event_type === "payment.refunded" && !payload.refund_stable_id) return fail("Refund callback requires the stable refund identity.", 422);
    if (["checkout.payment_confirmed", "payment.refunded"].includes(payload.event_type) && (payload.amount_minor == null || payload.currency == null)) {
      return fail("Confirmed payment and refund callbacks require amount and currency.", 422);
    }
    const result = await applyAuthenticatedPaymentEvent(createAdminClient(), {
      providerKey, providerMode: "sandbox", providerEventId, eventType: payload.event_type,
      checkoutStableId: payload.checkout_stable_id, outcome: payload.outcome,
      amountMinor: payload.amount_minor, currency: payload.currency, occurredAt: payload.occurred_at,
      refundStableId: payload.refund_stable_id,
      bodyDigest: createHash("sha256").update(body).digest("hex")
    });
    return ok(result, result.duplicate ? 200 : 201);
  } catch (error) {
    if (error instanceof Error && ["CHECKOUT_INTENT_NOT_FOUND", "VERIFIED_PLAN_UNAVAILABLE"].includes(error.message)) return fail(error.message, 409);
    return handleRouteError(error);
  }
}
