import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { computeActivityMetrics } from "./activity-insights.mjs";
import { localEdgeReadiness, warmLocalEdgeReadiness } from "./edge-readiness.mjs";
import { discoverPrivateNvrCapabilities } from "./private-nvr-capabilities.mjs";
import { awaitRequestWork, createRequestWorkScope } from "./request-work-scope.mjs";

const PORT = Number(process.env.PORT || process.env.VIDEO_GATEWAY_PORT || 8080);
const HOST = process.env.HOST || process.env.VIDEO_GATEWAY_HOST || "0.0.0.0";
const PROBE_TIMEOUT_MS = Number(process.env.DVR_PROBE_TIMEOUT_MS || 3500);
const DEFAULT_CHANNEL_COUNT = Number(process.env.DVR_EXPECTED_CHANNEL_COUNT || 16);
const MAX_CHANNEL_COUNT = 64;
const HLS_ROOT = join(tmpdir(), "gan-batuach-video-gateway-hls");
const PLAYBACK_TOKEN_TTL_MS = 5 * 60 * 1000;
// Some recorders deliver an HLS source in short bursts. Eight seconds caused
// healthy streams to be torn down between segments, producing a retry loop in
// the dashboard. A failed source is still detected, but only after a window
// large enough for normal recorder jitter and a full HLS refresh.
const RELAY_STALE_MS = Number(process.env.VIDEO_GATEWAY_RELAY_STALE_MS || 20_000);
const PRIVATE_NVR_PROBE_ATTEMPTS = Math.max(1, Math.min(3, Number(process.env.PRIVATE_NVR_PROBE_ATTEMPTS || 2)));
const EVENT_CLIP_MAX_SECONDS = 30;
const EVENT_THUMBNAIL_MAX_BYTES = 512 * 1024;
const EVENT_CLIP_MAX_BYTES = 8 * 1024 * 1024;
const streamSources = new Map();
const privateNvrSessions = new Map();
const relays = new Map();
const relayStarts = new Map();
const playbackTokens = new Map();
let lastDiscoverySummary = { channelCount: 0, connectedCount: 0, checkedAt: null };
const requestMetrics = { playbackRequests: 0, playbackReady: 0, playbackUnavailable: 0, playbackClaimRequests: 0, playbackClaimReady: 0, playbackClaimUnavailable: 0, hlsRequests: 0 };
const FRAME_WIDTH = 32;
const FRAME_HEIGHT = 18;
const OBJECT_WORKER_PATH = fileURLToPath(new URL("./onnx-object-worker.mjs", import.meta.url));
const GATEWAY_KEYCHAIN_SERVICE = process.env.GAN_BATUACH_GATEWAY_KEYCHAIN_SERVICE || "";
let deviceAccessToken = "";
let deviceAccessExpiresAt = 0;
let deviceAccessRefreshPromise = null;
let cameraActionPollPromise = null;
const CLOUD_AUTH_TIMEOUT_MS = 10_000;

mkdirSync(HLS_ROOT, { recursive: true });

// Start expensive self-tests in the background. The contract stays false until
// they complete, while health and live playback remain responsive.
warmLocalEdgeReadiness();

function json(response, status, body) {
  if (response.destroyed || response.writableEnded) return;
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "private, no-store, max-age=0"
  });
  response.end(JSON.stringify(body));
}

function allowedBrowserOrigins() {
  const configured = String(process.env.VIDEO_GATEWAY_BROWSER_ORIGIN || "").split(",").map((value) => value.trim()).filter(Boolean);
  return new Set(["https://ganbatuach.com", "https://www.ganbatuach.com", "https://gan-batuach.vercel.app", ...configured]);
}

function browserHeaders(request, contentType) {
  const requestedOrigin = String(request.headers.origin || "").replace(/\/$/, "");
  const allowedOrigin = allowedBrowserOrigins().has(requestedOrigin)
    ? requestedOrigin
    : "https://ganbatuach.com";
  return {
    "content-type": contentType,
    "cache-control": "private, no-store, max-age=0",
    "access-control-allow-origin": allowedOrigin,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-allow-private-network": "true",
    "vary": "Origin"
  };
}

function browserJson(request, response, status, body) {
  response.writeHead(status, browserHeaders(request, "application/json; charset=utf-8"));
  response.end(JSON.stringify(body));
}

function keychainSecret(account) {
  if (!GATEWAY_KEYCHAIN_SERVICE) return "";
  const result = spawnSync("/usr/bin/security", ["find-generic-password", "-s", GATEWAY_KEYCHAIN_SERVICE, "-a", account, "-w"], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "";
}

function storeKeychainSecret(account, value) {
  if (!GATEWAY_KEYCHAIN_SERVICE) throw new Error("Gateway Keychain service is unavailable");
  const result = spawnSync("/usr/bin/security", ["add-generic-password", "-U", "-s", GATEWAY_KEYCHAIN_SERVICE, "-a", account, "-w", value], { encoding: "utf8" });
  if (result.status !== 0) throw new Error("Gateway Keychain update failed");
}

async function refreshGatewayDeviceAccess() {
  if (deviceAccessToken && deviceAccessExpiresAt > Date.now() + 30_000) return deviceAccessToken;
  if (deviceAccessRefreshPromise) return deviceAccessRefreshPromise;
  deviceAccessRefreshPromise = (async () => {
    const gatewayId = keychainSecret("device_gateway_id");
    const cloudBaseUrl = keychainSecret("device_cloud_base_url").replace(/\/$/, "");
    if (!gatewayId || !cloudBaseUrl) throw new Error("Gateway device identity is unavailable");
    // Discovery and playback are separate local processes but share the same
    // rotating Keychain refresh material. If one rotates it first, re-read and
    // retry once rather than dropping every concurrent browser playback claim.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const refreshToken = keychainSecret("device_refresh_token");
      if (!refreshToken) throw new Error("Gateway device identity is unavailable");
      const response = await fetch(`${cloudBaseUrl}/api/digital-observer/gateway-enrollment`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "refresh", gateway_id: gatewayId, refresh_token: refreshToken }),
        signal: AbortSignal.timeout(CLOUD_AUTH_TIMEOUT_MS)
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload.data?.access_token && payload.data?.refresh_token) {
        storeKeychainSecret("device_refresh_token", String(payload.data.refresh_token));
        deviceAccessToken = String(payload.data.access_token);
        deviceAccessExpiresAt = Date.parse(String(payload.data.access_expires_at || "")) || Date.now() + 9 * 60 * 1000;
        return deviceAccessToken;
      }
    }
    throw new Error("Gateway device refresh failed");
  })().finally(() => { deviceAccessRefreshPromise = null; });
  return deviceAccessRefreshPromise;
}

async function claimCloudPlaybackGrant(grant) {
  const cloudBaseUrl = keychainSecret("device_cloud_base_url").replace(/\/$/, "");
  const accessToken = await refreshGatewayDeviceAccess();
  const response = await fetch(`${cloudBaseUrl}/api/video-gateway/playback-grant`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-video-gateway-device-token": accessToken },
    body: JSON.stringify({ grant }),
    signal: AbortSignal.timeout(CLOUD_AUTH_TIMEOUT_MS)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.data?.gateway_stream_id) throw new Error("Playback grant claim failed");
  return String(payload.data.gateway_stream_id);
}

