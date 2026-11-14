/* eslint-disable @typescript-eslint/no-explicit-any -- PUSH 39 tables precede generated Supabase database types. */
import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { actionIntentDraft, compileNaturalLanguageAction } from "@/lib/domain/digital-observer/notification-orchestration";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("natural_language_proposal"), observer_site_id: z.string().uuid(), instruction: z.string().trim().min(1).max(500), request_id: z.string().uuid() }).strict(),
  z.object({ kind: z.literal("decision_authorization"), observer_site_id: z.string().uuid(), decision_intent_id: z.string().uuid(), action_type: z.enum(["notify", "phone_escalation"]), request_id: z.string().uuid(), severity: z.enum(["info", "low", "medium", "high", "critical"]) }).strict(),
  z.object({ kind: z.literal("watch_rule_authorization"), observer_site_id: z.string().uuid(), watch_rule_id: z.string().uuid(), signal_id: z.string().uuid(), request_id: z.string().uuid(), severity: z.enum(["info", "low", "medium", "high", "critical"]) }).strict(),
  z.object({ kind: z.literal("manual_notification"), observer_site_id: z.string().uuid(), request_id: z.string().uuid(), severity: z.enum(["info", "low", "medium", "high", "critical"]) }).strict()
]);

export async function POST(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("Digital Observer authentication is required.", 401);
    const input = schema.parse(await request.json());
    const site = await getObserverSiteAccess(session.supabase, session.profile, input.observer_site_id, { manage: true });
    if (!site) return fail("The Site is unavailable or not manageable by this user.", 403);
    const admin = createAdminClient() as any;

    if (input.kind === "natural_language_proposal") {
      const proposal = compileNaturalLanguageAction(input.instruction);
      const draft = actionIntentDraft({ siteId: input.observer_site_id, sourceId: input.request_id,
        sourceProvenance: "HUMAN_AUTHORIZED", actionType: proposal.actionType, requestedBy: session.profile.id,
        severity: proposal.actionType === "phone_escalation" ? "critical" : "medium", proposedAction: proposal.parameters,
        emergency: proposal.actionType === "phone_escalation" });
      const insert = await admin.from("digital_observer_action_intents").upsert({ ...draft,
        policy_snapshot: { instruction_retained: false, structured_by: "do-action-language-v1", execution_authorized: false } },
      { onConflict: "observer_site_id,idempotency_key", ignoreDuplicates: true }).select("id,intent_status,action_type,human_confirmation_required,lawful_use_approval_required,created_at").maybeSingle();
      if (insert.error) return fail("The proposed action could not be recorded.", 503);
      const intent = insert.data ?? (await admin.from("digital_observer_action_intents").select("id,intent_status,action_type,human_confirmation_required,lawful_use_approval_required,created_at").eq("observer_site_id", input.observer_site_id).eq("idempotency_key", draft.idempotency_key).single()).data;
      return ok({ intent, proposal, executed: false, confirmation_required: true,
        message: "The request was converted into a structured proposal only. Authorization and confirmation remain required." }, 201);
    }

    let incidentId: string | null = null;
    let decisionIntentId: string | null = null;
    let actionType = "notify";
    const severity = input.severity;
    if (input.kind === "decision_authorization") {
      const decision = await admin.from("digital_observer_decision_intents")
        .select("id,observer_site_id,incident_id,decision,status,requires_human_review,external_execution_enabled")
        .eq("id", input.decision_intent_id).eq("observer_site_id", input.observer_site_id).maybeSingle();
      if (!decision.data || !["NOTIFY_IN_APP", "ESCALATION_CANDIDATE"].includes(decision.data.decision)) return fail("The canonical Decision is not eligible for notification orchestration.", 409);
      incidentId = decision.data.incident_id;
      decisionIntentId = decision.data.id;
      actionType = input.action_type;
    }
    let signalId: string | null = null;
    let sourceProvenance = "HUMAN_AUTHORIZED";
    if (input.kind === "watch_rule_authorization") {
      const [rule, signal] = await Promise.all([
        admin.from("observer_watch_requests").select("id,observer_site_id,active,requires_human_review,validation_status,confirmed_at,rule_state").eq("id", input.watch_rule_id).eq("observer_site_id", input.observer_site_id).maybeSingle(),
        admin.from("observer_intelligence_signals").select("id,observer_site_id,source_type,metadata").eq("id", input.signal_id).eq("observer_site_id", input.observer_site_id).maybeSingle()
      ]);
      const provenance = signal.data?.metadata?.provenance ?? signal.data?.source_type;
      if (!rule.data || rule.data.active !== true || !rule.data.confirmed_at || rule.data.validation_status !== "VALID" || rule.data.rule_state !== "ACTIVE"
        || !signal.data || provenance !== "REAL_CAMERA_AI") return fail("Only a confirmed Watch Rule matched to a real validated signal may propose an action.", 409);
      signalId = signal.data.id;
      sourceProvenance = "WATCH_RULE_REVIEWED";
    }
    const draft = actionIntentDraft({ siteId: input.observer_site_id, sourceId: input.request_id,
      sourceProvenance, actionType, requestedBy: session.profile.id,
      severity, proposedAction: { source: input.kind, decision_intent_id: decisionIntentId }, emergency: actionType === "phone_escalation" });
    const directlyAuthorized = !draft.human_confirmation_required && !draft.lawful_use_approval_required;
    const insert = await admin.from("digital_observer_action_intents").upsert({ ...draft,
      incident_id: incidentId, decision_intent_id: decisionIntentId,
      signal_id: signalId,
      authorized_by: directlyAuthorized ? session.profile.id : null,
      intent_status: directlyAuthorized ? "authorized" : draft.intent_status,
      policy_snapshot: { canonical_decision_reused: Boolean(decisionIntentId), production_provider_activation_authorized: false } },
    { onConflict: "observer_site_id,idempotency_key", ignoreDuplicates: true }).select("id,intent_status,action_type,human_confirmation_required,lawful_use_approval_required,created_at").maybeSingle();
    if (insert.error) return fail("The action intent could not be recorded.", 503);
    const intent = insert.data ?? (await admin.from("digital_observer_action_intents").select("id,intent_status,action_type,human_confirmation_required,lawful_use_approval_required,created_at").eq("observer_site_id", input.observer_site_id).eq("idempotency_key", draft.idempotency_key).single()).data;
    await admin.from("digital_observer_action_audit").insert({ observer_site_id: input.observer_site_id,
      action_intent_id: intent?.id, actor_profile_id: session.profile.id, event_type: "action_intent_created",
      result_status: directlyAuthorized ? "allowed" : "pending", reason_code: directlyAuthorized ? "authorized_non_sensitive" : "confirmation_or_legal_gate_required",
      safe_metadata: { kind: input.kind, action_type: actionType, raw_instruction_stored: false } });
    return ok({ intent, executed: false }, 201);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("ACTION_INSTRUCTION_")) return fail("The instruction is unsupported or unsafe. No action was executed.", 422);
    return handleRouteError(error);
  }
}
