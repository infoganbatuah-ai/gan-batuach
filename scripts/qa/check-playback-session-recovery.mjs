import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { createPlaybackSessionClient, PlaybackFlowError } from "../../lib/domain/digital-observer/playback-session.ts";
import { playbackRequestSchema } from "../../lib/domain/digital-observer/playback-request.ts";

const response = (payload, status = 200) => new Response(JSON.stringify(payload), { status });
const authorized = (grant = "test-grant") => response({ data: { playback: { claim_url: "http://127.0.0.1:18082/playback/claim", grant } } });
const media = (ttl = 300) => response({ playback: { hls_url: "/synthetic-playlist.m3u8" }, expires_in_seconds: ttl });
const isFailure = (code) => (error) => error instanceof PlaybackFlowError && error.flowCode === code;

let cloudCalls = 0;
let claimCalls = 0;
let clock = 1_000;
const shared = createPlaybackSessionClient({ now: () => clock, fetcher: async (url) => {
  if (url.startsWith("/api/")) { cloudCalls++; return authorized(); }
  claimCalls++;
  return media(30);
} });
assert.deepEqual(await Promise.all([shared.request("site-a", "source-a"), shared.request("site-a", "source-a")]), ["/synthetic-playlist.m3u8", "/synthetic-playlist.m3u8"]);
assert.equal(cloudCalls, 1, "Concurrent thumbnails must share the cloud grant request");
assert.equal(claimCalls, 1, "A one-time grant must not be redeemed twice");
await shared.request("site-a", "source-a");
assert.equal(cloudCalls, 1, "Fresh playback sessions must be reused");
clock += 26_000;
await shared.request("site-a", "source-a");
assert.equal(cloudCalls, 2, "Server TTL must constrain the cache lifetime");
await shared.request("site-b", "source-a");
assert.equal(cloudCalls, 3, "Session reuse must be scoped to both site and source");
shared.invalidate("site-a", "source-a");
await shared.request("site-a", "source-a");
assert.equal(cloudCalls, 4);

for (const stage of ["cloud", "local", "body"]) {
  let stuck = true;
  let aborted = false;
  const recovering = createPlaybackSessionClient({ requestTimeoutMs: 15, fetcher: async (url, init) => {
    const cloud = url.startsWith("/api/");
    if (stuck && (stage === "cloud" && cloud || stage === "local" && !cloud || stage === "body" && cloud)) {
      init.signal.addEventListener("abort", () => { aborted = true; }, { once: true });
      if (stage === "body") return { ok: true, json: () => new Promise(() => {}) };
      return new Promise(() => {});
    }
    return cloud ? authorized() : media();
  } });
  await assert.rejects(recovering.request("site", "source"), isFailure(stage === "local" ? "local_timeout" : "cloud_timeout"));
  assert.equal(aborted, true, "Timeout must release the underlying network request");
  stuck = false;
  assert.equal(await recovering.request("site", "source"), "/synthetic-playlist.m3u8", "A timed out promise must not poison all future attempts");
}

let retries = 0;
const delays = [];
const bounded = createPlaybackSessionClient({ sleep: async (delay) => { delays.push(delay); }, fetcher: async () => { retries++; return response({}, 503); } });
await assert.rejects(bounded.request("site", "source"), isFailure("cloud_503"));
assert.equal(retries, 3, "Unavailable cloud service must have bounded retries");
assert.deepEqual(delays, [1200, 2400], "Retries must preserve the bounded increasing backoff");

let eventualCalls = 0;
const eventualDelays = [];
const eventual = createPlaybackSessionClient({ sleep: async (delay) => { eventualDelays.push(delay); }, fetcher: async () => {
  eventualCalls++;
  return eventualCalls < 3 ? response({}, 503) : response({ data: { playback: { hls_url: "/recovered.m3u8" } } });
} });
assert.equal(await eventual.request("site", "source"), "/recovered.m3u8");
assert.equal(eventualCalls, 3);
assert.deepEqual(eventualDelays, [1200, 2400]);

for (const status of [401, 403, 409]) {
  let calls = 0;
  const denied = createPlaybackSessionClient({ sleep: async () => assert.fail("Authorization/ownership failures must not be retried"),
    fetcher: async () => { calls++; return response({}, status); }
  });
  await assert.rejects(denied.request("site", "source"), isFailure(`cloud_${status}`));
  assert.equal(calls, 1);
}

