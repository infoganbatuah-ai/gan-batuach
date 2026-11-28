import "server-only";
import { createServer, type IncomingMessage } from "node:http";
import { connect, createServer as createRelay, type Socket } from "node:net";
import type { AddressInfo } from "node:net";
import type { createGanCameraPilotHostAuthorization, GanCameraPilotScope } from "./gan-camera-pilot-grant";
import type { openGanCameraPilotSyntheticEdge } from "./gan-camera-pilot-synthetic-edge";

const loopback = "127.0.0.1";
const offerPath = "/pilot/whep";
const revokePath = "/pilot/revoke";
const issuePath = "/pilot/issue";
const sdpBytes = 16 * 1024;
const maxChunkBytes = 64 * 1024;
const revalidationIntervalMs = 2_000;
const revalidationTimeoutMs = 750;
const maxRevalidationCalls = 150;
type Lease = { handle: string; scope: GanCameraPilotScope };

function chooseRelayCandidate(answer: string, upstreamPort: number, relayPort: number) {
  const candidate = /^a=candidate:\S+ 1 tcp \d+ 127\.0\.0\.1 (\d+) typ host tcptype passive(?: .*)?$/i;
  let replaced = false;
  const lines = answer.split(/\r?\n/).filter((line) => !line.startsWith("a=remote-candidates:")).flatMap((line) => {
    if (!line.startsWith("a=candidate:")) return [line];
    const match = candidate.exec(line);
    if (!match || Number(match[1]) !== upstreamPort) return [];
    replaced = true;
    return [line.replace(` 127.0.0.1 ${upstreamPort} `, ` 127.0.0.1 ${relayPort} `)];
  });
  return replaced ? lines.join("\r\n") : null;
}

async function readBody(request: IncomingMessage, maxBytes: number) {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > maxBytes) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readOffer(request: IncomingMessage) {
  const offer = await readBody(request, sdpBytes);
  // The test receiver is non-trickle. Keep the upstream from dialing any
  // browser-supplied candidate or negotiating an extra track or data channel.
  if (!offer?.startsWith("v=0") || /^a=(?:candidate|remote-candidates):/m.test(offer) ||
      !/^a=recvonly\r?$/m.test(offer) || !/^m=video /m.test(offer) || (offer.match(/^m=/gm) ?? []).length !== 1) return null;
  return offer;
}

type Options = {
  environment: string;
  upstream: { httpPort: number; iceTcpPort: number; readPassword: string };
  edge: Pick<ReturnType<typeof openGanCameraPilotSyntheticEdge>, "transportAllowed" | "reserveTransportBytes" | "revokeKnownHandle" | "store">;
  // The caller must authenticate the QA session and redeem a signed Gan grant
  // for the exact bound scope via the same edge store. It must not trust headers
  // for viewer/role/site. The resulting lease is never sent to the browser.
  authorize: (request: IncomingMessage) => Promise<Lease | null>;
  // The private Gan resolver checks the current session and exact scope,
  // including the current role and garden/camera access, on every call.
  revalidateAccess: (scope: GanCameraPilotScope, signal: AbortSignal) => Promise<boolean>;
  issue: ReturnType<typeof createGanCameraPilotHostAuthorization>["issue"];
  authenticateService: (request: IncomingMessage) => boolean;
};

