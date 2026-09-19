import { createServer } from "node:http";
import { Readable } from "node:stream";

// This is the only service a future site-edge HTTPS tunnel may reach.
export function playbackIngressAllows(method, pathname, search = "") {
  if (pathname === "/playback/claim") return (method === "POST" || method === "OPTIONS") && !search;
  if (method !== "GET" && method !== "OPTIONS") return false;
  if (!/^\/hls\/[A-Za-z0-9_-]+\/(?:index\.m3u8|segment-\d+\.ts)$/.test(pathname)) return false;
  if (method === "OPTIONS") return !search;
  const params = new URLSearchParams(search);
  return [...params.keys()].length === 1 && /^[A-Za-z0-9_-]{32}$/.test(params.get("token") || "");
}

export function createPlaybackIngress({ origin = "http://127.0.0.1:18082" } = {}) {
  const target = new URL(origin);
  if (target.protocol !== "http:" || target.hostname !== "127.0.0.1" || target.username || target.password
    || target.pathname !== "/" || target.search || target.hash) throw new Error("PLAYBACK_INGRESS_ORIGIN_NOT_LOOPBACK");
  return createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    if (!playbackIngressAllows(request.method, url.pathname, url.search)) {
      response.writeHead(404, { "cache-control": "no-store" }).end();
      return;
    }
    try {
      let body;
      if (request.method === "POST") {
        const chunks = []; let length = 0;
        for await (const chunk of request) {
          length += chunk.length;
          if (length > 4096) { response.writeHead(413, { "cache-control": "no-store" }).end(); return; }
          chunks.push(chunk);
        }
        body = Buffer.concat(chunks);
      }
      const headers = new Headers();
      for (const key of ["origin", "content-type", "access-control-request-method", "access-control-request-headers"])
        if (typeof request.headers[key] === "string") headers.set(key, request.headers[key]);
      const upstream = await fetch(new URL(url.pathname + url.search, target), {
        method: request.method, headers, body, redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(30_000)
      });
      if (upstream.status >= 300 && upstream.status < 400) throw new Error("PLAYBACK_REDIRECT_REJECTED");
      const safe = {
        "content-type": upstream.headers.get("content-type") || "application/octet-stream",
        "cache-control": "private, no-store", "referrer-policy": "no-referrer",
        "x-content-type-options": "nosniff"
      };
      for (const key of ["access-control-allow-origin", "access-control-allow-methods", "access-control-allow-headers", "vary"])
        if (upstream.headers.has(key)) safe[key] = upstream.headers.get(key);
      response.writeHead(upstream.status, safe);
      if (upstream.body) Readable.fromWeb(upstream.body).on("error", () => response.destroy()).pipe(response);
      else response.end();
    } catch {
      if (!response.headersSent) response.writeHead(502, { "cache-control": "no-store" }).end();
      else response.destroy();
    }
  });
}