async function reportCameraActionResult(cloudBaseUrl, accessToken, requestId, outcome, resultCode) {
  await fetch(`${cloudBaseUrl}/api/video-gateway/camera-actions`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-video-gateway-device-token": accessToken },
    body: JSON.stringify({ action: "result", request_id: requestId, outcome, result_code: resultCode }),
    signal: AbortSignal.timeout(CLOUD_AUTH_TIMEOUT_MS)
  }).catch(() => null);
}

async function pollCloudCameraActions() {
  const cloudBaseUrl = keychainSecret("device_cloud_base_url").replace(/\/$/, "");
  if (!cloudBaseUrl || !GATEWAY_KEYCHAIN_SERVICE) return;
  try {
    const accessToken = await refreshGatewayDeviceAccess();
    const response = await fetch(`${cloudBaseUrl}/api/video-gateway/camera-actions`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-video-gateway-device-token": accessToken },
      body: JSON.stringify({ action: "poll" }),
      signal: AbortSignal.timeout(CLOUD_AUTH_TIMEOUT_MS)
    });
    const payload = await response.json().catch(() => ({}));
    const action = payload.data?.action_request;
    if (!response.ok || !action?.id) return;
    // An executor is added only together with a read-only capability probe for
    // that exact adapter. Unknown adapters fail closed and cannot reach the DVR.
    await reportCameraActionResult(cloudBaseUrl, accessToken, String(action.id), "failed", "adapter_executor_not_installed");
  } catch {
    // Device enrollment may be unavailable during startup or rotation. Health
    // and live relays must remain independent from command polling.
  }
}

if (GATEWAY_KEYCHAIN_SERVICE) {
  setInterval(() => {
    if (cameraActionPollPromise) return;
    cameraActionPollPromise = pollCloudCameraActions().finally(() => { cameraActionPollPromise = null; });
  }, 5_000).unref();
}

function safeEqual(left, right) {
  if (!left || !right) return false;
  const a = Buffer.from(String(left), "utf8");
  const b = Buffer.from(String(right), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function expectedSecret() {
  return process.env.VIDEO_GATEWAY_SIGNING_SECRET
    || process.env.VIDEO_GATEWAY_API_KEY
    || process.env.CAMERA_GATEWAY_SECRET
    || "";
}

function edgeCapabilityContract(edge) {
  const contract = {
    version: 1,
    issued_at: new Date().toISOString(),
    gateway: { connected: true, version: edge.gateway_version, read_only: true },
    runtime: edge.runtime,
    hardware: edge.hardware,
    models: edge.models,
    capability_test: edge.capability_test,
    consent_verified: false,
    capabilities: {
      local_activity_sampling: Boolean(edge.ffprobe_available),
      face_detection: Boolean(edge.face_detection),
      human_detection: Boolean(edge.human_detection),
      image_classification: Boolean(edge.image_classification),
      object_detection: Boolean(edge.object_detection),
      audio_event_detection: Boolean(edge.audio_event_detection),
      face_recognition: false,
      biometric_matching: false
    }
  };
  const secret = expectedSecret();
  return { ...contract, signature: secret ? `sha256=${createHmac("sha256", secret).update(JSON.stringify(contract)).digest("hex")}` : "" };
}

function authorized(request) {
  const expected = expectedSecret();
  if (!expected) return false;
  return safeEqual(request.headers["x-video-gateway-secret"], expected)
    || safeEqual(request.headers["x-video-gateway-key"], expected)
    || safeEqual(String(request.headers.authorization || "").replace(/^Bearer\s+/i, ""), expected);
}

async function readJson(request) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 65536) throw new Error("payload_too_large");
  }
  return raw ? JSON.parse(raw) : {};
}

