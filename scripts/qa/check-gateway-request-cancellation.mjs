import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { setTimeout as delay } from "node:timers/promises";
import http from "node:http";
import ts from "typescript";
import { computeActivityMetrics } from "../../services/video-gateway/activity-insights.mjs";
import { awaitRequestWork, createRequestWorkScope } from "../../services/video-gateway/request-work-scope.mjs";

// Load only selected declarations, never the Gateway's startup, Keychain or DVR.
const text = readFileSync("services/video-gateway/server.mjs", "utf8");
const ast = ts.createSourceFile("server.mjs", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const names = new Set(["json", "readJson", "waitForFile", "stopRequestChild", "analyzeRelayActivity", "analyzeRelayObjects", "runFfmpeg", "captureEventMedia", "handle"]);
const declarations = ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.has(node.name?.text));
assert.equal(declarations.length, names.size);
function load(overrides = {}) {
  const context = { Buffer, process: { execPath: process.execPath, env: {} }, Date, setTimeout, clearTimeout, delay,
    FRAME_WIDTH: 32, FRAME_HEIGHT: 18, OBJECT_WORKER_PATH: "synthetic-worker", computeActivityMetrics,
    EVENT_CLIP_MAX_SECONDS: 30, EVENT_CLIP_MAX_BYTES: 8 * 1024 * 1024, EVENT_THUMBNAIL_MAX_BYTES: 512 * 1024,
    awaitRequestWork, createRequestWorkScope, join, randomBytes, ensureRelay: async id => ({ playlist: id }), existsSync: () => true,
    authorized: () => true, streamSources: new Map([["synthetic", {}]]),
    localEdgeReadiness: () => ({ object_detection: true }), ...overrides };
  runInNewContext(declarations.map(node => node.getText(ast)).join("\n"), context);
  return context;
}

for (const end of ["aborted", "close", "error", "finished", "body-read"]) {
  const req = new EventEmitter(), res = new EventEmitter();
  const scope = createRequestWorkScope(req, res, 1000);
  if (end === "aborted") req.emit("aborted");
  else if (end === "body-read") req.emit("close");
  else if (end === "finished") { res.writableFinished = true; res.emit("close"); }
  else res.emit(end);
  assert.equal(scope.signal.aborted, !["finished", "body-read"].includes(end));
  scope.dispose(); scope.dispose();
  assert.equal(req.listenerCount("aborted") + res.listenerCount("close") + res.listenerCount("error"), 0);
}
const timedScope = createRequestWorkScope(new EventEmitter(), new EventEmitter(), 5);
await delay(10); assert.equal(timedScope.signal.aborted, true); timedScope.dispose();

// Actual OS children, but only synthetic Node producers; no ffmpeg/model/DVR call.
const children = [];
let mode = "activity", spawned;
const syntheticSpawn = (_command, args, options) => {
  const worker = args.includes("--infer-rgb");
  const code = mode === "stalled" ? "setTimeout(()=>{},60000)"
    : mode === "activity" ? "process.stdout.write(Buffer.alloc(1152,42))"
    : worker ? (mode === "pipe-failure" ? "process.exit(2)" : 'process.stdin.resume();process.stdin.on("end",()=>process.stdout.write(JSON.stringify({ok:true,no_raw_frame_returned:true,detections:[{label:"person",confidence:0.9}]})))')
    : mode === "pipe-failure" ? "setInterval(()=>process.stdout.write(Buffer.alloc(1024)),1)" : "process.stdout.write(Buffer.alloc(270000))";
  const child = spawn(process.execPath, ["-e", code], options);
  const record = { child, closed: false, killed: false };
  child.once("close", () => { record.closed = true; record.killed = child.signalCode === "SIGKILL"; });
  children.push(record); spawned?.();
  return child;
};
let pixels;
const ctx = load({ spawn: syntheticSpawn, computeActivityMetrics: data => { pixels = data; return computeActivityMetrics(data); } });
for (const pid of [undefined, 0, -1]) ctx.stopRequestChild({ pid, exitCode: null, signalCode: null, kill: () => assert.fail("invalid process kill") });
let value = await ctx.analyzeRelayActivity("synthetic", new AbortController().signal);
assert.equal(value.sample_frames, 2); assert.ok(pixels.every(byte => byte === 0));
mode = "objects";
value = await ctx.analyzeRelayObjects("synthetic", new AbortController().signal);
assert.equal(value[0].label, "person");
mode = "pipe-failure";
assert.equal(await ctx.analyzeRelayObjects("synthetic", new AbortController().signal), null);
assert.ok(children.every(record => record.closed), "Both inference children close before completion");

