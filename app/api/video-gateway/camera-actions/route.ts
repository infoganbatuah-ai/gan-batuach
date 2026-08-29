import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { verifyGatewayDeviceAccessToken } from "@/lib/domain/gateway-device-enrollment";
import { createAdminClient } from "@/lib/supabase/admin";

const pollSchema = z.object({ action: z.literal("poll") });
const resultSchema = z.object({
  action: z.literal("result"),
  request_id: z.string().uuid(),
  outcome: z.enum(["succeeded", "failed"]),
  result_code: z.string().trim().min(2).max(80)
});
const schema = z.discriminatedUnion("action", [pollSchema, resultSchema]);

async function authenticatedDevice(request: Request) {
  const secret = process.env.VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET;
  const token = request.headers.get("x-video-gateway-device-token")?.trim() ?? "";
  if (!secret || !token) return null;
  const claims = verifyGatewayDeviceAccessToken(token, secret);
  if (!claims) return null;
  const supabase = createAdminClient();
  const enrollment = await supabase.from("video_gateway_device_enrollments" as any)
    .select("id")
    .eq("id", claims.device_id)
    .eq("gateway_id", claims.gateway_id)
    .eq("observer_site_id", claims.observer_site_id)
    .eq("status", "delivered")
    .maybeSingle();
  return enrollment.data ? { claims, supabase } : null;
}

function sourceBelongsToGateway(source: any, gatewayId: string) {
  return source?.metadata?.gateway_id === gatewayId && Boolean(source?.metadata?.gateway_stream_id);
}

export async function POST(request: Request) {
  try {
    const device = await authenticatedDevice(request);
    if (!device) return fail("Gateway device authentication failed.", 401);
    const payload = schema.parse(await request.json());
    const { claims, supabase } = device;

    if (payload.action === "poll") {
      const now = new Date().toISOString();
      await supabase.from("digital_observer_camera_action_requests" as any)
        .update({ action_status: "expired", updated_at: now })
        .eq("observer_site_id", claims.observer_site_id)
        .eq("action_status", "approved")
        .lte("expires_at", now);

      const candidates = await supabase.from("digital_observer_camera_action_requests" as any)
        .select("id,camera_source_id,action_type,parameters,capability_evidence,expires_at")
        .eq("observer_site_id", claims.observer_site_id)
        .eq("action_status", "approved")
        .gt("expires_at", now)
        .order("created_at")
        .limit(10);
      for (const candidate of candidates.data ?? []) {
        const source = await supabase.from("digital_observer_camera_sources" as any)
          .select("id,metadata")
          .eq("id", candidate.camera_source_id)
          .eq("observer_site_id", claims.observer_site_id)
          .maybeSingle();
        if (!sourceBelongsToGateway(source.data, claims.gateway_id)) continue;
        const deliveredAt = new Date().toISOString();
        const delivered = await supabase.from("digital_observer_camera_action_requests" as any)
          .update({ action_status: "delivered", delivered_at: deliveredAt, updated_at: deliveredAt })
          .eq("id", candidate.id)
          .eq("action_status", "approved")
          .select("id")
          .maybeSingle();
        if (!delivered.data) continue;
        return ok({
          action_request: {
            id: candidate.id,
            action_type: candidate.action_type,
            parameters: candidate.parameters,
            capability_evidence: candidate.capability_evidence,
            gateway_stream_id: source.data.metadata.gateway_stream_id,
            expires_at: candidate.expires_at
          }
        });
      }
      return ok({ action_request: null });
    }

    const actionRequest = await supabase.from("digital_observer_camera_action_requests" as any)
      .select("id,camera_source_id,action_type,action_status")
      .eq("id", payload.request_id)
      .eq("observer_site_id", claims.observer_site_id)
      .maybeSingle();
    if (!actionRequest.data || actionRequest.data.action_status !== "delivered") return fail("Camera action is unavailable for result reporting.", 409);
    const source = await supabase.from("digital_observer_camera_sources" as any)
      .select("id,metadata")
      .eq("id", actionRequest.data.camera_source_id)
      .eq("observer_site_id", claims.observer_site_id)
      .maybeSingle();
    if (!sourceBelongsToGateway(source.data, claims.gateway_id)) return fail("Camera action does not belong to this Gateway.", 403);
    const completedAt = new Date().toISOString();
    await supabase.from("digital_observer_camera_action_requests" as any).update({
      action_status: payload.outcome,
      completed_at: completedAt,
      updated_at: completedAt,
      result: { code: payload.result_code, reported_by_gateway: true }
    }).eq("id", payload.request_id).eq("action_status", "delivered");
    await supabase.from("observer_capability_audit_events" as any).insert({
      event_key: `camera-action-camera_action_result-${payload.request_id}`,
      event_type: "camera_action_result",
      vertical_key: "home_observer",
      capability_key: actionRequest.data.action_type,
      status: payload.outcome === "succeeded" ? "success" : "failed",
      reason: payload.result_code,
      metadata: {
        observer_site_id: claims.observer_site_id,
        camera_source_id: actionRequest.data.camera_source_id,
        camera_action_request_id: payload.request_id,
        gateway_id: claims.gateway_id,
        no_credentials_returned: true
      }
    });
    return ok({ recorded: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
