import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { buildDigitalObserverCameraReadiness, digitalObserverConnectorTypes } from "@/lib/domain/digital-observer/connectors";
import { observerCameraPairingMethods } from "@/lib/domain/digital-observer/camera-connection-methods";

const targets = ["person", "unknown_person", "animal", "entry_exit", "vehicle", "vehicle_tampering", "distress", "room_entry_exit", "after_hours", "camera_obstruction", "restricted_area", "crowding", "door_left_open"] as const;

const createSchema = z.object({
  action: z.literal("create"),
  observer_site_id: z.string().uuid(),
  display_name: z.string().trim().min(2).max(100),
  location_label: z.string().trim().max(100).optional().default(""),
  connector_type: z.enum(digitalObserverConnectorTypes),
  connector_provider: z.string().trim().max(80).optional().default("generic"),
  pairing_method: z.enum(observerCameraPairingMethods).optional().default("manual_network"),
  pairing_payload_kind: z.enum(["rtsp", "onvif", "web_link", "vendor_code", "unknown"]).optional().default("unknown"),
  monitoring_targets: z.array(z.enum(targets)).max(13).default([]),
  preview_scene: z.string().trim().max(80).optional().nullable()
});

const testSchema = z.object({
  action: z.literal("test_readiness"),
  id: z.string().uuid()
});

const disableSchema = z.object({
  action: z.literal("disable"),
  id: z.string().uuid()
});

const renameSchema = z.object({
  action: z.literal("rename"),
  id: z.string().uuid(),
  display_name: z.string().trim().min(2).max(100),
  location_label: z.string().trim().max(100).optional().default(""),
  name_origin: z.enum(["user_edit", "ai_visual_review"]).optional().default("user_edit")
});

const removeDemoSchema = z.object({
  action: z.literal("remove_demo_bundle"),
  id: z.string().uuid()
});

const schema = z.discriminatedUnion("action", [createSchema, testSchema, disableSchema, renameSchema, removeDemoSchema]);

