/* eslint-disable @typescript-eslint/no-explicit-any -- PUSH 39 tables precede generated Supabase database types. */
import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("acknowledge") }).strict(),
  z.object({ action: z.literal("cancel"), reason: z.string().trim().min(3).max(240) }).strict(),
  z.object({ action: z.literal("review_dead_letter"), reason: z.string().trim().min(3).max(240) }).strict()
]);

export async function POST(request: Request, context: { params: Promise<{ deliveryId: string }> }) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("Digital Observer authentication is required.", 401);
    const { deliveryId } = await context.params;
    const input = schema.parse(await request.json());
    const admin = createAdminClient() as any;
    const found = await admin.from("digital_observer_notification_deliveries").select("id,observer_site_id,recipient_profile_id,delivery_status,attempt_count,max_attempts,unknown_outcome_at,expires_at").eq("id", deliveryId).maybeSingle();
    if (!found.data) return fail("Delivery not found.", 404);
    const delivery = found.data;
    const site = await getObserverSiteAccess(session.supabase, session.profile, delivery.observer_site_id, { manage: input.action !== "acknowledge" });
    const recipientAck = input.action === "acknowledge" && delivery.recipient_profile_id === session.profile.id;
    if (!site && !recipientAck) return fail("The delivery is outside the authorized Site or recipient scope.", 403);
    const now = new Date().toISOString();
    if (input.action === "acknowledge") {
      if (["cancelled", "expired", "terminal_failure", "dead_letter"].includes(delivery.delivery_status)) return fail("A terminal delivery cannot be acknowledged.", 409);
      const update = await admin.from("digital_observer_notification_deliveries").update({ delivery_status: "acknowledged", acknowledged_at: now,
        acknowledged_by: session.profile.id, terminal_at: now, updated_at: now }).eq("id", delivery.id)
        .not("delivery_status", "in", '(cancelled,expired,terminal_failure,dead_letter)').select("id,delivery_status,acknowledged_at").maybeSingle();
      await admin.from("digital_observer_escalations").update({ escalation_status: "acknowledged", acknowledged_at: now,
        acknowledged_by: session.profile.id, updated_at: now }).eq("primary_delivery_id", delivery.id).in("escalation_status", ["pending", "active", "escalated"]);
      return update.data ? ok({ delivery: update.data }) : fail("The delivery changed before acknowledgement.", 409);
    }
    if (input.action === "cancel") {
      if (["acknowledged", "cancelled", "expired"].includes(delivery.delivery_status)) return fail("The delivery is already terminal.", 409);
      const update = await admin.from("digital_observer_notification_deliveries").update({ delivery_status: "cancelled", cancelled_at: now,
        terminal_at: now, updated_at: now, failure_reason: input.reason }).eq("id", delivery.id).select("id,delivery_status").single();
      return ok({ delivery: update.data });
    }
    if (delivery.unknown_outcome_at) return fail("Unknown physical/provider outcomes require reconciliation and cannot be resent.", 423);
    if (!["dead_letter", "terminal_failure"].includes(delivery.delivery_status)) return fail("Only a reviewed terminal failure can return to the queue.", 409);
    if (delivery.max_attempts >= 10 || Date.parse(delivery.expires_at) <= Date.now()) return fail("The retry or expiry bound has been reached.", 409);
    const update = await admin.from("digital_observer_notification_deliveries").update({ delivery_status: "queued",
      max_attempts: delivery.max_attempts + 1, next_retry_at: now, terminal_at: null, dead_lettered_at: null,
      updated_at: now, failure_reason: `operator_review:${input.reason}` }).eq("id", delivery.id)
      .in("delivery_status", ["dead_letter", "terminal_failure"]).select("id,delivery_status,attempt_count,max_attempts").maybeSingle();
    return update.data ? ok({ delivery: update.data, automatically_dispatched: false }) : fail("The delivery changed before review.", 409);
  } catch (error) { return handleRouteError(error); }
}
