import { createOwnerApproval, approvalCookie } from "./observer-first-party/owner-approval.mjs";
import { OBSERVER_QA_HOST, observerQaRouteAllowed, observerQaRedirect } from "./push44-observer-qa-ingress-policy.mjs";
import { createServer, request as requestOrigin } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { readFileSync, statSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { qaPilotMediaRoute } from "../../services/video-gateway/qa-pilot-runtime.mjs";

// QA must never proxy the canonical integration preview on port 3000.
const origin = "http://127.0.0.1:3001";
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
  const localOrigin = ["localhost:3001", "127.0.0.1:3001"].includes(redirect.host);
  if (redirect.protocol !== "https:" && !(localOrigin && redirect.protocol === "http:")) return null;
  if (redirect.host !== incomingHost && !localOrigin) return null;
  const destination = `${redirect.pathname}${redirect.search}`;
  return allowedQaRequest("GET", destination) ? destination : null;
}

// Next constructs some redirects using its local listener authority. Resolve
// only this configured port, then apply the same external route allowlist.
export function observerOriginRedirect(location, upstream, gate) {
  const port = new URL(upstream).port;
  for (const scheme of ["http", "https"]) {
    for (const host of ["localhost", "127.0.0.1"]) {
      const prefix = `${scheme}://${host}:${port}/`;
      if (location.startsWith(prefix)) {
        return observerQaRedirect(location.slice(prefix.length - 1), gate);
      }
    }
  }
  return observerQaRedirect(location, gate);
}

