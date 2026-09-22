import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../../services/video-gateway/server.mjs", import.meta.url), "utf8");

for (const required of [
  'const SHADOW_MODE = process.env.VIDEO_GATEWAY_SHADOW_MODE === "1"',
  'Shadow qualification must bind to loopback',
  'Shadow qualification HLS state must use an isolated temporary directory',
  'Shadow qualification cannot load managed-device or cloud credentials',
  'Shadow qualification cloud access is disabled',
  'shadow_route_not_available',
  'payload?.metadata?.shadow_qualification !== true',
  'filter.length !== 1',
  'payload?.metadata?.read_only_requested !== true',
  'function scheduleRelayResume(streamId, delayMs)',
  'if (remainingMs > 0) return scheduleRelayResume(streamId, remainingMs)',
  'scheduleRelayResume(streamId, retryMs)'
]) assert.ok(source.includes(required), `missing shadow safety contract: ${required}`);

assert.match(source, /!SHADOW_MODE && \(GATEWAY_KEYCHAIN_SERVICE \|\| GATEWAY_SECRET_DIR\)/,
  "Shadow mode must disable cloud command polling");
assert.match(source, /method === "POST" && path === "\/dvr\/connect"/,
  "Shadow mode must expose only the bounded DVR connect route for setup");
assert.match(source, /method === "GET" && \/\^\\\/camera\\\/\[\^\/\]\+\\\/playback\$\//,
  "Shadow mode must permit only per-stream playback after discovery");

console.log("PUSH 38 single-channel DVR shadow safety PASS");
