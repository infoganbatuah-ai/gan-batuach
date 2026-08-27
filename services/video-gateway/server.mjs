import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import { extname, join, normalize } from "node:path";
import { computeActivityMetrics } from "./activity-insights.mjs";

const PORT = Number(process.env.PORT || process.env.VIDEO_GATEWAY_PORT || 8080);
const HOST = process.env.HOST || process.env.VIDEO_GATEWAY_HOST || "0.0.0.0";
const PROBE_TIMEOUT_MS = Number(process.env.DVR_PROBE_TIMEOUT_MS || 3500);
const DEFAULT_CHANNEL_COUNT = Number(process.env.DVR_EXPECTED_CHANNEL_COUNT || 16);
const MAX_CHANNEL_COUNT = 64;
const HLS_ROOT = join(tmpdir(), "gan-batuach-video-gateway-hls");
const PLAYBACK_TOKEN_TTL_MS = 5 * 60 * 1000;
const streamSources = new Map();
const relays = new Map();
const playbackTokens = new Map();
const FRAME_WIDTH = 32;
const FRAME_HEIGHT = 18;

mkdirSync(HLS_ROOT, { recursive: true });

function json(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "private, no-store, max-age=0"
  });
  response.end(JSON.stringify(body));
}

function browserHeaders(contentType) {
  return {
    "content-type": contentType,
    "cache-control": "private, no-store, max-age=0",
    "access-control-allow-origin": process.env.VIDEO_GATEWAY_BROWSER_ORIGIN || "https://gan-batuach.vercel.app",
    "access-control-allow-methods": "GET, OPTIONS"
  };
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

function privateNvrLiveUrl(session, channel, quality = "sub") {
  const streamType = quality === "main" ? 0 : 1;
  return `${session.baseUrl}/live.mp4?channel=${Math.max(0, channel - 1)}&type=${streamType}&chrome=1`;
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
  return response;
}

async function pipeWebStreamToWritable(stream, writable) {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!writable.write(Buffer.from(value))) await new Promise((resolve) => writable.once("drain", resolve));
    }
  } finally {
    writable.end();
    reader.releaseLock();
  }
}

async function probePrivateNvrStream(url, token, cookie) {
  const controller = new AbortController();
  const response = await privateNvrStreamResponse(url, token, cookie, controller.signal);
  if (!response) return { ok: false };
  return new Promise((resolve) => {
    const args = [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=codec_name,codec_type,width,height",
      "-of", "json",
      "-i", "pipe:0"
    ];
    const child = spawn("ffprobe", args, { stdio: ["pipe", "pipe", "ignore"] });
    let output = "";
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      controller.abort();
      resolve(result);
    };
    const timeout = setTimeout(() => child.kill("SIGKILL"), PROBE_TIMEOUT_MS + 1500);
    void pipeWebStreamToWritable(response.body, child.stdin).catch(() => child.kill("SIGKILL"));
    child.stdout.on("data", (chunk) => { output += chunk.toString("utf8"); });
    child.on("error", () => finish({ ok: false }));
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0) return finish({ ok: false });
      try {
        const parsed = JSON.parse(output || "{}");
        const stream = parsed.streams?.find((item) => item.codec_type === "video");
        finish({ ok: Boolean(stream), codec: stream?.codec_name ?? null, width: stream?.width ?? null, height: stream?.height ?? null });
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
  const channels = [];
  for (let channel = 1; channel <= channelCount; channel += 1) {
    const url = privateNvrLiveUrl(session, channel, payload.stream_quality);
    const result = await probePrivateNvrStream(url, session.token, session.cookie);
    const streamId = streamIdFor(payload, channel);
    if (result.ok) {
      streamSources.set(streamId, {
        kind: "private_nvr_http_mp4",
        url,
        token: session.token,
        cookie: session.cookie,
        input: { ...payload, password: String(payload.password || "") },
        channel
      });
    }
    channels.push({
      channel,
      name: `DVR ערוץ ${channel}`,
      area: `ערוץ ${channel}`,
      stream_id: streamId,
      status: result.ok ? "connected" : "offline",
      health_status: result.ok ? "healthy" : "failed",
      reason: result.ok ? "private_stream_found" : "private_stream_unreachable",
      template: result.ok ? "er_private_http_mp4" : null,
      candidates_tried: 1,
      codec: result.codec ?? null,
      width: result.width ?? null,
      height: result.height ?? null
    });
  }
  return channels;
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
  let channels = await discoverPrivateNvr(payload, channelCount);
  if (!channels) {
    channels = [];
    for (let channel = 1; channel <= channelCount; channel += 1) {
      channels.push(await probeChannel(payload, channel));
    }
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

function relayDirectory(streamId) {
  return join(HLS_ROOT, streamId.replace(/[^a-z0-9_-]/gi, "_"));
}

async function refreshPrivateNvrSource(source) {
  const session = await privateNvrLogin(source.input);
  if (!session) return source;
  source.token = session.token;
  source.cookie = session.cookie;
  source.url = privateNvrLiveUrl(session, source.channel, source.input.stream_quality);
  return source;
}

async function ensureRelay(streamId) {
  const existing = relays.get(streamId);
  if (existing?.process && !existing.process.killed) return existing;
  let source = streamSources.get(streamId);
  if (!source) return null;
  if (source.kind === "private_nvr_http_mp4") source = await refreshPrivateNvrSource(source);
  const directory = relayDirectory(streamId);
  mkdirSync(directory, { recursive: true });
  const playlist = join(directory, "index.m3u8");
  const args = [
    "-hide_banner", "-loglevel", "error",
    "-i", "pipe:0",
    "-map", "0:v:0",
    "-an",
    "-c:v", "libx264",
    "-preset", process.env.VIDEO_GATEWAY_X264_PRESET || "veryfast",
    "-tune", "zerolatency",
    "-pix_fmt", "yuv420p",
    "-g", "30",
    "-sc_threshold", "0",
    "-f", "hls",
    "-hls_time", "1",
    "-hls_list_size", "5",
    "-hls_flags", "delete_segments+append_list+omit_endlist+independent_segments",
    "-hls_segment_filename", join(directory, "segment-%06d.ts"),
    playlist
  ];
  const controller = new AbortController();
  const response = await privateNvrStreamResponse(source.url, source.token, source.cookie, controller.signal);
  if (!response) return null;
  const child = spawn("ffmpeg", args, { stdio: ["pipe", "ignore", "ignore"] });
  const relay = { process: child, playlist, startedAt: Date.now(), controller };
  relays.set(streamId, relay);
  void pipeWebStreamToWritable(response.body, child.stdin).catch(() => child.kill("SIGKILL"));
  child.on("close", () => {
    controller.abort();
    if (relays.get(streamId)?.process === child) relays.delete(streamId);
  });
  return relay;
}

async function waitForFile(file, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(file)) return true;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return false;
}

async function analyzeRelayActivity(streamId) {
  const relay = await ensureRelay(streamId);
  if (!relay || !(await waitForFile(relay.playlist))) return null;
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
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "ignore"] });
    const chunks = [];
    let size = 0;
    const timeout = setTimeout(() => child.kill("SIGKILL"), 7000);
    child.stdout.on("data", (chunk) => {
      if (size < frameBytes * 2) {
        chunks.push(chunk);
        size += chunk.length;
      }
    });
    child.on("close", () => {
      clearTimeout(timeout);
      const pixels = Buffer.concat(chunks).subarray(0, frameBytes * 2);
      if (pixels.length < frameBytes) return resolve(null);
      const metrics = computeActivityMetrics(pixels, FRAME_WIDTH, FRAME_HEIGHT);
      resolve(metrics ? { ...metrics, sampled_at: new Date().toISOString() } : null);
    });
  });
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