for (const status of [401, 409, 503]) {
  let grants = 0;
  let claims = 0;
  const claimedGrants = [];
  let failing = true;
  const claimFailure = createPlaybackSessionClient({ sleep: async () => assert.fail("Never automatically replay a one-time local claim"),
    fetcher: async (url, init) => {
      if (url.startsWith("/api/")) { grants++; return authorized(`test-grant-${grants}`); }
      claims++;
      claimedGrants.push(JSON.parse(init.body).grant);
      return failing ? response({}, status) : media();
    }
  });
  await assert.rejects(claimFailure.request("site", "source"), isFailure(`local_claim_${status}`));
  assert.equal(grants, 1);
  assert.equal(claims, 1);
  failing = false;
  assert.equal(await claimFailure.request("site", "source"), "/synthetic-playlist.m3u8");
  assert.equal(grants, 2, "Explicit recovery must obtain a fresh cloud grant");
  assert.equal(claims, 2);
  assert.deepEqual(claimedGrants, ["test-grant-1", "test-grant-2"], "Recovery must redeem the new grant, not replay the failed one");
}

const isolated = createPlaybackSessionClient({ fetcher: async (_url, init) => {
  const body = JSON.parse(init.body);
  if (body.camera_source_id === "offline") return response({}, 409);
  return response({ data: { playback: { hls_url: "/synthetic.m3u8" } } });
} });
const isolatedResults = await Promise.allSettled([isolated.request("site", "offline"), isolated.request("site", "online")]);
assert.deepEqual(isolatedResults.map((r) => r.status), ["rejected", "fulfilled"]);

let release;
let invalidatedCalls = 0;
const invalidated = createPlaybackSessionClient({ fetcher: async () => {
  invalidatedCalls++;
  return new Promise((resolve) => { release = () => resolve(response({ data: { playback: { hls_url: "/test.m3u8" } } })); });
} });
const pending = invalidated.request("site", "source");
invalidated.invalidate("site", "source");
release();
await pending;
const fresh = invalidated.request("site", "source");
assert.equal(invalidatedCalls, 2, "An invalidated pending response must not repopulate the cache");
release();
await fresh;

const siteId = "11111111-1111-4111-8111-111111111111";
const sourceId = "22222222-2222-4222-8222-222222222222";
assert.equal(playbackRequestSchema.safeParse({ observer_site_id: siteId, camera_source_id: sourceId }).success, true);
for (const payload of [
  { observer_site_id: siteId, channel: 1 },
  { observer_site_id: siteId, camera_source_id: sourceId, channel: 1 },
  { observer_site_id: siteId, camera_source_id: sourceId, token: "untrusted" },
  { observer_site_id: siteId, camera_source_id: sourceId, mode: "playback" }
]) assert.equal(playbackRequestSchema.safeParse(payload).success, false, "Neither global channel config nor a live feed may stand in for authorized playback");
const route = readFileSync(new URL("../../app/api/digital-observer/dvr-gateway/route.ts", import.meta.url), "utf8");
assert.doesNotMatch(route, /createDvrPlaybackSession|payload\.channel/, "The shared-channel fallback must not bypass site-source ownership");
assert.match(route, /\.eq\("observer_site_id", payload\.observer_site_id\)/);

