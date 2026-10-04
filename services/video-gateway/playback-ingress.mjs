import { createServer } from "node:http";
import { isIP } from "node:net";
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

function loopbackAddress(value) {
  return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(String(value || "").toLowerCase());
}

function playbackClientAddress(request) {
  const direct = String(request.socket.remoteAddress || "unknown");
  if (!loopbackAddress(direct)) return direct;
  const forwarded = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return isIP(forwarded) ? forwarded : direct;
}

export function createPlaybackIngress({ origin = "http://127.0.0.1:18082", publicOrigin = "", now = Date.now,
  rateLimits = {} } = {}) {
  const target = new URL(origin);
  if (target.protocol !== "http:" || target.hostname !== "127.0.0.1" || target.username || target.password
    || target.pathname !== "/" || target.search || target.hash) throw new Error("PLAYBACK_INGRESS_ORIGIN_NOT_LOOPBACK");
  const external = publicOrigin ? new URL(publicOrigin) : null;
  if (external && (external.protocol !== "https:" || external.username || external.password ||
    external.pathname !== "/" || external.search || external.hash))
    throw new Error("PLAYBACK_INGRESS_PUBLIC_ORIGIN_INVALID");
  const limits = {
    claim: Number(rateLimits.claimPerMinute ?? 30),
    media: Number(rateLimits.mediaPerMinute ?? 1200),
    clients: Number(rateLimits.maxClients ?? 2048)
  };
  if (![limits.claim, limits.media, limits.clients].every(Number.isInteger)
    || limits.claim < 1 || limits.media < 1 || limits.clients < 1) throw new Error("PLAYBACK_INGRESS_RATE_LIMIT_INVALID");
  const windows = new Map();
  function rateAllowed(request, pathname) {
    const observedAt = now();
    const kind = pathname === "/playback/claim" ? "claim" : "media";
    const key = `${kind}:${playbackClientAddress(request)}`;
    let current = windows.get(key);
    if (!current || current.expiresAt <= observedAt) {
      if (!current && windows.size >= limits.clients * 2) {
        for (const [candidate, window] of windows)
          if (window.expiresAt <= observedAt) windows.delete(candidate);
        if (windows.size >= limits.clients * 2) return false;
      }
      current = { count: 0, expiresAt: observedAt + 60_000 };
      windows.set(key, current);
    }
    current.count += 1;
    return current.count <= limits[kind];
  }
  return createServer(async (request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    if (!playbackIngressAllows(request.method, url.pathname, url.search)) {
      response.writeHead(404, { "cache-control": "no-store" }).end();
      return;
    }
    if (!rateAllowed(request, url.pathname)) {
      response.writeHead(429, { "cache-control": "no-store", "retry-after": "60" }).end();
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
      if (external && request.method === "POST" && url.pathname === "/playback/claim" && upstream.ok) {
        const payload = await upstream.json();
        const internal = new URL(String(payload?.playback?.hls_url || ""));
        if (internal.protocol !== "http:" || internal.hostname !== "127.0.0.1" ||
          internal.username || internal.password || internal.hash)
          throw new Error("PLAYBACK_INGRESS_CLAIM_URL_INVALID");
        payload.playback.hls_url = `${external.origin}${internal.pathname}${internal.search}`;
        response.end(JSON.stringify(payload));
      } else if (upstream.body) Readable.fromWeb(upstream.body).on("error", () => response.destroy()).pipe(response);
      else response.end();
    } catch {
      if (!response.headersSent) response.writeHead(502, { "cache-control": "no-store" }).end();
      else response.destroy();
    }
  });
}
