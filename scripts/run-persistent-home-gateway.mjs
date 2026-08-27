import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const workdir = process.cwd();
const runtimeConfigPath = process.env.GAN_BATUACH_GATEWAY_CONFIG || `${process.env.HOME}/.config/gan-batuach/home-gateway.json`;
const cloudConfigPath = `${workdir}/.env.video-gateway.local`;
const gatewayUrl = "http://127.0.0.1:18082";

function envFile(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(readFileSync(path, "utf8").split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => {
    const index = line.indexOf("=");
    return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^["']|["']$/g, "")];
  }));
}

const cloud = { ...envFile(cloudConfigPath), ...process.env };
const config = JSON.parse(readFileSync(runtimeConfigPath, "utf8"));
const passwordResult = spawnSync("/usr/bin/security", ["find-generic-password", "-s", config.keychain_service, "-a", config.username, "-w"], { encoding: "utf8" });
if (passwordResult.status !== 0 || !passwordResult.stdout.trim()) throw new Error("DVR credential is not available in macOS Keychain");
const password = passwordResult.stdout.trim();
const gatewaySecret = cloud.VIDEO_GATEWAY_SIGNING_SECRET;
const cloudSecret = cloud.VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET;
const gatewayId = cloud.VIDEO_GATEWAY_CLOUD_GATEWAY_ID;
const observerSiteId = cloud.VIDEO_GATEWAY_CLOUD_OBSERVER_SITE_ID;
const productionBaseUrl = cloud.VIDEO_GATEWAY_CLOUD_BASE_URL || "https://ganbatuach.com";
if (!gatewaySecret || !cloudSecret || !gatewayId || !observerSiteId) throw new Error("Persistent gateway cloud configuration is incomplete");

function sign(timestamp, nonce, body) {
  return `sha256=${crypto.createHmac("sha256", cloudSecret).update(`${timestamp}.${nonce}.${body}`).digest("hex")}`;
}

async function signedPost(path, payload) {
  const body = JSON.stringify(payload);
  const timestamp = new Date().toISOString();
  const nonce = crypto.randomUUID();
  const response = await fetch(`${productionBaseUrl.replace(/\/$/, "")}${path}`, { method: "POST", headers: { "content-type": "application/json", "x-video-gateway-id": gatewayId, "x-video-gateway-timestamp": timestamp, "x-video-gateway-nonce": nonce, "x-video-gateway-signature": sign(timestamp, nonce, body) }, body });
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
  const response = await fetch(`${gatewayUrl}/dvr/connect`, { method: "POST", headers: { "content-type": "application/json", "x-video-gateway-secret": gatewaySecret }, body: JSON.stringify({ connection_type: "dvr", endpoint: config.endpoint, port: config.port, username: config.username, password, metadata: { vendor: config.vendor, expected_channel_count: config.channel_count, read_only_requested: true } }) });
  const result = await response.json();
  if (!response.ok) throw new Error("DVR discovery failed");
  channels = (result.channels || []).map((channel, index) => Object.fromEntries(Object.entries({ channel: Number(channel.channel || index + 1), name: channel.name, area: channel.area, stream_id: channel.stream_id, gateway_stream_id: channel.gateway_stream_id || channel.stream_id, status: channel.status, health_status: channel.health_status, width: channel.width ?? null, height: channel.height ?? null, candidates_tried: channel.candidates_tried, template: channel.template, reason: channel.reason }).filter(([, value]) => value !== undefined && value !== null)));
  await signedPost("/api/video-gateway/cloud-discovery", { gateway_id: gatewayId, observer_site_id: observerSiteId, connection_type: "dvr", vendor: config.vendor, discovery_id: crypto.randomUUID(), discovered_at: new Date().toISOString(), channel_count: channels.length, connected_channel_count: channels.filter((channel) => channel.status === "connected").length, failed_channel_count: channels.filter((channel) => channel.status !== "connected").length, latency_ms: Number(result.latency_ms || 0), read_only: true, controls_supported: false, no_secrets_returned: true, channels, metadata: { source: "persistent_home_gateway", ai_shadow_only: true, read_only: true } });
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

await waitForGateway();
await discover();
await learn();
setInterval(() => void learn().catch((error) => console.error(error.message)), 5 * 60 * 1000).unref();
setInterval(() => void discover().catch((error) => console.error(error.message)), 60 * 60 * 1000).unref();

function shutdown() { child.kill("SIGTERM"); process.exit(0); }
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
child.on("exit", (code) => process.exit(code || 1));