mode = "stalled";
for (const name of ["analyzeRelayActivity", "analyzeRelayObjects", "runFfmpeg"]) {
  const controller = new AbortController();
  spawned = () => setTimeout(() => controller.abort(), 10);
  value = name === "runFfmpeg" ? await ctx[name]([], 2000, controller.signal) : await ctx[name]("synthetic", controller.signal);
  assert.equal(value, name === "runFfmpeg" ? false : null);
  assert.ok(children.every(record => record.closed), name);
}
spawned = undefined;
const before = children.length;
const cancelled = AbortSignal.abort();
for (const name of ["analyzeRelayActivity", "analyzeRelayObjects", "captureEventMedia"]) {
  await assert.rejects(name === "captureEventMedia" ? ctx[name]("synthetic", {}, cancelled) : ctx[name]("synthetic", cancelled), { name: "AbortError" });
}
assert.equal(children.length, before);
assert.ok(children.some(record => record.killed));

const missing = load({ spawn: (_command, _args, options) => spawn("/nonexistent-synthetic-program", [], options) });
assert.equal(await missing.analyzeRelayActivity("synthetic"), null);
assert.equal(await missing.analyzeRelayObjects("synthetic"), null);
assert.equal(await missing.runFfmpeg([]), false);

// The shared live relay may finish starting, but cancellation must not sample it.
let ready, relayCalls = 0;
const shared = load({ ensureRelay: async () => { relayCalls++; return new Promise(resolve => { ready = resolve; }); }, spawn: () => assert.fail("cancelled request spawned a sampler") });
const duringStart = new AbortController();
const waiting = shared.analyzeRelayActivity("synthetic", duringStart.signal);
duringStart.abort();
await assert.rejects(waiting, { name: "AbortError" });
ready({ playlist: "synthetic" }); assert.equal(relayCalls, 1);
const noFile = load({ existsSync: () => false });
const duringWait = new AbortController();
const fileWait = noFile.waitForFile("synthetic", 1000, duringWait.signal);
duringWait.abort(); await assert.rejects(fileWait, { name: "AbortError" });

// Simulated filesystem proves cancellation/throw/failure cleanup without writing media.
for (const scenario of ["success", "clip-abort", "thumbnail-abort", "throw", "failure", "wait-abort"]) {
  let created = 0, removed = 0, commands = 0, read = 0;
  const controller = new AbortController();
  const media = load({ tmpdir: () => "/synthetic-memory-only", mkdirSync: (_path, options) => { created++; assert.equal(options.mode, 0o700); },
    rmSync: () => { removed++; }, statSync: () => ({ size: 10 }), readFileSync: () => { read++; return Buffer.alloc(10); },
    delay: async () => { if (scenario === "wait-abort") controller.abort(); controller.signal.throwIfAborted(); } });
  media.runFfmpeg = async (_args, _timeout, signal) => {
    commands++; assert.equal(signal, controller.signal);
    if (scenario === "throw") throw new Error("synthetic capture failure");
    if (scenario === "clip-abort" || (scenario === "thumbnail-abort" && commands === 2)) controller.abort();
    return scenario !== "failure";
  };
  const capture = media.captureEventMedia("synthetic", {}, controller.signal);
  if (["success", "failure"].includes(scenario)) {
    value = await capture; assert.equal(value.status, scenario === "success" ? "available" : "failed");
  } else await assert.rejects(capture);
  assert.equal(created, scenario === "wait-abort" ? 0 : 1); assert.equal(removed, created);
  assert.equal(read, scenario === "success" ? 2 : 0);
  if (scenario === "clip-abort") assert.equal(commands, 1, "No thumbnail after cancelled clip");
}