// Execute the actual component with deterministic hooks/media/timers. No DVR,
// browser session or server is involved in these lifecycle regression tests.
const component = readFileSync(new URL("../../components/digital-observer/observer-live-player.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(component, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
let hook = 0;
let hooks = [];
let effect;
let stateUpdates = [];
const sessionRequests = [];
const sessionInvalidations = [];
const timers = new Map();
const intervals = new Map();
let nextInterval = 0;
const renewals = [];
let visibilityCallback;
let visibilityDisconnected = false;
let nextTimer = 0;
const fakeReact = {
  useRef: (initial) => { const index = hook++; return hooks[index] ??= { current: initial }; },
  useState: (initial) => { const index = hook++; hooks[index] ??= initial; return [hooks[index], (next) => { hooks[index] = typeof next === "function" ? next(hooks[index]) : next; stateUpdates.push(hooks[index]); }]; },
  useEffect: (run) => { effect = run; }
};
const exports = {};
const context = {
  IntersectionObserver: class { constructor(callback) { visibilityCallback = callback; } observe() {} disconnect() { visibilityDisconnected = true; } },
  exports, require: (name) => {
    if (name === "react") return fakeReact;
    if (name === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    if (name === "hls.js") return { default: { isSupported: () => false } };
    if (name.endsWith("playback-session")) return { createPlaybackSessionClient: () => ({
      request: async (site, source) => { sessionRequests.push([site, source]); return "/test.m3u8"; },
      renew: async (site, source, url) => { renewals.push([site, source, url]); return url; },
      invalidate: (site, source) => { sessionInvalidations.push([site, source]); }
    }), playbackFailureReason: () => "test" };
    return {};
  },
  Date, Promise, setInterval: (run, ms) => { intervals.set(++nextInterval, { run, ms }); return nextInterval; }, clearInterval: (id) => intervals.delete(id),
  setTimeout: (fn) => { timers.set(++nextTimer, fn); return nextTimer; },
  clearTimeout: (id) => timers.delete(id)
};
runInNewContext(compiled, context);
function render(source = "source-a") {
  hook = 0;
  const tree = exports.ObserverLivePlayer({ observerSiteId: "site", cameraSourceId: source, name: "Test" });
  const video = tree.props.children.find((child) => child?.type === "video");
  video.props.ref.current = { currentTime: 0, seekable: { length: 0 }, canPlayType: () => "probably", play: async () => {}, removeAttribute: () => {}, load: () => {} };
  const cleanup = effect();
  return { video, cleanup };
}
let rendered = render();
await new Promise((resolve) => setImmediate(resolve));
assert.deepEqual(sessionRequests, [["site", "source-a"]], "The player must use the shared site-scoped session client");
const leaseInterval = [...intervals.values()].find((i) => i.ms === 60_000);
assert.ok(leaseInterval, "Every active player must renew its media lease before expiry");
await leaseInterval.run();
await new Promise((resolve) => setImmediate(resolve));
assert.deepEqual(renewals, [["site", "source-a", "/test.m3u8"]]);
assert.equal(timers.size, 0, "In-place lease renewal must not reset the working decoder");
rendered.video.props.onError();
assert.deepEqual(sessionInvalidations, [["site", "source-a"]]);
assert.equal(timers.size, 1);
rendered.cleanup();
assert.equal(timers.size, 0);
assert.equal(intervals.size, 0, "Unmount must release both media and lease heartbeats");
rendered = render("source-b");
await new Promise((resolve) => setImmediate(resolve));
assert.deepEqual(sessionRequests, [["site", "source-a"], ["site", "source-b"]]);
rendered.video.props.onError();
assert.deepEqual(sessionInvalidations, [["site", "source-a"], ["site", "source-b"]]);
assert.equal(timers.size, 1, "Changing cameras after a pending retry must not disable retries for the new source");
stateUpdates = [];
rendered.video.props.onTimeUpdate({ currentTarget: { currentTime: 2, paused: true, readyState: 4, seeking: false, error: null } });
assert.equal(stateUpdates.includes("playing"), false, "Paused media must never be marked LIVE");
const buffered = { length: 1, start: () => 0, end: () => 3 };
rendered.video.props.onTimeUpdate({ currentTarget: { currentTime: 500, paused: false, readyState: 4, seeking: false, error: null, buffered } });
assert.equal(stateUpdates.includes("playing"), false, "A native clock beyond buffered media is not LIVE");
rendered.video.props.onTimeUpdate({ currentTarget: { currentTime: 2, paused: false, readyState: 4, seeking: false, error: null, buffered: { length: 0 } } });
assert.equal(stateUpdates.includes("playing"), false, "An empty media buffer cannot establish LIVE");
rendered.video.props.onTimeUpdate({ currentTarget: { currentTime: 2, paused: false, readyState: 4, seeking: false, error: null, buffered } });
assert.equal(timers.size, 0, "Recovered media must cancel the scheduled destructive reconnect");
assert.equal(stateUpdates.includes("playing"), true);
visibilityCallback([{ isIntersecting: false }]);
assert.equal(stateUpdates.at(-1), "suspended");
const invalidationsBeforeHiddenError = sessionInvalidations.length;
rendered.video.props.onError();
assert.equal(sessionInvalidations.length, invalidationsBeforeHiddenError, "Off-screen browser suspension must not invalidate the camera session");
assert.equal(timers.size, 0, "Hidden thumbnails must not enter a reconnect storm");
stateUpdates = [];
rendered.video.props.onTimeUpdate({ currentTarget: { currentTime: 3, paused: false, readyState: 4, seeking: false, error: null, buffered } });
assert.equal(stateUpdates.includes("playing"), false, "Suspended previews are not LIVE evidence");
visibilityCallback([{ isIntersecting: true }]);
assert.equal(stateUpdates.at(-1), "loading", "Visible again requires new media evidence, not a green label");
rendered.cleanup();
assert.equal(visibilityDisconnected, true);

console.log("Playback recovery/backoff, one-time claim safety, request deadlines, tenant scoping and actual player integration QA PASS (synthetic only)");
