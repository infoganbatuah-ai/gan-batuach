/* eslint-disable @typescript-eslint/no-explicit-any -- PUSH 39 tables precede generated Supabase database types. */
import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { nextEscalationStep } from "@/lib/domain/digital-observer/notification-orchestration";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("advance") }).strict(),
  z.object({ action: z.literal("cancel"), reason: z.string().trim().min(3).max(240) }).strict(),
  z.object({ action: z.literal("close"), reason: z.string().trim().min(3).max(240) }).strict()
]);

export async function POST(request: Request, context: { params: Promise<{ escalationId: string }> }) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("Digital Observer authentication is required.", 401);
    const { escalationId } = await context.params;
    const input = schema.parse(await request.json());
    const admin = createAdminClient() as any;
    const found = await admin.from("digital_observer_escalations").select("id,observer_site_id,escalation_status,current_step,max_steps,acknowledgement_deadline,acknowledged_at").eq("id", escalationId).maybeSingle();
    if (!found.data) return fail("Escalation not found.", 404);
    const escalation = found.data;
    if (!await getObserverSiteAccess(session.supabase, session.profile, escalation.observer_site_id, { manage: true })) return fail("The escalation is outside the authorized Site.", 403);
    const now = new Date();
    if (input.action !== "advance") {
      if (["acknowledged", "cancelled", "closed", "expired"].includes(escalation.escalation_status)) return fail("The escalation is already terminal.", 409);
      const status = input.action === "cancel" ? "cancelled" : "closed";
      const update = await admin.from("digital_observer_escalations").update({ escalation_status: status,
        cancellation_reason: input.action === "cancel" ? input.reason : null, closure_reason: input.action === "close" ? input.reason : null,
        closed_at: now.toISOString(), updated_at: now.toISOString() }).eq("id", escalation.id).select("id,escalation_status,closed_at").single();
      await admin.from("digital_observer_escalation_steps").update({ step_status: "cancelled", completed_at: now.toISOString() }).eq("escalation_id", escalation.id).in("step_status", ["pending", "active"]);
      return ok({ escalation: update.data });
    }
    const next = nextEscalationStep({ currentStep: escalation.current_step, maxSteps: escalation.max_steps,
      status: escalation.escalation_status, acknowledged: Boolean(escalation.acknowledged_at), now,
      acknowledgementDeadline: escalation.current_step === 0 ? null : escalation.acknowledgement_deadline });
    if (!next.activate) return ok({ escalation: { ...escalation, escalation_status: next.status }, activated: false });
    const step = await admin.from("digital_observer_escalation_steps").select("id,recipient_profile_id,channel,delay_seconds,step_status").eq("escalation_id", escalation.id).eq("step_number", next.nextStep).eq("step_status", "pending").maybeSingle();
    if (!step.data) return fail("The next escalation step is unavailable.", 409);
    const activateAt = new Date(now.getTime() + step.data.delay_seconds * 1000).toISOString();
    const deadline = new Date(Date.parse(activateAt) + 15 * 60_000).toISOString();
    const updated = await admin.from("digital_observer_escalations").update({ escalation_status: next.status,
      current_step: next.nextStep, acknowledgement_deadline: deadline, updated_at: now.toISOString() })
      .eq("id", escalation.id).eq("current_step", escalation.current_step).select("id,escalation_status,current_step,max_steps,acknowledgement_deadline").maybeSingle();
    if (!updated.data) return fail("Another worker advanced this escalation.", 409);
    await admin.from("digital_observer_escalation_steps").update({ step_status: "active", activated_at: activateAt }).eq("id", step.data.id).eq("step_status", "pending");
    return ok({ escalation: updated.data, active_step: { ...step.data, activated_at: activateAt }, delivery_queued: false,
      message: "The step is active. Recipient authorization must be revalidated when its delivery is queued." });
  } catch (error) { return handleRouteError(error); }
}
