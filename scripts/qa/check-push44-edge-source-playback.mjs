import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";
import * as health from "../../lib/domain/digital-observer/camera-live-status.ts";
import * as origin from "../../lib/domain/digital-observer/edge-playback-origin.ts";
import * as tokens from "../../lib/domain/gateway-device-enrollment.ts";
import { playbackIngressAllows } from "../../services/video-gateway/playback-ingress.mjs";

const site = "10000000-0000-4000-8000-000000000001";
const otherSite = "10000000-0000-4000-8000-000000000002";
const secret = "isolated-synthetic-gateway-key-never-used-by-a-service";
const fixtureProfiles = [
  { name: "CH1 fixture", profile: "PHYSICAL_GATEWAY", camera: "20000000-0000-4000-8000-000000000001",
    gateway: "30000000-0000-4000-8000-000000000001", device: "40000000-0000-4000-8000-000000000001",
    stream: "fixture-ch1", origin: "https://recorder.fixture.invalid", port: 18082 },
  { name: "Tapo fixture", profile: "SOFTWARE_CONNECTOR", camera: "20000000-0000-4000-8000-000000000002",
    gateway: "30000000-0000-4000-8000-000000000002", device: "40000000-0000-4000-8000-000000000002",
    stream: "fixture-tapo", origin: "https://connector.fixture.invalid", port: 18083 },
];
const now = Date.now();
const minutesAgo = (age) => new Date(now - age * 60_000).toISOString();
const root = new URL("../../", import.meta.url);

function compile(path) {
  const url = new URL(path, root);
  const { outputText } = ts.transpileModule(readFileSync(url, "utf8"), {
    fileName: url.pathname,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  });
  return new vm.Script(outputText, { filename: url.pathname });
}

