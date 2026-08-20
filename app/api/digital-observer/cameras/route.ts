import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { buildDigitalObserverCameraReadiness, digitalObserverConnectorTypes } from "@/lib/domain/digital-observer/connectors";
import { createClient } from "@/lib/supabase/server";

const targets = ["person", "unknown_person", "animal", "entry_exit", "after_hours", "camera_obstruction", "restricted_area", "crowding", "door_left_open"] as const;

const createSchema = z.object({
  action: z.literal("create"),
  observer_site_id: z.string().uuid(),
  display_name: z.string().trim().min(2).max(100),
  location_label: z.string().trim().max(100).optional().default(""),
  connector_type: z.enum(digitalObserverConnectorTypes),
  connector_provider: z.string().trim().max(80).optional().default("generic"),
  monitoring_targets: z.array(z.enum(targets)).max(9).default([]),
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

const schema = z.discriminatedUnion("action", [createSchema, testSchema, disableSchema]);

export async function POST(request: Request) {
  try {
    const { profile } = await requireUser();
    const payload = schema.parse(await request.json());
    const supabase = await createClient();

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
        metadata: readiness.metadata
      }).select("id,observer_site_id,display_name,location_label,connector_type,source_mode,status,health_status,monitoring_targets").single();
      if (error || !data) return fail("לא ניתן לשמור את מקור המצלמה. יש לוודא שהמיגרציה הוחלה.", 400);
      return ok({ camera: data, message: payload.connector_type === "demo" ? "מצלמת ההדמיה מוכנה לבדיקה." : "המקור נשמר במצב מוכנות. פרטי החיבור יוגדרו ב-Gateway המאובטח." }, 201);
    }

    const { data: source } = await supabase.from("digital_observer_camera_sources" as any)
      .select("id,observer_site_id,connector_type,status,metadata")
      .eq("id", payload.id)
      .maybeSingle();
    if (!source) return fail("מקור המצלמה לא נמצא.", 404);
    const site = await getObserverSiteAccess(supabase, profile, source.observer_site_id, { manage: true });
    if (!site) return fail("אין הרשאה לעדכן את מקור המצלמה.", 403);

    if (payload.action === "disable") {
      const { data, error } = await supabase.from("digital_observer_camera_sources" as any)
        .update({ status: "disabled", health_status: "unknown", updated_at: new Date().toISOString() })
        .eq("id", payload.id)
        .select("id,status,health_status")
        .single();
      if (error) return fail("לא ניתן להשבית את מקור המצלמה.", 400);
      return ok({ camera: data });
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
