import { createServer } from "node:https";
import { performance } from "node:perf_hooks";
import { gzipSync } from "node:zlib";
import { verifyGatewayPlaybackGrant } from "../../lib/domain/gateway-device-enrollment.ts";

// No listener, provider client, enrollment write or camera command is started by
// importing this module. The separately approved operator supplies all adapters.
export const CH1 = Object.freeze({
  sourceId: "6fddc732-13df-4268-9f32-3357262ea997",
  siteId: "cc1673b8-3eb0-4785-a12c-1fb88f425a41",
  tenantId: "cc1673b8-3eb0-4785-a12c-1fb88f425a41",
  enrollmentId: "1c450dca-38a8-4e49-853f-c613ca498c27",
  gatewayId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  streamId: "dvr_3a2d4e23f178cefa8f_1",
  viewerId: "00000000-0000-4000-8000-000000000f44",
  sourceEnvironment: "HOME_PUSH38T_QA",
  viewerEnvironment: "LOCAL_SUPABASE"
});
export const CH1_LIMITS = Object.freeze({ durationMs: 300_000, bytes: 100 * 1024 * 1024,
  requests: 600, objectBytes: 3 * 1024 * 1024, freshnessMs: 15_000 });

class Denied extends Error {
  constructor(code) { super(code); this.code = code; }
}
const deny = code => { throw new Denied(code); };
const exactScope = value => value && Object.entries(CH1).every(([key, expected]) => value[key] === expected);
const validPrincipal = p => p?.verified === true && p.active === true && p.viewerId === CH1.viewerId &&
  p.environment === CH1.viewerEnvironment && typeof p.sessionId === "string" && p.sessionId.length >= 8 &&
  typeof p.deviceId === "string" && p.deviceId.length >= 8;

async function bounded(operation) {
  let timer;
  try {
    return await Promise.race([Promise.resolve().then(operation), new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("ADAPTER_TIMEOUT")), 5000);
    })]);
  } finally { clearTimeout(timer); }
}

// This is a delegation, NOT a copied Site membership or an enrollment. Its
// issuer must verify both domain administrators outside the client boundary.
export function assertCh1Delegation(value, wallNow = Date.now()) {
  if (!exactScope(value) || value?.kind !== "CH1_VIEW_ONLY_DELEGATION" ||
    value.adminVerified !== true || value.sourceOwnerVerified !== true || value.revoked !== false ||
    !/^[A-Za-z0-9_-]{16,96}$/.test(value.approvalId || "") ||
    typeof value.purpose !== "string" || value.purpose.trim().length < 12 || value.purpose.length > 256 ||
    !Number.isSafeInteger(value.issuedAt) || !Number.isSafeInteger(value.expiresAt) ||
    value.issuedAt > wallNow || value.expiresAt <= wallNow ||
    value.expiresAt - value.issuedAt > CH1_LIMITS.durationMs) deny("DELEGATION_DENIED");
  return value;
}

/** One process, one approval, one session/device lease. There is no reset API.
 * consumeApproval must atomically consume an approval in a durable operator
 * store so neither a process restart nor another process can reuse the window.
 * readDelegation must recheck revocation; authenticate must validate the actual
 * server-side session (not getSession/JWT claims alone). Audit is synchronous,
 * durable and metadata-only. Missing/failed adapters permanently close the gate.
 */
