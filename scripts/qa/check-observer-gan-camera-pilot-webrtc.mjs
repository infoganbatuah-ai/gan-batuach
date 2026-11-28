import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { connect, createServer as relay } from "node:net";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { loadTs } from "./digital-guard-test-loader.mjs";

const { openGanCameraPilotSyntheticEdge } = loadTs("lib/domain/digital-observer/gan-camera-pilot-synthetic-edge.ts");
const { startGanCameraPilotWebRtc } = loadTs("lib/domain/digital-observer/gan-camera-pilot-webrtc.ts", { fetch: globalThis.fetch });
const { createGanCameraPilotAccessResolver, createGanCameraPilotHostAuthorization } =
  loadTs("lib/domain/digital-observer/gan-camera-pilot-grant.ts", { fetch: globalThis.fetch });
const scope = { viewerId: "qa-viewer", role: "parent", gardenId: "qa-garden", siteId: "qa-site", cameraId: "qa-camera",
  protocol: "WebRTC", tenantId: "qa-tenant", sessionId: "qa-session", sourceId: "synthetic", gatewayId: "loopback", streamId: "pattern" };
const handle = "h".repeat(43);
const offer = "v=0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\na=recvonly\r\n";
const loopback = "127.0.0.1";
const service = "s".repeat(43);
const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const { viewerId, role, gardenId, siteId, cameraId, protocol, sessionId } = scope;
const binding = { viewerId, role, gardenId, siteId, cameraId, protocol };
const readPassword = "r".repeat(43);
const readAuth = `Basic ${Buffer.from(`do-pilot-reader:${readPassword}`).toString("base64")}`;

async function fixture(t, revalidateAccess = async () => true) {
  const folder = mkdtempSync(resolve(".gan-pilot-tcp-"));
  let at = 10_000;
  const edge = openGanCameraPilotSyntheticEdge({ databasePath: join(folder, "test.db"), windowId: "w".repeat(32),
    scope, deadlineMs: 310_000, now: () => at });
  let upstreamSocket;
  let requests = 0;
  const media = relay((socket) => { upstreamSocket = socket; });
  media.listen(0, loopback);
  await once(media, "listening");
  const iceTcpPort = media.address().port;
  const signaling = createServer((request, response) => {
    assert.equal(request.url, "/qa-pattern/whep");
    request.resume();
    if (request.headers.authorization !== readAuth) {
      response.writeHead(401).end();
      return;
    }
    requests++;
    response.writeHead(201).end(`v=0\r\na=candidate:udp 1 udp 1 127.0.0.1 9000 typ host\r\na=candidate:tcp 1 tcp 1 127.0.0.1 ${iceTcpPort} typ host tcptype passive\r\n`);
  });
  signaling.listen(0, loopback);
  await once(signaling, "listening");
  assert.equal(await edge.store.issue({ handle, scope, expiresAtMs: 50_000 }, "j".repeat(32)), true);
  const host = createGanCameraPilotHostAuthorization({ environment: "development", qaGardenId: scope.gardenId,
    ganPublicKey: publicKey, ganServiceBearerSha256: createHash("sha256").update(service).digest("hex"), store: edge.store,
    now: () => at, resolveScope: async () => scope });
  const gate = await startGanCameraPilotWebRtc({ environment: "development", edge, issue: host.issue, revalidateAccess,
    upstream: { httpPort: signaling.address().port, iceTcpPort, readPassword },
    authenticateService: (request) => request.headers.authorization === "Bearer synthetic-control-service",
    async authorize(request) {
      if (request.headers.authorization !== "Bearer synthetic-verified-owner") return null;
      return edge.store.consume(handle, scope, 50_000);
    } });
  t.after(async () => {
    await gate.close();
    upstreamSocket?.destroy();
    signaling.closeAllConnections();
    await Promise.all([signaling, media].map((server) => new Promise((done) => server.close(done))));
    edge.close();
    rmSync(folder, { recursive: true, force: true });
  });
  function request({ auth = true, sdp = offer, origin } = {}) {
    return fetch(gate.endpoint, { method: "POST", body: sdp,
      headers: { "Content-Type": "application/sdp", ...(auth ? { Authorization: "Bearer synthetic-verified-owner" } : {}),
        ...(origin ? { Origin: origin } : {}) } });
  }
  async function open() {
    const result = await request();
    assert.equal(result.status, 201);
    assert.equal(result.headers.get("authorization"), null);
    assert.equal(result.headers.get("location"), null);
    const answer = await result.text();
    assert.doesNotMatch(answer, /candidate:udp| 9000 /);
    const relayPort = Number(/127\.0\.0\.1 (\d+) typ host tcptype passive/.exec(answer)[1]);
    assert.notEqual(relayPort, iceTcpPort);
    const connection = once(media, "connection");
    const socket = connect(relayPort, loopback);
    socket.on("error", () => {});
    await Promise.all([once(socket, "connect"), connection]);
    return { socket, relayPort, upstream: upstreamSocket };
  }
  const direct = `http://${loopback}:${signaling.address().port}/qa-pattern/whep`;
  const revoke = (target, authorized = true) => fetch(new URL("/pilot/revoke", gate.endpoint), {
    method: "POST", headers: { "Content-Type": "application/json",
      ...(authorized ? { Authorization: "Bearer synthetic-control-service" } : {}) }, body: JSON.stringify({ handle: target })
  });
  return { edge, gate, request, open, direct, revoke, advance: (value) => { at = value; }, get requests() { return requests; } };
}