async function readBuffer(request, maxBytes = 10 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new Error("payload_too_large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function forwardDeviceCloudRequest(path, body, contentType) {
  const cloudBaseUrl = keychainSecret("device_cloud_base_url").replace(/\/$/, "");
  const gatewayId = keychainSecret("device_gateway_id");
  if (!cloudBaseUrl || !gatewayId) throw new Error("Gateway cloud identity is unavailable");
  const accessToken = await refreshGatewayDeviceAccess();
  const response = await fetch(`${cloudBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": contentType,
      "x-video-gateway-id": gatewayId,
      "x-video-gateway-timestamp": new Date().toISOString(),
      "x-video-gateway-nonce": randomUUID(),
      "x-video-gateway-device-token": accessToken
    },
    body
  });
  return { status: response.status, contentType: response.headers.get("content-type") || "application/json; charset=utf-8", body: Buffer.from(await response.arrayBuffer()) };
}

function cleanHost(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw.includes("://") ? raw : `rtsp://${raw}`);
    return url.hostname;
  } catch {
    return raw.replace(/^.+:\/\//, "").replace(/\/.*$/, "").replace(/:.+$/, "");
  }
}

function encodeCredential(value) {
  return encodeURIComponent(String(value || ""));
}

function rtspAuth(username, password) {
  if (!username && !password) return "";
  return `${encodeCredential(username)}:${encodeCredential(password)}@`;
}

function channelSuffix(channel, quality) {
  return `${channel}${quality === "main" ? "01" : "02"}`;
}

function candidateUrls(input, channel) {
  const host = cleanHost(input.endpoint || input.host);
  if (!host) return [];
  const port = Number(input.port || 554);
  const quality = input.stream_quality === "main" ? "main" : "sub";
  const subtype = quality === "main" ? 0 : 1;
  const auth = rtspAuth(input.username, input.password);
  const privateNvrAuth = `user=${encodeCredential(input.username)}&password=${encodeCredential(input.password)}&channel=${channel}&stream=${subtype}.sdp?`;
  const vendor = String(input.metadata?.vendor || input.metadata?.provider || input.connection_type || "").toLowerCase();
  const all = [
    { vendor: "hikvision", template: "hikvision_streaming_channels", url: `rtsp://${auth}${host}:${port}/Streaming/Channels/${channelSuffix(channel, quality)}` },
    { vendor: "dahua", template: "dahua_realmonitor", url: `rtsp://${auth}${host}:${port}/cam/realmonitor?channel=${channel}&subtype=${subtype}` },
    { vendor: "uniview", template: "uniview_unicast", url: `rtsp://${auth}${host}:${port}/unicast/c${channel}/s${quality === "main" ? 0 : 1}` },
    // Private-protocol recorders frequently expose their RTSP relay through
    // this XMEye-compatible path even when their cameras themselves are not
    // ONVIF/RTSP devices. Credentials stay in this local process only.
    { vendor: "private_nvr", template: "private_nvr_rtsp_relay", url: `rtsp://${host}:${port}/${privateNvrAuth}` },
    // Recorder-native RTSP service exposed by the ER private NVR. The
    // recorder uses its combined HTTP/HTTPS/RTSP service port, not 554.
    { vendor: "private_nvr", template: "private_nvr_rtsp_streaming", url: `rtsp://${auth}${host}:${port}/rtsp/streaming?channel=${String(channel).padStart(2, "0")}&subtype=${subtype}` },
    // Some private-protocol recorders expose an RTSP relay using a standard
    // vendor-compatible path. Probe these only in the local gateway, in a
    // fixed order, so a selected Private NVR is not limited to one dialect.
    { vendor: "private_nvr", template: "private_nvr_streaming_channels", url: `rtsp://${auth}${host}:${port}/Streaming/Channels/${channelSuffix(channel, quality)}` },
    { vendor: "private_nvr", template: "private_nvr_realmonitor", url: `rtsp://${auth}${host}:${port}/cam/realmonitor?channel=${channel}&subtype=${subtype}` },
    { vendor: "private_nvr", template: "private_nvr_channel_stream_type", url: `rtsp://${auth}${host}:${port}/chID=${channel}&streamType=${quality === "main" ? "main" : "sub"}` },
    { vendor: "generic", template: "generic_channel_quality", url: `rtsp://${auth}${host}:${port}/ch${channel}/${quality}` },
    { vendor: "generic", template: "generic_stream", url: `rtsp://${auth}${host}:${port}/stream${channel}` }
  ];
  if (vendor.includes("hikvision")) return all.filter((item) => item.vendor === "hikvision");
  if (vendor.includes("dahua")) return all.filter((item) => item.vendor === "dahua");
  if (vendor.includes("uniview")) return all.filter((item) => item.vendor === "uniview");
  if (vendor.includes("private") || vendor.includes("xm")) return all.filter((item) => item.vendor === "private_nvr");
  return all;
}

function streamIdFor(input, channel) {
  const fingerprint = createHash("sha256")
    .update([input.connection_type || "dvr", cleanHost(input.endpoint || input.host), channel].join(":"))
    .digest("hex")
    .slice(0, 18);
  return `dvr_${fingerprint}_${channel}`;
}

function privateNvrBaseUrl(input) {
  const host = cleanHost(input.endpoint || input.host);
  const port = Number(input.port || 80);
  return host ? `http://${host}:${port}` : "";
}

function privateNvrSessionKey(input) {
  return createHash("sha256")
    .update([privateNvrBaseUrl(input), String(input.username || "")].join(":"))
    .digest("hex")
    .slice(0, 24);
}

function parseDigestChallenge(value) {
  const challenge = String(value || "").replace(/^Digest\s+/i, "");
  const fields = {};
  for (const match of challenge.matchAll(/([a-z0-9_-]+)=(?:"([^"]*)"|([^,\s]+))/gi)) {
    fields[match[1].toLowerCase()] = match[2] ?? match[3] ?? "";
  }
  return fields;
}

function digestHex(algorithm, value) {
  const normalized = String(algorithm || "MD5").toUpperCase() === "SHA-256" ? "sha256" : "md5";
  return createHash(normalized).update(value, "utf8").digest("hex");
}

async function privateNvrLogin(input) {
  const baseUrl = privateNvrBaseUrl(input);
  if (!baseUrl || !input.username || !input.password) return null;
  const uri = "/API/Web/Login";
  const body = JSON.stringify({ data: { remote_terminal_info: "GATEWAY" } });
  const common = {
    method: "POST",
    headers: { "content-type": "application/json", "x-requested-with": "XMLHttpRequest" },
    body,
    signal: AbortSignal.timeout(Math.max(2000, PROBE_TIMEOUT_MS))
  };
  const first = await fetch(`${baseUrl}${uri}`, common).catch(() => null);
  if (!first) return null;
  let response = first;
  if (first.status === 401) {
    const challenge = parseDigestChallenge(first.headers.get("www-authenticate"));
    if (!challenge.realm || !challenge.nonce) return null;
    const qop = String(challenge.qop || "auth").split(",")[0].trim();
    const nc = "00000001";
    const cnonce = randomBytes(8).toString("hex");
    const ha1 = digestHex(challenge.algorithm, `${input.username}:${challenge.realm}:${input.password}`);
    const ha2 = digestHex(challenge.algorithm, `POST:${uri}`);
    const digestResponse = digestHex(challenge.algorithm, `${ha1}:${challenge.nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
    const authorization = [
      `Digest username="${String(input.username).replaceAll('"', "")}"`,
      `realm="${challenge.realm}"`,
      `nonce="${challenge.nonce}"`,
      `uri="${uri}"`,
      `response="${digestResponse}"`,
      `opaque="${challenge.opaque || ""}"`,
      `qop=${qop}`,
      `nc=${nc}`,
      `cnonce="${cnonce}"`,
      challenge.algorithm ? `algorithm="${challenge.algorithm}"` : ""
    ].filter(Boolean).join(", ");
    response = await fetch(`${baseUrl}${uri}`, {
      ...common,
      headers: { ...common.headers, authorization }
    }).catch(() => null);
  }
  if (!response?.ok) return null;
  const token = String(response.headers.get("x-csrftoken") || "").split(",")[0].trim();
  const cookie = String(response.headers.get("set-cookie") || "").split(";")[0].trim();
  if (!token) return null;
  return { baseUrl, token, cookie };
}

function rememberPrivateNvrSession(input, session) {
  const key = privateNvrSessionKey(input);
  privateNvrSessions.set(key, {
    ...session,
    input,
    updatedAt: Date.now(),
    refreshPromise: null
  });
  return key;
}

async function refreshPrivateNvrSession(sessionKey, failedToken = null) {
  const current = privateNvrSessions.get(sessionKey);
  if (!current) return null;
  if (failedToken && current.token !== failedToken) return current;
  if (current.refreshPromise) return current.refreshPromise;
  const refreshPromise = (async () => {
    const session = await privateNvrLogin(current.input);
    if (!session) return current;
    const refreshed = { ...current, ...session, updatedAt: Date.now(), refreshPromise: null };
    privateNvrSessions.set(sessionKey, refreshed);
    return refreshed;
  })().finally(() => {
    const latest = privateNvrSessions.get(sessionKey);
    if (latest?.refreshPromise === refreshPromise) latest.refreshPromise = null;
  });
  current.refreshPromise = refreshPromise;
  return refreshPromise;
}

function privateNvrLiveUrl(session, channel, quality = "sub") {
  const streamType = quality === "main" ? 0 : 1;
  return `${session.baseUrl}/live.mp4?channel=${Math.max(0, channel - 1)}&type=${streamType}&chrome=1`;
}

function capabilityEvidence(supported, method, reason, adapter = null) {
  return {
    supported: Boolean(supported),
    method,
    tested_at: new Date().toISOString(),
    adapter,
    reason
  };
}

function mediaCapabilities(result, adapter) {
  const tested = Boolean(result.ok);
  return {
    live: capabilityEvidence(tested, "media_probe", tested ? "video_stream_verified" : "video_stream_unavailable", adapter),
    playback: capabilityEvidence(false, "not_tested", "playback_endpoint_not_discovered", adapter),
    audio_input: capabilityEvidence(Boolean(result.audio), "media_probe", result.audio ? "audio_track_verified" : "audio_track_not_present", adapter),
    audio_output: capabilityEvidence(false, "not_tested", "audio_output_not_discovered", adapter),
    talkback: capabilityEvidence(false, "not_tested", "talkback_not_discovered", adapter),
    ptz: capabilityEvidence(false, "not_tested", "ptz_not_discovered", adapter),
    relay: capabilityEvidence(false, "not_tested", "relay_not_discovered", adapter),
    siren: capabilityEvidence(false, "not_tested", "siren_not_discovered", adapter),
    light: capabilityEvidence(false, "not_tested", "light_not_discovered", adapter)
  };
}

function mergePrivateNvrCapabilityEvidence(media, discovered) {
  if (!discovered) return media;
  return Object.fromEntries(Object.entries({ ...media, ...Object.fromEntries(
    Object.entries(discovered).filter(([key]) => key !== "adapter").map(([key, value]) => [key, capabilityEvidence(
      value?.supported === true,
      value?.tested ? "vendor_read_only_api" : "not_tested",
      String(value?.reason || `${key}_not_reported`),
      discovered.adapter || "private_nvr_http_api_v1"
    )])
  ) }));
}

async function privateNvrStreamResponse(url, token, cookie, signal) {
  const response = await fetch(url, {
    headers: {
      "X-csrftoken": token,
      "cache-control": "no-cache",
      ...(cookie ? { cookie } : {})
    },
    signal
  }).catch(() => null);
  if (!response || (response.status !== 200 && response.status !== 400) || !response.body) return null;
  // Some recorders return 400 while still streaming media, but an HTML or JSON
  // error response must never be passed to ffmpeg as if it were an MP4 stream.
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (contentType && !contentType.includes("video/") && !contentType.includes("application/octet-stream")) return null;
  return response;
}

async function pipeWebStreamToWritable(stream, writable, onChunk = null) {
  const reader = stream.getReader();
  let pipeError = null;
  const onPipeError = (error) => { pipeError = error; };
  const removePipeErrorListener = () => writable.removeListener("error", onPipeError);
  writable.on("error", onPipeError);
  // ffmpeg's stdin can report EPIPE after end() has returned. Keep the error
  // listener through close so a normal recorder/client disconnect cannot crash
  // the persistent Gateway process.
  writable.once("close", removePipeErrorListener);
  const waitForDrain = () => new Promise((resolve) => {
    const finish = () => {
      writable.removeListener("drain", finish);
      writable.removeListener("close", finish);
      writable.removeListener("error", finish);
      resolve();
    };
    writable.once("drain", finish);
    writable.once("close", finish);
    writable.once("error", finish);
  });
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (pipeError || writable.destroyed || !writable.writable) break;
      try {
        onChunk?.(value.byteLength);
        if (!writable.write(Buffer.from(value))) {
          await waitForDrain();
        }
        // A recorder can keep a fetch ReadableStream continuously fulfilled.
        // Yield periodically so HTTP health, claims and HLS requests are not
        // starved while multiple relays are active.
        await new Promise((resolve) => setImmediate(resolve));
      } catch {
        break;
      }
    }
  } finally {
    if (!writable.destroyed && writable.writable) writable.end();
    reader.releaseLock();
    if (writable.destroyed) removePipeErrorListener();
  }
}

