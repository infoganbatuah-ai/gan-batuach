import { z } from "zod";

export const cameraConnectionInputSchema = z.object({
  system_type: z.enum([
    "dvr",
    "nvr",
    "dvr_nvr",
    "ip_camera",
    "rtsp",
    "onvif",
    "hikvision",
    "dahua",
    "uniview",
    "axis",
    "generic_camera",
    "manual_rtsp",
    "sample_hls"
  ]),
  host: z.string().optional(),
  port: z.coerce.number().int().min(1).max(65535).optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  channel: z.coerce.number().int().min(1).optional(),
  stream_quality: z.enum(["main", "sub"]).default("sub"),
  manual_rtsp_url: z.string().optional(),
  sample_hls_url: z.string().optional()
});

export type CameraConnectionInput = z.infer<typeof cameraConnectionInputSchema>;

function encodeCredential(value?: string | null) {
  return encodeURIComponent(value ?? "");
}

function channelSuffix(channel: number, quality: "main" | "sub") {
  return `${channel}${quality === "main" ? "01" : "02"}`;
}

export function buildRtspCandidates(input: CameraConnectionInput) {
  const parsed = cameraConnectionInputSchema.parse(input);
  if (parsed.system_type === "sample_hls") return [];
  if (parsed.system_type === "manual_rtsp") return parsed.manual_rtsp_url ? [{ vendor: "manual", template: "manual_rtsp", url: parsed.manual_rtsp_url }] : [];
  const host = parsed.host?.trim();
  if (!host) return [];
  const port = parsed.port ?? 554;
  const user = encodeCredential(parsed.username);
  const pass = encodeCredential(parsed.password);
  const auth = parsed.username || parsed.password ? `${user}:${pass}@` : "";
  const channel = parsed.channel ?? 1;
  const subtype = parsed.stream_quality === "main" ? 0 : 1;
  const hikvisionChannel = channelSuffix(channel, parsed.stream_quality);
  const candidates = [
    { vendor: "Hikvision", template: "hikvision_streaming_channels", url: `rtsp://${auth}${host}:${port}/Streaming/Channels/${hikvisionChannel}` },
    { vendor: "Dahua", template: "dahua_realmonitor", url: `rtsp://${auth}${host}:${port}/cam/realmonitor?channel=${channel}&subtype=${subtype}` },
    { vendor: "Uniview", template: "uniview_unicast", url: `rtsp://${auth}${host}:${port}/unicast/c${channel}/s${parsed.stream_quality === "main" ? 0 : 1}` },
    { vendor: "Axis", template: "axis_media", url: `rtsp://${auth}${host}:${port}/axis-media/media.amp` },
    { vendor: "Generic", template: "generic_channel_quality", url: `rtsp://${auth}${host}:${port}/ch${channel}/${parsed.stream_quality}` },
    { vendor: "Generic", template: "generic_stream", url: `rtsp://${auth}${host}:${port}/stream${channel}` }
  ];
  if (parsed.system_type === "hikvision") return candidates.filter((item) => item.vendor === "Hikvision");
  if (parsed.system_type === "dahua") return candidates.filter((item) => item.vendor === "Dahua");
  if (parsed.system_type === "uniview") return candidates.filter((item) => item.vendor === "Uniview");
  if (parsed.system_type === "axis") return candidates.filter((item) => item.vendor === "Axis");
  if (parsed.system_type === "rtsp" || parsed.system_type === "generic_camera" || parsed.system_type === "ip_camera") return candidates;
  return candidates;
}

export function buildMaskedConnectionSummary(input: CameraConnectionInput) {
  const parsed = cameraConnectionInputSchema.parse(input);
  const host = parsed.host?.trim();
  return {
    system_type: parsed.system_type,
    host: host && host.length > 4 ? host.replace(/^(.{2}).*(.{2})$/, "$1***$2") : host ?? null,
    port: parsed.port ?? null,
    channel: parsed.channel ?? null,
    stream_quality: parsed.stream_quality,
    username_present: Boolean(parsed.username),
    password_present: Boolean(parsed.password),
    candidates_available: buildRtspCandidates(parsed).length
  };
}
