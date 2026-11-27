import "server-only";
import { createServer, type IncomingMessage } from "node:http";
import { connect, createServer as createRelay, type Socket } from "node:net";
import type { AddressInfo } from "node:net";
import type { GanCameraPilotScope } from "./gan-camera-pilot-grant";
import type { openGanCameraPilotSyntheticEdge } from "./gan-camera-pilot-synthetic-edge";

const loopback = "127.0.0.1";
const offerPath = "/pilot/whep";
const sdpBytes = 16 * 1024;
const maxChunkBytes = 64 * 1024;
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

async function readOffer(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > sdpBytes) return null;
    chunks.push(chunk);
  }
  const offer = Buffer.concat(chunks).toString("utf8");
  // The test receiver is non-trickle. Keep the upstream from dialing any
  // browser-supplied candidate or negotiating an extra track or data channel.
  if (!offer.startsWith("v=0") || /^a=(?:candidate|remote-candidates):/m.test(offer) ||
      !/^a=recvonly\r?$/m.test(offer) || !/^m=video /m.test(offer) || (offer.match(/^m=/gm) ?? []).length !== 1) return null;
  return offer;
}

type Options = {
  environment: string;
  upstream: { httpPort: number; iceTcpPort: number };
  edge: Pick<ReturnType<typeof openGanCameraPilotSyntheticEdge>, "transportAllowed" | "reserveTransportBytes" | "store">;
  // The caller must authenticate the QA session and redeem a signed Gan grant
  // for the exact bound scope via the same edge store. It must not trust headers
  // for viewer/role/site. The resulting lease is never sent to the browser.
  authorize: (request: IncomingMessage) => Promise<Lease | null>;
};

/** Single-host synthetic fixture. Do not mount in the product or expose the upstream. */
export async function startGanCameraPilotWebRtc({ environment, upstream, edge, authorize }: Options) {
  if (environment !== "development" || ![upstream.httpPort, upstream.iceTcpPort].every(
    (port) => Number.isInteger(port) && port > 0 && port <= 65535)) throw Error("INVALID_SYNTHETIC_WEBRTC_TARGET");
  let lease: Lease | null = null;
  let admitting = false;
  let admitted = false;
  let stopped = false;
  let mediaUsed = false;
  let viewer: Socket | null = null;
  let source: Socket | null = null;
  const allowed = () => !stopped && lease !== null && edge.transportAllowed(lease.handle, lease.scope);
  const disconnect = () => { viewer?.destroy(); source?.destroy(); };
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
      if (!lease || chunk.length > maxChunkBytes || !edge.reserveTransportBytes(lease.handle, lease.scope, chunk.length)) {
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
  const control = createServer({ requestTimeout: 3000, headersTimeout: 3000 }, async (request, response) => {
    response.setHeader("Cache-Control", "private, no-store");
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
      if (!allowed()) { response.writeHead(403).end(); return; }
      const answer = await fetch(`http://${loopback}:${upstream.httpPort}/qa-pattern/whep`, {
        method: "POST", body: offer, headers: { "Content-Type": "application/sdp" },
        signal: AbortSignal.timeout(3000), redirect: "error"
      });
      const sdp = await answer.text();
      const rewritten = Buffer.byteLength(sdp) <= sdpBytes ? chooseRelayCandidate(sdp, upstream.iceTcpPort, relayPort) : null;
      if (!answer.ok || !rewritten || !allowed()) { response.writeHead(503).end(); return; }
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
  const timer = setInterval(() => { if (viewer && !allowed()) disconnect(); }, 20);
  return {
    endpoint: `http://${loopback}:${(control.address() as AddressInfo).port}${offerPath}`,
    async revoke() {
      stopped = true;
      disconnect();
      if (lease) await edge.store.revoke(lease.handle);
    },
    async close() {
      stopped = true;
      clearInterval(timer);
      disconnect();
      control.closeAllConnections();
      await Promise.all([control, relay].map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
    }
  };
}