export function createCh1MediaGate({ authenticate, readDelegation, consumeApproval, readMedia, audit,
  grantSecret, wallNow = Date.now, monotonicNow = () => performance.now() } = {}) {
  if (![authenticate, readDelegation, consumeApproval, readMedia, audit].every(x => typeof x === "function") ||
    typeof grantSecret !== "string" || grantSecret.length < 43) throw new Error("CH1_ADAPTERS_REQUIRED");
  let stopped = false, reason = null, lease = null, claiming = false, timer;
  let reservedBytes = 0, submittedBytes = 0, requests = 0, lastSequence = -1;
  const active = new Set(), usedNonces = new Set();
  let advertisedSegments = new Set();
  const metrics = () => ({ stopped, reason, reservedBytes, submittedBytes, requests, active: active.size });
  function record(event) {
    const result = audit(Object.freeze({ event, sourceId: CH1.sourceId, ...metrics() }));
    if (result !== true) throw new Error("AUDIT_UNAVAILABLE");
  }
  function stop(code = "CLOSED") {
    if (stopped) return;
    stopped = true; reason = code; clearTimeout(timer);
    for (const controller of active) controller.abort();
    try { record("CLOSED"); } catch { reason = "ACCOUNTING_OR_AUDIT_FAILURE"; }
  }
  function bounds() {
    if (stopped) deny(reason);
    if (lease && (monotonicNow() >= lease.deadline || wallNow() >= lease.wallDeadline)) {
      stop("DURATION_EXHAUSTED"); deny("DURATION_EXHAUSTED");
    }
  }
  async function identity(context, requireLease = true) {
    bounds();
    const p = await bounded(() => authenticate(context));
    if (!validPrincipal(p)) deny("SESSION_DENIED");
    const d = assertCh1Delegation(await bounded(readDelegation), wallNow());
    if (requireLease && (!lease || p.sessionId !== lease.sessionId || p.deviceId !== lease.deviceId ||
      d.approvalId !== lease.approvalId)) deny("VIEWER_DENIED");
    bounds();
    return { p, d };
  }
  function claims(token) {
    if (typeof token !== "string" || token.length > 4096) deny("GRANT_DENIED");
    const c = verifyGatewayPlaybackGrant(token, grantSecret);
    if (!c || c.gateway_id !== CH1.gatewayId || c.observer_site_id !== CH1.siteId ||
      c.camera_source_id !== CH1.sourceId || c.gateway_stream_id !== CH1.streamId) deny("GRANT_DENIED");
    return c;
  }
  async function claim(context, token) {
    // Acquire before the first await: parallel claims cannot create two leases.
    if (claiming || lease) deny("LEASE_ALREADY_CLAIMED");
    claiming = true;
    try {
      const { p, d } = await identity(context, false);
      const c = claims(token);
      if (usedNonces.has(c.nonce)) deny("REPLAY_DENIED");
      if (await bounded(() => consumeApproval(d.approvalId)) !== true) deny("APPROVAL_ALREADY_CONSUMED");
      usedNonces.add(c.nonce);
      const remaining = Math.min(CH1_LIMITS.durationMs, d.expiresAt - wallNow());
      if (remaining <= 0) deny("DELEGATION_DENIED");
      lease = { sessionId: p.sessionId, deviceId: p.deviceId, approvalId: d.approvalId,
        deadline: monotonicNow() + remaining, wallDeadline: d.expiresAt, nonce: c.nonce, grantExp: c.exp };
      timer = setTimeout(() => stop("DURATION_EXHAUSTED"), remaining); timer.unref();
      record("LEASE_CLAIMED");
      return { path: "/ch1/index.m3u8", expiresAt: Math.min(c.exp, d.expiresAt) };
    } catch (error) { stop(error instanceof Denied ? error.code : "ADAPTER_FAILURE"); throw error; }
    finally { claiming = false; }
  }
  async function renew(context, token) {
    try {
      await identity(context);
      const c = claims(token);
      if (usedNonces.has(c.nonce)) deny("REPLAY_DENIED");
      if (usedNonces.size >= 12) deny("RENEWAL_LIMIT");
      usedNonces.add(c.nonce); lease.nonce = c.nonce; lease.grantExp = c.exp;
      record("GRANT_RENEWED"); // Never resets deadline, bytes, request count or viewer.
    } catch (error) {
      if (!(error instanceof Denied)) stop("ADAPTER_OR_ACCOUNTING_FAILURE");
      throw error;
    }
  }
  async function media(context, pathname, deliver, { gzipPlaylist = false } = {}) {
    let controller;
    try {
      await identity(context);
      if (wallNow() >= lease.grantExp) deny("GRANT_EXPIRED");
      if (!/^\/ch1\/(index\.m3u8|segment-\d{1,16}\.ts)$/.test(pathname)) deny("ROUTE_DENIED");
      if (!pathname.endsWith("m3u8") && !advertisedSegments.has(pathname)) deny("SEGMENT_NOT_ADVERTISED");
      if (++requests > CH1_LIMITS.requests) { stop("REQUEST_LIMIT"); deny("REQUEST_LIMIT"); }
      if (active.size >= 4) deny("REQUEST_CONCURRENCY_LIMIT");
      controller = new AbortController(); active.add(controller);
      const object = await bounded(() => readMedia({ source: CH1, pathname, signal: controller.signal,
        maxBytes: CH1_LIMITS.objectBytes }));
      await identity(context); // Revocation while reading cannot leak a completed object.
      if (wallNow() >= lease.grantExp) deny("GRANT_EXPIRED");
      if (controller.signal.aborted) deny("TRANSFER_ABORTED");
      if (!Buffer.isBuffer(object?.body) || object.body.length > CH1_LIMITS.objectBytes ||
        !Number.isSafeInteger(object.producedAt) || wallNow() - object.producedAt > CH1_LIMITS.freshnessMs ||
        object.producedAt > wallNow() || !exactScope(object.source)) deny("STALE_OR_INVALID_MEDIA");
      let body = object.body;
      if (pathname.endsWith("m3u8")) {
        body = validateCh1Playlist(body, lastSequence);
        if (!Number.isSafeInteger(object.sequence) || object.sequence < 0 ||
          !body.toString().includes(`#EXT-X-MEDIA-SEQUENCE:${object.sequence}\n`)) deny("PLAYLIST_SEQUENCE_INVALID");
        lastSequence = object.sequence;
        advertisedSegments = new Set(body.toString().split("\n").filter(x => x.startsWith("/ch1/segment-")));
      }
      const contentEncoding = pathname.endsWith("m3u8") && gzipPlaylist ? "gzip" : undefined;
      if (contentEncoding) body = gzipSync(body);
      // Synchronous reserve before any asynchronous delivery. Interrupted writes
      // are NOT refunded: retries/Range/reconnect cannot reclaim the allowance.
      if (!Number.isSafeInteger(reservedBytes) || reservedBytes + body.length > CH1_LIMITS.bytes) {
        stop("BYTE_LIMIT"); deny("BYTE_LIMIT");
      }
      reservedBytes += body.length; record("TRANSFER_RESERVED"); bounds();
      await deliver(body, { contentType: pathname.endsWith("m3u8") ? "application/vnd.apple.mpegurl" : "video/mp2t",
        contentEncoding, signal: controller.signal });
      submittedBytes += body.length;
      if (submittedBytes > reservedBytes) throw new Error("ACCOUNTING_INVALID");
      record("TRANSFER_SUBMITTED");
    } catch (error) {
      if (!(error instanceof Denied)) stop("ADAPTER_OR_ACCOUNTING_FAILURE");
      throw error;
    } finally { if (controller) active.delete(controller); }
  }
  return Object.freeze({ claim, renew, media, stop, revoke: () => stop("GRANT_REVOKED"), metrics });
}

