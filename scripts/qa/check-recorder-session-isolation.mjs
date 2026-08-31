import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const code = readFileSync(new URL("../../services/video-gateway/server.mjs", import.meta.url), "utf8");
let failure = "source_unavailable", refreshes = 0, calls = 0;
const session = { token: "synthetic", cookie: "", input: {} };
const relays = new Map([["healthy", { lastInputAt: Date.now() }]]);
const sources = new Map([["healthy", { sessionKey: "recorder" }]]);
const relayCode = code.slice(code.indexOf("async function privateNvrRelayResponse("), code.indexOf("async function ensureRelay("));
const api = runInNewContext(`${relayCode};privateNvrRelayResponse`, {
  AbortController, Date, RELAY_STALE_MS: 20_000, relays, streamSources: sources,
  privateNvrSessions: new Map([["recorder", session]]),
  privateNvrLiveUrl: () => "https://synthetic.invalid/media", relayIsProgressing: () => true,
  privateNvrStreamResponse: async (_url, _token, _cookie, _signal, report) => {
    calls++;
    report?.(failure);
    return null;
  },
  refreshPrivateNvrSession: async () => { refreshes++; return session; }
});
assert.equal(await api({ sessionKey: "recorder", channel: 2 }), null);
assert.equal(refreshes, 0, "One channel transport failure must not invalidate healthy recorder streams");
failure = "source_not_media";
await api({ sessionKey: "recorder", channel: 2 });
assert.equal(refreshes, 0, "Malformed/codec input is not an authentication failure");
failure = "authentication_rejected";
await api({ sessionKey: "recorder", channel: 2 });
assert.equal(refreshes, 1, "Explicit rejected authentication can renew the shared session");
failure = "source_unavailable";
relays.clear();
await api({ sessionKey: "recorder", channel: 2 });
assert.equal(refreshes, 2, "An entirely unavailable recorder can attempt bounded recovery");
assert.equal(calls, 6);
const closeHandler = code.slice(code.indexOf('child.on("close", (code) => {', code.indexOf("async function startRelay(")), code.indexOf("async function waitForFile("));
assert.doesNotMatch(closeHandler, /refreshPrivateNvrSession\(/, "Decoder errors cannot rotate recorder credentials");
assert.match(code, /lastRefreshAttemptAt/);
let clock = 100_000, logins = 0;
const sessions = new Map([["recorder", { token: "one", input: {} }]]);
const refreshCode = code.slice(code.indexOf("async function refreshPrivateNvrSession("), code.indexOf("function privateNvrLiveUrl("));
const refresh = runInNewContext(`${refreshCode};refreshPrivateNvrSession`, {
  Date: { now: () => clock }, privateNvrSessions: sessions,
  privateNvrLogin: async () => { logins++; return { token: "two" }; }
});
await Promise.all([refresh("recorder", "one"), refresh("recorder", "one")]);
assert.equal(logins, 1, "Concurrent failures share one recorder authentication request");
clock += 15_000;
await refresh("recorder", "two");
assert.equal(logins, 1, "Persistent failures cannot create a login storm");
clock += 16_000;
await refresh("recorder", "two");
assert.equal(logins, 2, "Recovery becomes eligible again after backoff");
console.log("Recorder session isolation PASS: transport/malformed-source failures preserve healthy channels, explicit auth recovery and decoder separation");
