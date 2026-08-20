import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buildMaskedConnectionSummary, cameraConnectionInputSchema } from "@/lib/domain/camera-connection-builder";
import { testCameraSource } from "@/lib/domain/video-gateway-client";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = cameraConnectionInputSchema.extend({
  garden_id: z.string().uuid().optional(),
  camera_id: z.string().uuid().optional()
});

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["admin", "manager", "owner"]);
    const payload = schema.parse(await request.json());
    const supabase = await createClient();

    let gardenId = payload.garden_id ?? profile.garden_id ?? null;
    if (payload.camera_id) {
      const { data: camera, error } = await supabase.from("camera_streams" as any).select("id,garden_id,kindergarten_id").eq("id", payload.camera_id).maybeSingle();
      if (error || !camera) return fail("מצלמה לא נמצאה", 404);
      gardenId = (camera as any).garden_id ?? (camera as any).kindergarten_id ?? gardenId;
    }
    if (profile.role !== "admin" && (!gardenId || gardenId !== profile.garden_id)) return fail("אין הרשאה לבדוק מצלמה שאינה משויכת לגן שלך.", 403);
    const missing: string[] = [];
    if (payload.system_type !== "manual_rtsp" && payload.system_type !== "sample_hls" && !payload.host) missing.push("כתובת מצלמה או DVR/NVR");
    if (payload.system_type === "manual_rtsp" && !payload.manual_rtsp_url) missing.push("כתובת RTSP מלאה");
    if (["dvr", "nvr", "dvr_nvr", "hikvision", "dahua", "uniview"].includes(payload.system_type) && !payload.channel) missing.push("מספר ערוץ");
    if (!gardenId) missing.push("גן");
    if (missing.length) {
      return ok({
        success: false,
        status: "failed",
        result: "failed",
        message: `חסרים פרטים: ${missing.join(", ")}`,
        next_action: "להשלים את השדות החסרים ולבדוק שוב",
        checks: { required_fields: "failed", gateway_reachable: "not_checked", source_reachable: "not_checked", streaming_readiness: "not_checked" }
      });
    }
    // The host is intentionally not selectable by browser sessions. The server performs
    // duplicate detection only after the caller's garden scope has been verified.
    const duplicateQuery = gardenId && payload.host ? await createAdminClient()
      .from("camera_streams" as any)
      .select("id,name")
      .eq("garden_id", gardenId)
      .eq("connection_host", payload.host)
      .limit(1) : { data: [] };
    const duplicate = (duplicateQuery as any).data?.find((row: any) => row.id !== payload.camera_id);

    const gateway = await testCameraSource(payload);
    const friendlyMessage = gateway.status === "gateway_required"
      ? "נדרש חיבור Gateway לפני צפייה חיה"
      : gateway.status === "healthy"
        ? "החיבור הצליח"
        : gateway.message || "בדיקת החיבור נכשלה";
    const now = new Date().toISOString();
    const validationStatus = gateway.status === "healthy" ? "success" : gateway.status === "gateway_required" ? "gateway_required" : "failed";
    const userResult = duplicate ? "warning" : gateway.status === "healthy" ? "success" : gateway.status === "gateway_required" ? "warning" : "failed";
    const nextAction = duplicate
      ? "נמצאה מצלמה עם כתובת דומה. לבדוק שלא יוצרים כפילות."
      : gateway.status === "healthy"
        ? "אפשר לשמור את המצלמה ולפתוח צפייה מאובטחת"
        : gateway.status === "gateway_required"
          ? "להפעיל Video Gateway ואז להריץ בדיקה חוזרת"
          : "לבדוק כתובת, פורט, ערוץ והרשאות";
    const validationRow = {
      camera_id: payload.camera_id ?? null,
      garden_id: gardenId,
      provider_key: payload.system_type,
      validation_type: "gateway_readiness",
      status: validationStatus,
      rtsp_valid: (gateway.candidatesTried ?? 0) > 0 || Boolean(payload.sample_hls_url),
      connection_valid: gateway.status === "healthy",
      credentials_valid: Boolean(payload.username && payload.password) || payload.system_type === "sample_hls" || payload.system_type === "manual_rtsp",
      stream_available: gateway.status === "healthy" || Boolean(payload.sample_hls_url),
      latency_ms: gateway.latencyMs ?? null,
      candidates_tried_count: gateway.candidatesTried ?? 0,
      message: friendlyMessage,
      failure_reason: gateway.status === "healthy" ? null : friendlyMessage,
      gateway_required: gateway.status === "gateway_required",
      no_secrets_exposed: true,
      metadata: {
        gateway_provider: gateway.provider ?? null,
        duplicate_camera_id: duplicate?.id ?? null,
        validation_checks: ["reachable_host", "authentication", "stream_exists", "channel_exists", "latency", "timeout", "invalid_credentials"]
      }
    };
    const validationInsert = await supabase.from("camera_stream_validations" as any).insert(validationRow);
    if (validationInsert.error) console.error("[camera-test-connection] validation log failed", { error: validationInsert.error.message });

    if (payload.camera_id) {
      const patch = {
        status: gateway.status === "healthy" ? "connected" : "pending_gateway",
        stream_status: gateway.status === "healthy" ? "connected" : "pending",
        health_status: gateway.status === "healthy" ? "healthy" : "pending",
        last_test_status: gateway.status,
        last_test_message: friendlyMessage,
        last_test_at: now,
        gateway_registration_status: gateway.status === "healthy" ? "registered" : "pending_gateway",
        gateway_last_error: gateway.status === "healthy" ? null : friendlyMessage,
        masked_connection_summary: buildMaskedConnectionSummary(payload),
        validation_status: validationStatus,
        validation_message: friendlyMessage,
        validation_latency_ms: gateway.latencyMs ?? null,
        last_validation_at: now,
        live_preview_status: gateway.status === "healthy" ? "ready" : "pending_gateway",
        security_review: { rtsp_exposed: false, credentials_browser_exposed: false, gateway_secret_browser_exposed: false }
      };
      const { error } = await supabase.from("camera_streams" as any).update(patch).eq("id", payload.camera_id);
      if (error) console.error("[camera-test-connection] camera status update failed", { camera_id: payload.camera_id, error: error.message });
    }
    await supabase.from("camera_deployment_audit_logs" as any).insert({
      camera_id: payload.camera_id ?? null,
      garden_id: gardenId,
      actor_id: profile.id,
      actor_role: profile.role,
      action: "test_camera_connection",
      status: gateway.status === "healthy" ? "success" : "logged",
      gateway_provider: gateway.provider ?? null,
      validation_status: gateway.status,
      no_secrets_exposed: true,
      metadata: { candidates_tried_count: gateway.candidatesTried ?? 0, reason: gateway.reason ?? null }
    });

    return ok({
      success: gateway.status === "healthy",
      result: userResult,
      status: gateway.status,
      reason: gateway.reason,
      message: friendlyMessage,
      next_action: nextAction,
      checks: {
        required_fields: "success",
        duplicate_camera: duplicate ? "warning" : "success",
        gateway_reachable: gateway.configured ? (gateway.status === "healthy" ? "success" : "failed") : "warning",
        rtsp_format: payload.system_type === "manual_rtsp" ? (String(payload.manual_rtsp_url).startsWith("rtsp://") ? "success" : "failed") : "success",
        channel_value: payload.channel ? "success" : ["dvr", "nvr", "dvr_nvr", "hikvision", "dahua", "uniview"].includes(payload.system_type) ? "warning" : "not_required",
        source_reachable: gateway.status === "healthy" ? "success" : "placeholder",
        streaming_readiness: gateway.status === "healthy" ? "success" : "placeholder"
      },
      gateway_status: gateway.configured ? "configured" : "not_configured",
      gateway_provider: gateway.provider,
      candidates_tried_count: gateway.candidatesTried,
      connection_summary: buildMaskedConnectionSummary(payload)
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