test("the private issue endpoint returns a signed-scope handle that can be revoked before opening media", async (t) => {
  const h = await fixture(t);
  const issue = (overrides = {}, requestOptions = {}) => {
    const payload = Buffer.from(JSON.stringify({ version: 1, operation: "issue", issuer: "gan_batuach",
      audience: "digital_observer:gan_camera_pilot", environment: "development", binding, sessionId,
      jti: "i".repeat(32), issuedAtMs: 10_000, expiresAtMs: 50_000, ...overrides })).toString("base64url");
    const proof = `${payload}.${sign(null, Buffer.from(payload), privateKey).toString("base64url")}`;
    return fetch(new URL("/pilot/issue", h.gate.endpoint), { method: "POST",
      headers: { Authorization: `Bearer ${service}`, "X-Gan-Pilot-Assertion": proof }, ...requestOptions });
  };
  assert.equal((await issue({}, { headers: {} })).status, 403);
  assert.equal((await issue({}, { body: "{}" })).status, 400);
  assert.equal((await issue({ binding: { ...binding, gardenId: "other-garden" } })).status, 403);
  const response = await issue();
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const receipt = await response.json();
  assert.deepEqual(receipt, { ...binding, version: 1, environment: "development", capability: "live_playback",
    recording: false, operation: "issue", handle: receipt.handle, expiresAtMs: 50_000 });
  assert.match(receipt.handle, /^[A-Za-z0-9_-]{43}$/);
  assert.equal((await issue()).status, 403);
  assert.equal((await h.revoke(receipt.handle)).status, 204);
  assert.equal(await h.edge.store.consume(receipt.handle, scope, 50_000), null);
  assert.equal(h.requests, 0);
});

test("authenticated signaling rejects external candidates, binds one receiver and disconnects on revocation", async (t) => {
  const h = await fixture(t);
  assert.equal((await h.request({ auth: false })).status, 403);
  assert.equal((await h.request({ origin: "http://foreign.invalid" })).status, 403);
  assert.equal((await fetch(h.direct, { method: "POST", body: offer, headers: { "Content-Type": "application/sdp" } })).status, 401);
  assert.equal((await h.request({ sdp: offer + "a=candidate:abc 1 udp 1 192.0.2.1 9000 typ host\r\n" })).status, 400);
  assert.equal(h.requests, 0);
  const { socket, upstream, relayPort } = await h.open();
  assert.equal((await h.request()).status, 409);
  const second = connect(relayPort, loopback);
  await once(second, "close");
  const received = once(socket, "data");
  upstream.write("encrypted-example");
  assert.equal(String((await received)[0]), "encrypted-example");
  socket.resume();
  assert.equal((await h.revoke(handle, false)).status, 403);
  assert.equal((await h.revoke("wrong")).status, 403);
  const ended = once(socket, "close");
  assert.equal((await h.revoke(handle)).status, 204);
  await ended;
  assert.equal(h.edge.reserveTransportBytes(handle, scope, 1), false);
});

