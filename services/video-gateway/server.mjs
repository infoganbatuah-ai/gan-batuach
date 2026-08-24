import { createHash, timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";
import http from "node:http";

const PORT = Number(process.env.PORT || process.env.VIDEO_GATEWAY_PORT || 8080);
const HOST = process.env.HOST || process.env.VIDEO_GATEWAY_HOST || "0.0.0.0";
const PROBE_TIMEOUT_MS = Number(process.env.DVR_PROBE_TIMEOUT_MS || 3500);
const DEFAULT_CHANNEL_COUNT = Number(process.env.DVR_EXPECTED_CHANNEL_COUNT || 16);
const MAX_CHANNEL_COUNT = 64;

function json(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "private, no-store, max-age=0"
  });
  response.end(JSON.stringify(body));
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
  const vendor = String(input.metadata?.vendor || input.metadata?.provider || input.connection_type || "").toLowerCase();
  const all = [
    { vendor: "hikvision", template: "hikvision_streaming_channels", url: `rtsp://${auth}${host}:${port}/Streaming/Channels/${channelSuffix(channel, quality)}` },
    { vendor: "dahua", template: "dahua_realmonitor", url: `rtsp://${auth}${host}:${port}/cam/realmonitor?channel=${channel}&subtype=${subtype}` },
    { vendor: "uniview", template: "uniview_unicast", url: `rtsp://${auth}${host}:${port}/unicast/c${channel}/s${quality === "main" ? 0 : 1}` },
    { vendor: "generic", template: "generic_channel_quality", url: `rtsp://${auth}${host}:${port}/ch${channel}/${quality}` },
    { vendor: "generic", template: "generic_stream", url: `rtsp://${auth}${host}:${port}/stream${channel}` }
  ];
  if (vendor.includes("hikvision")) return all.filter((item) => item.vendor === "hikvision");
  if (vendor.includes("dahua")) return all.filter((item) => item.vendor === "dahua");
  if (vendor.includes("uniview")) return all.filter((item) => item.vendor === "uniview");
  return all;
}

function streamIdFor(input, channel) {
  const fingerprint = createHash("sha256")
    .update([input.connection_type || "dvr", cleanHost(input.endpoint || input.host), channel].join(":"))
    .digest("hex")
    .slice(0, 18);
  return `dvr_${fingerprint}_${channel}`;
}

function probeRtsp(url) {
  return new Promise((resolve) => {
    const args = [
      "-v", "error",
      "-rtsp_transport", "tcp",
      "-stimeout", String(Math.max(1000, PROBE_TIMEOUT_MS) * 1000),
      "-select_streams", "v:0",
      "-show_entries", "stream=codec_type,width,height",
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
        const stream = Array.isArray(parsed.streams) ? parsed.streams.find((item) => item.codec_type === "video") : null;
        resolve({ ok: Boolean(stream), reason: stream ? "video_stream_found" : "no_video_stream", width: stream?.width ?? null, height: stream?.height ?? null });
      } catch {
        resolve({ ok: true, reason: "probe_completed" });
      }
    });
  });
}

async function probeChannel(input, channel) {
  const candidates = candidateUrls(input, channel);
  if (!candidates.length) {
    return { channel, status: "pending", reason: "missing_endpoint", candidates_tried: 0 };
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
        height: result.height
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
    candidates_tried: candidates.length
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
  const channels = [];
  for (let channel = 1; channel <= channelCount; channel += 1) {
    channels.push(await probeChannel(payload, channel));
  }
  const connected = channels.filter((item) => item.status === "connected");
  return {
    status: connected.length ? "connected" : "pending_gateway",
    channel_count: channelCount,
    connected_channel_count: connected.length,
    failed_channel_count: channelCount - connected.length,
    latency_ms: Date.now() - started,
    channels,
    read_only: true,
    controls_supported: false,
    no_secrets_returned: true
  };
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
  if (request.url === "/health" && request.method === "GET") {
    json(response, 200, { ok: true, status: "healthy", provider: "custom", read_only: true });
    return;
  }
  if (!authorized(request)) {
    json(response, 401, { error: "unauthorized" });
    return;
  }
  try {
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
    json(response, 404, { error: "not_found" });
  } catch {
    json(response, 400, { error: "bad_request" });
  }
}

http.createServer((request, response) => {
  void handle(request, response);
}).listen(PORT, HOST, () => {
  console.log(`video-gateway listening on ${HOST}:${PORT}`);
});