async function probePrivateNvrStream(url, token, cookie) {
  const controller = new AbortController();
  const response = await privateNvrStreamResponse(url, token, cookie, controller.signal);
  if (!response) return { ok: false };
  return new Promise((resolve) => {
    const args = [
      "-v", "error",
      "-show_entries", "stream=codec_name,codec_type,width,height",
      "-of", "json",
      "-i", "pipe:0"
    ];
    const child = spawn("ffprobe", args, { stdio: ["pipe", "pipe", "ignore"] });
    let output = "";
    let settled = false;
    let timeout = null;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      controller.abort();
      resolve(result);
    };
    timeout = setTimeout(() => {
      child.kill("SIGKILL");
      finish({ ok: false, reason: "probe_timeout" });
    }, PROBE_TIMEOUT_MS + 1500);
    void pipeWebStreamToWritable(response.body, child.stdin).catch(() => child.kill("SIGKILL"));
    child.stdout.on("data", (chunk) => { output += chunk.toString("utf8"); });
    child.on("error", () => finish({ ok: false, reason: "probe_error" }));
    child.on("close", (code) => {
      if (code !== 0) return finish({ ok: false });
      try {
        const parsed = JSON.parse(output || "{}");
        const stream = parsed.streams?.find((item) => item.codec_type === "video");
        const audio = parsed.streams?.find((item) => item.codec_type === "audio");
        finish({ ok: Boolean(stream), codec: stream?.codec_name ?? null, audio: Boolean(audio), audio_codec: audio?.codec_name ?? null, width: stream?.width ?? null, height: stream?.height ?? null });
      } catch {
        finish({ ok: false });
      }
    });
  });
}

async function discoverPrivateNvr(payload, channelCount) {
  const vendor = String(payload.metadata?.vendor || payload.metadata?.provider || "").toLowerCase();
  if (!vendor.includes("private") && !vendor.includes("er")) return null;
  const session = await privateNvrLogin(payload);
  if (!session) return null;
  const sessionKey = rememberPrivateNvrSession(payload, session);
  const channels = [];
  for (let channel = 1; channel <= channelCount; channel += 1) {
    const url = privateNvrLiveUrl(session, channel, payload.stream_quality);
    let result = { ok: false };
    let probeAttempts = 0;
    while (!result.ok && probeAttempts < PRIVATE_NVR_PROBE_ATTEMPTS) {
      probeAttempts += 1;
      result = await probePrivateNvrStream(url, session.token, session.cookie);
      if (!result.ok && probeAttempts < PRIVATE_NVR_PROBE_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    }
    const streamId = streamIdFor(payload, channel);
    const previousRelay = relays.get(streamId);
    // Discovery runs periodically while users may be watching. A transient
    // probe failure must not tear down a healthy relay or unregister its stable
    // source. The next playback request can retry the retained source, while
    // cloud status still reports offline unless media is currently progressing.
    const retainedLiveEvidence = !result.ok && relayIsProgressing(previousRelay);
    if (result.ok) {
      streamSources.set(streamId, {
        kind: "private_nvr_http_mp4",
        sessionKey,
        channel,
        codec: result.codec ?? null
      });
    }
    channels.push({
      channel,
      name: `DVR ערוץ ${channel}`,
      area: `ערוץ ${channel}`,
      stream_id: streamId,
      status: result.ok || retainedLiveEvidence ? "connected" : "offline",
      health_status: result.ok || retainedLiveEvidence ? "healthy" : "failed",
      reason: result.ok ? "private_stream_found" : retainedLiveEvidence ? "active_relay_verified" : "private_stream_unreachable",
      template: result.ok || streamSources.has(streamId) ? "er_private_http_mp4" : null,
      candidates_tried: probeAttempts,
      codec: result.codec ?? streamSources.get(streamId)?.codec ?? null,
      width: result.width ?? null,
      height: result.height ?? null,
      capabilities: mediaCapabilities(result.ok || retainedLiveEvidence ? { ...result, ok: true } : result, "private_nvr_http_mp4")
    });
  }
  const connectedChannelNumbers = channels.filter((channel) => channel.status === "connected").map((channel) => channel.channel);
  const controlEvidence = await discoverPrivateNvrCapabilities({
    session,
    channels: connectedChannelNumbers,
    timeoutMs: Math.max(2_000, PROBE_TIMEOUT_MS)
  }).catch(() => new Map());
  for (const channel of channels) {
    channel.capabilities = mergePrivateNvrCapabilityEvidence(channel.capabilities, controlEvidence.get(channel.channel));
  }
  // Recorder discovery consumes the native live response sequence. Establish
  // one fresh playback session after all probes, then share it across relays.
  await refreshPrivateNvrSession(sessionKey, session.token);
  return channels;
}

function probeRtsp(url) {
  return new Promise((resolve) => {
    const args = [
      "-v", "error",
      "-rtsp_transport", "tcp",
      "-stimeout", String(Math.max(1000, PROBE_TIMEOUT_MS) * 1000),
      "-show_entries", "stream=codec_name,codec_type,width,height",
      "-of", "json",
      url
    ];
    const child = spawn("ffprobe", args, { stdio: ["ignore", "pipe", "ignore"] });
    let output = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ ok: false, reason: "timeout" });
    }, PROBE_TIMEOUT_MS + 500);
    child.stdout.on("data", (chunk) => {
      output += chunk.toString("utf8");
      if (output.length > 20000) output = output.slice(-20000);
    });
    child.on("error", () => {
      clearTimeout(timeout);
      resolve({ ok: false, reason: "probe_unavailable" });
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        resolve({ ok: false, reason: "unreachable" });
        return;
      }
      try {
        const parsed = JSON.parse(output || "{}");
        const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
        const stream = streams.find((item) => item.codec_type === "video");
        const audio = streams.find((item) => item.codec_type === "audio");
        resolve({ ok: Boolean(stream), reason: stream ? "video_stream_found" : "no_video_stream", audio: Boolean(audio), audio_codec: audio?.codec_name ?? null, width: stream?.width ?? null, height: stream?.height ?? null });
      } catch {
        resolve({ ok: true, reason: "probe_completed" });
      }
    });
  });
}

