import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { verifyGatewayDeviceAccessToken } from "@/lib/domain/gateway-device-enrollment";
import { createAdminClient } from "@/lib/supabase/admin";

const pollSchema = z.object({ action: z.literal("poll") });
const resultSchema = z.object({
  action: z.literal("result"), request_id: z.string().uuid(),
  outcome: z.enum(["succeeded", "failed", "capability_snapshot", "command_preflight"]),
  result_code: z.string().trim().min(2).max(80), outcome_payload: z.record(z.string(), z.unknown()).optional()
});
const schema = z.discriminatedUnion("action", [pollSchema, resultSchema]);

async function authenticatedDevice(request: Request) {
  const secret = process.env.VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET;
  const token = request.headers.get("x-video-gateway-device-token")?.trim() ?? "";
  if (!secret || !token) return null;
  const claims = verifyGatewayDeviceAccessToken(token, secret);
  if (!claims) return null;
  const supabase = createAdminClient();
  const enrollment = await supabase.from("video_gateway_device_enrollments" as any).select("id")
    .eq("id", claims.device_id).eq("gateway_id", claims.gateway_id).eq("observer_site_id", claims.observer_site_id).eq("status", "delivered").maybeSingle();
  return enrollment.data ? { claims, supabase: supabase as any } : null;
}

function scoped(source: any, claims: any) {
  return source?.id && source.observer_site_id === claims.observer_site_id
    && source.metadata?.gateway_id === claims.gateway_id && Boolean(source.metadata?.gateway_stream_id);
}

export async function POST(request: Request) {
  try {
    const device = await authenticatedDevice(request);
    if (!device) return fail("Gateway device authentication failed.", 401);
    const payload = schema.parse(await request.json());
    const { claims, supabase } = device;
    if (payload.action === "poll") {
      const now = new Date().toISOString();
      await supabase.from("digital_observer_camera_action_requests" as any).update({ action_status: "expired", updated_at: now })
        .eq("observer_site_id", claims.observer_site_id).eq("action_status", "approved").lte("expires_at", now);
      const candidates: any[] = [];
      for (let offset = 0; offset < 5000 && candidates.length === offset; offset += 100) {
        const page = await supabase.from("digital_observer_camera_action_requests" as any)
          .select("id,camera_source_id,action_type,parameters,capability_evidence,expires_at,created_at")
          .eq("observer_site_id", claims.observer_site_id).eq("action_status", "approved").gt("expires_at", now).order("created_at").range(offset, offset + 99);
        candidates.push(...(page.data ?? []));
        if ((page.data ?? []).length < 100) break;
      }
      for (const candidate of candidates) {
        const source = await supabase.from("digital_observer_camera_sources" as any).select("id,observer_site_id,metadata")
          .eq("id", candidate.camera_source_id).eq("observer_site_id", claims.observer_site_id).maybeSingle();
        if (!scoped(source.data, claims)) continue;
        const deliveredAt = new Date().toISOString();
        const delivered = await supabase.from("digital_observer_camera_action_requests" as any).update({ action_status: "delivered", delivered_at: deliveredAt, updated_at: deliveredAt })
          .eq("id", candidate.id).eq("action_status", "approved").select("id").maybeSingle();
        if (!delivered.data) continue;
        return ok({ action_request: { id: candidate.id, task_kind: "command_preflight", camera_id: source.data.id, site_id: claims.observer_site_id,
          stream_id: source.data.metadata.gateway_stream_id, channel: source.data.metadata.dvr_channel, requested_at: candidate.created_at,
          action: candidate.action_type, parameters: candidate.parameters, capability_evidence: candidate.capability_evidence, expires_at: candidate.expires_at } });
      }
      return ok({ action_request: null });
    }
    const actionRequest = await supabase.from("digital_observer_camera_action_requests" as any).select("id,camera_source_id,action_type,action_status")
      .eq("id", payload.request_id).eq("observer_site_id", claims.observer_site_id).maybeSingle();
    if (!actionRequest.data || actionRequest.data.action_status !== "delivered") return fail("Camera action is unavailable for result reporting.", 409);
    const source = await supabase.from("digital_observer_camera_sources" as any).select("id,observer_site_id,metadata")
      .eq("id", actionRequest.data.camera_source_id).eq("observer_site_id", claims.observer_site_id).maybeSingle();
    if (!scoped(source.data, claims)) return fail("Camera action does not belong to this Gateway.", 403);
    if (payload.outcome === "succeeded") {
      const result = payload.outcome_payload;
      if (!result || result.camera_id !== actionRequest.data.camera_source_id || result.site_id !== claims.observer_site_id
        || result.executor_installed !== true || result.executed !== true) return fail("Physical success requires verified executor evidence.", 422);
    }
    if (["capability_snapshot", "command_preflight"].includes(payload.outcome)) {
      const result = payload.outcome_payload;
      if (!result || result.camera_id !== actionRequest.data.camera_source_id || result.site_id !== claims.observer_site_id
        || result.executor_installed !== false || result.executed !== false) return fail("Gateway preflight result is invalid.", 422);
    }
    const completedAt = new Date().toISOString();
    const terminalStatus = payload.outcome === "succeeded" ? "succeeded" : payload.outcome === "failed" ? "failed" : "completed";
    const { data: updated, error: updateError } = await supabase.from("digital_observer_camera_action_requests" as any).update({ action_status: terminalStatus, completed_at: completedAt, updated_at: completedAt,
      result: { code: payload.result_code, outcome: payload.outcome, outcome_payload: payload.outcome_payload ?? null, reported_by_gateway: true } }).eq("id", payload.request_id).eq("action_status", "delivered").select("id").maybeSingle();
    if (updateError || !updated) return fail("Camera action result could not be recorded.", 503);
    return ok({ recorded: true });
  } catch (error) { return handleRouteError(error); }
}
