import { createServer, request as requestOrigin } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const origin = "http://127.0.0.1:3000";
const listenHost = "127.0.0.1";
const listenPort = 31744;
const maxDurationMs = 30 * 60_000;
const maxRequests = 1_200;
const maxRequestsPerMinute = 120;
const maxRequestBytes = 64 * 1024;
const maxResponseBytes = 80 * 1024 * 1024;
const ownerCookieName = "push44_owner_qa";

function validToken(token) {
  return typeof token === "string" && /^[a-f0-9]{64}$/.test(token);
}

function matchesToken(candidate, expected) {
  if (!validToken(candidate)) return false;
  return timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(expected, "hex"));
}

function authorizedCookie(rawCookie, expected) {
  if (typeof rawCookie !== "string") return false;
  const entries = rawCookie.split(";").map((part) => part.trim());
  const tokens = entries.filter((part) => part.startsWith(`${ownerCookieName}=`));
  return tokens.length === 1 && matchesToken(tokens[0].slice(ownerCookieName.length + 1), expected);
}

const readOnlyApi = new Set([
  "/api/development/version",
  "/api/digital-observer/mobile/runtime",
  "/api/digital-observer/cameras",
  "/api/digital-observer/camera-health",
  "/api/digital-observer/incidents",
  "/api/digital-observer/event-journal",
  "/api/digital-observer/notifications",
  "/api/digital-observer/settings",
  "/api/digital-observer/access-settings"
]);

export function allowedQaRequest(method, rawUrl) {
  if (!rawUrl?.startsWith("/") || rawUrl.startsWith("//")) return false;
  let url;
  try { url = new URL(rawUrl, origin); } catch { return false; }
  const path = url.pathname;
  if (/%(?:00|25|2e|2f|5c)/i.test(path)) return false;
  let decodedPath;
  try { decodedPath = decodeURIComponent(path); } catch { return false; }
  if (decodedPath.includes("\\") || decodedPath.includes("..")) return false;
  if (method === "POST") return path === "/api/digital-observer/auth/login" || path === "/api/auth/logout";
  if (method !== "GET" && method !== "HEAD") return false;
  if (path === "/digital-observer" || path.startsWith("/digital-observer/")) return true;
  if (path.startsWith("/_next/static/") || path.startsWith("/assets/digital-observer/")) return true;
  if (path === "/favicon.ico") return true;
  return readOnlyApi.has(path);
}

export function safeQaRedirect(rawLocation, incomingHost) {
  if (!rawLocation) return null;
  let redirect;
  try { redirect = new URL(rawLocation, `https://${incomingHost}`); } catch { return null; }
  const localOrigin = ["localhost:3000", "127.0.0.1:3000"].includes(redirect.host);
  if (redirect.protocol !== "https:" && !(localOrigin && redirect.protocol === "http:")) return null;
  if (redirect.host !== incomingHost && !localOrigin) return null;
  const destination = `${redirect.pathname}${redirect.search}`;
  return allowedQaRequest("GET", destination) ? destination : null;
}

