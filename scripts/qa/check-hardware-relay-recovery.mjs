import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { createHardwareTranscoder, hardwareDecodeArgs, hardwareEncodeArgs } from "../../services/video-gateway/hardware-transcoder.mjs";
import { createRelayInputMetrics } from "../../services/video-gateway/relay-input-metrics.mjs";

const server = readFileSync(new URL("../../services/video-gateway/server.mjs", import.meta.url), "utf8");
const code = server.slice(server.indexOf("async function startRelay("), server.indexOf("\nasync function waitForFile("));
const hardwareTranscoder = createHardwareTranscoder({ platform: "darwin", run: async () => ({ok:true, output:Buffer.alloc(188)}) });
const spawned = [], relays = new Map();
const context = vm.createContext({
  hardwareTranscoder, hardwareDecodeArgs, hardwareEncodeArgs, createRelayInputMetrics,
  streamSources: new Map(["a", "b", "c", "d"].map(id=>[id,{kind:"private_nvr_http_mp4",codec:"hevc"}])),
  relays, relayDirectory: () => "/synthetic", mkdirSync() {}, join,
  process: {env:{}}, Date, RELAY_STALE_MS:20_000,
  relayLifecycle: {starts:0,upstreamFailed:0,upstreamEnded:0},
  privateNvrRelayResponse: async () => ({response:{body:null}, controller:new AbortController(), sessionToken:"synthetic"}),
  spawn(_name,args) {
    const child = new EventEmitter();
    Object.assign(child,{args,stdin:{writableNeedDrain:false},stderr:new EventEmitter(),exitCode:null,kill(){this.killed=true;}});
    spawned.push(child);
    return child;
  },
  pipeWebStreamToWritable: async()=>{},
  setInterval: callback=>({callback,unref(){}}), clearInterval(){},
  setTimeout: (callback, delay)=>({callback,delay,unref(){}}), clearTimeout(timer) { timer.cleared = true; },
  playbackTokens:new Map(), ensureRelay:async()=>{}, relayIsProgressing:()=>true,
  stopRelay:(_id,relay)=>relay.process.kill(), console:{error() {}}
});
vm.runInContext(`${code}\nglobalThis.start=startRelay;`,context);
await context.start("a");
assert.ok(spawned[0].args.includes("h264_videotoolbox"));
spawned[0].emit("close",1);
await context.start("a");
assert.ok(spawned[1].args.includes("libx264"), "An encoder failure must fall back on the next real start");
await context.start("b");
assert.ok(spawned[2].args.includes("h264_videotoolbox"), "A failed source must not disable siblings");
spawned[2].emit("close",null);
await context.start("b");
assert.ok(spawned[3].args.includes("h264_videotoolbox"), "An upstream disconnect is not a hardware failure");
const stalled = await context.start("c");
stalled.startedAt = Date.now()-30000;
stalled.lastInputAt = Date.now()-30000;
stalled.process.stdin.writableNeedDrain = true;
stalled.monitor.callback();
await context.start("c");
assert.ok(spawned.at(-1).args.includes("libx264"), "A stuck encoder pipe must recover through the bounded software path");
context.pipeWebStreamToWritable = async () => { throw Object.assign(new Error("synthetic"), {cause:{code:"UND_ERR_SOCKET"}}); };
const draining = await context.start("d");
await new Promise(resolve => setImmediate(resolve));
assert.equal(draining.process.killed, undefined, "Do not discard the buffered tail immediately");
assert.equal(draining.drainTimer.delay, 1500, "A stuck drain has a finite recovery deadline");
draining.drainTimer.callback();
assert.equal(draining.process.killed, true);
draining.process.emit("close", 1);
assert.equal(draining.drainTimer.cleared, true);
assert.equal(hardwareTranscoder.canUse("d", "hevc"), true, "Truncated upstream data does not disprove hardware capability");
console.log("PASS: actual relay lifecycle selects verified hardware, isolates failures and restores software without mistaking upstream closure for hardware failure");
