/* eslint-disable @typescript-eslint/no-explicit-any -- PUSH 39 tables precede generated Supabase database types. */
import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm"), confirmation_text: z.literal("CONFIRM") }).strict(),
  z.object({ action: z.literal("cancel"), reason: z.string().trim().min(3).max(240) }).strict()
]);

export async function POST(request: Request, context: { params: Promise<{ intentId: string }> }) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("Digital Observer authentication is required.", 401);
    const { intentId } = await context.params;
    const input = schema.parse(await request.json());
    const admin = createAdminClient() as any;
    const result = await admin.from("digital_observer_action_intents").select("id,observer_site_id,requested_by,intent_status,human_confirmation_required,lawful_use_approval_required,policy_snapshot,expires_at").eq("id", intentId).maybeSingle();
    if (!result.data) return fail("Action intent not found.", 404);
    const intent = result.data;
    const site = await getObserverSiteAccess(session.supabase, session.profile, intent.observer_site_id, { manage: true });
    if (!site) return fail("The action intent is outside the authorized Site.", 403);
    if (input.action === "cancel") {
      if (["succeeded", "failed", "unknown_outcome", "cancelled", "expired", "closed"].includes(intent.intent_status)) return fail("The action intent is already terminal.", 409);
      const now = new Date().toISOString();
      const update = await admin.from("digital_observer_action_intents").update({ intent_status: "cancelled", cancelled_at: now, updated_at: now }).eq("id", intent.id).eq("observer_site_id", intent.observer_site_id).select("id,intent_status").single();
      await admin.from("digital_observer_action_audit").insert({ observer_site_id: intent.observer_site_id, action_intent_id: intent.id,
        actor_profile_id: session.profile.id, event_type: "action_intent_cancelled", result_status: "cancelled", reason_code: "human_cancelled", safe_metadata: { reason: input.reason } });
      return ok({ intent: update.data, executed: false });
    }
    if (intent.expires_at && Date.parse(intent.expires_at) <= Date.now()) return fail("The action intent expired.", 410);
    if (intent.lawful_use_approval_required && typeof intent.policy_snapshot?.lawful_approval_reference !== "string") {
      await admin.from("digital_observer_action_audit").insert({ observer_site_id: intent.observer_site_id, action_intent_id: intent.id,
        actor_profile_id: session.profile.id, event_type: "action_confirmation_denied", result_status: "denied", reason_code: "push45_lawful_use_approval_required" });
      return fail("Lawful-use approval is required before this sensitive action can be confirmed.", 409);
    }
    if (!["proposed", "awaiting_confirmation"].includes(intent.intent_status)) return fail("The action intent cannot be confirmed in its current state.", 409);
    const now = new Date().toISOString();
    const update = await admin.from("digital_observer_action_intents").update({ intent_status: "authorized", authorized_by: session.profile.id,
      confirmed_by: session.profile.id, human_confirmed_at: now, updated_at: now }).eq("id", intent.id).eq("observer_site_id", intent.observer_site_id)
      .in("intent_status", ["proposed", "awaiting_confirmation"]).select("id,intent_status,human_confirmed_at").maybeSingle();
    if (!update.data) return fail("The confirmation was already consumed or the intent changed.", 409);
    await admin.from("digital_observer_action_audit").insert({ observer_site_id: intent.observer_site_id, action_intent_id: intent.id,
      actor_profile_id: session.profile.id, event_type: "action_confirmed", result_status: "allowed", reason_code: "explicit_human_confirmation" });
    return ok({ intent: update.data, executed: false, message: "The intent is authorized; downstream capability and delivery policy still apply." });
  } catch (error) { return handleRouteError(error); }
}