export async function POST(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const { profile, supabase: sessionSupabase } = session;
    const supabase = sessionSupabase as any;
    const payload = schema.parse(await request.json());

    if (payload.action === "create") {
      const site = await getObserverSiteAccess(supabase, profile, payload.observer_site_id, { manage: true });
      if (!site) return fail("אין הרשאה להוסיף מצלמה לאתר הזה.", 403);
      const readiness = buildDigitalObserverCameraReadiness(payload.connector_type);
      const { data, error } = await supabase.from("digital_observer_camera_sources" as any).insert({
        observer_site_id: payload.observer_site_id,
        display_name: payload.display_name,
        location_label: payload.location_label || null,
        connector_type: payload.connector_type,
        connector_provider: payload.connector_provider,
        source_mode: readiness.sourceMode,
        status: readiness.status,
        health_status: readiness.healthStatus,
        stream_protocol: payload.connector_type === "rtsp" ? "rtsp_tcp" : null,
        preview_scene: payload.preview_scene ?? null,
        monitoring_targets: payload.monitoring_targets,
        capabilities: readiness.capabilities,
        created_by: profile.id,
        metadata: {
          ...readiness.metadata,
          pairing_method: payload.pairing_method,
          pairing_payload_kind: payload.pairing_payload_kind,
          qr_payload_stored: false,
          connection_instructions_ready: true
        }
      }).select("id,observer_site_id,display_name,location_label,connector_type,source_mode,status,health_status,monitoring_targets").single();
      if (error || !data) return fail("לא ניתן לשמור את מקור המצלמה. יש לוודא שהמיגרציה הוחלה.", 400);
      const learningResult = await supabase.rpc("initialize_digital_observer_learning" as any, { requested_site_id: payload.observer_site_id });
      return ok({
        camera: data,
        learning_initialized: !learningResult.error,
        message: payload.connector_type === "demo"
          ? "מצלמת ההדמיה מוכנה והופעל מסלול למידת שגרה בטוח. אין עיבוד וידאו חי."
          : "המקור נשמר והאתר מוכן ללמידה. עיבוד וידאו יתחיל רק לאחר חיבור Gateway מאובטח."
      }, 201);
    }

    const { data: source } = await supabase.from("digital_observer_camera_sources" as any)
      .select("id,observer_site_id,display_name,location_label,connector_type,status,health_status,metadata")
      .eq("id", payload.id)
      .maybeSingle();
    if (!source) return fail("מקור המצלמה לא נמצא.", 404);
    const site = await getObserverSiteAccess(supabase, profile, source.observer_site_id, { manage: true });
    if (!site) return fail("אין הרשאה לעדכן את מקור המצלמה.", 403);

    if (payload.action === "remove_demo_bundle") {
      const { data, error } = await supabase.rpc("remove_digital_observer_demo_camera_bundle", {
        requested_camera_source_id: payload.id
      });
      if (error) return fail("לא ניתן להסיר את מצלמת ההדמיה. הפעולה מותרת רק למקור דמו סינתטי ללא מדיה שמורה.", 400);
      return ok({ result: data, message: "מצלמת ההדמיה והנתונים הסינתטיים המשויכים אליה הוסרו." });
    }

    if (payload.action === "disable") {
      const { data, error } = await supabase.from("digital_observer_camera_sources" as any)
        .update({ status: "disabled", health_status: "unknown", updated_at: new Date().toISOString() })
        .eq("id", payload.id)
        .select("id,status,health_status")
        .single();
      if (error) return fail("לא ניתן להשבית את מקור המצלמה.", 400);
      return ok({ camera: data });
    }

    if (payload.action === "rename") {
      const { data, error } = await supabase.from("digital_observer_camera_sources" as any)
        .update({
          display_name: payload.display_name,
          location_label: payload.location_label || null,
          metadata: {
            ...(source.metadata ?? {}),
            ...(payload.name_origin === "user_edit"
              ? { user_assigned_name: payload.display_name, user_assigned_location: payload.location_label || null }
              : { ai_suggested_name: payload.display_name, ai_suggested_location: payload.location_label || null }),
            ai_context_updated_at: new Date().toISOString(),
            ai_context_source: payload.name_origin === "user_edit" ? "verified_user_edit" : "ai_visual_review"
          },
          updated_at: new Date().toISOString()
        })
        .eq("id", payload.id)
        .select("id,display_name,location_label,status,health_status,metadata")
        .single();
      if (error || !data) return fail("לא ניתן לעדכן את שם המצלמה.", 400);
      return ok({ camera: data, message: "שם המצלמה נשמר ומשמש מעכשיו כהקשר לתצפיתן." });
    }

    const demo = source.connector_type === "demo";
    const { data, error } = await supabase.from("digital_observer_camera_sources" as any)
      .update({
        status: "ready_to_test",
        health_status: demo ? "healthy" : "unknown",
        last_health_check_at: new Date().toISOString(),
        last_error_code: demo ? null : "GATEWAY_CONFIGURATION_REQUIRED",
        last_error_message: demo ? null : "נדרש Gateway מאובטח ופרטי חיבור בצד השרת.",
        metadata: { ...(source.metadata ?? {}), last_readiness_test: new Date().toISOString(), real_stream_tested: false },
        updated_at: new Date().toISOString()
      })
      .eq("id", payload.id)
      .select("id,status,health_status,last_error_code,last_error_message,last_health_check_at")
      .single();
    if (error) return fail("בדיקת המוכנות נכשלה.", 400);
    return ok({ camera: data, real_stream_tested: false, message: demo ? "מקור ההדמיה עבר בדיקת מוכנות." : "מבנה המקור תקין. בדיקת וידאו אמיתית ממתינה ל-Gateway." });
  } catch (error) {
    return handleRouteError(error);
  }
}