function serveHls(request, response) {
  const url = new URL(request.url, "http://gateway.local");
  const match = url.pathname.match(/^\/hls\/([a-zA-Z0-9_-]+)\/(index\.m3u8|segment-\d+\.ts)$/);
  if (!match || !validatePlaybackToken(url.searchParams.get("token"), match[1])) {
    json(response, 401, { error: "unauthorized" });
    return;
  }
  const file = normalize(join(relayDirectory(match[1]), match[2]));
  if (!file.startsWith(relayDirectory(match[1])) || !existsSync(file)) {
    json(response, 404, { error: "not_ready" });
    return;
  }
  const extension = extname(file);
  if (extension === ".m3u8") {
    const token = encodeURIComponent(url.searchParams.get("token"));
    const playlist = readFileSync(file, "utf8").replace(/^(segment-\d+\.ts)$/gm, `$1?token=${token}`);
    response.writeHead(200, browserHeaders("application/vnd.apple.mpegurl"));
    response.end(playlist);
    return;
  }
  response.writeHead(200, browserHeaders("video/mp2t"));
  response.end(readFileSync(file));
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
    response.writeHead(204, browserHeaders("text/plain"));
    response.end();
    return;
  }
  if (request.method === "GET" && request.url?.startsWith("/hls/")) {
    serveHls(request, response);
    return;
  }
  if (request.url === "/health" && request.method === "GET") {
    json(response, 200, {
      ok: true,
      status: "healthy",
      provider: "custom",
      read_only: true,
      streamCount: streamSources.size,
      failedStreamCount: 0,
      capabilities: {
        live: true,
        playback: true,
        event_insights: true,
        local_activity_sampling: true,
        audio: false,
        ptz: false,
        siren: false,
        light: false,
        remote_settings: false
      }
    });
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
    const playbackMatch = request.url?.match(/^\/camera\/([^/]+)\/playback$/);
    if (playbackMatch && request.method === "GET") {
      const streamId = decodeURIComponent(playbackMatch[1]);
      const relay = await ensureRelay(streamId);
      if (!relay) {
        json(response, 404, { error: "stream_not_registered" });
        return;
      }
      const token = issuePlaybackToken(streamId);
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
      const streamId = decodeURIComponent(insightsMatch[1]);
      const insight = await analyzeRelayActivity(streamId);
      if (!insight) {
        json(response, 503, { error: "sample_not_ready" });
        return;
      }
      json(response, 200, {
        status: "sampled",
        stream_id: streamId,
        insight,
        local_processing: true,
        no_raw_video_returned: true
      });
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
