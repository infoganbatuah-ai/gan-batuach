import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { verifyGatewayDeviceAccessToken } from "@/lib/domain/gateway-device-enrollment";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const identifier = z.string().trim().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/);
const heartbeatSchema = z.object({
  heartbeat_id: identifier,
  gateway_id: z.string().uuid(),
  observer_site_id: z.string().uuid(),
  observed_at: z.string().datetime(),
  runtime: z.object({
    contract: z.literal("observer-edge-runtime-v1"),
    device_type: z.enum(["SOFTWARE_CONNECTOR", "PHYSICAL_GATEWAY"]),
    installation_id: identifier,
    software_version: z.string().trim().min(1).max(80),
    build_sha: z.string().trim().min(1).max(80),
    outbound_only: z.literal(true),
    arbitrary_shell_commands: z.literal(false)
  }).passthrough(),
  health: z.object({
    status: z.enum(["HEALTHY", "DEGRADED", "OFFLINE", "NO_FRAMES", "HIGH_LATENCY", "UNSTABLE"]),
    uptime_seconds: z.number().nonnegative().max(10 * 365 * 24 * 60 * 60),
    cpu_percent: z.number().min(0).max(100).nullable(),
    memory_mb: z.number().nonnegative().max(1024 * 1024).nullable(),
    disk_free_mb: z.number().nonnegative().max(1024 * 1024 * 1024).nullable(),
    camera_count: z.number().int().min(0).max(64),
    streaming_count: z.number().int().min(0).max(64),
    last_frame_at: z.string().datetime().nullable(),
    error_codes: z.array(z.string().trim().min(2).max(80).regex(/^[A-Za-z0-9_.:-]+$/)).max(20)
  })
}).strict();

function cloudSecret() {
  return process.env.VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET || "";
}

export async function POST(request: Request) {
  try {
    const secret = cloudSecret();
    if (!secret) return fail("Connector heartbeat is not configured.", 503);
    const device = verifyGatewayDeviceAccessToken(request.headers.get("x-video-gateway-device-token") || "", secret);
    if (!device) return fail("Connector identity is invalid or expired.", 401);
    const payload = heartbeatSchema.parse(await request.json());
    if (payload.gateway_id !== device.gateway_id || payload.observer_site_id !== device.observer_site_id
      || request.headers.get("x-video-gateway-id") !== device.gateway_id) {
      return fail("Connector heartbeat scope mismatch.", 403);
    }
    const observedAt = Date.parse(payload.observed_at);
    if (!Number.isFinite(observedAt) || Math.abs(Date.now() - observedAt) > 5 * 60_000) return fail("Connector heartbeat is stale.", 401);

    const admin = createAdminClient();
    const enrollment = await admin.from("video_gateway_device_enrollments")
      .select("id,status,observer_site_id,gateway_id,metadata")
      .eq("id", device.device_id).eq("gateway_id", device.gateway_id)
      .eq("observer_site_id", device.observer_site_id).eq("status", "delivered").maybeSingle();
    if (enrollment.error || !enrollment.data) return fail("Connector identity was revoked.", 401);

    const previous = enrollment.data.metadata && typeof enrollment.data.metadata === "object" ? enrollment.data.metadata : {};
    const enrolledDeviceType = previous.device_type === "SOFTWARE_CONNECTOR" ? "SOFTWARE_CONNECTOR" : "PHYSICAL_GATEWAY";
    if (payload.runtime.device_type !== enrolledDeviceType
      || (typeof previous.installation_id === "string" && previous.installation_id !== payload.runtime.installation_id)) {
      return fail("Connector runtime identity does not match enrollment.", 403);
    }
    const previousObservedAt = Date.parse(String(previous.last_heartbeat_at || ""));
    if (Number.isFinite(previousObservedAt) && observedAt < previousObservedAt) return fail("Older Connector heartbeat rejected.", 409);
    const configVersion = Number.isInteger(previous.connector_config_version) && previous.connector_config_version > 0
      ? previous.connector_config_version : 1;
    if (previous.last_heartbeat_id === payload.heartbeat_id) {
      return ok({
        status: "accepted",
        idempotent_replay: true,
        device_type: enrolledDeviceType,
        config: {
          version: configVersion,
          issued_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 60 * 60_000).toISOString(),
          cameras: [],
          sampling_policy: { mode: "cloud_managed" }
        },
        commands: [],
        revoked: false
      });
    }
    const metadata = {
      ...previous,
      device_type: payload.runtime.device_type,
      installation_id: payload.runtime.installation_id,
      software_version: payload.runtime.software_version,
      build_sha: payload.runtime.build_sha,
      runtime_contract: payload.runtime.contract,
      outbound_only: true,
      arbitrary_shell_commands: false,
      last_heartbeat_id: payload.heartbeat_id,
      last_heartbeat_at: payload.observed_at,
      health: payload.health
    };
    const updated = await admin.from("video_gateway_device_enrollments")
      .update({ metadata, updated_at: new Date().toISOString() })
      .eq("id", enrollment.data.id).eq("status", "delivered").select("id").maybeSingle();
    if (updated.error || !updated.data) throw new Error("CONNECTOR_HEARTBEAT_WRITE_FAILED");

    return ok({
      status: "accepted",
      device_type: payload.runtime.device_type,
      config: {
        version: configVersion,
        issued_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 60 * 60_000).toISOString(),
        cameras: [],
        sampling_policy: { mode: "cloud_managed" }
      },
      commands: [],
      revoked: false
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
