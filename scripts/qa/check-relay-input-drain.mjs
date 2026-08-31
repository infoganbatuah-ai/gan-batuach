import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import vm from "node:vm";
import { createRelayInputMetrics } from "../../services/video-gateway/relay-input-metrics.mjs";
import { createHardwareTranscoder, hardwareDecodeArgs, hardwareEncodeArgs } from "../../services/video-gateway/hardware-transcoder.mjs";

const server = readFileSync(new URL("../../services/video-gateway/server.mjs", import.meta.url), "utf8");
const pipe = server.slice(server.indexOf("async function pipeWebStreamToWritable("), server.indexOf("\nasync function probePrivateNvrStream("));
const start = server.slice(server.indexOf("async function startRelay("), server.indexOf("\nasync function waitForFile("));
const hardware = process.argv.includes("--run-hardware");
if (hardware) assert.equal(process.platform, "darwin", "Explicit hardware QA requires macOS");
const fixtureCodec = hardware
  ? ["-vf", "format=nv12", "-c:v", "hevc_videotoolbox", "-allow_sw", "0", "-realtime", "1", "-b:v", "800k", "-g", "25", "-bf", "0", "-tag:v", "hvc1"]
  : ["-c:v", "libx264", "-threads", "1", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-g", "25"];
const fixture = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-filter_threads", "1", "-f", "lavfi", "-i", `testsrc=size=${hardware ? "640x480" : "160x96"}:rate=25`, "-frames:v", "130", ...fixtureCodec, "-f", "mp4", "-movflags", "frag_keyframe+empty_moov", "pipe:1"], { timeout: 15000, maxBuffer: 2_000_000 });
assert.equal(fixture.status, 0);
const root = mkdtempSync(join(tmpdir(), "relay-drain-qa-"));
const relays = new Map(), children = [];
let exit;
const lifecycle = { starts: 0, inputSocketError: 0, inputAborted: 0, inputOtherError: 0, upstreamEnded: 0, upstreamFailed: 0 };
let sent = false;
const body = new ReadableStream({ pull(controller) {
  if (!sent) { sent = true; controller.enqueue(fixture.stdout); }
  else controller.error(Object.assign(new Error("synthetic_socket_closed"), { cause: { code: "UND_ERR_SOCKET" } }));
} });
const context = vm.createContext({
  Buffer, Date, process: { env: {} }, createRelayInputMetrics, relays,
  streamSources: new Map([["fixture", { kind: "private_nvr_http_mp4", codec: hardware ? "hevc" : "h264" }]]),
  relayDirectory: () => root, mkdirSync, existsSync, statSync, join,
  hardwareDecodeArgs, hardwareEncodeArgs,
  hardwareTranscoder: hardware ? createHardwareTranscoder() : { test() { assert.fail("H264 copy needs no hardware provisioning"); } },
  RELAY_STALE_MS: 20000, relayLifecycle: lifecycle,
  privateNvrRelayResponse: async () => ({ response: { body }, controller: new AbortController(), sessionToken: "synthetic" }),
  spawn(name, args, options) {
    const child = spawn(name, args, options);
    children.push(child);
    exit = new Promise(resolve => { child.once("close", code => resolve(code)); child.once("error", () => resolve("spawn_error")); });
    return child;
  },
  setInterval, clearInterval, setTimeout, clearTimeout, setImmediate,
  playbackTokens: new Map(), ensureRelay: async () => assert.fail("No lease: do not reconnect"),
  relayIsProgressing: () => true, stopRelay: () => assert.fail("No stale relay"), console: { error() {} }
});
try {
  vm.runInContext(`${pipe}\n${start}\nthis.start = startRelay;`, context);
  const relay = await context.start("fixture");
  assert.equal(relay.encoder, hardware ? "videotoolbox" : "copy");
  const code = await exit;
  assert.equal(code, 0, "A socket error must allow buffered media to flush instead of immediate SIGKILL");
  assert.equal(lifecycle.inputSocketError, 1);
  const playlist = readFileSync(relay.playlist, "utf8");
  const duration = [...playlist.matchAll(/^#EXTINF:([\d.]+),/gm)].reduce((sum, match) => sum + Number(match[1]), 0);
  assert.ok(duration >= 4.19, "The bounded final window must retain the last partial segment");
  assert.match(playlist, hardware ? /#EXTINF:0\.400000/ : /#EXTINF:0\.200000/);
  console.log(JSON.stringify({ result: "PASS", encoder: relay.encoder, final_window_seconds: duration, socket_errors: 1, synthetic_only: true }));
} finally {
  for (const child of children) if (child.exitCode === null && !child.killed) child.kill("SIGKILL");
  for (const relay of relays.values()) { clearInterval(relay.monitor); clearTimeout(relay.drainTimer); }
  rmSync(root, { recursive: true, force: true });
}
