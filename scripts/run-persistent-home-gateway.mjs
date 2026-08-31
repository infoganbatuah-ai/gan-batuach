import crypto from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { createPersistentLearningCycle } from "../services/video-gateway/persistent-learning-cycle.mjs";

const workdir = process.cwd();
const gatewayUrl = "http://127.0.0.1:18082";
const gatewayKeychainService = process.env.GAN_BATUACH_GATEWAY_KEYCHAIN_SERVICE || "com.ganbatuach.video-gateway.runtime";
const discoveryEnabled = process.env.GAN_BATUACH_GATEWAY_DISCOVERY === "1";
const DISCOVERY_RETRY_DELAY_MS = 20_000;
const DISCOVERY_RETRY_ATTEMPTS = 2;
const EMPTY_DISCOVERY_CONFIRMATIONS = 3;
const VERIFIED_CONNECTED_COUNT_KEY = "last_verified_connected_channel_count";
const EVENT_COOLDOWN_MS = 10 * 60 * 1000;
const CLOUD_REQUEST_TIMEOUT_MS = 30_000;
const DISCOVERY_REQUEST_TIMEOUT_MS = 3 * 60 * 1000;
const INSIGHT_REQUEST_TIMEOUT_MS = 20_000;
const EVENT_MEDIA_REQUEST_TIMEOUT_MS = 30_000;

