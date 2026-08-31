import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../../services/video-gateway/server.mjs", import.meta.url), "utf8");
const functions = source.slice(source.indexOf("function privateNvrSessionHasLiveRelay("), source.indexOf("\nfunction probeRtsp("));
assert.ok(functions.includes("async function discoverPrivateNvr("));
function fixture({ healthy = true, credentialChanged = false, wrongChannel = false } = {}) {
  const payload = { password: credentialChanged ? "new-fixture" : "fixture", metadata: { vendor: "er_private" } };
  const original = { token: "synthetic", input: { password: "fixture" } };
  const sessions = new Map([["session", original]]);
  const streams = new Map([1, 2].map(channel => [`stream-${channel}`, { kind: "private_nvr_http_mp4", sessionKey: "session", channel: wrongChannel && channel === 2 ? 9 : channel, codec: "h264", audio: true, width: 640, height: 480 }]));
  const relays = new Map([1, 2].map(channel => [`stream-${channel}`, { fresh: healthy, lastInputAt: Date.now() }]));
  const calls = { login: 0, refresh: 0, probes: [] };
  const context = {
    Date, Map, Boolean, String, Number, Object, Promise, setTimeout,
    PRIVATE_NVR_PROBE_ATTEMPTS: 1, RELAY_STALE_MS: 20000, PROBE_TIMEOUT_MS: 100,
    privateNvrSessions: sessions, streamSources: streams, relays,
    privateNvrSessionKey: () => "session", relayIsProgressing: relay => relay?.fresh === true,
    privateNvrLogin: async () => { calls.login++; return { token: "new-synthetic" }; },
    rememberPrivateNvrSession: (input, session) => { sessions.set("session", { ...session, input }); return "session"; },
    privateNvrLiveUrl: (_session, channel) => channel,
    streamIdFor: (_input, channel) => `stream-${channel}`,
    probePrivateNvrStream: async channel => { calls.probes.push(channel); return { ok: false }; },
    mediaCapabilities: result => ({ live: result.ok, audio: result.audio }),
    mergePrivateNvrCapabilityEvidence: result => result,
    discoverPrivateNvrCapabilities: async () => new Map(),
    refreshPrivateNvrSession: async () => { calls.refresh++; }
  };
  runInNewContext(`${functions}\nthis.discover = discoverPrivateNvr;`, context);
  return { payload, context, calls, original, sessions };
}
const active = fixture();
const channels = await active.context.discover(active.payload, 3);
assert.equal(active.calls.login, 0, "Periodic discovery must reuse the live recorder session");
assert.equal(active.calls.refresh, 0, "Offline channel probes must not rotate healthy sibling logins");
assert.deepEqual(active.calls.probes, [3], "Only the unavailable channel needs a stream probe");
assert.equal(active.sessions.get("session"), active.original);
assert.deepEqual(Array.from(channels, channel => channel.status), ["connected", "connected", "offline"]);
assert.equal(channels[0].reason, "active_relay_verified");
assert.equal(channels[0].candidates_tried, 0);
assert.equal(channels[0].capabilities.audio, true);
assert.equal(channels[0].width, 640);

const stale = fixture({ healthy: false });
await stale.context.discover(stale.payload, 3);
assert.equal(stale.calls.login, 1, "Absent media requires real authentication, not cached readiness");
assert.equal(stale.calls.refresh, 1);
assert.deepEqual(stale.calls.probes, [1, 2, 3]);
const changed = fixture({ credentialChanged: true });
await changed.context.discover(changed.payload, 3);
assert.equal(changed.calls.login, 1, "Changed credentials must not be silently accepted through a previous session");
const mismatched = fixture({ wrongChannel: true });
const mismatchResult = await mismatched.context.discover(mismatched.payload, 3);
assert.deepEqual(mismatched.calls.probes, [2, 3]);
assert.equal(mismatchResult[1].status, "offline", "Media from a different channel is not live evidence for this source");
console.log("PASS: real discovery function preserves live sessions, probes offline channels only, verifies source binding and checks changed credentials");