export function createQaProxy({ now = () => Date.now(), upstream = origin, ownerToken, qaHost } = {}) {
  if (!validToken(ownerToken)) throw new Error("PUSH44 QA requires a 256-bit temporary owner token");
  if (typeof qaHost !== "string" || !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(qaHost)) {
    throw new Error("PUSH44 QA requires one exact HTTPS hostname");
  }
  const started = now();
  let requests = 0;
  let responseBytes = 0;
  let minuteStart = started;
  let minuteRequests = 0;
  const server = createServer((incoming, outgoing) => {
    const current = now();
    // Protected Quick Tunnel copies its response headers into the origin map;
    // an empty map can crash cloudflared on an early rejected request.
    outgoing.setHeader("cache-control", "no-store");
    outgoing.setHeader("x-robots-tag", "noindex, nofollow");
    outgoing.setHeader("referrer-policy", "no-referrer");
    if (process.env.PUSH44_QA_DIAGNOSTICS === "1") {
      let path = "/";
      try { path = new URL(incoming.url ?? "/", origin).pathname; } catch { /* invalid URLs remain unclassified */ }
      const route = path === "/digital-observer/login" ? "login-page"
        : path.startsWith("/_next/static/") ? "next-static"
        : path.startsWith("/_next/") ? "next-internal"
        : path.startsWith("/api/digital-observer/") ? "observer-api"
        : path.startsWith("/digital-observer") ? "product-page" : "other";
      let finished = false;
      outgoing.on("finish", () => {
        finished = true;
        console.log(`qa_request route=${route} method=${incoming.method} status=${outgoing.statusCode} origin_header=${incoming.headers.origin ? "present" : "absent"} duration_ms=${now() - current}`);
      });
      outgoing.on("close", () => {
        if (!finished) console.log(`qa_request route=${route} method=${incoming.method} status=incomplete origin_header=${incoming.headers.origin ? "present" : "absent"} duration_ms=${now() - current}`);
      });
    }
    if (current - started >= maxDurationMs) return void outgoing.writeHead(410).end();
    if (current - minuteStart >= 60_000) { minuteStart = current; minuteRequests = 0; }
    requests += 1;
    minuteRequests += 1;
    if (requests > maxRequests || minuteRequests > maxRequestsPerMinute || responseBytes >= maxResponseBytes) {
      return void outgoing.writeHead(429).end();
    }
    if (incoming.headers.host !== qaHost) return void outgoing.writeHead(421).end();
    if (incoming.method === "GET" && incoming.url?.startsWith("/__push44/bootstrap?")) {
      let bootstrap;
      try { bootstrap = new URL(incoming.url, `https://${qaHost}`); } catch { /* denied below */ }
      if (bootstrap?.pathname !== "/__push44/bootstrap" || bootstrap.searchParams.size !== 1
        || !matchesToken(bootstrap.searchParams.get("t"), ownerToken)) {
        return void outgoing.writeHead(401).end();
      }
      outgoing.setHeader("set-cookie", `${ownerCookieName}=${ownerToken}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=1800`);
      outgoing.setHeader("location", "/digital-observer/login");
      return void outgoing.writeHead(303).end();
    }
    if (!authorizedCookie(incoming.headers.cookie, ownerToken)) return void outgoing.writeHead(401).end();
    if (!allowedQaRequest(incoming.method, incoming.url)) return void outgoing.writeHead(404).end();
    if (Number(incoming.headers["content-length"] ?? 0) > maxRequestBytes) return void outgoing.writeHead(413).end();

    const target = new URL(incoming.url, upstream);
    const headers = { ...incoming.headers, host: incoming.headers.host ?? target.host,
      "x-forwarded-proto": "https", "x-push44-owner-qa": "bounded" };
    delete headers["cf-access-jwt-assertion"];
    delete headers["x-user-role"];
    delete headers["x-video-gateway-device-token"];
    delete headers["x-forwarded-host"];
    delete headers["x-forwarded-port"];
    if (headers.cookie) {
      const productCookies = headers.cookie.split(";").map((part) => part.trim())
        .filter((part) => !part.startsWith(`${ownerCookieName}=`));
      if (productCookies.length) headers.cookie = productCookies.join("; ");
      else delete headers.cookie;
    }
    const forwarded = requestOrigin(target, { method: incoming.method, headers, timeout: 15_000 }, (source) => {
      const safeHeaders = { ...source.headers, "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" };
      delete safeHeaders["transfer-encoding"];
      if (safeHeaders["set-cookie"]) {
        safeHeaders["set-cookie"] = safeHeaders["set-cookie"].map((cookie) =>
          /(?:^|;)\s*secure(?:;|$)/i.test(cookie) ? cookie : `${cookie}; Secure`);
      }
      if (safeHeaders.location) {
        const location = safeQaRedirect(safeHeaders.location, incoming.headers.host ?? "");
        if (!location) { source.destroy(); outgoing.writeHead(502).end(); return; }
        safeHeaders.location = location;
      }
      outgoing.writeHead(source.statusCode ?? 502, safeHeaders);
      source.on("data", (chunk) => {
        responseBytes += chunk.length;
        if (responseBytes > maxResponseBytes) { source.destroy(); outgoing.destroy(); return; }
        outgoing.write(chunk);
      });
      source.on("end", () => outgoing.end());
      source.on("error", () => outgoing.destroy());
    });
    forwarded.on("timeout", () => forwarded.destroy(new Error("origin_timeout")));
    forwarded.on("error", () => { if (!outgoing.headersSent) outgoing.writeHead(502); outgoing.end(); });
    let bodyBytes = 0;
    incoming.on("data", (chunk) => {
      bodyBytes += chunk.length;
      if (bodyBytes > maxRequestBytes) { incoming.destroy(); forwarded.destroy(); return; }
      forwarded.write(chunk);
    });
    incoming.on("end", () => forwarded.end());
    incoming.on("error", () => forwarded.destroy());
  });
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const tokenFile = process.env.PUSH44_QA_TOKEN_FILE;
  const qaHost = process.env.PUSH44_QA_HOST;
  if (!tokenFile || !qaHost) throw new Error("PUSH44 QA token file and exact hostname are required");
  if (statSync(tokenFile).mode & 0o077) throw new Error("QA token file must be owner-readable only");
  const server = createQaProxy({ ownerToken: readFileSync(tokenFile, "utf8").trim(), qaHost });
  server.listen(listenPort, listenHost, () => {
    console.log(`PUSH44 owner QA route filter active on ${listenHost}:${listenPort}; expires in 30 minutes; no media routes`);
  });
  const expiry = setTimeout(() => { server.close(); server.closeAllConnections(); }, maxDurationMs);
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => {
    clearTimeout(expiry);
    server.close();
    server.closeAllConnections();
  });
}