async function probeChannel(input, channel) {
  const candidates = candidateUrls(input, channel);
  if (!candidates.length) {
    return { channel, status: "pending", reason: "missing_endpoint", candidates_tried: 0, capabilities: mediaCapabilities({ ok: false, audio: false }, "generic_rtsp") };
  }
  for (const candidate of candidates) {
    const result = await probeRtsp(candidate.url);
    if (result.ok) {
      return {
        channel,
        name: `DVR ערוץ ${channel}`,
        area: `ערוץ ${channel}`,
        stream_id: streamIdFor(input, channel),
        status: "connected",
        health_status: "healthy",
        template: candidate.template,
        candidates_tried: candidates.indexOf(candidate) + 1,
        width: result.width,
        height: result.height,
        capabilities: mediaCapabilities(result, candidate.vendor)
      };
    }
  }
  return {
    channel,
    name: `DVR ערוץ ${channel}`,
    area: `ערוץ ${channel}`,
    stream_id: streamIdFor(input, channel),
    status: "offline",
    health_status: "failed",
    reason: "no_candidate_connected",
    candidates_tried: candidates.length,
    capabilities: mediaCapabilities({ ok: false, audio: false }, "generic_rtsp")
  };
}

function requestedChannelCount(input) {
  const raw = Number(input.metadata?.expected_channel_count || input.metadata?.channel_count || input.channel_count || DEFAULT_CHANNEL_COUNT);
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_CHANNEL_COUNT;
  return Math.min(Math.trunc(raw), MAX_CHANNEL_COUNT);
}

async function dvrConnect(payload) {
  const channelCount = requestedChannelCount(payload);
  const started = Date.now();
  let channels = await discoverPrivateNvr(payload, channelCount);
  if (!channels) {
    channels = [];
    for (let channel = 1; channel <= channelCount; channel += 1) {
      channels.push(await probeChannel(payload, channel));
    }
  }
  const connected = channels.filter((item) => item.status === "connected");
  lastDiscoverySummary = {
    channelCount: channels.length,
    connectedCount: connected.length,
    checkedAt: new Date().toISOString()
  };
  return {
    status: connected.length ? "connected" : "pending_gateway",
    channel_count: channelCount,
    connected_channel_count: connected.length,
    failed_channel_count: channelCount - connected.length,
    latency_ms: Date.now() - started,
    channels,
    read_only: true,
    controls_supported: channels.some((channel) => Object.entries(channel.capabilities || {}).some(([key, evidence]) => !["live", "playback", "audio_input"].includes(key) && evidence?.supported === true)),
    no_secrets_returned: true
  };
}

function relayDirectory(streamId) {
  return join(HLS_ROOT, streamId.replace(/[^a-z0-9_-]/gi, "_"));
}

async function privateNvrRelayResponse(source) {
  let session = privateNvrSessions.get(source.sessionKey);
  if (!session) return null;
  if (session.refreshPromise) session = await session.refreshPromise;
  const url = privateNvrLiveUrl(session, source.channel, session.input.stream_quality);
  const controller = new AbortController();
  let response = await privateNvrStreamResponse(url, session.token, session.cookie, controller.signal);
  if (response) return { response, controller, sessionToken: session.token };
  controller.abort();
  const refreshed = await refreshPrivateNvrSession(source.sessionKey, session.token);
  if (!refreshed) return null;
  const retryController = new AbortController();
  const retryUrl = privateNvrLiveUrl(refreshed, source.channel, refreshed.input.stream_quality);
  response = await privateNvrStreamResponse(retryUrl, refreshed.token, refreshed.cookie, retryController.signal);
  return response ? { response, controller: retryController, sessionToken: refreshed.token } : null;
}

async function ensureRelay(streamId) {
  const existing = relays.get(streamId);
  if (existing && relayIsProgressing(existing)) return existing;
  if (existing) stopRelay(streamId, existing);
  if (relayStarts.has(streamId)) return relayStarts.get(streamId);
  const start = startRelay(streamId).finally(() => relayStarts.delete(streamId));
  relayStarts.set(streamId, start);
  return start;
}

function relayIsProgressing(relay) {
  if (!relay?.process || relay.process.exitCode !== null || relay.process.killed) return false;
  if (!existsSync(relay.playlist)) return Date.now() - relay.startedAt < RELAY_STALE_MS;
  try {
    return Date.now() - statSync(relay.playlist).mtimeMs < RELAY_STALE_MS;
  } catch {
    return false;
  }
}

function stopRelay(streamId, relay) {
  relay.monitor && clearInterval(relay.monitor);
  relay.controller?.abort();
  if (relay.process?.exitCode === null && !relay.process.killed) relay.process.kill("SIGKILL");
  if (relays.get(streamId) === relay) relays.delete(streamId);
}

async function startRelay(streamId) {
  const source = streamSources.get(streamId);
  if (!source) return null;
  const directory = relayDirectory(streamId);
  rmSync(directory, { recursive: true, force: true });
  mkdirSync(directory, { recursive: true });
  const playlist = join(directory, "index.m3u8");
  const copyVideo = source.codec === "h264" && process.env.VIDEO_GATEWAY_FORCE_TRANSCODE !== "1";
  const args = [
    "-hide_banner", "-loglevel", "error",
    "-i", "pipe:0",
    "-map", "0:v:0",
    "-an",
    ...(copyVideo
      ? ["-c:v", "copy"]
      : [
        "-c:v", "libx264",
        "-preset", process.env.VIDEO_GATEWAY_X264_PRESET || "veryfast",
        "-tune", "zerolatency",
        "-pix_fmt", "yuv420p",
        "-g", "30",
        "-sc_threshold", "0"
      ]),
    "-f", "hls",
    "-hls_time", "1",
    "-hls_list_size", "5",
    "-hls_flags", "delete_segments+append_list+omit_endlist+independent_segments",
    "-hls_segment_filename", join(directory, "segment-%06d.ts"),
    playlist
  ];
  const relaySource = source.kind === "private_nvr_http_mp4" ? await privateNvrRelayResponse(source) : null;
  if (!relaySource) return null;
  const { response, controller, sessionToken } = relaySource;
  const child = spawn("ffmpeg", args, { stdio: ["pipe", "ignore", "pipe"] });
  const relay = { process: child, playlist, startedAt: Date.now(), lastInputAt: Date.now(), inputBytes: 0, controller, errorSummary: "", sessionToken, monitor: null };
  relays.set(streamId, relay);
  void pipeWebStreamToWritable(response.body, child.stdin, (byteLength) => {
    relay.lastInputAt = Date.now();
    relay.inputBytes += byteLength;
  }).catch(() => child.kill("SIGKILL"));
  relay.monitor = setInterval(() => {
    if (relays.get(streamId) !== relay) return clearInterval(relay.monitor);
    if (!relayIsProgressing(relay) || Date.now() - relay.lastInputAt >= RELAY_STALE_MS) stopRelay(streamId, relay);
  }, 2000);
  relay.monitor.unref();
  child.stderr.on("data", (chunk) => {
    relay.errorSummary = `${relay.errorSummary}${chunk.toString("utf8")}`.slice(-2000);
  });
  child.on("close", (code) => {
    clearInterval(relay.monitor);
    controller.abort();
    if (code && relay.errorSummary) {
      const safeSummary = relay.errorSummary.replace(/(?:https?|rtsp):\/\/\S+/gi, "[private-source]").trim().split("\n").slice(-3).join(" | ");
      console.error(`video relay exited (${code}): ${safeSummary}`);
    }
    if (code && source.kind === "private_nvr_http_mp4") {
      void refreshPrivateNvrSession(source.sessionKey, relay.sessionToken);
    }
    if (relays.get(streamId) === relay) relays.delete(streamId);
  });
  return relay;
}

