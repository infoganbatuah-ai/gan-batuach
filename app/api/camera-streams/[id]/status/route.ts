import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { recordCameraHealthCheck } from "@/lib/domain/camera-health";
import { hasPlaybackSource } from "@/lib/domain/video-gateway";
import { getGatewayProvider, registerCameraSource, testCameraSource } from "@/lib/domain/video-gateway-client";
import { createClient } from "@/lib/supabase/server";

const actionSchema = z.object({
  action: z.enum(["enable", "disable", "test_connection", "register_gateway", "mark_offline", "mark_connected"]),
  note: z.string().optional()
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireRole(["admin", "manager", "owner"]);
    const { id } = await context.params;
    const body = actionSchema.parse(await request.json());
    const supabase = await createClient();
    const { data: camera, error: cameraError } = await supabase.from("camera_streams" as any).select("*").eq("id", id).single();
    if (cameraError || !camera) return fail(cameraError?.message ?? "Camera not found", 404);

    const cameraGardenId = (camera as any).garden_id ?? (camera as any).kindergarten_id;
    if (profile.role !== "admin" && profile.garden_id !== cameraGardenId) return fail("Forbidden", 403);

    let update: Record<string, unknown> = {};
    const now = new Date().toISOString();
    if (body.action === "disable") {
      update = { active: false, status: "disabled", stream_status: "disabled", health_status: "disabled", disabled_at: now, disabled_by: profile.id };
    }
    if (body.action === "enable") {
      update = { active: true, status: hasPlaybackSource(camera as any) ? "connected" : "pending_gateway", stream_status: hasPlaybackSource(camera as any) ? "connected" : "pending", health_status: hasPlaybackSource(camera as any) ? "healthy" : "pending", disabled_at: null, disabled_by: null };
    }
    if (body.action === "mark_offline") {
      const row = await recordCameraHealthCheck(supabase as any, camera as any, { offline: true, metadata: { source: "manual", note: body.note ?? null } });
      return ok({ camera: row, message: "המצלמה סומנה כלא מחוברת" });
    }
    if (body.action === "mark_connected") {
      const row = await recordCameraHealthCheck(supabase as any, camera as any, { metadata: { source: "manual", note: body.note ?? null } });
      return ok({ camera: row, message: "המצלמה סומנה כמחוברת" });
    }
    if (body.action === "test_connection") {
      const gatewayTest = await testCameraSource({
        system_type: ((camera as any).system_type as any) || "manual_rtsp",
        host: (camera as any).connection_host ?? (camera as any).host ?? undefined,
        port: (camera as any).connection_port ?? (camera as any).port ?? undefined,
        channel: (camera as any).connection_channel ?? (camera as any).channel ?? undefined,
        stream_quality: (camera as any).stream_quality === "main" ? "main" : "sub"
      });
      update = hasPlaybackSource(camera as any) && gatewayTest.status !== "gateway_required"
        ? { status: "connected", stream_status: "connected", health_status: "healthy", last_seen: now, last_stream_activity_at: now, last_successful_connection_at: now, health_summary: { ...((camera as any).health_summary ?? {}), last_manual_test_at: now, playback_source_found: true } }
        : { status: "pending_gateway", stream_status: "pending", health_status: "pending", last_test_status: gatewayTest.status, last_test_message: gatewayTest.message, last_test_at: now, gateway_registration_status: "pending_gateway", gateway_last_error: gatewayTest.message, health_summary: { ...((camera as any).health_summary ?? {}), last_manual_test_at: now, playback_source_found: false, message: gatewayTest.message } };
    }
    if (body.action === "register_gateway") {
      const gateway = await registerCameraSource(id, {
        system_type: ((camera as any).system_type as any) || "manual_rtsp",
        host: (camera as any).connection_host ?? (camera as any).host ?? undefined,
        port: (camera as any).connection_port ?? (camera as any).port ?? undefined,
        channel: (camera as any).connection_channel ?? (camera as any).channel ?? undefined,
        stream_quality: (camera as any).stream_quality === "main" ? "main" : "sub",
        manual_rtsp_url: (camera as any).source_url && !String((camera as any).source_url).includes("@") ? (camera as any).source_url : undefined
      });
      const registered = gateway.status === "healthy";
      update = {
        status: registered ? "connected" : "pending_gateway",
        stream_status: registered ? "connected" : "pending",
        health_status: registered ? "healthy" : "pending",
        gateway_provider: gateway.provider ?? getGatewayProvider(),
        gateway_source_id: gateway.streamId,
        gateway_playback_id: gateway.streamId,
        gateway_stream_id: gateway.streamId,
        video_gateway_stream_id: gateway.streamId,
        gateway_registration_status: registered ? "registered" : gateway.status === "gateway_required" ? "pending_gateway" : "failed",
        gateway_registered_at: registered ? now : (camera as any).gateway_registered_at,
        gateway_health_status: gateway.status,
        gateway_latency_ms: gateway.latencyMs ?? null,
        gateway_last_error: registered ? null : gateway.message,
        hls_playback_url: gateway.playback?.hls_url ?? (camera as any).hls_playback_url,
        webrtc_playback_url: gateway.playback?.webrtc_url ?? (camera as any).webrtc_playback_url,
        last_test_status: gateway.status,
        last_test_message: gateway.message,
        last_test_at: now
      };
    }

    let { data, error } = await supabase.from("camera_streams" as any).update(update).eq("id", id).select("*").single();
    if (error && /column .* does not exist|schema cache/i.test(error.message ?? "")) {
      const legacyUpdate = { ...update };
      ["stream_status", "health_status", "last_seen", "last_stream_activity_at", "last_successful_connection_at", "health_summary", "disabled_at", "disabled_by"].forEach((key) => delete legacyUpdate[key]);
      const fallback = await supabase.from("camera_streams" as any).update(legacyUpdate).eq("id", id).select("*").single();
      data = fallback.data;
      error = fallback.error;
    }
    if (error) return fail(error.message, 400);
    await supabase.from("audit_logs" as any).insert({
      actor_id: profile.id,
      actor_role: profile.role,
      garden_id: cameraGardenId,
      entity_type: "camera_streams",
      entity_id: id,
      action: `camera_${body.action}`,
      before_data: { status: (camera as any).status, active: (camera as any).active },
      after_data: { status: (data as any).status, active: (data as any).active, note: body.note ?? null }
    });
    await supabase.from("camera_infrastructure_audit_logs" as any).insert({
      actor_id: profile.id,
      actor_role: profile.role,
      garden_id: cameraGardenId,
      camera_id: id,
      action: `camera_${body.action}`,
      status: body.action === "test_connection" && (data as any).last_test_status !== "healthy" ? "warning" : "success",
      no_secrets_exposed: true,
      before_data: { status: (camera as any).status, active: (camera as any).active },
      after_data: { status: (data as any).status, active: (data as any).active, gateway_registration_status: (data as any).gateway_registration_status ?? null },
      metadata: { note: body.note ?? null }
    });
    return ok({ camera: data, message: "סטטוס המצלמה עודכן" });
  } catch (error) {
    return handleRouteError(error);
  }
}