test("the real TCP relay refuses a chunk over the durable 100 MiB budget", async (t) => {
  const h = await fixture(t);
  const { socket, upstream } = await h.open();
  for (let megabyte = 0; megabyte < 99; megabyte++) assert.equal(h.edge.reserveTransportBytes(handle, scope, 1048576), true);
  assert.equal(h.edge.reserveTransportBytes(handle, scope, 1048575), true);
  const received = once(socket, "data");
  upstream.write(Buffer.from([1]));
  assert.deepEqual((await received)[0], Buffer.from([1]));
  let extra = 0;
  socket.on("data", (bytes) => { extra += bytes.length; });
  const ended = once(socket, "close");
  upstream.write(Buffer.from([2]));
  await ended;
  assert.equal(extra, 0);
});

test("the absolute deadline closes a connected but idle receiver", async (t) => {
  const h = await fixture(t);
  const { socket } = await h.open();
  socket.resume();
  const ended = once(socket, "close");
  h.advance(310_000);
  await ended;
  assert.equal(h.edge.transportAllowed(handle, scope), false);
});

test("current access must be verified before the first media receiver is admitted", async (t) => {
  const h = await fixture(t, async (checked) => {
    assert.deepEqual(checked, scope);
    return false;
  });
  assert.equal((await h.request()).status, 403);
  assert.equal(h.edge.transportAllowed(handle, scope), false);
});

for (const [failure, status] of [["session or scope denied", 403], ["resolver unavailable", 503], ["resolver timeout", null]]) {
  test(`active delivery fails closed on ${failure} without a remote revoke request`, { timeout: 8_000 }, async (t) => {
    let checks = 0;
    let timedOut;
    const authorizedChecks = status === 403 ? 2 : 1;
    const resolver = createServer(async (request, response) => {
      assert.equal(request.method, "POST");
      assert.equal(request.url, "/qa/resolve");
      assert.equal(request.headers.authorization, `Bearer ${service}`);
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      assert.deepEqual(JSON.parse(Buffer.concat(chunks)), { binding, sessionId });
      response.writeHead(checks <= authorizedChecks ? 204 : status).end();
    });
    resolver.listen(0, loopback);
    await once(resolver, "listening");
    t.after(() => {
      resolver.closeAllConnections();
      return new Promise((done) => resolver.close(done));
    });
    const revalidate = createGanCameraPilotAccessResolver({
      environment: "development", endpoint: `http://${loopback}:${resolver.address().port}/qa/resolve`, bearer: service
    });
    const h = await fixture(t, async (checked, signal) => {
      assert.deepEqual(checked, scope);
      if (++checks > 1 && status === null) {
        signal.addEventListener("abort", () => { timedOut = true; }, { once: true });
        return new Promise(() => {});
      }
      return revalidate(checked, signal);
    });
    const { socket, upstream } = await h.open();
    const received = once(socket, "data");
    upstream.write("authorized data");
    assert.equal(String((await received)[0]), "authorized data");
    assert.equal(checks, 1);
    socket.resume();
    const ended = once(socket, "close");
    await ended;
    assert.equal(checks, authorizedChecks + 1);
    if (failure === "resolver timeout") assert.equal(timedOut, true);
    assert.equal(h.edge.transportAllowed(handle, scope), false);
    assert.equal(h.edge.reserveTransportBytes(handle, scope, 1), false);
  });
}
