import { createHash } from "node:crypto";
import { gatewayDeviceSessionAllows, verifyGatewayDeviceAccessToken } from "../gateway-device-enrollment";

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

export async function authenticateEventGateway(request: Request, supabase: unknown, operation = "EVENT_INGEST") {
  const database = supabase as GatewayAuthDatabase;
  const secret = process.env.VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET;
  if (!secret) throw new Error("GATEWAY_AUTH_NOT_CONFIGURED");
  const device = verifyGatewayDeviceAccessToken(request.headers.get("x-video-gateway-device-token") || "", secret);
  if (!device || !gatewayDeviceSessionAllows(device, operation)) return null;
  const result = await database.from("video_gateway_device_enrollments").select("id,lifecycle_state,identity_scheme,credential_version,deployment_profile")
    .eq("id", device.device_id).eq("gateway_id", device.gateway_id)
    .eq("observer_site_id", device.observer_site_id).eq("status", "delivered").maybeSingle();
  if (result.error) throw new Error("GATEWAY_AUTH_UNAVAILABLE");
  const row = result.data as { lifecycle_state?: string; identity_scheme?: string; credential_version?: number; deployment_profile?: string } | null;
  if (!row || (row.lifecycle_state && row.lifecycle_state !== "ACTIVE")) return null;
  if (device.version === 2 && (row.credential_version !== device.credential_version || row.deployment_profile !== device.deployment_profile)) return null;
  return device;
}