export function createQaProxy({ now = () => Date.now(), upstream = origin, ownerToken, approvalCode, qaHost, expiresAt, mediaUpstream, mediaSha } = {}) {
  const observer = qaHost === OBSERVER_QA_HOST;
  if (observer && (ownerToken !== undefined || !/^http:\/\/127\.0\.0\.1:\d+$/.test(upstream))) {
    throw new Error("Observer requires an isolated loopback origin and one-use approval");
  }
  if (!observer && !validToken(ownerToken)) throw new Error("PUSH44 QA requires a 256-bit temporary owner token");
  if (typeof qaHost !== "string" || !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(qaHost)) {
    throw new Error("PUSH44 QA requires one exact HTTPS hostname");
  }
  if ((mediaUpstream !== undefined || mediaSha !== undefined) &&
      (!observer || !/^http:\/\/127\.0\.0\.1:[1-9]\d{3,4}$/.test(mediaUpstream || "") ||
        Number(new URL(mediaUpstream).port) < 1024 || mediaUpstream === upstream ||
        !/^[a-f0-9]{40}$/.test(mediaSha || ""))) throw new Error("Invalid isolated QA media upstream");
  const started = now();
  const deadline = Math.min(started + maxDurationMs, expiresAt ?? started + maxDurationMs);
  const approval = observer ? createOwnerApproval({ code: approvalCode, now, deadline }) : null;
  const gate = { host: qaHost, ownerAuthorized: true, trustedHttps: true };
  let requests = 0;
  let responseBytes = 0;
  let minuteStart = started;
  let minuteRequests = 0;
  const server = createServer((incoming, outgoing) => {
    const current = now();
    const media = Boolean(observer && mediaUpstream && incoming.method === "GET" &&
      !incoming.headers.range && qaPilotMediaRoute.test(incoming.url ?? ""));
    const issue = Boolean(observer && mediaUpstream && incoming.method === "POST" &&
      incoming.url === "/api/digital-observer/dvr-gateway");
    // Protected Quick Tunnel copies its response headers into the origin map;
    // an empty map can crash cloudflared on an early rejected request.
    outgoing.setHeader("cache-control", "no-store");
    outgoing.setHeader("x-robots-tag", "noindex, nofollow");
    outgoing.setHeader("referrer-policy", observer ? "same-origin" : "no-referrer");
    if (process.env.PUSH44_QA_DIAGNOSTICS === "1") {
      let path = "/";
      try { path = new URL(incoming.url ?? "/", origin).pathname; } catch { /* invalid URLs remain unclassified */ }
      const route = media ? "qa-media" : issue ? "qa-issuance" : path === "/digital-observer/login" ? "login-page"
        : path.startsWith("/_next/static/") ? "next-static"
        : path.startsWith("/_next/") ? "next-internal"
        : path.startsWith("/api/digital-observer/") ? "observer-api"
        : path.startsWith("/digital-observer") ? "product-page" : "other";
      let finished = false;
      outgoing.on("finish", () => {
        finished = true;
        console.log(`qa_request route=${route} method=${incoming.method} status=${outgoing.statusCode} internal_path=${route === "next-internal" ? path : "none"} origin_header=${incoming.headers.origin ? "present" : "absent"} duration_ms=${now() - current}`);
      });
      outgoing.on("close", () => {
        if (!finished) console.log(`qa_request route=${route} method=${incoming.method} status=incomplete origin_header=${incoming.headers.origin ? "present" : "absent"} duration_ms=${now() - current}`);
      });
    }
    if (current >= deadline) return void outgoing.writeHead(410).end();
    if (current - minuteStart >= 60_000) { minuteStart = current; minuteRequests = 0; }
    requests += 1;
    minuteRequests += 1;
    if (requests > maxRequests || minuteRequests > maxRequestsPerMinute || responseBytes >= maxResponseBytes) {
      return void outgoing.writeHead(429).end();
    }
    if (incoming.headers.host !== qaHost) return void outgoing.writeHead(421).end();
    if (observer) {
      // Only a TLS-terminating, host-pinned ingress may forward to this loopback listener.
      if (incoming.headers["x-forwarded-proto"] !== "https") return void outgoing.writeHead(403).end();
      // Native HLS may not carry the UI approval cookie. The media service
      // authenticates the signed receipt and re-checks the active viewer.
      if (!media && (incoming.url === approval.approvalPath || !approval.authorized(incoming.headers.cookie))) {
        approval.respond(incoming, outgoing).catch(() => outgoing.destroy());
        return;
      }
      if (incoming.method === "POST" && incoming.headers.origin !== `https://${qaHost}`) {
        return void outgoing.writeHead(403).end();
      }
      if (!media && !issue && !observerQaRouteAllowed({ ...gate, method: incoming.method, rawUrl: incoming.url, rsc: incoming.headers.rsc })) {
        return void outgoing.writeHead(404).end();
      }
    } else if (incoming.method === "GET" && incoming.url?.startsWith("/__push44/bootstrap?")) {
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
    if (!observer && !authorizedCookie(incoming.headers.cookie, ownerToken)) return void outgoing.writeHead(401).end();
    if (!observer && !allowedQaRequest(incoming.method, incoming.url)) return void outgoing.writeHead(404).end();
    if (Number(incoming.headers["content-length"] ?? 0) > maxRequestBytes) return void outgoing.writeHead(413).end();

    const target = new URL(incoming.url, media ? mediaUpstream : upstream);
    const headers = media ? { host: target.host } : { ...incoming.headers, host: incoming.headers.host ?? target.host,
      "x-forwarded-proto": "https", "x-push44-owner-qa": "bounded" };
    delete headers["cf-access-jwt-assertion"];
    delete headers["x-user-role"];
    delete headers["x-video-gateway-device-token"];
    delete headers["x-forwarded-host"];
    delete headers["x-forwarded-port"];
    if (headers.cookie) {
      const productCookies = headers.cookie.split(";").map((part) => part.trim())
        .filter((part) => !part.startsWith(`${ownerCookieName}=`) && !part.startsWith(`${approvalCookie}=`));
      if (productCookies.length) headers.cookie = productCookies.join("; ");
      else delete headers.cookie;
    }
    const forwarded = requestOrigin(target, { method: incoming.method, headers, timeout: 15_000 }, (source) => {
      if (issue) {
        const chunks = [];
        let size = 0;
        const reject = () => { if (!outgoing.headersSent) outgoing.writeHead(404).end(); };
        source.on("error", reject);
        source.on("data", chunk => {
          size += chunk.length;
          if (size <= 8192) chunks.push(chunk);
          else { source.destroy(); reject(); }
        });
        source.on("end", () => {
          try {
            const playback = JSON.parse(Buffer.concat(chunks)).data.playback;
            const signed = new URL(playback.hls_url);
            if (source.statusCode !== 200 || playback.qa_build_sha !== mediaSha ||
                Object.keys(playback).sort().join(",") !== "hls_url,qa_build_sha" ||
                signed.origin !== `https://${qaHost}` || signed.username || signed.password || signed.hash ||
                !signed.pathname.endsWith("/index.m3u8") || !qaPilotMediaRoute.test(signed.pathname + signed.search)) return reject();
            const body = Buffer.from(JSON.stringify({ data: { playback } }));
            responseBytes += body.length;
            if (responseBytes > maxResponseBytes) return reject();
            outgoing.writeHead(200, { "content-type": "application/json", "content-length": body.length,
              "referrer-policy": "no-referrer" }).end(body);
          } catch { reject(); }
        });
        return;
      }
      if (media && (source.statusCode !== 200 || source.headers["x-observer-qa-build"] !== mediaSha)) {
        source.destroy();
        outgoing.writeHead(404).end();
        return;
      }
      const mediaHeaders = ["content-type", "content-length", "x-observer-qa-build"];
      const safeHeaders = { ...(media ? Object.fromEntries(mediaHeaders.flatMap(key => source.headers[key] ? [[key, source.headers[key]]] : [])) : source.headers),
        "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" };
      delete safeHeaders["transfer-encoding"];
      // A cold WebView reloads many bundles. Cache only successful immutable
      // build assets on this device, never session data or shared edge responses.
      if (observer && incoming.method === "GET" && source.statusCode === 200 &&
          !source.headers["set-cookie"] && target.pathname.startsWith("/_next/static/") &&
          /\bimmutable\b/i.test(source.headers["cache-control"] ?? "") &&
          /[.-][a-f0-9]{16}\.(?:js|css)$/.test(target.pathname)) {
        const ttl = Math.max(0, Math.floor((deadline - now()) / 1000));
        safeHeaders["cache-control"] = `private, max-age=${ttl}, immutable`;
        safeHeaders["cdn-cache-control"] = "no-store";
      }
      if (observer) safeHeaders["referrer-policy"] = media || issue ? "no-referrer" : "same-origin";
      if (safeHeaders["set-cookie"]) {
        safeHeaders["set-cookie"] = safeHeaders["set-cookie"].map((cookie) =>
          /(?:^|;)\s*secure(?:;|$)/i.test(cookie) ? cookie : `${cookie}; Secure`);
      }
      if (safeHeaders.location) {
        const location = observer ? observerOriginRedirect(safeHeaders.location, upstream, gate) : safeQaRedirect(safeHeaders.location, incoming.headers.host ?? "");
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
  const observer = qaHost === OBSERVER_QA_HOST;
  const output = process.env.PUSH44_QA_APPROVAL_OUTPUT;
  if (observer && (!output || tokenFile)) throw new Error("Set a fresh local owner approval output path only");
  if ((!observer && !tokenFile) || !qaHost) throw new Error("PUSH44 QA token file and exact hostname are required");
  if (!observer && statSync(tokenFile).mode & 0o077) throw new Error("QA token file must be owner-readable only");
  const expectedSha = process.env.PUSH44_QA_EXPECTED_SHA;
  if (!expectedSha || !/^[a-f0-9]{8,40}$/.test(expectedSha)) throw new Error("Expected QA source SHA is required");
  const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (!sourceSha.startsWith(expectedSha)) throw new Error("QA source commit differs from expected");
  const login = await fetch(`${origin}/digital-observer/login`, { signal: AbortSignal.timeout(5000) });
  if (!login.ok || !(await login.text()).includes("תצפיתן דיגיטלי")) {
    throw new Error("QA origin is not serving the Digital Observer Product");
  }
  const expiresAt = Number(process.env.PUSH44_QA_HARD_DEADLINE_MS);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now() || expiresAt - Date.now() > maxDurationMs) {
    throw new Error("QA requires a valid deadline within 30 minutes");
  }
  const approvalCode = observer ? randomBytes(8).toString("hex") : undefined;
  const ownerToken = observer ? undefined : readFileSync(tokenFile, "utf8").trim();
  const mediaUpstream = process.env.PUSH44_QA_MEDIA_UPSTREAM;
  if (mediaUpstream && expectedSha !== sourceSha) throw new Error("Media QA requires an exact build SHA");
  const server = createQaProxy({ ownerToken, approvalCode, qaHost, expiresAt,
    mediaUpstream, mediaSha: mediaUpstream ? sourceSha : undefined });
  if (observer) writeFileSync(output, approvalCode + "\n", { flag: "wx", mode: 0o600 });
  server.listen(listenPort, listenHost, () => {
    console.log(`PUSH44 owner QA route filter active on ${listenHost}:${listenPort}; fixed deadline; media ${mediaUpstream ? "receipt-only" : "disabled"}`);
  });
  const expiry = setTimeout(() => { server.close(); server.closeAllConnections(); }, expiresAt - Date.now());
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => {
    clearTimeout(expiry);
    server.close();
    server.closeAllConnections();
  });
}
