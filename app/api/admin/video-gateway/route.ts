import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { checkGatewayHealth, disableCameraSource, getGatewayProvider, registerCameraSource, testCameraSource } from "@/lib/domain/video-gateway-client";
import { createClient } from "@/lib/supabase/server";

const actionSchema = z.object({
  action: z.enum(["health", "register", "retest", "disable"]),
  camera_id: z.string().uuid().optional()
});

function cameraInput(camera: Record<string, any>) {
  return {
    system_type: camera.system_type ?? "manual_rtsp",
    host: camera.connection_host ?? camera.host ?? undefined,
    port: camera.connection_port ?? camera.port ?? undefined,
    username: undefined,
    password: undefined,
    channel: camera.connection_channel ?? camera.channel ?? undefined,
    stream_quality: camera.stream_quality === "main" ? "main" as const : "sub" as const,
    manual_rtsp_url: camera.source_url && !String(camera.source_url).includes("@") ? camera.source_url : undefined
  };
}

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["admin"]);
    const payload = actionSchema.parse(await request.json().catch(() => ({})));
    const supabase = await createClient();
    if (payload.action === "health") {
      const health = await checkGatewayHealth();
      return ok({ health });
    }
    if (!payload.camera_id) return fail("חסרה מצלמה לפעולת Gateway.", 422);
    const { data: camera, error: cameraError } = await supabase.from("camera_streams" as any).select("*").eq("id", payload.camera_id).single();
    if (cameraError || !camera) return fail(cameraError?.message ?? "מצלמה לא נמצאה", 404);
    const cameraGardenId = (camera as any).garden_id ?? (camera as any).kindergarten_id;
    const now = new Date().toISOString();

    if (payload.action === "disable") {
      const streamId = (camera as any).gateway_source_id ?? (camera as any).gateway_stream_id ?? (camera as any).video_gateway_stream_id ?? payload.camera_id;
      const result = await disableCameraSource(streamId);
      const { data, error } = await supabase.from("camera_streams" as any).update({
        active: false,
        status: "disabled",
        stream_status: "disabled",
        health_status: "disabled",
        gateway_registration_status: "disabled",
        gateway_provider: getGatewayProvider(),
        gateway_last_error: result.status === "error" ? result.message : null,
        disabled_at: now,
        disabled_by: profile.id
      }).eq("id", payload.camera_id).select("*").single();
      if (error) return fail(error.message, 400);
      return ok({ camera: data, gateway: result, message: "המקור הושבת ב-Gateway." });
    }

    await supabase.from("camera_streams" as any).update({
      gateway_registration_status: payload.action === "register" ? "registering" : (camera as any).gateway_registration_status,
      status: payload.action === "register" ? "pending_gateway" : (camera as any).status,
      gateway_provider: getGatewayProvider(),
      gateway_last_error: null
    }).eq("id", payload.camera_id);

    const result = payload.action === "register"
      ? await registerCameraSource(payload.camera_id, cameraInput(camera as any))
      : await testCameraSource(cameraInput(camera as any));
    const registered = result.status === "healthy";
    const streamId = (result as any).streamId ?? (camera as any).gateway_source_id ?? (camera as any).gateway_stream_id ?? (camera as any).video_gateway_stream_id ?? `camera_${payload.camera_id.replaceAll("-", "")}`;
    const playback = (result as any).playback ?? null;
    const patch = {
      status: registered ? "connected" : "pending_gateway",
      stream_status: registered ? "connected" : "pending",
      health_status: registered ? "healthy" : "pending",
      gateway_provider: result.provider ?? getGatewayProvider(),
      gateway_source_id: streamId,
      gateway_playback_id: streamId,
      gateway_stream_id: streamId,
      video_gateway_stream_id: streamId,
      gateway_registration_status: registered ? "registered" : result.status === "gateway_required" ? "pending_gateway" : "failed",
      gateway_registered_at: registered ? now : (camera as any).gateway_registered_at,
      gateway_health_status: result.status,
      gateway_latency_ms: result.latencyMs ?? null,
      gateway_stream_count: result.streamCount ?? 0,
      gateway_failed_stream_count: result.failedStreamCount ?? 0,
      gateway_last_error: registered ? null : result.message,
      last_test_status: result.status,
      last_test_message: result.message,
      last_test_at: now,
      hls_playback_url: playback?.hls_url ?? (camera as any).hls_playback_url,
      webrtc_playback_url: playback?.webrtc_url ?? (camera as any).webrtc_playback_url,
      recording_enabled: Boolean((camera as any).recording_enabled),
      retention_days: (camera as any).retention_days ?? null,
      storage_location: (camera as any).storage_location ?? null
    };
    const { data, error } = await supabase.from("camera_streams" as any).update(patch).eq("id", payload.camera_id).select("*").single();
    if (error) return fail(error.message, 400);
    await supabase.from("audit_logs" as any).insert({
      actor_id: profile.id,
      actor_role: profile.role,
      garden_id: cameraGardenId,
      entity_type: "camera_streams",
      entity_id: payload.camera_id,
      action: `video_gateway_${payload.action}`,
      after_data: { gateway_status: result.status, provider: result.provider, no_rtsp_exposed: true }
    });
    return ok({ camera: data, gateway: result, message: registered ? "המצלמה נרשמה ל-Gateway." : result.message });
  } catch (error) {
    return handleRouteError(error);
  }
}
