import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const workdir = process.cwd();
const runtimeConfigPath = process.env.GAN_BATUACH_GATEWAY_CONFIG || `${process.env.HOME}/.config/gan-batuach/home-gateway.json`;
const gatewayUrl = "http://127.0.0.1:18082";
const gatewayKeychainService = process.env.GAN_BATUACH_GATEWAY_KEYCHAIN_SERVICE || "com.ganbatuach.video-gateway.runtime";

const config = JSON.parse(readFileSync(runtimeConfigPath, "utf8"));
function keychainSecret(account) {
  const result = spawnSync("/usr/bin/security", ["find-generic-password", "-s", gatewayKeychainService, "-a", account, "-w"], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "";
}
const passwordResult = spawnSync("/usr/bin/security", ["find-generic-password", "-s", config.keychain_service, "-a", config.username, "-w"], { encoding: "utf8" });
if (passwordResult.status !== 0 || !passwordResult.stdout.trim()) throw new Error("DVR credential is not available in macOS Keychain");
const password = passwordResult.stdout.trim();
const gatewaySecret = keychainSecret("gateway_signing_secret");
const cloudSecret = keychainSecret("cloud_discovery_secret");
const deviceGatewayId = keychainSecret("device_gateway_id");
const deviceObserverSiteId = keychainSecret("device_observer_site_id");
let deviceRefreshToken = keychainSecret("device_refresh_token");
const gatewayId = deviceGatewayId || keychainSecret("cloud_gateway_id");
const observerSiteId = deviceObserverSiteId || keychainSecret("cloud_observer_site_id");
const productionBaseUrl = keychainSecret("device_cloud_base_url") || keychainSecret("cloud_base_url") || "https://ganbatuach.com";
if (!gatewaySecret || !gatewayId || !observerSiteId || (!deviceRefreshToken && !cloudSecret)) throw new Error("Persistent gateway cloud configuration is incomplete");

function storeKeychainSecret(account, value) {
  const result = spawnSync("/usr/bin/security", ["add-generic-password", "-U", "-s", gatewayKeychainService, "-a", account, "-w", value], { encoding: "utf8" });
  if (result.status !== 0) throw new Error("Unable to rotate Gateway Keychain material");
}

async function refreshDeviceAccess() {
  if (!deviceRefreshToken || !deviceGatewayId || !deviceObserverSiteId) return null;
  const response = await fetch(`${productionBaseUrl.replace(/\/$/, "")}/api/digital-observer/gateway-enrollment`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "refresh", gateway_id: deviceGatewayId, refresh_token: deviceRefreshToken })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.data?.access_token || !payload.data?.refresh_token) throw new Error("Gateway device identity refresh failed");
  deviceRefreshToken = String(payload.data.refresh_token);
  storeKeychainSecret("device_refresh_token", deviceRefreshToken);
  return String(payload.data.access_token);
}

function sign(timestamp, nonce, body) {
  return `sha256=${crypto.createHmac("sha256", cloudSecret).update(`${timestamp}.${nonce}.${body}`).digest("hex")}`;
}

function signEventMedia(timestamp, nonce, metadataText, clipBytes, thumbnailBytes) {
  const clipHash = crypto.createHash("sha256").update(clipBytes).digest("hex");
  const thumbnailHash = crypto.createHash("sha256").update(thumbnailBytes).digest("hex");
  return `sha256=${crypto.createHmac("sha256", cloudSecret).update(`${timestamp}.${nonce}.${metadataText}.${clipHash}.${thumbnailHash}`).digest("hex")}`;
}

async function signedPost(path, payload, options = {}) {
  const body = JSON.stringify(payload);
  const deviceAccessToken = options.deviceAccess ? await refreshDeviceAccess() : null;
  const timestamp = new Date().toISOString();
  const nonce = crypto.randomUUID();
  const headers = { "content-type": "application/json", "x-video-gateway-id": gatewayId, "x-video-gateway-timestamp": timestamp, "x-video-gateway-nonce": nonce, ...(deviceAccessToken ? { "x-video-gateway-device-token": deviceAccessToken } : { "x-video-gateway-signature": sign(timestamp, nonce, body) }) };
  const response = await fetch(`${productionBaseUrl.replace(/\/$/, "")}${path}`, { method: "POST", headers, body });
  if (!response.ok) throw new Error(`Cloud request failed (${response.status})`);
  return response.json();
}

