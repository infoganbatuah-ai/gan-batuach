import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import { MAX_PROBE_OUTPUT_BYTES, parseProbeResult } from "../../services/video-gateway/probe-result.mjs";

const source = readFileSync(new URL("../../services/video-gateway/server.mjs", import.meta.url), "utf8");
const start = source.indexOf("function probeRtsp(");
const end = source.indexOf("function requestedChannelCount(", start);
assert.ok(start >= 0 && end > start);
const script = new vm.Script(source.slice(start, end) + "\nexports.probe = probeRtsp; exports.channel = probeChannel;");
const candidates = [
  { url: "rtsp://camera.fixture.invalid/stream1", template: "generic_stream", vendor: "generic" },
  { url: "rtsp://camera.fixture.invalid/ch1/sub", template: "generic_channel_quality", vendor: "generic" },
];
const validProbeData = Buffer.from(JSON.stringify({
  streams: [{ codec_type: "video", codec_name: "h264", width: 640, height: 360 }],
}));
const privateMarker = "private-fixture-text-must-not-escape";

function fixture({ prepareFailure, spawnFailure, attachFailure } = {}) {
  const children = [];
  const inputs = [];
  const timers = new Map();
  const streamSources = new Map();
  const exports = {};
  let nextTimer = 0;
  script.runInNewContext({
    exports,
    PROBE_TIMEOUT_MS: 3500,
    MAX_PROBE_OUTPUT_BYTES,
    parseProbeResult,
    protectedRtspInput(url) {
      inputs.push(url);
      if (prepareFailure?.(url)) throw Error(privateMarker);
      return {
        args: ["-i", "pipe:0"],
        attach(child) {
          if (attachFailure) throw Error(privateMarker);
          child.stdin.end();
        },
      };
    },
    spawn(command, args, options) {
      assert.equal(command, "ffprobe");
      assert.equal(args.includes(privateMarker), false);
      assert.deepEqual([...options.stdio], ["pipe", "pipe", "ignore"]);
      if (spawnFailure) throw Error(privateMarker);
      const child = Object.assign(new EventEmitter(), {
        stdin: Object.assign(new EventEmitter(), { end() {} }),
        stdout: new EventEmitter(),
        exitCode: null,
        killed: false,
        signals: [],
        kill(signal) { this.killed = true; this.signals.push(signal); },
      });
      children.push(child);
      return child;
    },
    setTimeout(handler) { const id = ++nextTimer; timers.set(id, handler); return id; },
    clearTimeout(id) { timers.delete(id); },
    candidateUrls: () => candidates,
    streamIdFor: () => "synthetic-standalone-1",
    streamSources,
    relays: new Map(),
    relayIsProgressing: () => false,
    mediaCapabilities: ({ ok }) => ({ preview: ok }),
  }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  return { ...exports, children, inputs, timers, streamSources };
}

function pipeError() {
  return Object.assign(new Error(privateMarker), { code: "EPIPE" });
}

function finishVideoProbe(child) {
  child.stdout.emit("data", validProbeData);
  child.exitCode = 0;
  child.emit("close", 0);
}

test("early ffprobe stdin EPIPE is a bounded nonfatal result and keeps the error handler through close", async () => {
  const h = fixture();
  const result = h.probe(candidates[0].url);
  const child = h.children[0];
  assert.doesNotThrow(() => child.stdin.emit("error", pipeError()));
  const output = await result;
  assert.equal(output.ok, false);
  assert.equal(output.reason, "probe_input_unavailable");
  assert.deepEqual(child.signals, ["SIGKILL"]);
  assert.equal(h.timers.size, 0);
  child.emit("close", 1);
  assert.doesNotThrow(() => child.stdin.emit("error", pipeError()));
  assert.doesNotMatch(JSON.stringify(output), new RegExp(privateMarker));
});

test("rejected protected input does not launch a child and the next existing candidate can connect", async () => {
  const h = fixture({ prepareFailure: (url) => url === candidates[0].url });
  const result = h.channel({}, 1);
  // Let discovery continue from the rejected candidate to the next one.
  await Promise.resolve();
  await Promise.resolve();
  if (h.children.length !== 1) await result;
  assert.equal(h.children.length, 1);
  finishVideoProbe(h.children[0]);
  const response = await result;
  assert.equal(response.status, "connected");
  assert.equal(response.candidates_tried, 2);
  assert.equal(h.streamSources.get("synthetic-standalone-1").url, candidates[1].url);
  assert.doesNotMatch(JSON.stringify(response), new RegExp(privateMarker));
});

test("synchronous child launch and input handoff failures return safe outcomes with no orphan timer", async () => {
  const unavailable = fixture({ spawnFailure: true });
  const first = await unavailable.probe(candidates[0].url);
  assert.equal(first.reason, "probe_unavailable");
  assert.equal(unavailable.children.length, 0);

  const attach = fixture({ attachFailure: true });
  const second = await attach.probe(candidates[0].url);
  assert.equal(second.reason, "probe_input_unavailable");
  assert.deepEqual(attach.children[0].signals, ["SIGKILL"]);
  assert.equal(attach.timers.size, 0);
  assert.doesNotMatch(JSON.stringify([first, second]), new RegExp(privateMarker));
});

test("the existing timeout wins over late pipe events and does not schedule another probe", async () => {
  const h = fixture();
  const result = h.probe(candidates[0].url);
  const child = h.children[0];
  const [timeout] = h.timers.values();
  timeout();
  assert.equal((await result).reason, "timeout");
  assert.equal(h.timers.size, 0);
  assert.doesNotThrow(() => child.stdin.emit("error", pipeError()));
  child.emit("close", 1);
  assert.equal(h.children.length, 1);
  assert.deepEqual(child.signals, ["SIGKILL"]);
});

test("a read-side pipe failure is bounded and does not leak across discovery", async () => {
  const h = fixture();
  const result = h.probe(candidates[0].url);
  const child = h.children[0];
  assert.doesNotThrow(() => child.stdout.emit("error", pipeError()));
  const report = await result;
  assert.equal(report.reason, "probe_output_unavailable");
  assert.deepEqual(child.signals, ["SIGKILL"]);
  assert.equal(h.timers.size, 0);
  assert.doesNotMatch(JSON.stringify(report), new RegExp(privateMarker));
});

test("exhausting the existing candidates keeps public failure coarse and registers no stream", async () => {
  const h = fixture();
  const result = h.channel({}, 1);
  h.children[0].stdin.emit("error", pipeError());
  await Promise.resolve();
  assert.equal(h.children.length, 2);
  h.children[1].stdin.emit("error", pipeError());
  const response = await result;
  assert.equal(response.status, "offline");
  assert.equal(response.reason, "no_candidate_connected");
  assert.equal(response.candidates_tried, candidates.length);
  assert.equal(h.streamSources.size, 0);
  assert.equal(h.timers.size, 0);
  assert.doesNotMatch(JSON.stringify(response), /probe_input_unavailable|private-fixture-text/);
});

test("healthy standalone acquisition registers the exact first candidate with one child", async () => {
  const h = fixture();
  const result = h.channel({}, 1);
  finishVideoProbe(h.children[0]);
  const response = await result;
  assert.equal(response.status, "connected");
  assert.equal(response.width, 640);
  assert.equal(response.candidates_tried, 1);
  assert.equal(h.streamSources.get("synthetic-standalone-1").url, candidates[0].url);
  assert.equal(h.children.length, 1);
  assert.equal(h.timers.size, 0);
  assert.doesNotThrow(() => h.children[0].stdin.emit("error", pipeError()));
  assert.deepEqual(h.children[0].signals, []);
});
