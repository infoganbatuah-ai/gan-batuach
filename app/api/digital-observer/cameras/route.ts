import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { buildDigitalObserverCameraReadiness, digitalObserverConnectorTypes } from "@/lib/domain/digital-observer/connectors";
import { observerCameraPairingMethods } from "@/lib/domain/digital-observer/camera-connection-methods";
import {
  assessCameraConnection,
  buildExistingSourceAssessmentInput,
  buildPairingConnectionAssessmentInput,
  cameraConnectionMetadataForAssessment
} from "@/lib/domain/digital-observer/camera-connection-layer";
import { createAdminClient } from "@/lib/supabase/admin";

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
  name_origin: z.enum(["user_edit", "ai_visual_review"]).optional().default("user_edit"),
  zone_type: z.enum(["POOL", "PARKING", "ENTRANCE", "PERIMETER", "INDOOR"]).optional(),
  crossing_line: z.object({ axis: z.enum(["x", "y"]), position: z.number().min(0.05).max(0.95), inside: z.enum(["positive", "negative"]) }).strict().nullable().optional()
});

const removeDemoSchema = z.object({
  action: z.literal("remove_demo_bundle"),
  id: z.string().uuid()
});

const schema = z.discriminatedUnion("action", [createSchema, testSchema, disableSchema, renameSchema, removeDemoSchema]);

