import { randomUUID } from "node:crypto";
import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { createAdminClient } from "@/lib/supabase/admin";

const actionTypes = ["talkback", "ptz_pan", "ptz_tilt", "ptz_zoom", "light_on", "light_off", "siren_on", "siren_off", "relay_on", "relay_off"] as const;
const createSchema = z.object({
  action: z.literal("request"),
  observer_site_id: z.string().uuid(),
  camera_source_id: z.string().uuid(),
  action_type: z.enum(actionTypes),
  request_origin: z.enum(["dashboard", "observer_chat"]).default("dashboard"),
  parameters: z.record(z.string(), z.union([z.string().max(80), z.number().finite(), z.boolean()])).default({})
});
const confirmSchema = z.object({ action: z.literal("confirm"), request_id: z.string().uuid(), confirmation: z.literal(true) });
const cancelSchema = z.object({ action: z.literal("cancel"), request_id: z.string().uuid() });
const schema = z.discriminatedUnion("action", [createSchema, confirmSchema, cancelSchema]);

const capabilityForAction: Record<(typeof actionTypes)[number], string> = {
  talkback: "talkback",
  ptz_pan: "ptz",
  ptz_tilt: "ptz",
  ptz_zoom: "ptz",
  light_on: "light",
  light_off: "light",
  siren_on: "siren",
  siren_off: "siren",
  relay_on: "relay",
  relay_off: "relay"
};

type CapabilityEvidence = { supported?: boolean; method?: string; tested_at?: string; adapter?: string | null; reason?: string | null };

function sourceEvidence(source: any, capability: string): CapabilityEvidence | null {
  const candidates = [source.capabilities?.capability_evidence, source.metadata?.channel_capabilities];
  for (const value of candidates) {
    const evidence = value?.[capability];
    if (evidence && typeof evidence === "object") return evidence;
  }
  return null;
}

function verifiedEvidence(evidence: CapabilityEvidence | null) {
  if (!evidence || evidence.supported !== true || !evidence.method || evidence.method === "not_tested" || !evidence.tested_at || !evidence.adapter) return false;
  const testedAt = Date.parse(evidence.tested_at);
  return Number.isFinite(testedAt) && Date.now() - testedAt <= 24 * 60 * 60 * 1000;
}

async function writeAudit(supabase: any, input: { eventType: string; profileId: string; siteId: string; sourceId: string; requestId: string; actionType: string; status: string; reason: string }) {
  await supabase.from("observer_capability_audit_events" as any).insert({
    event_key: `camera-action-${input.eventType}-${input.requestId}`,
    event_type: input.eventType,
    vertical_key: "home_observer",
    capability_key: input.actionType,
    actor_profile_id: input.profileId,
    status: input.status,
    reason: input.reason,
    metadata: {
      observer_site_id: input.siteId,
      camera_source_id: input.sourceId,
      camera_action_request_id: input.requestId,
      immediate_confirmation_required: true,
      no_credentials_stored: true
    }
  });
}

