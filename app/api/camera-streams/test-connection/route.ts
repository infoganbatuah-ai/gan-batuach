import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buildMaskedConnectionSummary, cameraConnectionInputSchema } from "@/lib/domain/camera-connection-builder";
import { testCameraSource } from "@/lib/domain/video-gateway-client";

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

    const gateway = await testCameraSource(payload);
    const friendlyMessage = gateway.status === "gateway_required"
      ? "נדרש חיבור Gateway לפני צפייה חיה"
      : gateway.status === "healthy"
        ? "החיבור הצליח"
        : gateway.message || "בדיקת החיבור נכשלה";
    const now = new Date().toISOString();

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
        masked_connection_summary: buildMaskedConnectionSummary(payload)
      };
      const { error } = await supabase.from("camera_streams" as any).update(patch).eq("id", payload.camera_id);
      if (error) console.error("[camera-test-connection] camera status update failed", { camera_id: payload.camera_id, error: error.message });
    }

    return ok({
      success: gateway.status === "healthy",
      status: gateway.status,
      reason: gateway.reason,
      message: friendlyMessage,
      gateway_status: gateway.configured ? "configured" : "not_configured",
      gateway_provider: gateway.provider,
      candidates_tried_count: gateway.candidatesTried,
      connection_summary: buildMaskedConnectionSummary(payload)
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
