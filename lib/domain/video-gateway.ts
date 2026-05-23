import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptField } from "@/lib/security/encryption";

export const onvifDiscoverySchema = z.object({
  garden_id: z.string().uuid(),
  network_cidr: z.string(),
  username: z.string().optional(),
  password: z.string().optional()
});

export const rtspIngestSchema = z.object({
  garden_id: z.string().uuid(),
  camera_stream_id: z.string().uuid().optional(),
  name: z.string().min(2),
  area: z.string().min(2),
  rtsp_url: z.string().min(8),
  username: z.string().optional(),
  password: z.string().optional()
});

export const dvrConnectionSchema = z.object({
  garden_id: z.string().uuid(),
  connection_type: z.enum(["dvr", "nvr", "onvif", "rtsp"]),
  endpoint: z.string().min(3),
  port: z.number().int().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).default({})
});

export const streamHealthSchema = z.object({
  garden_id: z.string().uuid(),
  camera_stream_id: z.string().uuid(),
  black_screen: z.boolean().default(false),
  frozen: z.boolean().default(false),
  offline: z.boolean().default(false),
  covered: z.boolean().default(false),
  frame_loss_percent: z.number().optional(),
  latency_ms: z.number().int().optional(),
  bitrate_kbps: z.number().int().optional(),
  metadata: z.record(z.string(), z.unknown()).default({})
});

async function gatewayRequest(path: string, payload: unknown) {
  if (!process.env.VIDEO_GATEWAY_URL) {
    return { gateway_unconfigured: true, path, payload };
  }

  const response = await fetch(`${process.env.VIDEO_GATEWAY_URL}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-video-gateway-secret": process.env.VIDEO_GATEWAY_SIGNING_SECRET ?? ""
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) throw new Error(`Video gateway error ${response.status}`);
  return response.json();
}

export async function discoverOnvif(payload: z.infer<typeof onvifDiscoverySchema>) {
  const parsed = onvifDiscoverySchema.parse(payload);
  const gateway = await gatewayRequest("/onvif/discover", parsed);
  return gateway;
}

export async function ingestRtsp(payload: z.infer<typeof rtspIngestSchema>) {
  const parsed = rtspIngestSchema.parse(payload);
  const supabase = createAdminClient();
  const gateway = await gatewayRequest("/streams/rtsp", parsed);
  const gatewayStreamId = (gateway as any).stream_id ?? (gateway as any).id ?? null;

  const { data: camera, error } = await supabase
    .from("camera_streams")
    .upsert({
      id: parsed.camera_stream_id,
      garden_id: parsed.garden_id,
      name: parsed.name,
      area: parsed.area,
      protocol: "RTSP",
      video_gateway_stream_id: gatewayStreamId,
      hls_playback_url: (gateway as any).hls_url,
      webrtc_playback_url: (gateway as any).webrtc_url,
      active: true
    } as any)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return { camera, gateway };
}

export async function createDvrConnection(payload: z.infer<typeof dvrConnectionSchema>) {
  const parsed = dvrConnectionSchema.parse(payload);
  const supabase = createAdminClient();
  const gateway = await gatewayRequest("/dvr/connect", parsed);
  const { data, error } = await supabase
    .from("video_gateway_connections")
    .insert({
      garden_id: parsed.garden_id,
      connection_type: parsed.connection_type,
      endpoint_encrypted: encryptField(parsed.endpoint),
      port: parsed.port,
      username_encrypted: encryptField(parsed.username),
      password_encrypted: encryptField(parsed.password),
      gateway_stream_id: (gateway as any).stream_id,
      status: "connected",
      metadata: parsed.metadata
    } as any)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return { connection: data, gateway };
}

export async function recordStreamHealth(payload: z.infer<typeof streamHealthSchema>) {
  const parsed = streamHealthSchema.parse(payload);
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("stream_health_checks").insert(parsed as any).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}