// Real loopback HTTP: cancel only the request-owned worker, not another request.
let objectsStarted;
const objectsReady = new Promise(resolve => { objectsStarted = resolve; });
const httpContext = load({ spawn: syntheticSpawn, authorized: req => req.headers["x-synthetic-deny"] !== "1" });
httpContext.analyzeRelayActivity = async (_id, signal) => { signal.throwIfAborted(); return { sampled_at: new Date().toISOString() }; };
httpContext.analyzeRelayObjects = async (_id, signal) => {
  spawned = () => objectsStarted();
  return ctx.analyzeRelayObjects("synthetic", signal);
};
httpContext.captureEventMedia = async (_id, _input, signal) => {
  await delay(10, undefined, { signal }); return { status: "available", synthetic: true };
};
const pending = new Set();
const server = http.createServer((req, res) => {
  const job = httpContext.handle(req, res).finally(() => pending.delete(job)); pending.add(job);
});
try {
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const count = children.length;
  const denied = await fetch(`${base}/camera/synthetic/insights`, { headers: { "x-synthetic-deny": "1" } });
  assert.equal(denied.status, 401); assert.equal(children.length, count);
  const requestController = new AbortController();
  const request = fetch(`${base}/camera/synthetic/insights`, { signal: requestController.signal });
  const rejected = assert.rejects(request, { name: "AbortError" });
  await objectsReady;
  const other = await fetch(`${base}/camera/synthetic/event-media`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal(other.status, 200); assert.equal((await other.json()).status, "available");
  requestController.abort(); await rejected;
  await Promise.all([...pending]);
  assert.ok(children.every(record => record.closed));
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  for (const { child, closed } of children) if (!closed) child.kill("SIGKILL");
}

const runner = readFileSync("scripts/run-persistent-home-gateway.mjs", "utf8");
assert.equal(runner.includes("submitReadinessEvidence"), false);
assert.equal(runner.includes('event_type: "camera_media_readiness"'), false);
assert.ok(runner.includes("learningCycle.run(channels)"));
const runnerAst = ts.createSourceFile("runner.mjs", runner, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
let analyze;
function visit(node) {
  if (ts.isPropertyAssignment(node) && node.name.getText(runnerAst) === "analyze") analyze = node.initializer.getText(runnerAst);
  ts.forEachChild(node, visit);
}
visit(runnerAst); assert.ok(analyze);
for (const [status, data, expected] of [
  [200, { insight: "synthetic" }, "success"], [404, {}, "no_media"],
  [503, { error: "sample_not_ready" }, "no_media"], [503, { error: "analysis_cancelled" }, "failed"], [503, {}, "failed"]
]) {
  const callback = runInNewContext(`(${analyze})`, { gatewayUrl: "http://synthetic.invalid", gatewaySecret: "synthetic-only",
    fetch: async () => ({ status, ok: status === 200, json: async () => data }) });
  const result = callback({ gateway_stream_id: "synthetic" }, new AbortController().signal);
  if (expected === "failed") await assert.rejects(result, /analysis_failed/);
  else assert.equal((await result)[expected === "no_media" ? "state" : "insight"], expected === "no_media" ? "no_media" : "synthetic");
}
console.log("PASS: startup has no automatic diagnostic capture; request abort/deadline/cleanup, actual synthetic child termination, HTTP isolation and normal POST completion (no DVR/Keychain/model access)");