async function removeSyntheticDemoBundleFallback(sourceId: string, observerSiteId: string) {
  const admin = createAdminClient() as any;
  const sourceResult = await admin.from("digital_observer_camera_sources")
    .select("id,observer_site_id,camera_stream_id,connector_type,connector_provider,source_mode,secret_reference,capabilities,metadata")
    .eq("id", sourceId)
    .eq("observer_site_id", observerSiteId)
    .single();
  if (sourceResult.error || !sourceResult.data) throw new Error("DEMO_SOURCE_NOT_FOUND");
  const source = sourceResult.data;
  const hasGatewayBinding = Boolean(source.camera_stream_id || source.secret_reference || source.metadata?.gateway_stream_id || source.metadata?.video_gateway_stream_id);
  if (source.connector_type !== "demo" || source.source_mode !== "demo" || source.capabilities?.live_view === true || hasGatewayBinding) {
    throw new Error("ONLY_SYNTHETIC_DEMO_CAMERA_CAN_BE_REMOVED");
  }

  const clips = await admin.from("digital_observer_event_clips")
    .select("id,signal_id,storage_path,snapshot_storage_path")
    .eq("camera_source_id", sourceId);
  if (clips.error) throw new Error("DEMO_CLIP_PREFLIGHT_FAILED");
  if ((clips.data ?? []).some((clip: any) => clip.storage_path || clip.snapshot_storage_path)) throw new Error("DEMO_CAMERA_HAS_STORED_MEDIA");

  const signals = await admin.from("observer_intelligence_signals")
    .select("id")
    .eq("observer_site_id", observerSiteId)
    .contains("metadata", { camera_source_id: sourceId });
  if (signals.error) throw new Error("DEMO_SIGNAL_PREFLIGHT_FAILED");
  const signalIds = (signals.data ?? []).map((item: any) => item.id);
  const ensure = (scope: string, error: any) => {
    if (error) throw new Error(scope);
  };

  if (signalIds.length) {
    ensure("DEMO_DELIVERY_DELETE_FAILED", (await admin.from("digital_observer_notification_deliveries").delete().in("signal_id", signalIds)).error);
    ensure("DEMO_SIGNAL_CLIP_DELETE_FAILED", (await admin.from("digital_observer_event_clips").delete().in("signal_id", signalIds)).error);
  }
  ensure("DEMO_CAMERA_CLIP_DELETE_FAILED", (await admin.from("digital_observer_event_clips").delete().eq("camera_source_id", sourceId)).error);
  ensure("DEMO_IDENTITY_DELETE_FAILED", (await admin.from("digital_observer_identity_candidates").delete().eq("camera_source_id", sourceId)).error);
  ensure("DEMO_RULE_DELETE_FAILED", (await admin.from("observer_watch_requests").delete().eq("camera_source_id", sourceId)).error);
  if (signalIds.length) ensure("DEMO_SIGNAL_DELETE_FAILED", (await admin.from("observer_intelligence_signals").delete().in("id", signalIds)).error);
  ensure("DEMO_SOURCE_DELETE_FAILED", (await admin.from("digital_observer_camera_sources").delete().eq("id", sourceId).eq("connector_type", "demo").eq("source_mode", "demo")).error);
  return { camera_removed: true, signals_removed: signalIds.length, clips_removed: (clips.data ?? []).length, fallback: "server_scoped_idempotent" };
}

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
      const assessment = assessCameraConnection(buildPairingConnectionAssessmentInput({
        siteId: payload.observer_site_id,
        connectorType: payload.connector_type,
        provider: payload.connector_provider,
        pairingMethod: payload.pairing_method,
        pairingPayloadKind: payload.pairing_payload_kind
      }));
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
        capabilities: {
          ...readiness.capabilities,
          canonical_connection_capabilities: assessment.capabilities,
          production_connection_eligible: assessment.productionEligible,
          automatic_insecure_fallback: false
        },
        created_by: profile.id,
        metadata: {
          ...readiness.metadata,
          pairing_method: payload.pairing_method,
          pairing_payload_kind: payload.pairing_payload_kind,
          qr_payload_stored: false,
          connection_instructions_ready: true,
          ...cameraConnectionMetadataForAssessment(assessment)
        }
      }).select("id,observer_site_id,display_name,location_label,connector_type,source_mode,status,health_status,monitoring_targets").single();
      if (error || !data) return fail("לא ניתן לשמור את מקור המצלמה. יש לוודא שהמיגרציה הוחלה.", 400);
      const learningResult = await supabase.rpc("initialize_digital_observer_learning" as any, { requested_site_id: payload.observer_site_id });
      return ok({
        camera: data,
        connection_assessment: assessment,
        learning_initialized: !learningResult.error,
        message: payload.connector_type === "demo"
          ? "מצלמת ההדמיה מוכנה והופעל מסלול למידת שגרה בטוח. אין עיבוד וידאו חי."
          : assessment.recommendation === "DIRECT_CONNECTION_AVAILABLE"
            ? "המקור נשמר. נמצא מסלול דיגיטלי מועדף והוא יופעל רק לאחר אימות והרשאה."
            : assessment.recommendation === "SOFTWARE_CONNECTOR_REQUIRED"
              ? "המקור נשמר. מומלץ מחבר תוכנה מקומי ויוצא; אין צורך להניח מראש חומרת Gateway."
              : assessment.recommendation === "PHYSICAL_GATEWAY_REQUIRED"
                ? "המקור נשמר. Gateway פיזי נדרש רק לפי אילוצי המערכת שתועדו."
                : "המקור נשמר במצב מוכנות. נדרשים פרטי מערכת נוספים לפני בחירת חיבור בטוח."
      }, 201);
    }

    const { data: source } = await supabase.from("digital_observer_camera_sources" as any)
      .select("id,observer_site_id,camera_stream_id,display_name,location_label,connector_type,connector_provider,source_mode,status,health_status,stream_protocol,gateway_provider,capabilities,last_health_check_at,last_seen_at,secret_reference,metadata")
      .eq("id", payload.id)
      .maybeSingle();
    if (!source) return fail("מקור המצלמה לא נמצא.", 404);
    const site = await getObserverSiteAccess(supabase, profile, source.observer_site_id, { manage: true });
    if (!site) return fail("אין הרשאה לעדכן את מקור המצלמה.", 403);

    if (payload.action === "remove_demo_bundle") {
      const { data, error } = await supabase.rpc("remove_digital_observer_demo_camera_bundle", {
        requested_camera_source_id: payload.id
      });
      if (!error) return ok({ result: data, message: "מצלמת ההדמיה והנתונים הסינתטיים המשויכים אליה הוסרו." });
      if (!["PGRST202", "42883", "P0001"].includes(String(error.code || ""))) return fail("לא ניתן להסיר את מצלמת ההדמיה. הפעולה מותרת רק למקור דמו סינתטי ללא מדיה שמורה.", 400);
      const result = await removeSyntheticDemoBundleFallback(payload.id, source.observer_site_id);
      return ok({ result, message: "מצלמת ההדמיה והנתונים הסינתטיים המשויכים אליה הוסרו." });
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
            ...(payload.zone_type ? { zone_type: payload.zone_type } : {}),
            ...(payload.crossing_line !== undefined ? { crossing_line: payload.crossing_line } : {}),
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
    const assessment = assessCameraConnection(buildExistingSourceAssessmentInput(source));
    const { data, error } = await supabase.from("digital_observer_camera_sources" as any)
      .update({
        status: "ready_to_test",
        health_status: demo ? "healthy" : "unknown",
        last_health_check_at: new Date().toISOString(),
        last_error_code: demo ? null : assessment.missingRequirements[0] ?? "CONNECTION_TEST_REQUIRED",
        last_error_message: demo ? null : assessment.recommendation === "SOFTWARE_CONNECTOR_REQUIRED"
          ? "נדרש מחבר תוכנה מקומי ומאומת לפני בדיקת וידאו."
          : assessment.recommendation === "PHYSICAL_GATEWAY_REQUIRED"
            ? "נדרש Gateway מאומת בגלל אילוצי המקור המקומי."
            : "נדרשת השלמת מסלול חיבור מאובטח לפני בדיקת וידאו.",
        metadata: {
          ...(source.metadata ?? {}),
          last_readiness_test: new Date().toISOString(),
          real_stream_tested: false,
          ...cameraConnectionMetadataForAssessment(assessment)
        },
        updated_at: new Date().toISOString()
      })
      .eq("id", payload.id)
      .select("id,status,health_status,last_error_code,last_error_message,last_health_check_at")
      .single();
    if (error) return fail("בדיקת המוכנות נכשלה.", 400);
    return ok({
      camera: data,
      connection_assessment: assessment,
      real_stream_tested: false,
      message: demo
        ? "מקור ההדמיה עבר בדיקת מוכנות."
        : assessment.recommendation === "SOFTWARE_CONNECTOR_REQUIRED"
          ? "מבנה המקור תקין. בדיקת וידאו אמיתית ממתינה למחבר תוכנה מאומת."
          : assessment.recommendation === "PHYSICAL_GATEWAY_REQUIRED"
            ? "מבנה המקור תקין. בדיקת וידאו אמיתית ממתינה ל-Gateway המוצדק עבור מקור זה."
            : "מבנה המקור תקין. נדרש להשלים את מסלול החיבור המומלץ לפני בדיקת וידאו."
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