export async function POST(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const { profile, supabase: sessionSupabase } = session;
    const supabase = sessionSupabase as any;
    const admin = createAdminClient() as any;
    const payload = schema.parse(await request.json());

    if (payload.action === "request") {
      const site = await getObserverSiteAccess(supabase, profile, payload.observer_site_id, { manage: true });
      if (!site) return fail("אין הרשאה להפעיל את המצלמה באתר הזה.", 403);
      if (site.metadata?.observer_safe_action_consent !== true) return fail("יש להפעיל תחילה הרשאת פעולות בטוחות בהגדרות התצפיתן.", 412);
      const { data: source } = await supabase.from("digital_observer_camera_sources" as any)
        .select("id,observer_site_id,status,health_status,capabilities,metadata")
        .eq("id", payload.camera_source_id)
        .eq("observer_site_id", payload.observer_site_id)
        .maybeSingle();
      if (!source) return fail("מקור המצלמה לא נמצא באתר הזה.", 404);
      if (!['connected', 'healthy'].includes(String(source.status ?? source.health_status))) return fail("המצלמה אינה מחוברת ולכן הפעולה חסומה.", 409);
      const capability = capabilityForAction[payload.action_type];
      const evidence = sourceEvidence(source, capability);
      if (!verifiedEvidence(evidence)) return fail("הפעולה אינה זמינה: אין בדיקת יכולת עדכנית ומתאם מאומת למצלמה הזו.", 412);

      const { data, error } = await admin.from("digital_observer_camera_action_requests" as any).insert({
        observer_site_id: payload.observer_site_id,
        camera_source_id: payload.camera_source_id,
        requested_by: profile.id,
        action_type: payload.action_type,
        request_origin: payload.request_origin,
        action_status: "awaiting_confirmation",
        parameters: payload.parameters,
        capability_evidence: evidence,
        idempotency_key: randomUUID(),
        expires_at: new Date(Date.now() + 2 * 60 * 1000).toISOString()
      }).select("id,action_type,action_status,expires_at").single();
      if (error) return fail("לא ניתן להכין את הפעולה לאישור.", 400);
      await writeAudit(supabase, { eventType: "camera_action_requested", profileId: profile.id, siteId: payload.observer_site_id, sourceId: payload.camera_source_id, requestId: data.id, actionType: payload.action_type, status: "logged", reason: "Evidence-backed physical action requested; awaiting immediate user confirmation." });
      return ok({ request: data, confirmation_required: true, message: "הפעולה מוכנה לאישור מיידי. היא לא נשלחה למצלמה." }, 201);
    }

    const { data: actionRequest } = await supabase.from("digital_observer_camera_action_requests" as any)
      .select("id,observer_site_id,camera_source_id,requested_by,action_type,action_status,expires_at")
      .eq("id", payload.request_id)
      .maybeSingle();
    if (!actionRequest) return fail("בקשת הפעולה לא נמצאה.", 404);
    const site = await getObserverSiteAccess(supabase, profile, actionRequest.observer_site_id, { manage: true });
    if (!site) return fail("אין הרשאה לאשר את הפעולה.", 403);
    if (actionRequest.action_status !== "awaiting_confirmation") return fail("בקשת הפעולה כבר טופלה.", 409);

    if (payload.action === "cancel") {
      await admin.from("digital_observer_camera_action_requests" as any).update({ action_status: "cancelled", updated_at: new Date().toISOString() }).eq("id", payload.request_id);
      await writeAudit(supabase, { eventType: "camera_action_cancelled", profileId: profile.id, siteId: actionRequest.observer_site_id, sourceId: actionRequest.camera_source_id, requestId: actionRequest.id, actionType: actionRequest.action_type, status: "success", reason: "Action cancelled before Gateway delivery." });
      return ok({ cancelled: true, message: "הפעולה בוטלה ולא נשלחה למצלמה." });
    }

    if (Date.parse(actionRequest.expires_at) <= Date.now()) {
      await admin.from("digital_observer_camera_action_requests" as any).update({ action_status: "expired", updated_at: new Date().toISOString() }).eq("id", payload.request_id);
      return fail("תוקף האישור פג. יש להתחיל את הפעולה מחדש.", 410);
    }
    const now = new Date().toISOString();
    const { data: approved, error } = await admin.from("digital_observer_camera_action_requests" as any).update({
      action_status: "approved",
      confirmed_by: profile.id,
      confirmed_at: now,
      updated_at: now
    }).eq("id", payload.request_id).eq("action_status", "awaiting_confirmation").select("id,action_type,action_status,expires_at").single();
    if (error) return fail("לא ניתן לאשר את הפעולה.", 409);
    await writeAudit(supabase, { eventType: "camera_action_confirmed", profileId: profile.id, siteId: actionRequest.observer_site_id, sourceId: actionRequest.camera_source_id, requestId: actionRequest.id, actionType: actionRequest.action_type, status: "success", reason: "Immediate user confirmation recorded; enrolled Gateway may now claim the action once." });
    return ok({ request: approved, message: "האישור נרשם. הפעולה תישלח רק ל-Gateway המאומת של האתר." });
  } catch (error) {
    return handleRouteError(error);
  }
}
