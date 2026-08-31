import http from "node:http";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { createMediaBroker } from "./broker.mjs";
import { CLOUD_ORIGIN, RELAY_ORIGIN } from "../video-gateway/relay-protocol.mjs";

const permissions = new Map();
async function authorize(kind, token) {
  if (token.length < 32 || token.length > 4096) return null;
  const cacheKey = createHash("sha256").update(`${kind}:${token}`).digest("hex");
  const cached = permissions.get(cacheKey);
  if (cached?.until > Date.now()) return cached.identity;
  permissions.delete(cacheKey);
  const response = await fetch(`${CLOUD_ORIGIN}/api/video-gateway/relay-access`, {
    method: "POST", redirect: "error", headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "inspect", kind, token }), signal: AbortSignal.timeout(8000)
  });
  const payload = await response.json();
  const identity = payload.data;
  if (!response.ok || typeof identity?.gateway_id !== "string" || typeof identity?.observer_site_id !== "string"
    || !Number.isFinite(identity.expires_at) || identity.expires_at <= Date.now()) return null;
  if (kind === "transport") {
    if (permissions.size >= 2000) permissions.delete(permissions.keys().next().value);
    permissions.set(cacheKey, { identity, until: Math.min(identity.expires_at, Date.now() + 15_000) });
  }
  return identity;
}

const broker = createMediaBroker({ authorize });
const server = http.createServer(async (incoming, outgoing) => {
  const controller = new AbortController();
  outgoing.once("close", () => controller.abort());
  try {
    const request = new Request(new URL(incoming.url || "/", RELAY_ORIGIN), {
      method: incoming.method, headers: incoming.headers,
      ...(["GET", "HEAD"].includes(incoming.method || "GET") ? {} : { body: Readable.toWeb(incoming), duplex: "half" }),
      signal: controller.signal
    });
    const result = await broker.handle(request);
    outgoing.writeHead(result.status, Object.fromEntries(result.headers));
    if (result.body) Readable.fromWeb(result.body).on("error", () => outgoing.destroy()).pipe(outgoing);
    else outgoing.end();
  } catch { outgoing.writeHead(500); outgoing.end(); }
});
server.requestTimeout = 30_000;
server.headersTimeout = 10_000;
server.maxHeadersCount = 32;
server.listen(Number(process.env.PORT || 18190), "127.0.0.1", () => console.log("Media Relay ready; bind=loopback; credentials=none; recording=disabled"));
process.once("SIGTERM", () => { broker.close(); server.close(); server.closeAllConnections(); permissions.clear(); });
process.once("SIGINT", () => { broker.close(); server.close(); server.closeAllConnections(); permissions.clear(); });
