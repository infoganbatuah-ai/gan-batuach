import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { createMediaBroker } from "../../services/video-relay/broker.mjs";
import { createRemoteRelay } from "../../services/video-gateway/remote-relay.mjs";
import { MEDIA_MAX_BYTES, RELAY_ORIGIN, SESSION_TTL_MS, sanitizePlaylist } from "../../services/video-gateway/relay-protocol.mjs";
import { issueGatewayRelayAccess, verifyGatewayRelayAccess } from "../../lib/domain/gateway-relay-auth.ts";
import { issueGatewayDeviceAccessToken, verifyGatewayDeviceAccessToken, issueGatewayPlaybackGrant, verifyGatewayPlaybackGrant } from "../../lib/domain/gateway-device-enrollment.ts";

const secret = randomBytes(32).toString("hex");
const claims = { device_id: "test-device", gateway_id: "test-gateway", observer_site_id: "test-site" };
const transport = issueGatewayRelayAccess(claims, secret);
assert.equal(verifyGatewayRelayAccess(transport.token, secret)?.scope, "relay_transport");
assert.equal(verifyGatewayDeviceAccessToken(transport.token, secret), null, "Relay credentials cannot authenticate cloud discovery");
assert.equal(verifyGatewayRelayAccess(issueGatewayDeviceAccessToken(claims, secret), secret), null);
assert.equal(verifyGatewayRelayAccess(`${transport.token}x`, secret), null);
assert.equal(verifyGatewayRelayAccess(transport.token, "wrong"), null);
const tokenParts = transport.token.split(".");
const forged = JSON.parse(Buffer.from(tokenParts[0], "base64url").toString());
forged.observer_site_id = "other-site";
assert.equal(verifyGatewayRelayAccess(`${Buffer.from(JSON.stringify(forged)).toString("base64url")}.${tokenParts[1]}`, secret), null);