async function waitForFile(file, timeoutMs = 5000, signal) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    signal?.throwIfAborted();
    if (existsSync(file)) return true;
    await delay(150, undefined, { signal });
  }
  return false;
}

function stopRequestChild(child) {
  if (Number.isSafeInteger(child.pid) && child.pid > 0 && child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
}

async function analyzeRelayActivity(streamId, signal) {
  signal?.throwIfAborted();
  const relay = await awaitRequestWork(ensureRelay(streamId), signal);
  signal?.throwIfAborted();
  if (!relay || !(await waitForFile(relay.playlist, 5000, signal))) return null;
  signal?.throwIfAborted();
  const frameBytes = FRAME_WIDTH * FRAME_HEIGHT;
  const args = [
    "-hide_banner", "-loglevel", "error",
    "-i", relay.playlist,
    "-vf", `fps=1,scale=${FRAME_WIDTH}:${FRAME_HEIGHT},format=gray`,
    "-frames:v", "2",
    "-f", "rawvideo",
    "pipe:1"
  ];
  return await new Promise((resolve) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "ignore"], signal, killSignal: "SIGKILL" });
    const chunks = [];
    let size = 0;
    let failed = false;
    const timeout = setTimeout(() => { failed = true; stopRequestChild(child); }, 7000);
    child.on("error", () => { failed = true; });
    child.stdout.on("error", () => { failed = true; stopRequestChild(child); });
    child.stdout.on("data", (chunk) => {
      if (size < frameBytes * 2) {
        const bytes = Buffer.from(chunk.subarray(0, frameBytes * 2 - size));
        chunks.push(bytes);
        size += bytes.length;
      }
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      const pixels = Buffer.concat(chunks);
      try {
        const metrics = !failed && code === 0 && !signal?.aborted && pixels.length >= frameBytes
          ? computeActivityMetrics(pixels, FRAME_WIDTH, FRAME_HEIGHT) : null;
        resolve(metrics ? { ...metrics, sampled_at: new Date().toISOString() } : null);
      } finally {
        pixels.fill(0);
        for (const chunk of chunks) chunk.fill(0);
        chunks.length = 0;
      }
    });
  });
}

async function analyzeRelayObjects(streamId, signal) {
  signal?.throwIfAborted();
  const relay = await awaitRequestWork(ensureRelay(streamId), signal);
  signal?.throwIfAborted();
  if (!relay || !(await waitForFile(relay.playlist, 5000, signal))) return null;
  signal?.throwIfAborted();
  const ffmpeg = spawn("ffmpeg", [
    "-hide_banner", "-loglevel", "error",
    "-i", relay.playlist,
    "-frames:v", "1",
    "-vf", "scale=300:300,format=rgb24",
    "-f", "rawvideo",
    "pipe:1"
  ], { stdio: ["ignore", "pipe", "ignore"], signal, killSignal: "SIGKILL" });
  const worker = spawn(process.execPath, [OBJECT_WORKER_PATH, "--infer-rgb"], { stdio: ["pipe", "pipe", "ignore"], signal, killSignal: "SIGKILL" });
  return await new Promise((resolve) => {
    const chunks = [];
    let outputSize = 0;
    let failed = false, stopping = false, ffmpegClosed = false, workerClosed = false;
    const stop = () => {
      failed = true;
      if (stopping) return;
      stopping = true;
      stopRequestChild(ffmpeg);
      stopRequestChild(worker);
    };
    const timeout = setTimeout(stop, 20_000);
    const finish = () => {
      // Wait for both children to close before releasing this request's slot.
      if (!ffmpegClosed || !workerClosed) return;
      clearTimeout(timeout);
      try {
        if (failed || signal?.aborted) return resolve(null);
        const result = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (result.ok !== true || result.no_raw_frame_returned !== true || !Array.isArray(result.detections)) return resolve(null);
        resolve(result.detections.slice(0, 10));
      } catch {
        resolve(null);
      } finally {
        for (const chunk of chunks) chunk.fill(0);
        chunks.length = 0;
      }
    };
    ffmpeg.on("error", stop);
    worker.on("error", stop);
    worker.stdout.on("error", stop);
    // A short/invalid frame can make the inference worker exit before ffmpeg.
    // Isolate that normal pipeline shutdown so an EPIPE on the child stdin can
    // never terminate the persistent Gateway or unrelated live relays.
    const closeInferencePipe = () => {
      if (ffmpeg.stdout.readable) ffmpeg.stdout.destroy();
      stop();
    };
    worker.stdin.on("error", closeInferencePipe);
    ffmpeg.stdout.on("error", () => {
      if (!worker.stdin.destroyed) worker.stdin.destroy();
      stop();
    });
    ffmpeg.stdout.pipe(worker.stdin);
    worker.stdout.on("data", (chunk) => {
      if (outputSize + chunk.length > 32_768) { stop(); return; }
      const bytes = Buffer.from(chunk);
      chunks.push(bytes);
      outputSize += bytes.length;
    });
    worker.on("close", (code) => {
      workerClosed = true;
      if (code !== 0) stop();
      finish();
    });
    ffmpeg.on("close", (code) => {
      ffmpegClosed = true;
      if (ffmpeg.stdout.readable) ffmpeg.stdout.destroy();
      if (code !== 0) stop();
      finish();
    });
  });
}

async function runFfmpeg(args, timeoutMs = 15000, signal) {
  signal?.throwIfAborted();
  return await new Promise((resolve) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "ignore"], signal, killSignal: "SIGKILL" });
    let failed = false;
    const timeout = setTimeout(() => { failed = true; stopRequestChild(child); }, timeoutMs);
    child.on("error", () => { failed = true; });
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve(!failed && code === 0 && !signal?.aborted);
    });
  });
}

