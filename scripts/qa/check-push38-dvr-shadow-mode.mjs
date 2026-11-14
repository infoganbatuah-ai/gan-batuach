import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../services/video-gateway/server.mjs", import.meta.url), "utf8");
const isolation = readFileSync(new URL("./run-push38-dvr-shadow-isolated.mjs", import.meta.url), "utf8");

for (const required of [
  'const SHADOW_MODE = process.env.VIDEO_GATEWAY_SHADOW_MODE === "1"',
  'Shadow qualification must bind to loopback',
  'Shadow qualification HLS state must use an isolated temporary directory',
  'Shadow qualification cannot load managed-device or cloud credentials',
  'Shadow qualification cloud access is disabled',
  'shadow_route_not_available',
  'payload?.metadata?.shadow_qualification !== true',
  'filter.length === 1',
  'payload?.metadata?.read_only_requested !== true',
  'function scheduleRelayResume(streamId, delayMs, relay = null)',
  'if (remainingMs > 0) return scheduleRelayResume(streamId, remainingMs, relay)',
  'scheduleRelayResume(streamId, retryMs)'
]) assert.ok(source.includes(required), `missing shadow safety contract: ${required}`);

assert.match(source, /!SHADOW_MODE && \(GATEWAY_KEYCHAIN_SERVICE \|\| GATEWAY_SECRET_DIR\)/,
  "Shadow mode must disable cloud command polling");
assert.match(source, /method === "POST" && path === "\/dvr\/connect"/,
  "Shadow mode must expose only the bounded DVR connect route for setup");
assert.match(source, /method === "GET" && \/\^\\\/camera\\\/\[\^\/\]\+\\\/playback\$\//,
  "Shadow mode must permit only per-stream playback after discovery");
assert.match(isolation, /function baselineIdentityMatches[\s\S]*progressingRelays\) >= 1/,
  "known legacy relay collapse must not circularly block isolated candidate diagnosis");
assert.match(isolation, /function restoredBaselineMatches[\s\S]*\[8, 9\]\.includes/,
  "the exact live release must recover to its bounded eight-or-nine stream baseline");
const runner = readFileSync(new URL("./run-push38-dvr-shadow.mjs", import.meta.url), "utf8");
assert.match(runner, /requestedTransport === "native_http_mp4" && item\.template !== "er_private_http_mp4"/,
  "native recorder qualification must fail closed instead of falling back to RTSP");
assert.match(runner, /isolatedMultiChannel \? 90_000 : 20_000/,
  "only the exact isolated nine-source proof receives the bounded startup allowance");
assert.match(source, /last_login_error_code[\s\S]*Retry once inside the[\s\S]*session = await privateNvrLogin\(payload\)/,
  "the native recorder adapter must diagnose and retry one transient login response");

console.log("PUSH 38 single-channel DVR shadow safety PASS");