const child = spawn(process.execPath, ["services/video-gateway/server.mjs"], { cwd: workdir, env: { ...process.env, HOST: "127.0.0.1", PORT: "18082", VIDEO_GATEWAY_SIGNING_SECRET: gatewaySecret, DVR_EXPECTED_CHANNEL_COUNT: String(config.channel_count) }, stdio: "inherit" });

async function waitForGateway() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { if ((await fetch(`${gatewayUrl}/health`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Local gateway did not start");
}

let channels = [];
async function discover() {
  const health = await fetch(`${gatewayUrl}/health`).then((response) => response.ok ? response.json() : {}).catch(() => ({}));
  const response = await fetch(`${gatewayUrl}/dvr/connect`, { method: "POST", headers: { "content-type": "application/json", "x-video-gateway-secret": gatewaySecret }, body: JSON.stringify({ connection_type: "dvr", endpoint: config.endpoint, port: config.port, username: config.username, password, metadata: { vendor: config.vendor, expected_channel_count: config.channel_count, read_only_requested: true } }) });
  const result = await response.json();
  if (!response.ok) throw new Error("DVR discovery failed");
  channels = (result.channels || []).map((channel, index) => Object.fromEntries(Object.entries({ channel: Number(channel.channel || index + 1), name: channel.name, area: channel.area, stream_id: channel.stream_id, gateway_stream_id: channel.gateway_stream_id || channel.stream_id, status: channel.status, health_status: channel.health_status, width: channel.width ?? null, height: channel.height ?? null, candidates_tried: channel.candidates_tried, template: channel.template, reason: channel.reason }).filter(([, value]) => value !== undefined && value !== null)));
  const mapped = await signedPost("/api/video-gateway/cloud-discovery", { gateway_id: gatewayId, observer_site_id: observerSiteId, connection_type: "dvr", vendor: config.vendor, discovery_id: crypto.randomUUID(), discovered_at: new Date().toISOString(), channel_count: channels.length, connected_channel_count: channels.filter((channel) => channel.status === "connected").length, failed_channel_count: channels.filter((channel) => channel.status !== "connected").length, latency_ms: Number(result.latency_ms || 0), read_only: true, controls_supported: false, no_secrets_returned: true, channels, metadata: { source: "persistent_home_gateway", ai_shadow_only: true, read_only: true, edge_capability_contract: health.edge_capability_contract ?? null } }, { deviceAccess: true });
  const mappedPayload = mapped?.data && typeof mapped.data === "object" ? mapped.data : mapped;
  const mappedChannels = Array.isArray(mappedPayload?.channels) ? mappedPayload.channels : [];
  channels = channels.map((channel) => {
    const mappedChannel = mappedChannels.find((item) => item?.gateway_stream_id === channel.gateway_stream_id);
    return { ...channel, camera_source_id: mappedChannel?.camera_source_id ?? channel.camera_source_id ?? null };
  });
}

async function learn() {
  const samples = (await Promise.all(channels.filter((channel) => channel.status === "connected" && channel.gateway_stream_id).map(async (channel) => {
    try {
      const response = await fetch(`${gatewayUrl}/camera/${encodeURIComponent(channel.gateway_stream_id)}/insights`, { headers: { "x-video-gateway-secret": gatewaySecret } });
      const data = await response.json();
      if (!response.ok || data.local_processing !== true || data.no_raw_video_returned !== true) return null;
      return { stream_id: channel.gateway_stream_id, motion_score: Number(data.insight.motion_score || 0), luminance_score: Number(data.insight.luminance_score || 0), sampled_at: String(data.insight.sampled_at || new Date().toISOString()), sample_frames: Number(data.insight.sample_frames || 1) };
    } catch { return null; }
  }))).filter(Boolean);
  if (samples.length) await signedPost("/api/video-gateway/cloud-learning", { gateway_id: gatewayId, observer_site_id: observerSiteId, sample_id: crypto.randomUUID(), sampled_at: new Date().toISOString(), local_processing: true, no_raw_video_returned: true, samples });
}

async function submitReadinessEvidence() {
  const channel = channels.find((item) => item.status === "connected" && item.gateway_stream_id && item.camera_source_id);
  if (!channel) return { submitted: false, reason: "no_connected_mapped_channel" };
  const response = await fetch(`${gatewayUrl}/camera/${encodeURIComponent(channel.gateway_stream_id)}/event-media`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-video-gateway-secret": gatewaySecret },
    body: JSON.stringify({ window_seconds_before: 3, window_seconds_after: 5 })
  });
  const media = await response.json();
  if (!response.ok || media.status !== "available") return { submitted: false, reason: media.reason || "media_capture_failed" };
  const clipBytes = Buffer.from(String(media.clip?.base64 || ""), "base64");
  const thumbnailBytes = Buffer.from(String(media.thumbnail?.base64 || ""), "base64");
  if (!clipBytes.length || !thumbnailBytes.length) return { submitted: false, reason: "media_bytes_missing" };
  const metadata = {
    gateway_id: gatewayId,
    observer_site_id: observerSiteId,
    event_id: crypto.randomUUID(),
    camera_source_id: channel.camera_source_id,
    stream_id: channel.gateway_stream_id,
    event_type: "camera_media_readiness",
    severity: "info",
    confidence: 1,
    captured_at: media.captured_at || new Date().toISOString(),
    duration_seconds: Number(media.duration_seconds || 8),
    window_seconds_before: Number(media.window_seconds_before || 3),
    window_seconds_after: Number(media.window_seconds_after || 5),
    retry_count: 0,
    local_capture: true,
    read_only: true,
    controls_supported: false,
    no_dvr_credentials_returned: true,
    no_rtsp_returned: true,
    event_summary: "נוצר תיעוד מדיה מאומת מה-Gateway לצורך בדיקת חיבור ושמירה סביב אירוע בלבד.",
    event_context: "device_health",
    metadata: { source: "persistent_home_gateway", channel: channel.channel, ai_shadow_only: true }
  };
  const metadataText = JSON.stringify(metadata);
  const timestamp = new Date().toISOString();
  const nonce = crypto.randomUUID();
  const form = new FormData();
  form.set("metadata", metadataText);
  form.set("clip", new Blob([clipBytes], { type: "video/mp4" }), "clip.mp4");
  form.set("thumbnail", new Blob([thumbnailBytes], { type: "image/jpeg" }), "thumbnail.jpg");
  const upload = await fetch(`${productionBaseUrl.replace(/\/$/, "")}/api/video-gateway/cloud-event-media`, {
    method: "POST",
    headers: {
      "x-video-gateway-id": gatewayId,
      "x-video-gateway-timestamp": timestamp,
      "x-video-gateway-nonce": nonce,
      "x-video-gateway-signature": signEventMedia(timestamp, nonce, metadataText, clipBytes, thumbnailBytes)
    },
    body: form
  });
  if (!upload.ok) throw new Error(`Cloud event media failed (${upload.status})`);
  return { submitted: true };
}

await waitForGateway();
await discover();
if (cloudSecret) {
  await learn();
  void submitReadinessEvidence().then((result) => {
    if (!result.submitted) console.error(`event media skipped: ${result.reason}`);
  }).catch((error) => console.error(error.message));
  setInterval(() => void learn().catch((error) => console.error(error.message)), 5 * 60 * 1000).unref();
}
setInterval(() => void discover().catch((error) => console.error(error.message)), 60 * 60 * 1000).unref();

function shutdown() { child.kill("SIGTERM"); process.exit(0); }
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
child.on("exit", (code) => process.exit(code || 1));