export function validateCh1Playlist(body, previousSequence = -1) {
  if (!Buffer.isBuffer(body) || body.length > 64 * 1024) deny("PLAYLIST_INVALID");
  const lines = body.toString("utf8").replace(/\r/g, "").trim().split("\n");
  const seqs = lines.filter(x => /^#EXT-X-MEDIA-SEQUENCE:\d+$/.test(x));
  const sequence = Number(seqs[0]?.split(":")[1]);
  const segments = lines.filter(x => x && !x.startsWith("#"));
  const allowed = /^(#EXTM3U|#EXT-X-VERSION:[1-7]|#EXT-X-TARGETDURATION:[1-9]\d?|#EXT-X-MEDIA-SEQUENCE:\d+|#EXT-X-INDEPENDENT-SEGMENTS|#EXT-X-DISCONTINUITY|#EXTINF:\d+(?:\.\d+)?,)$/;
  if (lines[0] !== "#EXTM3U" || seqs.length !== 1 || sequence < previousSequence || !Number.isSafeInteger(sequence) ||
    segments.length < 1 || segments.length > 12 || lines.some(x => x.startsWith("#") && !allowed.test(x)) ||
    lines.filter(x => x.startsWith("#EXTINF:")).length !== segments.length ||
    segments.some((x, i) => !/^segment-\d{1,16}\.ts$/.test(x) ||
      !Number.isSafeInteger(Number(x.slice(8, -3))) || Number(x.slice(8, -3)) !== sequence + i)) deny("PLAYLIST_INVALID");
  return Buffer.from(lines.map(x => x.startsWith("#") ? x : `/ch1/${x}`).join("\n") + "\n");
}

// Private TLS adapter only; no HTTP fallback, CORS, query token or arbitrary
// upstream URL. Native clients use the trusted authenticate adapter's session
// cookie/header. Range is deliberately denied (full segments are <=3 MiB).
export function createCh1HttpsServer({ tls, gate }) {
  if (!tls?.key || !tls?.cert || !gate) throw new Error("CH1_TLS_REQUIRED");
  const server = createServer({ ...tls, minVersion: "TLSv1.2" }, async (req, res) => {
    res.setHeader("cache-control", "private, no-store");
    res.setHeader("referrer-policy", "no-referrer");
    res.setHeader("x-content-type-options", "nosniff");
    let abort;
    try {
      if (req.method !== "GET" || req.url?.includes("?") || req.headers.range) deny("ROUTE_DENIED");
      const gzipPlaylist = /(?:^|,)\s*gzip(?:\s*;\s*q=(?:1(?:\.0*)?|0?\.\d*[1-9]\d*))?\s*(?:,|$)/i
        .test(req.headers["accept-encoding"] || "");
      await gate.media(req, req.url, async (body, { contentType, contentEncoding, signal }) => {
        if (signal.aborted) deny("TRANSFER_ABORTED");
        abort = () => res.destroy(); signal.addEventListener("abort", abort, { once: true });
        try {
          res.writeHead(200, { "content-type": contentType, "content-length": body.length,
            ...(contentEncoding ? { "content-encoding": contentEncoding, vary: "Accept-Encoding" } : {}) });
          await new Promise((resolve, reject) => {
            res.once("close", () => res.writableFinished ? resolve() : reject(new Error("INTERRUPTED")));
            res.end(body, resolve);
          });
        } finally { signal.removeEventListener("abort", abort); }
      }, { gzipPlaylist });
    } catch {
      if (!res.headersSent) res.writeHead(403).end("MEDIA_UNAVAILABLE");
      else res.destroy();
    }
  });
  server.headersTimeout = 5000; server.requestTimeout = 10_000; server.maxConnections = 4;
  server.setTimeout(5000, socket => socket.destroy());
  server.on("close", () => gate.stop("SERVER_CLOSED"));
  return server;
}