/** Single-host synthetic fixture. Do not mount in the product or expose the upstream. */
export async function startGanCameraPilotWebRtc({ environment, upstream, edge, authorize, revalidateAccess, issue, authenticateService }: Options) {
  if (environment !== "development" || typeof revalidateAccess !== "function" || ![upstream.httpPort, upstream.iceTcpPort].every(
    (port) => Number.isInteger(port) && port > 0 && port <= 65535) ||
    !/^[A-Za-z0-9_-]{43,128}$/.test(upstream.readPassword)) throw Error("INVALID_SYNTHETIC_WEBRTC_TARGET");
  let lease: Lease | null = null;
  let admitting = false;
  let admitted = false;
  let stopped = false;
  let mediaUsed = false;
  let viewer: Socket | null = null;
  let source: Socket | null = null;
  let pendingCheck: AbortController | null = null;
  let nextCheckAt = 0;
  let validUntil = 0;
  let revalidationCalls = 0;
  let revocation: Promise<void> | undefined;
  const durableAllowed = () => !stopped && lease !== null && edge.transportAllowed(lease.handle, lease.scope);
  const accessFresh = () => !stopped && performance.now() < validUntil;
  const allowed = () => accessFresh() && durableAllowed();
  const disconnect = () => { viewer?.destroy(); source?.destroy(); };
  function revoke() {
    if (revocation) return revocation;
    stopped = true;
    pendingCheck?.abort();
    disconnect();
    revocation = (lease ? edge.store.revoke(lease.handle) : Promise.resolve()).catch((error: unknown) => {
      revocation = undefined;
      throw error;
    });
    return revocation;
  }
  async function checkAccess(scope: GanCameraPilotScope) {
    if (revalidationCalls >= maxRevalidationCalls) return false;
    revalidationCalls++;
    const started = performance.now();
    const expiresAt = Math.min(started + revalidationTimeoutMs, validUntil || Infinity);
    const controller = new AbortController();
    pendingCheck = controller;
    const timeout = setTimeout(() => controller.abort(), expiresAt - started);
    const canceled = new Promise<boolean>((resolve) => controller.signal.addEventListener("abort", () => resolve(false), { once: true }));
    try {
      const result = await Promise.race([revalidateAccess(scope, controller.signal), canceled]);
      if (result !== true || stopped || controller.signal.aborted || performance.now() >= expiresAt) return false;
      nextCheckAt = started + revalidationIntervalMs;
      validUntil = nextCheckAt + revalidationTimeoutMs;
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
      pendingCheck = null;
    }
  }
  const relay = createRelay({ pauseOnConnect: true }, (socket) => {
    if (!admitted || mediaUsed || !allowed() || socket.remoteAddress !== loopback) { socket.destroy(); return; }
    mediaUsed = true;
    viewer = socket;
    const input = connect({ host: loopback, port: upstream.iceTcpPort });
    source = input;
    for (const connection of [socket, input]) {
      connection.once("error", disconnect);
      connection.once("close", disconnect);
    }
    socket.pipe(input);
    input.on("data", (chunk: Buffer) => {
      if (!lease || !accessFresh() || chunk.length > maxChunkBytes || !edge.reserveTransportBytes(lease.handle, lease.scope, chunk.length)) {
        disconnect();
        return;
      }
      if (!socket.write(chunk)) {
        input.pause();
        socket.once("drain", () => { if (allowed()) input.resume(); else disconnect(); });
      }
    });
  });
  await new Promise<void>((resolve, reject) => { relay.once("error", reject); relay.listen(0, loopback, resolve); });
  const relayPort = (relay.address() as AddressInfo).port;
  const upstreamAuthorization = `Basic ${Buffer.from(`do-pilot-reader:${upstream.readPassword}`).toString("base64")}`;
  const control = createServer({ requestTimeout: 3000, headersTimeout: 3000 }, async (request, response) => {
    response.setHeader("Cache-Control", "private, no-store");
    const host = `${loopback}:${(control.address() as AddressInfo).port}`;
    if (request.headers.host !== host || (request.headers.origin !== undefined && request.headers.origin !== `http://${host}`)) {
      response.writeHead(403).end(); return;
    }
    if (request.url === issuePath && request.method === "POST") {
      // The signed assertion is the entire issue request. There is no JSON or
      // SDP body in which a caller can offer different identifiers.
      if ((request.headers["content-length"] ?? "0") !== "0" || request.headers["transfer-encoding"]) {
        response.writeHead(400).end(); return;
      }
      try {
        const receipt = !stopped && await issue(request);
        if (!receipt || stopped) { response.writeHead(403).end(); return; }
        response.writeHead(201, { "Content-Type": "application/json" }).end(JSON.stringify(receipt));
      } catch { response.writeHead(503).end(); }
      return;
    }
    if (request.url === revokePath && request.method === "POST") {
      try {
        if (!authenticateService(request)) { response.writeHead(403).end(); return; }
        if (request.headers["content-type"] !== "application/json") { response.writeHead(415).end(); return; }
        const raw = await readBody(request, 256);
        const body: unknown = raw && JSON.parse(raw);
        if (!body || typeof body !== "object" || Object.keys(body).length !== 1 || !("handle" in body) ||
            typeof body.handle !== "string") { response.writeHead(400).end(); return; }
        if (lease?.handle === body.handle) await revoke();
        else if (!edge.revokeKnownHandle(body.handle)) { response.writeHead(403).end(); return; }
        response.writeHead(204).end();
      } catch (error) {
        response.writeHead(error instanceof SyntaxError ? 400 : 503).end();
      }
      return;
    }
    if (request.url !== offerPath) {
      response.writeHead(404).end(); return;
    }
    if (request.method !== "POST") {
      response.writeHead(405, { Allow: "POST", "Content-Type": "text/plain; charset=utf-8" })
        .end("Synthetic WebRTC signaling requires POST.");
      return;
    }
    if (request.headers["content-type"] !== "application/sdp") { response.writeHead(415).end(); return; }
    if (stopped || admitting || admitted) { response.writeHead(409).end(); return; }
    admitting = true;
    try {
      const offer = await readOffer(request);
      if (!offer) { response.writeHead(400).end(); return; }
      lease = await authorize(request);
      if (!lease || !durableAllowed()) { response.writeHead(403).end(); return; }
      const answer = await fetch(`http://${loopback}:${upstream.httpPort}/qa-pattern/whep`, {
        method: "POST", body: offer, headers: { "Content-Type": "application/sdp", Authorization: upstreamAuthorization },
        signal: AbortSignal.timeout(3000), redirect: "error"
      });
      const sdp = await answer.text();
      const rewritten = Buffer.byteLength(sdp) <= sdpBytes ? chooseRelayCandidate(sdp, upstream.iceTcpPort, relayPort) : null;
      if (!answer.ok || !rewritten || !durableAllowed()) { response.writeHead(503).end(); return; }
      if (!await checkAccess(lease.scope) || !allowed()) {
        await revoke();
        response.writeHead(403).end(); return;
      }
      admitted = true;
      response.writeHead(201, { "Content-Type": "application/sdp" }).end(rewritten);
    } catch {
      response.writeHead(503).end();
    } finally { admitting = false; }
  });
  try {
    await new Promise<void>((resolve, reject) => { control.once("error", reject); control.listen(0, loopback, resolve); });
  } catch (error) {
    relay.close();
    throw error;
  }
  const timer = setInterval(() => {
    if (!admitted || !lease || stopped || viewer?.destroyed) return;
    if (!allowed()) {
      void revoke().catch(disconnect);
    } else if (!pendingCheck && performance.now() >= nextCheckAt) {
      void checkAccess(lease.scope).then((ok) => {
        if (!ok && !stopped) return revoke();
      }).catch(disconnect);
    }
  }, 20);
  return {
    endpoint: `http://${loopback}:${(control.address() as AddressInfo).port}${offerPath}`,
    revoke,
    async close() {
      stopped = true;
      clearInterval(timer);
      pendingCheck?.abort();
      disconnect();
      control.closeAllConnections();
      await Promise.all([control, relay].map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
    }
  };
}
