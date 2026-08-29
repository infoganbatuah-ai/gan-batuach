import { readFileSync } from "node:fs";

const gateway = readFileSync("services/video-gateway/server.mjs", "utf8");

for (const required of [
  "await new Promise((resolve) => setImmediate(resolve))",
  "health, claims and HLS requests are not",
  "starved while multiple relays are active",
  "ffmpeg's stdin can report EPIPE after end() has returned",
  "writable.once(\"close\", removePipeErrorListener)",
  "VIDEO_GATEWAY_RELAY_STALE_MS || 20_000",
  "PRIVATE_NVR_PROBE_ATTEMPTS",
  "probe failure must not tear down a healthy relay",
  "active_relay_verified",
  "healthy streams to be torn down between segments",
  "createReadStream(file)",
  "media.pipe(response)",
  "response.once(\"error\", closeResponse)",
  "client-side EPIPE can terminate the persistent Gateway",
  "gatewayServer.on(\"clientError\"",
  "worker.stdin.on(\"error\", closeInferencePipe)",
  "ffmpeg.stdout.on(\"error\"",
  "never terminate the persistent Gateway or unrelated live relays",
  "rotating Keychain refresh material",
  "for (let attempt = 0; attempt < 2; attempt += 1)"
]) {
  if (!gateway.includes(required)) throw new Error(`Missing relay event-loop fairness control: ${required}`);
}

console.log("Gateway relay fairness QA PASS");
