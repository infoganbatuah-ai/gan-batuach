import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { connect, createServer as relay } from "node:net";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { loadTs } from "./digital-guard-test-loader.mjs";

const { openGanCameraPilotSyntheticEdge } = loadTs("lib/domain/digital-observer/gan-camera-pilot-synthetic-edge.ts");
const { startGanCameraPilotWebRtc } = loadTs("lib/domain/digital-observer/gan-camera-pilot-webrtc.ts", { fetch: globalThis.fetch });
const scope = { viewerId: "qa-viewer", role: "parent", gardenId: "qa-garden", siteId: "qa-site", cameraId: "qa-camera",
  protocol: "WebRTC", tenantId: "qa-tenant", sessionId: "qa-session", sourceId: "synthetic", gatewayId: "loopback", streamId: "pattern" };
const handle = "h".repeat(43);
const offer = "v=0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\na=recvonly\r\n";
const loopback = "127.0.0.1";

async function fixture(t) {
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
    requests++;
    request.resume();
    response.writeHead(201).end(`v=0\r\na=candidate:udp 1 udp 1 127.0.0.1 9000 typ host\r\na=candidate:tcp 1 tcp 1 127.0.0.1 ${iceTcpPort} typ host tcptype passive\r\n`);
  });
  signaling.listen(0, loopback);
  await once(signaling, "listening");
  assert.equal(await edge.store.issue({ handle, scope, expiresAtMs: 50_000 }, "j".repeat(32)), true);
  const gate = await startGanCameraPilotWebRtc({ environment: "development", edge,
    upstream: { httpPort: signaling.address().port, iceTcpPort },
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
  function request({ auth = true, sdp = offer } = {}) {
    return fetch(gate.endpoint, { method: "POST", body: sdp,
      headers: { "Content-Type": "application/sdp", ...(auth ? { Authorization: "Bearer synthetic-verified-owner" } : {}) } });
  }
  async function open() {
    const result = await request();
    assert.equal(result.status, 201);
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
  return { edge, gate, request, open, advance: (value) => { at = value; }, get requests() { return requests; } };
}

test("authenticated signaling rejects external candidates, binds one receiver and disconnects on revocation", async (t) => {
  const h = await fixture(t);
  assert.equal((await h.request({ auth: false })).status, 403);
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
  const ended = once(socket, "close");
  await h.gate.revoke();
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