async function captureEventMedia(streamId, input = {}, signal) {
  signal?.throwIfAborted();
  const relay = await awaitRequestWork(ensureRelay(streamId), signal);
  signal?.throwIfAborted();
  if (!relay || !(await waitForFile(relay.playlist, 5000, signal))) return { status: "failed", reason: "relay_not_ready", retryable: true };
  const before = Math.max(0, Math.min(15, Number(input.window_seconds_before ?? 3)));
  const after = Math.max(0, Math.min(15, Number(input.window_seconds_after ?? 5)));
  const duration = Math.max(1, Math.min(EVENT_CLIP_MAX_SECONDS, before + after));
  if (!Number.isFinite(duration)) return { status: "failed", reason: "invalid_capture_window", retryable: false };
  if (after > 0) await delay(after * 1000, undefined, { signal });
  signal?.throwIfAborted();
  const directory = join(tmpdir(), `gan-batuach-event-${randomBytes(8).toString("hex")}`);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const clipPath = join(directory, "clip.mp4");
  const thumbnailPath = join(directory, "thumbnail.jpg");
  try {
    const clipOk = await runFfmpeg([
      "-hide_banner", "-loglevel", "error",
      "-i", relay.playlist,
      "-t", String(duration),
      "-map", "0:v:0",
      "-an",
      "-c:v", "libx264",
      "-preset", process.env.VIDEO_GATEWAY_X264_PRESET || "veryfast",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      clipPath
    ], Math.max(12000, (duration + 8) * 1000), signal);
    signal?.throwIfAborted();
    const thumbnailOk = clipOk && await runFfmpeg([
      "-hide_banner", "-loglevel", "error",
      "-i", clipPath,
      "-frames:v", "1",
      "-vf", "scale=640:-2",
      thumbnailPath
    ], 8000, signal);
    signal?.throwIfAborted();
    if (!clipOk || !thumbnailOk || !existsSync(clipPath) || !existsSync(thumbnailPath)) return { status: "failed", reason: "ffmpeg_capture_failed", retryable: true };
    const clipSize = statSync(clipPath).size;
    const thumbnailSize = statSync(thumbnailPath).size;
    if (clipSize < 1 || clipSize > EVENT_CLIP_MAX_BYTES) return { status: "failed", reason: "clip_size_not_allowed", retryable: true };
    if (thumbnailSize < 1 || thumbnailSize > EVENT_THUMBNAIL_MAX_BYTES) return { status: "failed", reason: "thumbnail_size_not_allowed", retryable: true };
    return {
      status: "available",
      captured_at: new Date().toISOString(),
      duration_seconds: duration,
      window_seconds_before: before,
      window_seconds_after: after,
      clip: { content_type: "video/mp4", base64: readFileSync(clipPath).toString("base64"), size: clipSize },
      thumbnail: { content_type: "image/jpeg", base64: readFileSync(thumbnailPath).toString("base64"), size: thumbnailSize },
      read_only: true,
      controls_supported: false,
      no_secrets_returned: true
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function publicGatewayBase(request) {
  const configured = String(process.env.VIDEO_GATEWAY_EXTERNAL_BASE_URL || "").replace(/\/$/, "");
  if (configured) return configured;
  const forwarded = String(request.headers["x-forwarded-proto"] || "http").split(",")[0];
  return `${forwarded}://${request.headers.host}`;
}

function issuePlaybackToken(streamId) {
  const token = randomBytes(24).toString("base64url");
  playbackTokens.set(token, { streamId, expiresAt: Date.now() + PLAYBACK_TOKEN_TTL_MS });
  return token;
}

function validatePlaybackToken(token, streamId) {
  const record = playbackTokens.get(String(token || ""));
  if (!record || record.streamId !== streamId || record.expiresAt < Date.now()) return false;
  return true;
}

async function serveHls(request, response) {
  requestMetrics.hlsRequests += 1;
  const url = new URL(request.url, "http://gateway.local");
  const match = url.pathname.match(/^\/hls\/([a-zA-Z0-9_-]+)\/(index\.m3u8|segment-\d+\.ts)$/);
  if (!match || !validatePlaybackToken(url.searchParams.get("token"), match[1])) {
    browserJson(request, response, 401, { error: "unauthorized" });
    return;
  }
  if (match[2] === "index.m3u8") {
    const relay = await ensureRelay(match[1]);
    if (!relay || !(await waitForFile(relay.playlist, 8000))) {
      browserJson(request, response, 503, { error: "stream_starting", retryable: true });
      return;
    }
  }
  const file = normalize(join(relayDirectory(match[1]), match[2]));
  if (!file.startsWith(relayDirectory(match[1])) || !existsSync(file)) {
    browserJson(request, response, 404, { error: "not_ready" });
    return;
  }
  const extension = extname(file);
  if (extension === ".m3u8") {
    const token = encodeURIComponent(url.searchParams.get("token"));
    const playlist = readFileSync(file, "utf8").replace(/^(segment-\d+\.ts)$/gm, `$1?token=${token}`);
    response.writeHead(200, browserHeaders(request, "application/vnd.apple.mpegurl"));
    response.end(playlist);
    return;
  }
  response.writeHead(200, browserHeaders(request, "video/mp2t"));
  const media = createReadStream(file);
  const closeMedia = () => media.destroy();
  const closeResponse = () => media.destroy();
  const cleanup = () => {
    request.removeListener("close", closeMedia);
    response.removeListener("error", closeResponse);
  };
  request.once("close", closeMedia);
  // Browser HLS clients frequently abandon an old segment when seeking or
  // recovering. Treat that socket close as a normal per-request condition,
  // never as a Gateway process failure.
  response.once("error", closeResponse);
  media.once("error", () => {
    cleanup();
    if (!response.headersSent) browserJson(request, response, 404, { error: "not_ready" });
    else response.end();
  });
  media.once("close", cleanup);
  media.once("end", cleanup);
  media.pipe(response);
}

async function cameraTest(payload) {
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  for (const candidate of candidates) {
    if (!candidate?.url || !String(candidate.url).startsWith("rtsp://")) continue;
    const result = await probeRtsp(String(candidate.url));
    if (result.ok) return { status: "healthy", message: "source reachable", candidatesTried: candidates.indexOf(candidate) + 1, read_only: true };
  }
  return { status: "error", message: "source not reachable", candidatesTried: candidates.length, read_only: true };
}

async function handle(request, response) {
  if (request.method === "OPTIONS" && request.url?.startsWith("/hls/")) {
    response.writeHead(204, browserHeaders(request, "text/plain"));
    response.end();
    return;
  }
  if (request.method === "OPTIONS" && request.url === "/playback/claim") {
    response.writeHead(204, browserHeaders(request, "application/json"));
    response.end();
    return;
  }
  if (request.method === "GET" && request.url?.startsWith("/hls/")) {
    await serveHls(request, response);
    return;
  }
  if (request.url === "/health" && request.method === "GET") {
    const edge = localEdgeReadiness();
    json(response, 200, {
      ok: true,
      status: "healthy",
      provider: "custom",
      read_only: true,
      streamCount: streamSources.size,
      failedStreamCount: Math.max(0, lastDiscoverySummary.channelCount - lastDiscoverySummary.connectedCount),
      lastDiscovery: lastDiscoverySummary,
      requestMetrics,
      mediaHeartbeat: {
        activeRelays: relays.size,
        progressingRelays: [...relays.values()].filter(relayIsProgressing).length,
        stalledRelays: [...relays.values()].filter((relay) => !relayIsProgressing(relay)).length
      },
      edge,
      edge_capability_contract: edgeCapabilityContract(edge),
      capabilities: {
        live: true,
        playback: true,
        event_insights: Boolean(edge.ffprobe_available),
        local_activity_sampling: Boolean(edge.ffprobe_available),
        face_detection: Boolean(edge.face_detection),
        human_detection: Boolean(edge.human_detection),
        image_classification: Boolean(edge.image_classification),
        object_detection: edge.object_detection,
        audio_event_detection: edge.audio_event_detection,
        face_recognition: false,
        audio: false,
        ptz: false,
        siren: false,
        light: false,
        remote_settings: false
      }
    });
    return;
  }
  if (request.url === "/playback/claim" && request.method === "POST") {
    requestMetrics.playbackClaimRequests += 1;
    try {
      const payload = await readJson(request);
      const grant = String(payload.grant || "");
      if (grant.length < 32 || grant.length > 4096) throw new Error("Playback grant is invalid");
      const streamId = await claimCloudPlaybackGrant(grant);
      if (!streamSources.has(streamId)) throw new Error("Playback source is unavailable on this Gateway");
      const relay = await ensureRelay(streamId);
      if (!relay || !(await waitForFile(relay.playlist, 8000))) throw new Error("Playback relay is not ready");
      const token = issuePlaybackToken(streamId);
      const base = publicGatewayBase(request);
      requestMetrics.playbackClaimReady += 1;
      response.writeHead(200, browserHeaders(request, "application/json"));
      response.end(JSON.stringify({ status: "starting", playback: { hls_url: `${base}/hls/${encodeURIComponent(streamId)}/index.m3u8?token=${encodeURIComponent(token)}` }, expires_in_seconds: Math.floor(PLAYBACK_TOKEN_TTL_MS / 1000), private_source_hidden: true }));
    } catch {
      requestMetrics.playbackClaimUnavailable += 1;
      response.writeHead(503, browserHeaders(request, "application/json"));
      response.end(JSON.stringify({ error: "playback_unavailable", retryable: true }));
    }
    return;
  }
  if (!authorized(request)) {
    json(response, 401, { error: "unauthorized" });
    return;
  }
  try {
    const cloudJsonPath = request.url === "/cloud/discovery"
      ? "/api/video-gateway/cloud-discovery"
      : request.url === "/cloud/learning"
        ? "/api/video-gateway/cloud-learning"
        : null;
    if (cloudJsonPath && request.method === "POST" && authorized(request)) {
      const upstream = await forwardDeviceCloudRequest(cloudJsonPath, Buffer.from(JSON.stringify(await readJson(request))), "application/json");
      response.writeHead(upstream.status, { "content-type": upstream.contentType, "cache-control": "private, no-store" });
      response.end(upstream.body);
      return;
    }
    if (request.url === "/cloud/event-media" && request.method === "POST" && authorized(request)) {
      const contentType = String(request.headers["content-type"] || "");
      if (!contentType.startsWith("multipart/form-data;")) throw new Error("invalid_media_content_type");
      const upstream = await forwardDeviceCloudRequest("/api/video-gateway/cloud-event-media", await readBuffer(request), contentType);
      response.writeHead(upstream.status, { "content-type": upstream.contentType, "cache-control": "private, no-store" });
      response.end(upstream.body);
      return;
    }
    if (request.url === "/dvr/connect" && request.method === "POST") {
      json(response, 200, await dvrConnect(await readJson(request)));
      return;
    }
    if (request.url === "/camera/test" && request.method === "POST") {
      json(response, 200, await cameraTest(await readJson(request)));
      return;
    }
    if (request.url === "/camera/register" && request.method === "POST") {
      const payload = await readJson(request);
      const result = await cameraTest(payload);
      json(response, 200, { ...result, stream_id: payload.camera_id || payload.stream_id || null });
      return;
    }
    const playbackMatch = request.url?.match(/^\/camera\/([^/]+)\/playback$/);
    if (playbackMatch && request.method === "GET") {
      requestMetrics.playbackRequests += 1;
      const streamId = decodeURIComponent(playbackMatch[1]);
      const relay = await ensureRelay(streamId);
      if (!relay) {
        requestMetrics.playbackUnavailable += 1;
        json(response, 404, { error: "stream_not_registered" });
        return;
      }
      if (!(await waitForFile(relay.playlist, 8000))) {
        requestMetrics.playbackUnavailable += 1;
        json(response, 503, { error: "stream_starting", retryable: true });
        return;
      }
      const token = issuePlaybackToken(streamId);
      requestMetrics.playbackReady += 1;
      const base = publicGatewayBase(request);
      json(response, 200, {
        status: "starting",
        provider: "custom",
        playback: { hls_url: `${base}/hls/${encodeURIComponent(streamId)}/index.m3u8?token=${encodeURIComponent(token)}`, webrtc_url: "" },
        expires_in_seconds: Math.floor(PLAYBACK_TOKEN_TTL_MS / 1000)
      });
      return;
    }
    const insightsMatch = request.url?.match(/^\/camera\/([^/]+)\/insights$/);
    if (insightsMatch && request.method === "GET") {
      const work = createRequestWorkScope(request, response, 30_000);
      try {
        const streamId = decodeURIComponent(insightsMatch[1]);
        const insight = await analyzeRelayActivity(streamId, work.signal);
        work.signal.throwIfAborted();
        if (!insight) {
          json(response, 503, { error: "sample_not_ready" });
          return;
        }
        const edge = localEdgeReadiness();
        const detectedObjects = edge.object_detection ? await analyzeRelayObjects(streamId, work.signal) : null;
        work.signal.throwIfAborted();
        json(response, 200, {
          status: "sampled",
          stream_id: streamId,
          insight: { ...insight, object_detection: detectedObjects ? { status: "sampled", detections: detectedObjects } : { status: "unavailable", detections: [] } },
          local_processing: true,
          no_raw_video_returned: true
        });
      } catch (error) {
        if (!work.signal.aborted) throw error;
        json(response, 503, { error: "analysis_cancelled", retryable: true });
      } finally { work.dispose(); }
      return;
    }
    const eventMediaMatch = request.url?.match(/^\/camera\/([^/]+)\/event-media$/);
    if (eventMediaMatch && request.method === "POST") {
      const streamId = decodeURIComponent(eventMediaMatch[1]);
      if (!streamSources.has(streamId)) {
        json(response, 404, { error: "stream_not_registered" });
        return;
      }
      const work = createRequestWorkScope(request, response, 60_000);
      try {
        const media = await captureEventMedia(streamId, await readJson(request), work.signal);
        work.signal.throwIfAborted();
        json(response, 200, media);
      } catch (error) {
        if (!work.signal.aborted) throw error;
        json(response, 503, { error: "capture_cancelled", retryable: true });
      } finally { work.dispose(); }
      return;
    }
    json(response, 404, { error: "not_found" });
  } catch {
    json(response, 400, { error: "bad_request" });
  }
}

const gatewayServer = http.createServer((request, response) => {
  // A closed HLS request must remain isolated to that request. Without this
  // listener, a client-side EPIPE can terminate the persistent Gateway.
  response.once("error", () => {
    if (!response.writableEnded) response.destroy();
  });
  void handle(request, response).catch(() => {
    if (!response.headersSent) json(response, 500, { error: "gateway_error" });
    else response.destroy();
  });
});

gatewayServer.on("clientError", (_error, socket) => socket.destroy());

gatewayServer.listen(PORT, HOST, () => {
  console.log(`video-gateway listening on ${HOST}:${PORT}`);
});
