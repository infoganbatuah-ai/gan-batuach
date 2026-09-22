import { createServer } from "node:http";
import { createServer as createSecureServer } from "node:https";
import { lstatSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const routes = new Set([
  "POST /api/digital-observer/gateway-enrollment",
  "GET /api/video-gateway/edge-updates",
  "POST /api/video-gateway/edge-updates/download",
  "POST /api/video-gateway/home-qa-legacy-download"
]);
const forwardHeaders = new Set([
  "accept", "content-type", "x-video-gateway-device-token",
  "x-observer-device-protocol", "x-observer-device-id",
  "x-observer-device-credential-version", "x-observer-device-timestamp",
  "x-observer-device-nonce", "x-observer-device-runtime-instance",
  "x-observer-device-sequence", "x-observer-device-signature",
  "x-observer-home-qa-legacy-signature"
]);

export function push38tIngressAllows(method, pathname) {
  return routes.has(`${method} ${pathname}`);
}

function tlsMaterial(path, privateKey) {
  const target = resolve(path);
  const info = lstatSync(target);
  if (!info.isFile() || info.isSymbolicLink() ||
    (privateKey && (info.mode & 0o077) !== 0)) throw new Error("QA_INGRESS_TLS_MATERIAL_UNSAFE");
  return readFileSync(target);
}

export function createPush38tIngress({ origin = "http://127.0.0.1:3100", tls = null } = {}) {
  const target = new URL(origin);
  if (target.protocol !== "http:" || target.hostname !== "127.0.0.1" || target.username || target.password || target.pathname !== "/")
    throw new Error("QA_INGRESS_ORIGIN_NOT_LOOPBACK");
  if (tls && (!tls.keyPath || !tls.certPath)) throw new Error("QA_INGRESS_TLS_MATERIAL_REQUIRED");
  const handler = async (request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    if (!push38tIngressAllows(request.method, url.pathname) ||
      (url.pathname !== "/api/video-gateway/edge-updates" && url.search)) {
      response.writeHead(404, { "cache-control": "no-store" }).end();
      return;
    }
    try {
      const chunks = []; let length = 0;
      for await (const chunk of request) {
        length += chunk.length;
        if (length > 8192) {
          response.writeHead(413, { "cache-control": "no-store" }).end();
          return;
        }
        chunks.push(chunk);
      }
      const headers = new Headers();
      for (const [name, value] of Object.entries(request.headers))
        if (forwardHeaders.has(name) && typeof value === "string") headers.set(name, value);
      const upstream = await fetch(new URL(url.pathname + url.search, target), {
        method: request.method, headers, body: request.method === "GET" ? undefined : Buffer.concat(chunks),
        // The cumulative QA route performs bounded eligibility, revocation and
        // audit checks before it mints the capability. Keep the route bounded,
        // but do not let the ingress expire before the device's 20s control
        // contract (especially on the first local Next compilation).
        redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(20_000)
      });
      if (upstream.status >= 300 && upstream.status < 400) throw new Error("QA_INGRESS_REDIRECT_REJECTED");
      const data = Buffer.from(await upstream.arrayBuffer());
      if (data.length > 32_768) throw new Error("QA_INGRESS_OVERSIZE_RESPONSE");
      response.writeHead(upstream.status, {
        "cache-control": "private, no-store", "referrer-policy": "no-referrer",
        "content-type": upstream.headers.get("content-type") || "application/json"
      }).end(data);
    } catch {
      if (!response.headersSent) response.writeHead(502, { "cache-control": "no-store" }).end();
    }
  };
  return tls ? createSecureServer({ key: tlsMaterial(tls.keyPath, true),
    cert: tlsMaterial(tls.certPath, false), minVersion: "TLSv1.2" }, handler) : createServer(handler);
}