function keychainSecret(account) {
  const result = spawnSync("/usr/bin/security", ["find-generic-password", "-s", gatewayKeychainService, "-a", account, "-w"], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "";
}

function storeKeychainSecret(account, value) {
  const result = spawnSync("/usr/bin/security", ["add-generic-password", "-U", "-s", gatewayKeychainService, "-a", account, "-w", value], { encoding: "utf8" });
  if (result.status !== 0) throw new Error("Unable to store Gateway Keychain material");
}

let gatewaySecret = keychainSecret("gateway_signing_secret");
if (!gatewaySecret) {
  gatewaySecret = crypto.randomBytes(32).toString("base64url");
  storeKeychainSecret("gateway_signing_secret", gatewaySecret);
}
const cloudSecret = keychainSecret("cloud_discovery_secret");
const deviceGatewayId = keychainSecret("device_gateway_id");
const deviceObserverSiteId = keychainSecret("device_observer_site_id");
const deviceRefreshToken = keychainSecret("device_refresh_token");
const gatewayId = deviceGatewayId || keychainSecret("cloud_gateway_id");
const observerSiteId = deviceObserverSiteId || keychainSecret("cloud_observer_site_id");
const productionBaseUrl = keychainSecret("device_cloud_base_url") || keychainSecret("cloud_base_url") || "https://ganbatuach.com";
const missingCloudConfiguration = [
  !gatewaySecret && "gateway_signing_secret",
  !gatewayId && "device_gateway_id",
  !observerSiteId && "device_observer_site_id",
  !deviceRefreshToken && !cloudSecret && "device_refresh_token_or_cloud_discovery_secret"
].filter(Boolean);
if (missingCloudConfiguration.length) throw new Error(`Persistent gateway cloud configuration is incomplete: ${missingCloudConfiguration.join(",")}`);

let config = null;
let password = "";
if (discoveryEnabled) {
  const profileJson = keychainSecret("dvr_profile_json");
  if (!profileJson) throw new Error("DVR profile is not available in macOS Keychain");
  config = JSON.parse(profileJson);
  password = keychainSecret("dvr_password");
  if (!password) throw new Error("DVR credential is not available in macOS Keychain");
}

async function signedPost(path, payload, options = {}) {
  const body = JSON.stringify(payload);
  const localPath = path.endsWith("/cloud-discovery")
    ? "/cloud/discovery"
    : path.endsWith("/cloud-learning")
      ? "/cloud/learning"
      : null;
  if (!localPath || options.deviceAccess !== true) throw new Error("Unsupported persistent Gateway cloud operation");
  // The child Gateway is the only owner of rotating device identity. The
  // runner sends a fixed, authenticated operation over loopback and never
  // receives an access or refresh token.
  const response = await fetch(`${gatewayUrl}${localPath}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-video-gateway-secret": gatewaySecret },
    body,
    signal: AbortSignal.timeout(CLOUD_REQUEST_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`Cloud request failed (${response.status})`);
  return response.json();
}

const child = spawn(process.execPath, ["services/video-gateway/server.mjs"], { cwd: workdir, env: { ...process.env, HOST: "127.0.0.1", PORT: "18082", VIDEO_GATEWAY_SIGNING_SECRET: gatewaySecret, DVR_EXPECTED_CHANNEL_COUNT: String(config?.channel_count || 0) }, stdio: "inherit" });

async function waitForGateway() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { if ((await fetch(`${gatewayUrl}/health`, { signal: AbortSignal.timeout(3_000) })).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Local gateway did not start");
}

let channels = [];
let consecutiveEmptyDiscoveries = 0;
async function discover() {
  const health = await fetch(`${gatewayUrl}/health`, { signal: AbortSignal.timeout(10_000) }).then((response) => response.ok ? response.json() : {}).catch(() => ({}));
  const response = await fetch(`${gatewayUrl}/dvr/connect`, { method: "POST", headers: { "content-type": "application/json", "x-video-gateway-secret": gatewaySecret }, body: JSON.stringify({ connection_type: "dvr", endpoint: config.endpoint, port: config.port, username: config.username, password, metadata: { vendor: config.vendor, expected_channel_count: config.channel_count, read_only_requested: true } }), signal: AbortSignal.timeout(DISCOVERY_REQUEST_TIMEOUT_MS) });
  const result = await response.json();
  if (!response.ok) throw new Error("DVR discovery failed");
  channels = (result.channels || []).map((channel, index) => Object.fromEntries(Object.entries({ channel: Number(channel.channel || index + 1), name: channel.name, area: channel.area, stream_id: channel.stream_id, gateway_stream_id: channel.gateway_stream_id || channel.stream_id, status: channel.status, health_status: channel.health_status, width: channel.width ?? null, height: channel.height ?? null, candidates_tried: channel.candidates_tried, template: channel.template, reason: channel.reason, capabilities: channel.capabilities && typeof channel.capabilities === "object" ? channel.capabilities : {} }).filter(([, value]) => value !== undefined && value !== null)));
  const connectedChannels = channels.filter((channel) => channel.status === "connected");
  const previouslyVerified = Number(keychainSecret(VERIFIED_CONNECTED_COUNT_KEY) || 0);
  const hasUnconfirmedRegression = channels.length
    && (connectedChannels.length === 0 || (previouslyVerified > 0 && connectedChannels.length < previouslyVerified));
  if (hasUnconfirmedRegression) {
    consecutiveEmptyDiscoveries += 1;
    // A recorder can briefly reject all streams during session recovery. Do not
    // overwrite the dashboard's last known-good mapping until this is repeated.
    if (consecutiveEmptyDiscoveries < EMPTY_DISCOVERY_CONFIRMATIONS) {
      throw new Error("channel_regression_pending_confirmation");
    }
  } else {
    consecutiveEmptyDiscoveries = 0;
  }
  const mapped = await signedPost("/api/video-gateway/cloud-discovery", { gateway_id: gatewayId, observer_site_id: observerSiteId, connection_type: "dvr", vendor: config.vendor, discovery_id: crypto.randomUUID(), discovered_at: new Date().toISOString(), channel_count: channels.length, connected_channel_count: channels.filter((channel) => channel.status === "connected").length, failed_channel_count: channels.filter((channel) => channel.status !== "connected").length, latency_ms: Number(result.latency_ms || 0), read_only: true, controls_supported: result.controls_supported === true, no_secrets_returned: true, channels, metadata: { source: "persistent_home_gateway", ai_shadow_only: true, read_only: true, edge_capability_contract: health.edge_capability_contract ?? null } }, { deviceAccess: true });
  const mappedPayload = mapped?.data && typeof mapped.data === "object" ? mapped.data : mapped;
  const mappedChannels = Array.isArray(mappedPayload?.channels) ? mappedPayload.channels : [];
  channels = channels.map((channel) => {
    const mappedChannel = mappedChannels.find((item) => item?.gateway_stream_id === channel.gateway_stream_id);
    return { ...channel, camera_source_id: mappedChannel?.camera_source_id ?? channel.camera_source_id ?? null };
  });
  if (connectedChannels.length > 0) storeKeychainSecret(VERIFIED_CONNECTED_COUNT_KEY, String(connectedChannels.length));
}

async function runDiscoveryWithRetry(context, attempt = 0) {
  try {
    await discover();
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "discovery_failed";
    if (attempt >= DISCOVERY_RETRY_ATTEMPTS) {
      console.error(`${context} DVR discovery unavailable; retry scheduled: ${message}`);
      return false;
    }
    console.error(`${context} DVR discovery retrying: ${message}`);
    await new Promise((resolve) => setTimeout(resolve, DISCOVERY_RETRY_DELAY_MS));
    return runDiscoveryWithRetry(context, attempt + 1);
  }
}

let discoveryRun = null;
function discoverWithRetry(context) {
  if (discoveryRun) return discoveryRun;
  discoveryRun = runDiscoveryWithRetry(context).finally(() => { discoveryRun = null; });
  return discoveryRun;
}

const learningCycle = createPersistentLearningCycle({
  cooldownMs: EVENT_COOLDOWN_MS,
  schedulerOptions: { concurrency: 2, maxSourcesPerRound: 20, timeoutMs: INSIGHT_REQUEST_TIMEOUT_MS, roundBudgetMs: 60_000 },
  authorize: async (sourceIds) => {
    const requestId = crypto.randomUUID();
    const result = await signedPost("/api/video-gateway/cloud-learning", {
      operation: "authorize_round", gateway_id: gatewayId, observer_site_id: observerSiteId,
      sample_id: requestId, sampled_at: new Date().toISOString(), local_processing: true,
      no_raw_video_returned: true, source_ids: sourceIds
    }, { deviceAccess: true });
    const payload = result?.data ?? result;
    if (payload?.status !== "analysis_policy" || payload.policy?.request_id !== requestId) throw new Error("analysis_policy_unavailable");
    return payload.policy;
  },
  analyze: async (channel, signal) => {
    const response = await fetch(`${gatewayUrl}/camera/${encodeURIComponent(channel.gateway_stream_id)}/insights`, {
      headers: { "x-video-gateway-secret": gatewaySecret }, signal
    });
    if (response.status === 503 || response.status === 404) return { state: "no_media" };
    if (!response.ok) throw new Error("analysis_failed");
    return response.json();
  },
  publishSamples: async (samples) => {
    const result = await signedPost("/api/video-gateway/cloud-learning", {
      gateway_id: gatewayId, observer_site_id: observerSiteId, sample_id: crypto.randomUUID(),
      sampled_at: new Date().toISOString(), local_processing: true, no_raw_video_returned: true, samples
    }, { deviceAccess: true });
    return { submitted: (result?.data ?? result)?.status === "learned" };
  },
  publishEvent: (channel, primary, signal) => {
    const eventType = primary.label === "person" ? "person_detected" : ["car", "motorcycle", "truck"].includes(primary.label) ? "vehicle_detected" : "animal_detected";
    const label = primary.label === "person" ? "אדם" : primary.label === "motorcycle" ? "אופנוע" : primary.label === "dog" || primary.label === "cat" ? "בעל חיים" : "רכב";
    return submitEventEvidence(channel, {
      event_type: eventType,
      event_context: "presence",
      severity: "info",
      confidence: Number(primary.confidence),
      summary: `${label} זוהה מקומית במצלמה. נשמר קליפ סביב האירוע לבדיקה אנושית; לא בוצע זיהוי זהות.`
    }, { signal });
  }
});

async function learn() {
  const result = await learningCycle.run(channels);
  console.log(JSON.stringify({ operation: "analysis_round", state: result.state, attempted: result.attempted ?? 0,
    events_submitted: result.events_submitted ?? 0, event_failures: result.event_failures ?? 0, events_deferred: result.events_deferred ?? 0 }));
}

async function submitEventEvidence(channel, event, { signal } = {}) {
  if (!channel?.gateway_stream_id || !channel?.camera_source_id) return { submitted: false, reason: "no_connected_mapped_channel" };
  const response = await fetch(`${gatewayUrl}/camera/${encodeURIComponent(channel.gateway_stream_id)}/event-media`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-video-gateway-secret": gatewaySecret },
    body: JSON.stringify({ window_seconds_before: 3, window_seconds_after: 5 }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(EVENT_MEDIA_REQUEST_TIMEOUT_MS)]) : AbortSignal.timeout(EVENT_MEDIA_REQUEST_TIMEOUT_MS)
  });
  const media = await response.json();
  signal?.throwIfAborted();
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
    event_type: event.event_type,
    severity: event.severity,
    confidence: event.confidence,
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
    event_summary: event.summary,
    event_context: event.event_context,
    metadata: { source: "persistent_home_gateway", channel: channel.channel, ai_shadow_only: true, identity_recognition_used: false }
  };
  const metadataText = JSON.stringify(metadata);
  const form = new FormData();
  form.set("metadata", metadataText);
  form.set("clip", new Blob([clipBytes], { type: "video/mp4" }), "clip.mp4");
  form.set("thumbnail", new Blob([thumbnailBytes], { type: "image/jpeg" }), "thumbnail.jpg");
  const upload = await fetch(`${gatewayUrl}/cloud/event-media`, {
    method: "POST",
    headers: {
      "x-video-gateway-secret": gatewaySecret
    },
    body: form,
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(CLOUD_REQUEST_TIMEOUT_MS)]) : AbortSignal.timeout(CLOUD_REQUEST_TIMEOUT_MS)
  });
  if (!upload.ok) throw new Error(`Cloud event media failed (${upload.status})`);
  return { submitted: true };
}

async function submitReadinessEvidence() {
  const channel = channels.find((item) => item.status === "connected" && item.gateway_stream_id && item.camera_source_id);
  return submitEventEvidence(channel, {
    event_type: "camera_media_readiness",
    event_context: "device_health",
    severity: "info",
    confidence: 1,
    summary: "נוצר תיעוד מדיה מאומת מה-Gateway לצורך בדיקת חיבור ושמירה סביב אירוע בלבד."
  });
}

await waitForGateway();
if (discoveryEnabled) {
  await discoverWithRetry("initial");
  await learn().catch((error) => {
    // Cloud identity rotation or learning upload must never own the local live
    // process lifecycle. Keep relays available and retry learning on schedule.
    console.error(`initial cloud learning unavailable; live remains active: ${error instanceof Error ? error.message : "learning_failed"}`);
  });
  void submitReadinessEvidence().then((result) => {
    if (!result.submitted) console.error(`event media skipped: ${result.reason}`);
  }).catch((error) => console.error(error.message));
  setInterval(() => void learn().catch((error) => console.error(error.message)), 5 * 60 * 1000).unref();
  setInterval(() => void discoverWithRetry("scheduled"), 15 * 60 * 1000).unref();
}

function shutdown() { child.kill("SIGTERM"); process.exit(0); }
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
child.on("exit", (code) => process.exit(code || 1));
