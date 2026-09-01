import { verifyGatewayDeviceAccessToken } from "../gateway-device-enrollment";

export async function authenticateEventGateway(request: Request, supabase: any) {
  const secret = process.env.VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET;
  if (!secret) throw new Error("GATEWAY_AUTH_NOT_CONFIGURED");
  const device = verifyGatewayDeviceAccessToken(request.headers.get("x-video-gateway-device-token") || "", secret);
  if (!device) return null;
  const result = await supabase.from("video_gateway_device_enrollments").select("id")
    .eq("id", device.device_id).eq("gateway_id", device.gateway_id)
    .eq("observer_site_id", device.observer_site_id).eq("status", "delivered").maybeSingle();
  if (result.error) throw new Error("GATEWAY_AUTH_UNAVAILABLE");
  return result.data ? device : null;
}
