import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";

const code = readFileSync(new URL("../../services/video-gateway/server.mjs", import.meta.url), "utf8");
let now = 100_000, playlistTime = 0;
let launched = 0;
const pending = [], monitors = new Set(), relays = new Map(), tokens = new Map();
const lifecycle = { starts: 0, upstreamEnded: 0, upstreamFailed: 0, staleInput: 0, stalePlaylist: 0 };
const context = {
  Date: { now: () => now }, process: { env: {} }, console: { error: () => {} }, join,
  relays, relayStarts: new Map(), streamSources: new Map([["one", { kind: "private_nvr_http_mp4", codec: "h264" }], ["two", { kind: "private_nvr_http_mp4", codec: "h264" }]]),
  playbackTokens: tokens, relayLifecycle: lifecycle, RELAY_STALE_MS: 20_000,
  relayDirectory: (id) => `/synthetic/${id}`, mkdirSync: () => {}, existsSync: () => playlistTime > 0, statSync: () => ({ mtimeMs: playlistTime }),
  privateNvrRelayResponse: async () => ({ response: { body: {} }, controller: new AbortController(), sessionToken: "synthetic" }),
  refreshPrivateNvrSession: async () => {}, pipeWebStreamToWritable: async (_body, _writable, chunk) => chunk(1024),
  spawn: () => {
    launched++;
    const child = new EventEmitter();
    Object.assign(child, { exitCode: null, killed: false, stdin: {}, stderr: new EventEmitter(), kill: () => { child.killed = true; child.emit("close", null); } });
    return child;
  },
  setInterval: (fn) => { const timer = { run: fn, unref: () => {} }; monitors.add(timer); return timer; },
  clearInterval: (timer) => monitors.delete(timer),
  setTimeout: (fn) => { pending.push(fn); return { unref: () => {} }; }
};
const api = runInNewContext(`${code.slice(code.indexOf("async function ensureRelay("), code.indexOf("async function waitForFile("))}; ({ensureRelay,relayIsProgressing});`, context);
const [one, duplicate] = await Promise.all([api.ensureRelay("one"), api.ensureRelay("one")]);
assert.equal(one, duplicate);
assert.equal(launched, 1, "Concurrent viewers must share one upstream");
assert.equal(api.relayIsProgressing(one), false, "Process startup alone is not media evidence");
assert.equal(await api.ensureRelay("one"), one, "Startup grace must not trigger duplicate relays");
playlistTime = now + 1;
assert.equal(api.relayIsProgressing(one), true);
one.process.exitCode = 0;
one.process.emit("close", 0);
pending.shift()();
await new Promise((resolve) => setImmediate(resolve));
assert.equal(launched, 1, "No viewing lease means no background replay loop");
tokens.set("synthetic", { streamId: "one", expiresAt: now + 300_000 });
const second = await api.ensureRelay("one");
second.process.exitCode = 0;
second.process.emit("close", 0);
pending.shift()();
await new Promise((resolve) => setImmediate(resolve));
assert.equal(launched, 3, "A clean upstream EOF must recover while the authorized viewing lease remains valid");
const other = await api.ensureRelay("two");
now += 21_000;
playlistTime = now;
other.lastInputAt = now;
const active = relays.get("one");
active.monitor.run();
assert.equal(lifecycle.staleInput, 1);
assert.equal(relays.get("two"), other, "A stale source must not stop another relay");
tokens.clear();
for (const run of pending.splice(0)) run();
await new Promise((resolve) => setImmediate(resolve));
assert.equal(relays.has("one"), false, "Expired/revoked local leases stop automatic recovery");
console.log("Relay single-flight, truthful startup, lease-scoped EOF recovery and stale-source isolation PASS");
