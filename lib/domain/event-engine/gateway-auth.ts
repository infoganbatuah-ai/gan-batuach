import { createHash } from "node:crypto";
import { verifyGatewayDeviceAccessToken } from "../gateway-device-enrollment";

type GatewayEnrollmentQuery = {
  eq(field: string, value: string): GatewayEnrollmentQuery;
  maybeSingle(): Promise<{ data: unknown; error: unknown }>;
};
type GatewayAuthDatabase = {
  from(table: string): { select(fields: string): GatewayEnrollmentQuery };
};

// Exposes a bounded one-way environment identifier to an already-authenticated
// Gateway without returning a URL or credential.
export function eventEnvironmentFingerprint(environment: NodeJS.ProcessEnv = process.env) {
  const identity = environment.NEXT_PUBLIC_SUPABASE_URL || environment.SUPABASE_URL;
  if (!identity) return null;
  return `env-sha256:${createHash("sha256").update(identity).digest("hex").slice(0, 16)}`;
}

export async function authenticateEventGateway(request: Request, supabase: unknown) {
  const database = supabase as GatewayAuthDatabase;
  const secret = process.env.VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET;
  if (!secret) throw new Error("GATEWAY_AUTH_NOT_CONFIGURED");
  const device = verifyGatewayDeviceAccessToken(request.headers.get("x-video-gateway-device-token") || "", secret);
  if (!device) return null;
  const result = await database.from("video_gateway_device_enrollments").select("id")
    .eq("id", device.device_id).eq("gateway_id", device.gateway_id)
    .eq("observer_site_id", device.observer_site_id).eq("status", "delivered").maybeSingle();
  if (result.error) throw new Error("GATEWAY_AUTH_UNAVAILABLE");
  return result.data ? device : null;
}