function load(script, dependencies, env = {}, globals = {}) {
  const exports = {};
  script.runInNewContext({ ...globals, exports, URL, Date, process: { env }, require(name) {
    assert.ok(Object.hasOwn(dependencies, name), `unapproved fixture import: ${name}`);
    return dependencies[name];
  } }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  return exports;
}

const issueModule = compile("app/api/digital-observer/dvr-gateway/route.ts");
const redeemModule = compile("app/api/video-gateway/playback-grant/route.ts");
const bindingModule = load(compile("lib/domain/digital-observer/edge-playback-source.ts"), {
  "@/lib/domain/digital-observer/camera-live-status": health,
});

function fixture({ delivery = "remote", signedIn = true } = {}) {
  const sources = fixtureProfiles.map((edge) => ({
    id: edge.camera, observer_site_id: site, source_mode: "gateway_test",
    status: "connected", health_status: "healthy", last_seen_at: minutesAgo(1), last_health_check_at: minutesAgo(1),
    metadata: { gateway_id: edge.gateway, gateway_stream_id: edge.stream,
      canonical_stream_reference: edge.stream, connector_device_type: edge.profile, connector_local_port: edge.port },
  }));
  const enrollments = fixtureProfiles.map((edge) => ({
    id: edge.device, observer_site_id: site, gateway_id: edge.gateway, status: "delivered",
    lifecycle_state: "ACTIVE", deployment_profile: edge.profile, credential_version: 1,
  }));
  const audit = new Map();
  const calls = { enrollments: 0, sources: 0 };
  function table(name) {
    let rows;
    switch (name) {
      case "digital_observer_camera_sources": rows = sources; calls.sources += 1; break;
      case "video_gateway_device_enrollments": rows = enrollments; calls.enrollments += 1; break;
      case "provider_webhook_events":
        return { async insert(row) {
          if (audit.has(row.idempotency_key)) return { error: { code: "23505" } };
          audit.set(row.idempotency_key, row);
          return { error: null };
        } };
      default: throw Error(`unexpected fixture table: ${name}`);
    }
    const filters = new Map();
    const finish = async () => {
      const matches = rows.filter((row) => [...filters].every(([key, value]) => row[key] === value));
      assert.ok(matches.length <= 1);
      return { data: matches[0] ?? null, error: null };
    };
    return { select() { return this; }, eq(key, value) { filters.set(key, value); return this; },
      single: finish, maybeSingle: finish };
  }
  const client = { from: table };
  const api = {
    fail: (_error, status) => new Response(null, { status }),
    ok: (data) => Response.json({ data }),
    handleRouteError: (error) => { throw error; },
  };
  const env = {
    NODE_ENV: delivery === "local" ? "development" : "production",
    VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET: secret,
    OBSERVER_PLAYBACK_EDGE_ORIGINS_JSON: delivery === "remote"
      ? JSON.stringify(Object.fromEntries(fixtureProfiles.map((edge) => [edge.gateway, edge.origin]))) : "{}",
  };
  const modules = {
    zod: { z },
    "@/lib/api": api,
    "@/lib/domain/gateway-device-enrollment": tokens,
    "@/lib/domain/digital-observer/camera-live-status": health,
    "@/lib/domain/digital-observer/edge-playback-source": bindingModule,
    "@/lib/supabase/admin": { createAdminClient: () => client },
  };
  const issue = load(issueModule, {
    ...modules,
    "@/lib/domain/digital-observer/edge-playback-origin": origin,
    "@/lib/domain/digital-observer/access": {
      getDigitalObserverApiUser: async () => signedIn ? { profile: { id: "fixture-owner" }, supabase: client } : null,
      getObserverSiteAccess: async (_client, _profile, requested) => requested === site ? { id: site } : null,
    },
    "@/lib/domain/digital-observer/dvr-gateway": {
      createDvrPlaybackSession: () => assert.fail("channel-only route must not run"),
    },
  }, env);
  const redeem = load(redeemModule, modules, env);
  const issueFor = (edge, siteId = site) => issue.POST(new Request(
    `${delivery === "local" ? "http://127.0.0.1:3100" : "https://app.fixture.invalid"}/api/digital-observer/dvr-gateway`,
    { method: "POST", body: JSON.stringify({ observer_site_id: siteId, camera_source_id: edge.camera }) },
  ));
  const redeemAt = (edge, grant) => redeem.POST(new Request(
    "https://app.fixture.invalid/api/video-gateway/playback-grant", {
      method: "POST",
      headers: { "x-video-gateway-device-token": tokens.issueManagedDeviceSessionToken({
        device_id: edge.device, gateway_id: edge.gateway, observer_site_id: site,
        deployment_profile: edge.profile, credential_version: 1, operations: ["PLAYBACK_GRANT"],
      }, secret) },
      body: JSON.stringify({ grant }),
    },
  ));
  return { sources, enrollments, audit, calls, issueFor, redeemAt };
}

for (const [index, edge] of fixtureProfiles.entries()) {
  test(`${edge.name}: exact signed issue and redemption, other component and replay denied`, async () => {
    const h = fixture();
    const issued = await h.issueFor(edge);
    assert.equal(issued.status, 200);
    const { data: { playback } } = await issued.json();
    assert.equal(playback.claim_url, `${edge.origin}/playback/claim`);
    assert.equal(playback.allowed_origin, edge.origin);
    const grant = tokens.verifyGatewayPlaybackGrant(playback.grant, secret);
    assert.equal(grant.gateway_id, edge.gateway);
    assert.equal(grant.observer_site_id, site);
    assert.equal(grant.camera_source_id, edge.camera);
    assert.equal(grant.gateway_stream_id, edge.stream);
    assert.ok(playbackIngressAllows("POST", new URL(playback.claim_url).pathname));
    assert.equal((await h.redeemAt(fixtureProfiles[1 - index], playback.grant)).status, 403);
    const accepted = await h.redeemAt(edge, playback.grant);
    assert.equal(accepted.status, 200);
    assert.equal((await accepted.json()).data.gateway_stream_id, edge.stream);
    assert.equal(h.audit.size, 1);
    assert.equal((await h.redeemAt(edge, playback.grant)).status, 409);
    assert.equal(h.audit.size, 1);
  });

  test(`${edge.name}: stale report with connected flags does not authorize issuance`, async () => {
    const h = fixture();
    h.sources[index].last_seen_at = minutesAgo(120);
    h.sources[index].last_health_check_at = minutesAgo(120);
    assert.equal((await h.issueFor(edge)).status, 409);
    assert.equal(h.calls.enrollments, 0);
  });

  test(`${edge.name}: loss of freshness between issue and claim does not consume a grant`, async () => {
    const h = fixture();
    const { data: { playback } } = await (await h.issueFor(edge)).json();
    h.sources[index].last_seen_at = minutesAgo(61);
    h.sources[index].last_health_check_at = minutesAgo(61);
    assert.equal((await h.redeemAt(edge, playback.grant)).status, 403);
    assert.equal(h.audit.size, 0);
  });

  test(`${edge.name}: component binding changed between issue and claim is rejected`, async () => {
    const h = fixture();
    const { data: { playback } } = await (await h.issueFor(edge)).json();
    h.sources[index].metadata.connector_device_type = fixtureProfiles[1 - index].profile;
    assert.equal((await h.redeemAt(edge, playback.grant)).status, 403);
    assert.equal(h.audit.size, 0);
  });
}

test("normal local Development handoff uses the separate established loopbacks", async () => {
  const h = fixture({ delivery: "local" });
  for (const edge of fixtureProfiles) {
    const response = await h.issueFor(edge);
    assert.equal(response.status, 200);
    const { data: { playback } } = await response.json();
    assert.equal(playback.claim_url, `http://127.0.0.1:${edge.port}/playback/claim`);
  }
});

test("missing remote mapping cannot fall back to an unapproved edge", async () => {
  const h = fixture({ delivery: "unmapped" });
  for (const edge of fixtureProfiles) {
    assert.equal((await h.issueFor(edge)).status, 503);
  }
  assert.equal(h.audit.size, 0);
});

test("authentication, Site scope, mode, assignment and ambiguous source mapping fail closed", async () => {
  const [edge] = fixtureProfiles;
  const anonymous = fixture({ signedIn: false });
  assert.equal((await anonymous.issueFor(edge)).status, 401);
  assert.equal(anonymous.calls.sources, 0);
  const h = fixture();
  assert.equal((await h.issueFor(edge, otherSite)).status, 403);
  assert.equal(h.calls.sources, 0);
  h.sources[0].source_mode = "readiness";
  assert.equal((await h.issueFor(edge)).status, 404);
  h.sources[0].source_mode = "live";
  h.sources[0].metadata.channel_assignment = "CHANNEL_EMPTY";
  assert.equal((await h.issueFor(edge)).status, 409);
  h.sources[0].metadata.channel_assignment = "ASSIGNED";
  h.sources[0].metadata.canonical_stream_reference = "foreign-stream-reference";
  assert.equal((await h.issueFor(edge)).status, 409);
  assert.equal(h.calls.enrollments, 0);
});

const playerModule = compile("components/digital-observer/observer-live-player.tsx");
const mobileModule = compile("lib/domain/digital-observer/mobile-playback-lifecycle.ts");

// The actual player attaches the fixture URL. There is no browser, codec, socket
// or physical source behind these synthetic fetch and media implementations.
function playerFixture(t, edge, nativeHls) {
  const h = fixture();
  const listeners = new EventTarget();
  const mobile = load(mobileModule, {}, {}, { window: listeners });
  const mobileSession = nativeHls ? mobile.openMobilePlaybackPublisher() : null;
  const calls = [];
  const states = [];
  const jsx = (type, props) => ({ type, props });
  const claimPath = "/playback/claim";
  const signedMedia = "a".repeat(32);
  const playlist = `${edge.origin}/hls/${edge.stream}/index.m3u8?token=${signedMedia}`;
  const segment = `/hls/${edge.stream}/segment-1.ts`;
  const segmentQuery = `?generation=10000000-0000-4000-8000-000000000001&revision=1&token=${signedMedia}`;
  const { promise: played, resolve: recordPlay, reject: failPlay } = Promise.withResolvers();
  let refCount = 0;
  let cleanup;
  const video = {
    canPlayType: () => nativeHls ? "maybe" : "",
    currentSource: null,
    set src(value) { this.currentSource = value; },
    play() { recordPlay(this.currentSource); return Promise.resolve(); },
    pause() {}, load() {}, removeAttribute() { this.currentSource = null; },
  };
  class FixtureHls {
    static Events = { MEDIA_ATTACHED: "attached", MANIFEST_PARSED: "parsed", ERROR: "error" };
    static isSupported() { return !nativeHls; }
    events = new Map();
    on(name, callback) { this.events.set(name, callback); }
    attachMedia(element) { assert.equal(element, video); this.events.get("attached")(); }
    loadSource(url) { video.src = url; this.events.get("parsed")(); }
    destroy() { this.events.clear(); }
  }
  const modules = {
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    react: {
      useState(initial) { const index = states.push(initial) - 1; return [initial, (value) => { states[index] = value; }]; },
      useRef(initial) { return { current: refCount++ === 0 ? video : initial }; },
      useEffect(effect) { cleanup = effect(); },
    },
    "hls.js": { __esModule: true, default: FixtureHls },
    "lucide-react": {},
    "@/lib/domain/digital-observer/mobile-playback-lifecycle": mobile,
  };
  const player = load(playerModule, modules, {}, {
    window: listeners,
    setInterval: () => 1, clearInterval() {}, clearTimeout() {},
    setTimeout: () => { failPlay(Error("unexpected playback retry")); return 1; },
    async fetch(url, init) {
      try {
        calls.push(url);
        if (url === "/api/digital-observer/dvr-gateway") {
          const payload = JSON.parse(init.body);
          assert.equal(payload.camera_source_id, edge.camera);
          assert.equal(payload.observer_site_id, site);
          return await h.issueFor(edge);
        }
        assert.equal(url, edge.origin + claimPath);
        assert.equal(init.redirect, "error");
        const { grant } = JSON.parse(init.body);
        const redemption = await h.redeemAt(edge, grant);
        assert.equal(redemption.status, 200);
        assert.equal((await redemption.json()).data.gateway_stream_id, edge.stream);
        const resource = new URL(playlist);
        assert.ok(playbackIngressAllows("GET", resource.pathname, resource.search));
        assert.ok(playbackIngressAllows("GET", segment, segmentQuery));
        return Response.json({ playback: { hls_url: playlist } });
      } catch (error) {
        failPlay(error);
        throw error;
      }
    },
  });
  t.after(() => { cleanup?.(); mobileSession?.close(); });
  if (mobileSession) {
    mobileSession.appInactive(false);
    mobileSession.networkOffline(false);
  }
  player.ObserverLivePlayer({ observerSiteId: site, cameraSourceId: edge.camera, name: edge.name, compact: true });
  return { played, playlist, states, calls, video, mobileSession };
}

for (const edge of fixtureProfiles) {
  for (const nativeHls of [false, true]) {
    test(`${edge.name}: actual ${nativeHls ? "native-HLS WebView" : "Web hls.js"} player takes the scoped claim to media attachment`,
      { timeout: 2000 }, async (t) => {
        const f = playerFixture(t, edge, nativeHls);
        assert.equal(await f.played, f.playlist);
        assert.deepEqual(f.calls, ["/api/digital-observer/dvr-gateway", edge.origin + "/playback/claim"]);
        assert.equal(f.states[0], "loading", "attaching a fixture URL is not moving-frame proof");
        if (f.mobileSession) {
          f.mobileSession.networkOffline(true);
          assert.equal(f.video.currentSource, null);
        }
      });
  }
}