// Execute the cloud route with a tenant-aware DB fixture, without production
// credentials, a real database or a device enrollment side effect.
const routeSource = readFileSync(new URL("../../app/api/video-gateway/relay-access/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(routeSource, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const routeExports = {};
let revoked = false;
let sourceGateway = claims.gateway_id;
const queries = [];
const environment = { VIDEO_GATEWAY_REMOTE_RELAY_ENABLED: "true", VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET: secret };
runInNewContext(compiled, { exports: routeExports, Buffer, process: { env: environment }, require: (name) => {
  if (name === "zod") return { z };
  if (name.endsWith("/api")) return { ok: (data) => Response.json({ data }), fail: (error, status) => Response.json({ error }, { status }), handleRouteError: () => Response.json({ error: "invalid_request" }, { status: 400 }) };
  if (name.endsWith("gateway-device-enrollment")) return { verifyGatewayDeviceAccessToken, verifyGatewayPlaybackGrant };
  if (name.endsWith("gateway-relay-auth")) return { gatewayRelayOrigin: RELAY_ORIGIN, issueGatewayRelayAccess, verifyGatewayRelayAccess };
  if (name.endsWith("camera-live-status")) return { digitalObserverCameraIsConnected: (source) => source.status === "connected" };
  if (name.endsWith("supabase/admin")) return { createAdminClient: () => ({ from: (table) => {
    const query = { table, filters: [] }; queries.push(query);
    const chain = { select: () => chain, eq: (field, value) => { query.filters.push([field, value]); return chain; }, limit: () => chain,
      maybeSingle: async () => ({ error: null, data: table === "video_gateway_device_enrollments" ? (revoked ? null : { id: claims.device_id }) : { id: "source", status: "connected", metadata: { gateway_id: sourceGateway, gateway_stream_id: "stream" } } }) };
    return chain;
  } }) };
  throw new Error(`Unexpected import ${name}`);
} });
const cloudRequest = (body, token = "") => new Request("https://example.invalid/api", { method: "POST", headers: { "x-video-gateway-device-token": token }, body: JSON.stringify(body) });
const deviceToken = issueGatewayDeviceAccessToken(claims, secret);
let cloudResult = await routeExports.POST(cloudRequest({ action: "lease" }, deviceToken));
assert.equal(cloudResult.status, 200);
assert.deepEqual(queries[0].filters, [["gateway_id", claims.gateway_id], ["observer_site_id", claims.observer_site_id], ["status", "delivered"], ["id", claims.device_id]]);
const leaseBody = (await cloudResult.json()).data;
assert.equal(leaseBody.relay_origin, RELAY_ORIGIN);
assert.equal(verifyGatewayDeviceAccessToken(leaseBody.token, secret), null);
assert.equal((await routeExports.POST(cloudRequest({ action: "lease" }, leaseBody.token))).status, 401);
revoked = true;
assert.equal((await routeExports.POST(cloudRequest({ action: "inspect", kind: "transport", token: leaseBody.token }))).status, 401);
revoked = false;
const viewerGrant = issueGatewayPlaybackGrant({ gateway_id: claims.gateway_id, observer_site_id: claims.observer_site_id, camera_source_id: "source", gateway_stream_id: "stream" }, secret);
assert.equal((await routeExports.POST(cloudRequest({ action: "inspect", kind: "viewer", token: viewerGrant }))).status, 200);
sourceGateway = "another-gateway";
assert.equal((await routeExports.POST(cloudRequest({ action: "inspect", kind: "viewer", token: viewerGrant }))).status, 403);
assert.ok(queries.filter((q) => q.table === "digital_observer_camera_sources").every((q) => q.filters.some(([key, value]) => key === "observer_site_id" && value === claims.observer_site_id)));
environment.VIDEO_GATEWAY_REMOTE_RELAY_ENABLED = "false";
assert.equal((await routeExports.POST(cloudRequest({ action: "lease" }, deviceToken))).status, 503);
environment.VIDEO_GATEWAY_REMOTE_RELAY_ENABLED = "true";
assert.equal((await routeExports.POST(cloudRequest({ action: "lease", huge: "x".repeat(5000) }, deviceToken))).status, 413);

const playlist = "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:1\n#EXT-X-MEDIA-SEQUENCE:0\n#EXTINF:1.000,\nsegment-000001.ts\n";
assert.match(sanitizePlaylist(playlist, "view-token"), /segment-000001.ts\?token=view-token/);
for (const unsafe of ["http://private-device/stream", "../config", "#EXT-X-KEY:METHOD=AES-128,URI=\"https://unexpected/key\"", "#EXT-X-MAP:URI=\"file:///etc/passwd\"", "#private hostname"]) {
  assert.throws(() => sanitizePlaylist(`#EXTM3U\n${unsafe}\n`, "test"));
}

let clock = Date.now();
const idA = { gateway_id: "gateway-a", observer_site_id: "site-a", expires_at: clock + 120_000 };
const idB = { gateway_id: "gateway-b", observer_site_id: "site-b", expires_at: clock + 120_000 };
const used = new Set();
let bytesRead = 0;
let actualReads = [];
const broker = createMediaBroker({ now: () => clock, pollMs: 30, taskMs: 1000, maxGateways: 4, authorize: async (kind, token) => {
  if (kind === "transport") return token === "transport-a" ? idA : token === "transport-b" ? idB : null;
  if (kind === "viewer") return token.startsWith("grant-a-") ? idA : token.startsWith("grant-b-") ? idB : null;
  return null;
} });
const request = (path, body, headers = {}, method = "POST") => new Request(`${RELAY_ORIGIN}${path}`, {
  method, headers: { "content-type": "application/json", ...headers }, ...(method === "GET" ? {} : { body: JSON.stringify(body || {}) })
});
const agent = createRemoteRelay({
  enabled: true, now: () => clock,
  lease: async () => ({ token: "transport-a", relay_origin: RELAY_ORIGIN, expires_at: clock + 120_000 }),
  claimGrant: async (grant) => {
    if (used.has(grant)) throw new Error("replay");
    used.add(grant);
    return grant.endsWith("offline") ? "offline-source" : "online-source";
  },
  readAsset: async (stream, asset) => {
    actualReads.push({ stream, asset });
    if (stream === "offline-source") throw new Error("private-dvr-error-must-not-leak");
    const bytes = Buffer.from(asset === "index.m3u8" ? playlist : [0x47, 0, 0, 1]);
    bytesRead += bytes.length;
    return bytes;
  },
  fetcher: async (url, init) => broker.handle(new Request(url, init))
});

async function withPoll(operation) {
  const polling = agent.pollOnce();
  await new Promise((resolve) => setImmediate(resolve));
  const result = await operation();
  await polling;
  return result;
}

try {
  const denied = await broker.handle(request("/gateway/poll", {}, { authorization: "Bearer wrong" }));
  assert.equal(denied.status, 401);
  const offline = await broker.handle(request("/playback/claim", { grant: "grant-b-offline" }));
  assert.equal(offline.status, 503, "No Gateway presence must not report ready");
  const unknownOrigin = await broker.handle(request("/playback/claim", { grant: "grant-a-origin" }, { origin: "https://unknown.invalid" }));
  assert.equal(unknownOrigin.status, 403);
  const claimResponse = await withPoll(() => broker.handle(request("/playback/claim", { grant: "grant-a-first" })));
  assert.equal(claimResponse.status, 200);
  const session = await claimResponse.json();
  const hls = new URL(session.playback.hls_url);
  assert.equal(hls.origin, RELAY_ORIGIN);
  assert.equal(hls.href.includes("online-source"), false, "Never expose local stream identity");
  const replay = await broker.handle(request("/playback/claim", { grant: "grant-a-first" }));
  assert.equal(replay.status, 409);
  const media = await withPoll(() => broker.handle(new Request(hls)));
  assert.equal(media.status, 200);
  const contents = await media.text();
  assert.match(contents, /segment-000001.ts\?token=/);
  const segment = new URL(contents.split("\n").find((line) => line.startsWith("segment")), hls);
  const segmentResponse = await withPoll(() => broker.handle(new Request(segment)));
  assert.equal(segmentResponse.status, 200);
  assert.equal((await segmentResponse.arrayBuffer()).byteLength, 4);
  const badToken = new URL(hls); badToken.searchParams.set("token", "x".repeat(43));
  assert.equal((await broker.handle(new Request(badToken))).status, 401);
  const injected = new URL(hls); injected.pathname = injected.pathname.replace("index.m3u8", "config.json");
  assert.equal((await broker.handle(new Request(injected))).status, 404);
  const crossTenant = await broker.handle(request("/gateway/result", { id: "x".repeat(43), ok: true }, { authorization: "Bearer transport-b" }));
  assert.equal(crossTenant.status, 409, "Another Gateway cannot complete another tenant task");

  const failedClaim = await withPoll(() => broker.handle(request("/playback/claim", { grant: "grant-a-offline" })));
  const failedHls = new URL((await failedClaim.json()).playback.hls_url);
  const failedMedia = await withPoll(() => broker.handle(new Request(failedHls)));
  assert.equal(failedMedia.status, 503);
  assert.equal((await failedMedia.text()).includes("private-dvr-error"), false);
  const stillHealthy = await withPoll(() => broker.handle(new Request(hls)));
  assert.equal(stillHealthy.status, 200, "Offline source must not break an existing active source");
  assert.ok(bytesRead > 0);
  assert.ok(actualReads.every((item) => ["index.m3u8", "segment-000001.ts"].includes(item.asset)));

  const oversized = await broker.handle(request("/gateway/result", { id: "x", base64: "A".repeat(Math.ceil(MEDIA_MAX_BYTES * 4 / 3) + 5000) }, { authorization: "Bearer transport-a" }));
  assert.equal(oversized.status, 413);
  clock += SESSION_TTL_MS + 1;
  assert.equal((await broker.handle(new Request(hls))).status, 401, "Expired sessions must stop media immediately");
  const stoppedReads = bytesRead;
  assert.equal(bytesRead, stoppedReads);
} finally { agent.stop(); broker.close(); }

let outbound = 0;
const disabled = createRemoteRelay({ lease: async () => { outbound++; }, fetcher: async () => { outbound++; } });
await disabled.start(); await disabled.pollOnce();
assert.equal(outbound, 0, "Import/default settings must never start external traffic");
const unexpectedDestination = createRemoteRelay({ enabled: true, lease: async () => ({ token: "test", expires_at: Date.now() + 120000, relay_origin: "https://unexpected.invalid" }), fetcher: async () => { outbound++; } });
assert.equal(await unexpectedDestination.pollOnce(), false);
assert.equal(outbound, 0, "Never send a token to an unapproved destination");
unexpectedDestination.stop(); disabled.stop();
console.log("Secure media Relay QA PASS: local fixture only; tenant isolation, grants, TTL, bounded media, offline isolation, disabled default");
