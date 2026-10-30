/* eslint-disable @typescript-eslint/no-explicit-any -- PUSH 39 tables precede generated Supabase database types. */
import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { loadRecipientAuthorization } from "@/lib/domain/digital-observer/notification-delivery-service";
import { createAdminClient } from "@/lib/supabase/admin";

const step = z.object({ recipient_profile_id: z.string().uuid(), channel: z.enum(["in_app", "push", "email", "sms", "whatsapp", "webhook", "phone"]), delay_seconds: z.number().int().min(0).max(86400) }).strict();
const schema = z.object({ observer_site_id: z.string().uuid(), action_intent_id: z.string().uuid(), acknowledgement_timeout_seconds: z.number().int().min(60).max(86400), steps: z.array(step).min(1).max(10) }).strict();

export async function GET(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("Digital Observer authentication is required.", 401);
    const siteId = new URL(request.url).searchParams.get("observer_site_id");
    if (!siteId || !z.string().uuid().safeParse(siteId).success) return fail("A valid Site is required.", 400);
    if (!await getObserverSiteAccess(session.supabase, session.profile, siteId)) return fail("The Site is unavailable.", 403);
    const data = await session.supabase.from("digital_observer_escalations" as any).select("id,action_intent_id,primary_delivery_id,operator_profile_id,escalation_status,current_step,acknowledgement_deadline,acknowledged_at,max_steps,created_at,closed_at").eq("observer_site_id", siteId).order("created_at", { ascending: false }).limit(100);
    if (data.error) return fail("Escalation history is unavailable.", 503);
    return ok({ escalations: data.data ?? [] });
  } catch (error) { return handleRouteError(error); }
}

export async function POST(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("Digital Observer authentication is required.", 401);
    const input = schema.parse(await request.json());
    if (!await getObserverSiteAccess(session.supabase, session.profile, input.observer_site_id, { manage: true })) return fail("The Site is unavailable or not manageable by this user.", 403);
    const uniqueSteps = new Set(input.steps.map((item) => `${item.recipient_profile_id}:${item.channel}`));
    if (uniqueSteps.size !== input.steps.length) return fail("An escalation chain cannot repeat the same recipient and channel.", 422);
    const admin = createAdminClient() as any;
    const intent = await admin.from("digital_observer_action_intents").select("id,observer_site_id,intent_status,human_confirmation_required,human_confirmed_at,lawful_use_approval_required,policy_snapshot").eq("id", input.action_intent_id).eq("observer_site_id", input.observer_site_id).maybeSingle();
    if (!intent.data || !["authorized", "queued", "executing"].includes(intent.data.intent_status)) return fail("The action intent is not authorized for escalation.", 409);
    if (intent.data.human_confirmation_required && !intent.data.human_confirmed_at) return fail("Human confirmation is required.", 409);
    if (intent.data.lawful_use_approval_required && typeof intent.data.policy_snapshot?.lawful_approval_reference !== "string") return fail("Lawful-use approval is required for this escalation.", 409);
    for (const candidate of input.steps) {
      const authorization = await loadRecipientAuthorization(admin, { siteId: input.observer_site_id, profileId: candidate.recipient_profile_id, channel: candidate.channel });
      if (!authorization?.authorization.activeMembership || authorization.authorization.revoked) return fail("Every escalation recipient must be active and authorized at creation time.", 403);
    }
    const deadline = new Date(Date.now() + input.acknowledgement_timeout_seconds * 1000).toISOString();
    const escalation = await admin.from("digital_observer_escalations").upsert({ observer_site_id: input.observer_site_id,
      action_intent_id: input.action_intent_id, operator_profile_id: session.profile.id, escalation_status: "pending",
      current_step: 0, acknowledgement_deadline: deadline, max_steps: input.steps.length },
    { onConflict: "action_intent_id", ignoreDuplicates: true }).select("id,escalation_status,current_step,max_steps,acknowledgement_deadline").maybeSingle();
    if (escalation.error) return fail("The escalation could not be created.", 503);
    const row = escalation.data ?? (await admin.from("digital_observer_escalations").select("id,escalation_status,current_step,max_steps,acknowledgement_deadline").eq("action_intent_id", input.action_intent_id).single()).data;
    const steps = input.steps.map((candidate, index) => ({ escalation_id: row.id, observer_site_id: input.observer_site_id,
      step_number: index + 1, recipient_profile_id: candidate.recipient_profile_id, channel: candidate.channel,
      delay_seconds: candidate.delay_seconds, step_status: "pending" }));
    const insertSteps = await admin.from("digital_observer_escalation_steps").upsert(steps, { onConflict: "escalation_id,step_number", ignoreDuplicates: true });
    if (insertSteps.error) {
      await admin.from("digital_observer_escalations").update({ escalation_status: "failed", updated_at: new Date().toISOString() }).eq("id", row.id);
      return fail("The escalation steps could not be preserved.", 503);
    }
    return ok({ escalation: row, activated: false, external_action_taken: false }, 201);
  } catch (error) { return handleRouteError(error); }
}
