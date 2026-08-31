import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { CameraDevice } from "@/lib/domain/digital-observer/guard-engine";
import { writeCameraAccessEvent } from "@/lib/security/audit-log-service";

const schema = z.object({
  camera_source_id: z.string().uuid(),
  action: z.enum(["ptz", "talk", "siren", "lighting"]),
  confirmed: z.boolean().default(false)
});

export async function POST(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const payload = schema.parse(await request.json());
    const supabase = session.supabase as any;
    const result = await supabase.from("digital_observer_camera_sources")
      .select("id,observer_site_id,display_name,location_label,capabilities,metadata,source_mode,status,health_status")
      .eq("id", payload.camera_source_id).maybeSingle();
    if (result.error || !result.data) return fail("המצלמה לא נמצאה.", 404);
    const site = await getObserverSiteAccess(supabase, session.profile, result.data.observer_site_id, { manage: true });
    if (!site) return fail("אין הרשאת ניהול למצלמה הזו.", 403);
    const device = new CameraDevice({
      cameraId: result.data.id,
      cameraZoneName: result.data.location_label || result.data.display_name,
      capabilities: result.data.capabilities,
      metadata: result.data.metadata,
      sourceMode: result.data.source_mode
    });
    try {
      const requestResult = device.request(payload.action, payload.confirmed);
      const live = ["connected", "healthy", "online", "active"].includes(String(result.data.status || result.data.health_status));
      await writeCameraAccessEvent({
        eventType: `digital_guard_action_blocked_${payload.action}`,
        actorProfileId: session.profile.id,
        actorRole: session.profile.role,
        cameraId: result.data.id,
        targetId: result.data.id,
        metadata: { action: payload.action, confirmed: payload.confirmed, state: live ? "gateway_adapter_missing" : "camera_offline", executed: false, reason: "NO_COMMAND_ADAPTER" },
        riskLevel: payload.action === "siren" || payload.action === "talk" ? "critical" : "high"
      });
      void requestResult;
      return fail(live
        ? "לא בוצעה פעולה: אין Adapter פקודות מחובר שמסוגל להחזיר ACK אמיתי מה-Gateway."
        : "המצלמה אינה מחוברת כרגע; הפעולה לא בוצעה.", 503);
    } catch (error) {
      await writeCameraAccessEvent({
        eventType: `digital_guard_action_denied_${payload.action}`,
        actorProfileId: session.profile.id,
        actorRole: session.profile.role,
        cameraId: result.data.id,
        targetId: result.data.id,
        metadata: { action: payload.action, confirmed: payload.confirmed, reason: error instanceof Error ? error.message : "unknown" },
        riskLevel: "high"
      });
      if (error instanceof Error && error.message === "HUMAN_CONFIRMATION_REQUIRED") return fail("נדרש אישור אנושי מפורש לפני דיבור או הפעלת סירנה.", 409);
      if (error instanceof Error && error.message === "CAMERA_CAPABILITY_UNAVAILABLE") return fail("היכולת הזו לא דווחה על ידי המצלמה.", 422);
      if (error instanceof Error && error.message === "CAPABILITY_EVIDENCE_REQUIRED") return fail("נדרש manifest מאומת מה-Gateway לפני הפעלת חומרה. metadata לבדו אינו מספיק.", 428);
      throw error;
    }
  } catch (error) { return handleRouteError(error); }
}
