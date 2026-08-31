import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import vm from "node:vm";
import { parseProbeResult, MAX_PROBE_OUTPUT_BYTES } from "../../services/video-gateway/probe-result.mjs";

const code = readFileSync(new URL("../../services/video-gateway/server.mjs", import.meta.url), "utf8");
const probeCode = code.slice(code.indexOf("function probeRtsp("), code.indexOf("\nasync function probeChannel("));
function createProbe() {
  const calls = [], timers = [];
  const context = vm.createContext({
    Buffer, PROBE_TIMEOUT_MS: 3500, parseProbeResult, MAX_PROBE_OUTPUT_BYTES,
    spawn(binary, args, options) {
      assert.equal(binary, "ffprobe");
      assert.deepEqual(Array.from(options.stdio), ["ignore", "pipe", "ignore"]);
      const child = new EventEmitter();
      Object.assign(child, { stdout: new EventEmitter(), exitCode: null, killed: false, kill() { this.killed = true; this.emit("close", null); } });
      calls.push({ child, args });
      return child;
    },
    setTimeout(run, ms) { const timer = {run, ms, cleared: false}; timers.push(timer); return timer; },
    clearTimeout(timer) { if (timer) timer.cleared = true; }
  });
  vm.runInContext(`${probeCode}\nthis.probe = probeRtsp;`, context);
  return { start: () => context.probe("rtsp://fixture.invalid/channel"), calls, timers };
}
const valid = JSON.stringify({ streams: [null, {codec_type:"audio",codec_name:"aac"}, {codec_type:"video",codec_name:"h264",width:640,height:480}] });
const invalid = ["", "broken", '{"streams":[', "null", "{}", "[]", '{"streams":{}}', '{"streams":[null]}', '{"streams":[{"codec_type":"audio","codec_name":"aac"}]}'];
for (const output of invalid) {
  const fixture = createProbe(), result = fixture.start(), child = fixture.calls[0].child;
  child.stdout.emit("data", Buffer.from(output)); child.emit("close", 0);
  assert.equal((await result).ok, false, "A successful process exit cannot substitute for valid video metadata");
  assert.equal(parseProbeResult(output).ok, false);
}
{
  const fixture = createProbe(), pending = fixture.start(), {child, args} = fixture.calls[0];
  child.stdout.emit("data", Buffer.from(valid)); child.emit("close", 0);
  assert.deepEqual(JSON.parse(JSON.stringify(await pending)), {ok:true,reason:"video_stream_found",audio:true,audio_codec:"aac",width:640,height:480});
  assert.equal(args[args.indexOf("-timeout")+1], "3500000");
  assert.ok(!args.includes("-stimeout"), "Use the installed RTSP socket timeout option");
  assert.ok(fixture.timers.every(timer=>timer.cleared));
}
for (const scenario of ["timeout", "spawn_error", "nonzero_exit", "oversized"]) {
  const fixture = createProbe(), pending = fixture.start(), child = fixture.calls[0].child;
  if (scenario === "timeout") fixture.timers[0].run();
  if (scenario === "spawn_error") child.emit("error", Error("synthetic"));
  if (scenario === "nonzero_exit") child.emit("close", 1);
  if (scenario === "oversized") child.stdout.emit("data", Buffer.from("x".repeat(MAX_PROBE_OUTPUT_BYTES) + valid));
  child.stdout.emit("data", Buffer.from(valid)); child.emit("close", 0);
  const result = await pending;
  assert.equal(result.ok, false, "Late data must not turn failure into readiness");
  assert.equal(result.reason, {timeout:"timeout",spawn_error:"probe_unavailable",nonzero_exit:"unreachable",oversized:"probe_response_too_large"}[scenario]);
  assert.ok(fixture.timers.every(timer=>timer.cleared));
  if (["timeout", "oversized"].includes(scenario)) assert.ok(child.killed);
}
assert.equal(parseProbeResult("x".repeat(MAX_PROBE_OUTPUT_BYTES)+valid).ok, false);
{
  const fixture = createProbe(), bad = fixture.start(), good = fixture.start();
  fixture.calls[0].child.stdout.emit("data", Buffer.from("broken"));
  fixture.calls[0].child.emit("close", 0);
  fixture.calls[1].child.stdout.emit("data", Buffer.from(valid));
  fixture.calls[1].child.emit("close", 0);
  assert.equal((await bad).ok, false);
  assert.equal((await good).ok, true, "A failed source must not poison another probe");
}
if (process.argv.includes("--check-installed")) {
  const help = spawnSync("ffprobe", ["-hide_banner", "-h", "demuxer=rtsp"], {encoding:"utf8",timeout:5000,maxBuffer:100000});
  assert.equal(help.status, 0);
  assert.match(help.stdout + help.stderr, /\s-timeout\s+<int64>/);
}
console.log("PASS: actual RTSP probe rejects malformed/oversized/late output, preserves video/audio metadata and uses supported bounded socket timeout; no network or credentials");
