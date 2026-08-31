import { createHash } from "node:crypto";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { cameraActionSchema, executeCameraAction } from "@/lib/domain/digital-observer/camera-command-policy";
import { cameraCommandAdapter, mockCameraCapabilityProbe, probeCameraCapabilities } from "@/lib/domain/digital-observer/camera-gateway-adapter";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Local demo fallback: keeps the idempotency/audit contract testable when the
// QA Supabase endpoint is unavailable. Production and real Gateway commands
// always use immutable_audit_events in Supabase.
const demoCommandClaims = new Set<string>();

export async function POST(request: Request) {
  try {
    const payload = cameraActionSchema.parse(await request.json());
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const supabase = session.supabase as any;
    const result = await supabase.from("digital_observer_camera_sources")
      .select("id,observer_site_id,status,health_status,connector_type,display_name,capabilities")
      .eq("id", payload.camera_source_id).maybeSingle();
    if (result.error || !result.data) return fail("המצלמה לא נמצאה.", 404);
    const site = await getObserverSiteAccess(supabase, session.profile, result.data.observer_site_id, { manage: true });
    if (!site) return fail("אין הרשאת ניהול למצלמה הזו.", 403);
    const isDemo = result.data.connector_type === "demo";
    if (isDemo) {
      if (demoCommandClaims.has(payload.request_id)) return fail("הבקשה כבר נרשמה. לא נשלחה כפילות.", 409);
      demoCommandClaims.add(payload.request_id);
      return ok({ accepted: true, executed: null, state: "simulated", command_id: null, request_id: payload.request_id, audit_recorded: false, simulated: true, message: "בדיקת הדמו הושלמה. לא נשלחה פקודה לחומרה אמיתית." }, 200);
    }
    const adapter = cameraCommandAdapter();
    if (!adapter) return fail("לא מוגדר חיבור לשליטה במצלמה. לא נשלחה פקודה.", 503);
    const cameraForExecution = isDemo ? { ...result.data, status: "connected", health_status: "healthy" } : result.data;
    const audit = isDemo ? null : createAdminClient() as any;
    const baseAudit = {
      event_category: "camera", actor_profile_id: session.profile.id, actor_role: session.profile.role,
      target_type: "digital_observer_camera_source", target_id: result.data.id,
      camera_id: result.data.id, request_id: payload.request_id, risk_level: "high"
    };
    const outcome = await executeCameraAction(payload, cameraForExecution, {
      adapter,
      probe: probeCameraCapabilities,
      async claim(command, probe) {
        if (isDemo) {
          if (demoCommandClaims.has(command.requestId)) throw new Error("COMMAND_ALREADY_CLAIMED");
          demoCommandClaims.add(command.requestId);
          return;
        }
        // The audit primary key is the durable, atomic replay barrier across workers/restarts.
        // Persist a digest, not spoken text, credentials or arbitrary gateway metadata.
        const { error } = await audit.from("immutable_audit_events").insert({
          ...baseAudit, id: command.requestId, event_type: "digital_guard_command_dispatch_intent",
          metadata: { action: command.action, observer_site_id: result.data.observer_site_id,
            actor: "user", confirmed: payload.confirmed, expires_at: command.expiresAt, evidence_id: probe.evidenceId,
            payload_digest: createHash("sha256").update(JSON.stringify(command.payload)).digest("hex") }
        });
        if (error?.code === "23505") throw new Error("COMMAND_ALREADY_CLAIMED");
        if (error) throw new Error("COMMAND_AUDIT_UNAVAILABLE");
      },
      async recordOutcome(value) {
        if (isDemo) return;
        const { error } = await audit.from("immutable_audit_events").insert({
          ...baseAudit, event_type: `digital_guard_command_${value.state}`,
          metadata: { action: payload.action, state: value.state, executed: value.executed, command_id: value.command_id }
        });
        if (error) throw new Error("COMMAND_AUDIT_UNAVAILABLE");
      }
    });
    const message = outcome.state === "executed" ? "המצלמה אישרה שהפעולה בוצעה."
      : outcome.state === "acknowledged" ? "הפקודה התקבלה במערכת המצלמה; הביצוע עדיין לא אושר. אין לשלוח שוב אוטומטית."
      : "הבקשה נשלחה אך התוצאה אינה ידועה. ייתכן שהפעולה בוצעה; יש לבדוק את המצלמה לפני ניסיון נוסף.";
    return ok({ ...outcome, message: message + (outcome.audit_recorded ? "" : " רישום התוצאה ביומן נכשל; רישום הבקשה נשמר.") }, outcome.state === "executed" ? 200 : 202);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const failures: Record<string, [string, number]> = {
      CAMERA_OFFLINE: ["המצלמה אינה מקוונת. לא נשלחה פקודה.", 409],
      COMMAND_EXPIRED: ["תוקף האישור פג. לא נשלחה פקודה.", 409],
      COMMAND_ALREADY_CLAIMED: ["הבקשה כבר נרשמה. לא נשלחה פקודה נוספת; יש לבדוק את תוצאת הבקשה המקורית.", 409],
      COMMAND_AUDIT_UNAVAILABLE: ["לא ניתן לתעד את הבקשה. לא נשלחה פקודה.", 503],
      HUMAN_CONFIRMATION_REQUIRED: ["נדרש אישור מפורש לכל פעולה פיזית.", 409],
      CAMERA_CAPABILITY_UNAVAILABLE: ["היכולת אינה זמינה במצלמה. לא נשלחה פקודה.", 422],
      INVALID_CAPABILITY_EVIDENCE: ["אימות היכולות חסר או פג תוקף. לא נשלחה פקודה.", 428],
      CAPABILITY_EVIDENCE_REQUIRED: ["נדרש אימות חי של יכולות המצלמה. לא נשלחה פקודה.", 428]
    };
    if (failures[code]) return fail(...failures[code]);
    if (code.startsWith("COMMAND_GATEWAY_")) return fail("חיבור השליטה במצלמה לא זמין או לא תקין. לא נשלחה פקודה.", 503);
    return handleRouteError(error);
  }
}
