import { createServer } from "node:http";
import { createServer as createSecureServer } from "node:https";
import { lstatSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { timingSafeEqual } from "node:crypto";
import { push38RemotePlaybackPage, sanitizePush38RemotePlaybackResult } from "./push38-remote-playback-page.mjs";

const routes = new Set([
  "POST /api/digital-observer/gateway-enrollment",
  "GET /api/video-gateway/edge-updates",
  "POST /api/video-gateway/edge-updates",
  "POST /api/video-gateway/edge-updates/download",
  "POST /api/video-gateway/home-qa-legacy-download",
  "POST /api/video-gateway/cloud-discovery",
  "POST /api/video-gateway/device-heartbeat",
  "POST /api/video-gateway/cloud-learning",
  "POST /api/video-gateway/playback-grant",
  "POST /api/video-gateway/camera-actions",
  "GET /api/video-gateway/event-manifest",
  "POST /api/video-gateway/cloud-events",
  "POST /api/video-gateway/cloud-event-media",
  "POST /api/digital-observer/dvr-gateway",
  "GET /push38/remote-playback",
  "POST /push38/remote-playback/result"
]);
const forwardHeaders = new Set([
  "accept", "authorization", "content-type", "x-video-gateway-device-token",
  "x-video-gateway-id", "x-video-gateway-timestamp", "x-video-gateway-nonce",
  "x-video-gateway-signature",
  "x-observer-device-protocol", "x-observer-device-id",
  "x-observer-device-credential-version", "x-observer-device-timestamp",
  "x-observer-device-nonce", "x-observer-device-runtime-instance",
  "x-observer-device-sequence", "x-observer-device-signature",
  "x-observer-home-qa-legacy-signature"
]);
const remoteQualificationRoutes = new Set([
  "POST /api/digital-observer/dvr-gateway",
  "GET /push38/remote-playback",
  "POST /push38/remote-playback/result"
]);

export function push38tIngressAllows(method, pathname) {
  return routes.has(`${method} ${pathname}`);
}

export function classifyPush38tIngressResponse(method, pathname, status, data) {
  if (method !== "GET" || pathname !== "/api/video-gateway/edge-updates" || status !== 200)
    return null;
  try {
    const payload = JSON.parse(data.toString("utf8"));
    const releaseId = payload?.data?.manifest?.release_id;
    if (typeof releaseId === "string" && /^[A-Za-z0-9._:-]{3,160}$/.test(releaseId))
      return `MANIFEST:${releaseId}`;
    const reason = payload?.data?.reason;
    return typeof reason === "string" && /^[A-Z0-9_:-]{3,100}$/.test(reason)
      ? `NO_MANIFEST:${reason}` : "NO_MANIFEST:UNSPECIFIED";
  } catch { return "INVALID_JSON"; }
}

function tlsMaterial(path, privateKey) {
  const target = resolve(path);
  const info = lstatSync(target);
  if (!info.isFile() || info.isSymbolicLink() ||
    (privateKey && (info.mode & 0o077) !== 0)) throw new Error("QA_INGRESS_TLS_MATERIAL_UNSAFE");
  return readFileSync(target);
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && a.length >= 32 && timingSafeEqual(a, b);
}

export function createPush38tIngress({ origin = "http://127.0.0.1:3100", tls = null,
  remoteResultToken = "", remoteResultExpiresAt = 0, remoteSession = null, now = Date.now,
  onRemoteResult = () => {}, onAudit = () => {} } = {}) {
  const target = new URL(origin);
  if (target.protocol !== "http:" || target.hostname !== "127.0.0.1" || target.username || target.password || target.pathname !== "/")
    throw new Error("QA_INGRESS_ORIGIN_NOT_LOOPBACK");
  if (tls && (!tls.keyPath || !tls.certPath)) throw new Error("QA_INGRESS_TLS_MATERIAL_REQUIRED");
  const handler = async (request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    const remoteSessionMatch = request.method === "GET" && url.pathname === "/push38/remote-playback" &&
      remoteSession && url.searchParams.size === 1 && url.searchParams.get("session") === remoteSession.session_id;
    if (!push38tIngressAllows(request.method, url.pathname) ||
      (url.pathname !== "/api/video-gateway/edge-updates" && url.search && !remoteSessionMatch)) {
      onAudit({ method: request.method, pathname: url.pathname, outcome: "DENIED", status: 404 });
      response.writeHead(404, { "cache-control": "no-store" }).end();
      return;
    }
    const remoteQualificationActive = Boolean(remoteResultToken) && Number.isFinite(remoteResultExpiresAt) &&
      remoteResultExpiresAt > now() && (!remoteSession || remoteSession.expires_at_ms > now());
    if (!remoteQualificationActive && remoteQualificationRoutes.has(`${request.method} ${url.pathname}`)) {
      onAudit({ method: request.method, pathname: url.pathname, outcome: "DENIED", status: 404 });
      response.writeHead(404, { "cache-control": "no-store" }).end();
      return;
    }
    if (url.pathname === "/push38/remote-playback" && request.method === "GET") {
      if (!remoteQualificationActive || (remoteSession && !remoteSessionMatch)) {
        onAudit({ method: request.method, pathname: url.pathname, outcome: "DENIED", status: 404 });
        response.writeHead(404, { "cache-control": "no-store" }).end();
        return;
      }
      onAudit({ method: request.method, pathname: url.pathname, outcome: "QUALIFICATION_CLIENT", status: 200 });
      response.writeHead(200, { "cache-control": "private, no-store", "content-type": "text/html; charset=utf-8",
        "content-security-policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src https:; media-src https:; img-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
        "referrer-policy": "no-referrer", "x-content-type-options": "nosniff" })
        .end(push38RemotePlaybackPage(remoteSession?.config ?? null));
      return;
    }
    try {
      const chunks = []; let length = 0;
      const requestLimit = request.method === "POST" && url.pathname === "/api/video-gateway/cloud-event-media"
        ? 8 * 1024 * 1024 + 64 * 1024 : 8192;
      for await (const chunk of request) {
        length += chunk.length;
        if (length > requestLimit) {
          response.writeHead(413, { "cache-control": "no-store" }).end();
          return;
        }
        chunks.push(chunk);
      }
      if (url.pathname === "/push38/remote-playback/result") {
        if (!safeEqual(request.headers["x-push38-result-token"], remoteResultToken)) {
          onAudit({ method: request.method, pathname: url.pathname, outcome: "DENIED", status: 401 });
          response.writeHead(401, { "cache-control": "no-store" }).end();
          return;
        }
        const result = sanitizePush38RemotePlaybackResult(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        onRemoteResult(result);
        onAudit({ method: request.method, pathname: url.pathname, outcome: "REMOTE_RESULT", status: 202,
          responseClass: result.pass ? "PASS" : "FAIL" });
        response.writeHead(202, { "cache-control": "no-store", "content-type": "application/json" })
          .end('{"accepted":true}');
        return;
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
      onAudit({ method: request.method, pathname: url.pathname, outcome: "FORWARDED", status: upstream.status,
        responseClass: classifyPush38tIngressResponse(request.method, url.pathname, upstream.status, data) });
      response.writeHead(upstream.status, {
        "cache-control": "private, no-store", "referrer-policy": "no-referrer",
        "content-type": upstream.headers.get("content-type") || "application/json"
      }).end(data);
    } catch (error) {
      onAudit({ method: request.method, pathname: url.pathname, outcome: "UPSTREAM_ERROR", status: 502,
        reason: error instanceof Error ? error.message : "QA_INGRESS_UNKNOWN_ERROR" });
      if (!response.headersSent) response.writeHead(502, { "cache-control": "no-store" }).end();
    }
  };
  return tls ? createSecureServer({ key: tlsMaterial(tls.keyPath, true),
    cert: tlsMaterial(tls.certPath, false), minVersion: "TLSv1.2" }, handler) : createServer(handler);
}
