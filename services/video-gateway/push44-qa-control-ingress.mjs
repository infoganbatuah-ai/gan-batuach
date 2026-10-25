import { createServer } from "node:http";
import { chmodSync, lstatSync, realpathSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";
import { createRemoteJWKSet, jwtVerify } from "jose";

// This module never starts a listener on import. A separate, owner-approved
// activation must supply the protected proxy key and local SQLite database.
export const CONTROL_HOST = "qa-iphone-device-proof.ganbatuach.com";
export const CONTROL_PATH = "/api/digital-observer/qa-device";
export const ACCESS_ISSUER = "https://spring-feather-ce4e.cloudflareaccess.com";
export const ACCESS_OWNER = "info.ganbatuah@gmail.com";
const WINDOW_MS = 30 * 60_000;
const MAX_ATTEMPTS = 1_000;
const MAX_ATTEMPTS_PER_MINUTE = 60;
const MAX_BODY_BYTES = 2_048;
const MAX_REPLY_BYTES = 8_192;
const MAX_PAGE_BYTES = 512 * 1024;
const MAX_ASSET_BYTES = 4 * 1024 * 1024;
const MAX_ACCOUNTED_BYTES = 64 * 1024 * 1024;
const RESERVED_BYTES_PER_ATTEMPT = MAX_BODY_BYTES + MAX_REPLY_BYTES;
const LOGIN_PATH = "/digital-observer/login";
const ENROLLMENT_PATH = "/digital-observer/qa-device-enrollment";
const LOGIN_API_PATH = "/api/digital-observer/auth/login";

function controlRoute(request) {
  const path = request.url;
  if (request.method === "POST" && path === CONTROL_PATH) return { kind: "control", path };
  if (request.method === "POST" && path === LOGIN_API_PATH) return { kind: "login", path };
  if (request.method === "GET" && path === ENROLLMENT_PATH) return { kind: "page", path };
  if (request.method === "GET" && path.startsWith(`${LOGIN_PATH}?`)) {
    const url = new URL(path, `https://${CONTROL_HOST}`);
    const params = url.searchParams;
    if (url.hash || params.getAll("next").length !== 1 ||
      params.get("next") !== ENROLLMENT_PATH || params.size > 2 ||
      [...params.keys()].some(key => !["next", "error"].includes(key)) ||
      (params.has("error") && !["invalid_login", "email_not_confirmed", "observer_setup_required"].includes(params.get("error")))) return null;
    return { kind: "page", path };
  }
  if (request.method === "GET" && /^\/_next\/static\/[A-Za-z0-9_./%~-]+$/.test(path) &&
    !path.includes("..") && !/%2f|%5c|%2e/i.test(path)) return { kind: "asset", path };
  return null;
}

function protectedSocketPath(socketPath) {
  if (typeof socketPath !== "string" || !isAbsolute(socketPath) ||
    Buffer.byteLength(socketPath) > 100 || !/\/control\.sock$/.test(socketPath)) return false;
  try {
    const parent = dirname(socketPath);
    const directory = lstatSync(parent);
    return directory.isDirectory() && directory.uid === process.getuid() &&
      (directory.mode & 0o700) === 0o700 && (directory.mode & 0o077) === 0 &&
      realpathSync(parent) === parent &&
      !lstatSync(socketPath, { throwIfNoEntry: false });
  } catch { return false; }
}

const validProxyKey = value => typeof value === "string" && /^[A-Za-z0-9_-]{43,96}$/.test(value);
const deny = (response, status = 403) => {
  response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store",
    "x-content-type-options": "nosniff" });
  response.end('{"error":"QA_CONTROL_DENIED"}');
};

export function createPush44AccessVerifier({ audience, keySet = createRemoteJWKSet(
  new URL(`${ACCESS_ISSUER}/cdn-cgi/access/certs`)), now = Date.now } = {}) {
  if (typeof audience !== "string" || !/^[a-f0-9]{64}$/.test(audience) ||
    typeof now !== "function") throw new Error("QA_ACCESS_CONFIG_REQUIRED");
  return async assertion => {
    if (typeof assertion !== "string" || assertion.length > 8192 ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(assertion)) return false;
    try {
      const { payload } = await jwtVerify(assertion, keySet, {
        issuer: ACCESS_ISSUER, audience,
        algorithms: ["RS256"], currentDate: new Date(now())
      });
      return payload.email === ACCESS_OWNER && typeof payload.sub === "string" &&
        payload.sub.length > 0 && Number.isSafeInteger(payload.iat) &&
        Number.isSafeInteger(payload.exp) && payload.exp > payload.iat &&
        payload.exp - payload.iat <= WINDOW_MS / 1000;
    } catch { return false; }
  };
}

// The SQLite UPDATE is atomic and survives a proxy restart. A different
// deadline cannot silently reset the one approved test window's budget.
export function createPush44ControlLedger(database, deadline, now = Date.now) {
  if (!database || !Number.isSafeInteger(deadline) || typeof now !== "function")
    throw new Error("QA_LEDGER_REQUIRED");
  database.exec(`CREATE TABLE IF NOT EXISTS push44_qa_control_ingress_limit (
    id INTEGER PRIMARY KEY CHECK(id=1), deadline INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0, bytes INTEGER NOT NULL DEFAULT 0,
    minute_bucket INTEGER NOT NULL DEFAULT -1, minute_attempts INTEGER NOT NULL DEFAULT 0
  )`);
  database.prepare(`INSERT OR IGNORE INTO push44_qa_control_ingress_limit(id,deadline)
    VALUES(1,?)`).run(deadline);
  // Reserve the worst-case request + response before any upstream mutation.
  // Reservations are never released, so crashes, denials and retries cannot
  // create extra budget. This is a conservative bound, not measured traffic.
  const consume = database.prepare(`UPDATE push44_qa_control_ingress_limit
    SET attempts=attempts+1, bytes=bytes+?,
      minute_attempts=CASE WHEN minute_bucket=? THEN minute_attempts+1 ELSE 1 END,
      minute_bucket=? WHERE id=1 AND deadline=? AND attempts<? AND bytes+?<=?
      AND (minute_bucket<>? OR minute_attempts<?)`);
  const read = database.prepare(`SELECT attempts,bytes,deadline,minute_bucket,minute_attempts
    FROM push44_qa_control_ingress_limit WHERE id=1`);
  const accountReply = database.prepare(`UPDATE push44_qa_control_ingress_limit SET bytes=bytes+?
    WHERE id=1 AND deadline=? AND bytes+?<=?`);
  return Object.freeze({
    consume: () => {
      const minute = Math.floor(now() / 60_000);
      return Number.isSafeInteger(minute) && consume.run(RESERVED_BYTES_PER_ATTEMPT,
        minute, minute, deadline, MAX_ATTEMPTS, RESERVED_BYTES_PER_ATTEMPT,
        MAX_ACCOUNTED_BYTES, minute, MAX_ATTEMPTS_PER_MINUTE).changes === 1;
    },
    accountReply: bytes => Number.isSafeInteger(bytes) && bytes >= 0 &&
      accountReply.run(bytes, deadline, bytes, MAX_ACCOUNTED_BYTES).changes === 1,
    stats: () => read.get()
  });
}

function permitted(request, route) {
  const headers = request.headers;
  const length = headers["content-length"];
  const counts = new Map();
  for (let i = 0; i < request.rawHeaders.length; i += 2) {
    const name = request.rawHeaders[i].toLowerCase();
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  if (["host", "x-forwarded-proto", "cf-access-jwt-assertion"]
    .some(name => counts.get(name) !== 1) || (counts.get("content-length") ?? 0) > 1 ||
    (counts.get("origin") ?? 0) > 1 || (counts.get("content-type") ?? 0) > 1)
    return false;
  const post = route.kind === "control" || route.kind === "login";
  return request.socket.remoteAddress === undefined &&
    (post ? counts.get("origin") === 1 && counts.get("content-type") === 1 &&
      headers.origin === `https://${CONTROL_HOST}` &&
      headers["content-type"] === (route.kind === "control" ? "application/json" : "application/x-www-form-urlencoded")
      : (!headers.origin || headers.origin === `https://${CONTROL_HOST}`) &&
        !headers["content-type"] && !headers["content-length"] && !headers["transfer-encoding"]) &&
    headers.host === CONTROL_HOST &&
    headers["x-forwarded-proto"] === "https" &&
    !headers.forwarded && !headers["x-forwarded-host"] &&
    !headers["x-do-qa-proxy-key"] && !headers["x-do-qa-ingress-key"] &&
    !headers.authorization && !headers["x-user-role"] &&
    typeof headers["cf-access-jwt-assertion"] === "string" &&
    (length === undefined || (/^\d{1,4}$/.test(length) && Number(length) <= MAX_BODY_BYTES)) &&
    request.rawHeaders.join("").length <= 8192;
}

async function boundedBody(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > MAX_BODY_BYTES) throw new Error("QA_BODY_LIMIT");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function boundedReply(response, maxBytes) {
  if (!response.body) throw new Error("QA_UPSTREAM_DENIED");
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new Error("QA_REPLY_LIMIT");
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  return Buffer.concat(chunks);
}

function safeLocation(value) {
  if (!value) return null;
  try {
    const url = new URL(value, "https://localhost:3001");
    if (url.username || url.password || url.hash ||
      !(["localhost", "127.0.0.1", CONTROL_HOST].includes(url.hostname)) ||
      (url.hostname === CONTROL_HOST ? url.port !== "" : !["3001", ""].includes(url.port)) ||
      url.protocol !== "https:") return null;
    const path = `${url.pathname}${url.search}`;
    if (path === ENROLLMENT_PATH || controlRoute({ method: "GET", url: path })?.kind === "page")
      return `https://${CONTROL_HOST}${path}`;
  } catch { /* deny unsafe redirects */ }
  return null;
}

// Next may start streaming before a Server Component calls redirect(). In that
// case it emits a meta refresh with HTTP 200. Translate only the two expected
// local control-page redirects into explicit, scoped HTTP redirects; never
// return an unchecked meta refresh to the iPhone.
function streamedPageRedirect(body, path) {
  const tags = [...body.toString("utf8").matchAll(/<meta\b[^>]*\bid="__next-page-redirect"[^>]*>/gi)];
  if (!tags.length) return null;
  if (tags.length !== 1) throw new Error("QA_STREAM_REDIRECT_DENIED");
  const content = /\bcontent="([^"]+)"/i.exec(tags[0][0])?.[1];
  const target = /^1;url=(.+)$/.exec(content ?? "")?.[1];
  if (path === ENROLLMENT_PATH && target === LOGIN_PATH)
    return `https://${CONTROL_HOST}${LOGIN_PATH}?next=${encodeURIComponent(ENROLLMENT_PATH)}`;
  const safe = target && safeLocation(target);
  if (!safe || path.startsWith(`${LOGIN_PATH}?`) && safe !== `https://${CONTROL_HOST}${ENROLLMENT_PATH}`)
    throw new Error("QA_STREAM_REDIRECT_DENIED");
  return safe;
}

function scopedSetCookies(upstream) {
  const raw = upstream.headers.getSetCookie?.() ?? [];
  if (raw.length > 8) throw new Error("QA_COOKIE_LIMIT");
  return raw.map(cookie => {
    const pair = cookie.split(";", 1)[0];
    const match = /^([A-Za-z0-9_.-]+)=([A-Za-z0-9_+\-./%=]+)$/.exec(pair);
    if (!match || (!/^sb-[A-Za-z0-9_-]+(?:\.[0-9]+)?$/.test(match[1]) &&
      match[1] !== "gb_active_product") || pair.length > 4096) throw new Error("QA_COOKIE_DENIED");
    return `${pair}; Path=/; Secure; HttpOnly; SameSite=Lax`;
  });
}

function developmentCookies(raw) {
  if (typeof raw !== "string") return undefined;
  const selected = raw.split(";").map(part => part.trim()).filter(part =>
    /^sb-[A-Za-z0-9_-]+(?:\.[0-9]+)?=/.test(part));
  return selected.length ? selected.join("; ") : undefined;
}

export function createPush44QaControlIngress({ proxyKey, socketPath, ledger, deadline, verifyAccess,
  developmentBackendUrl, fetcher = fetch, now = Date.now } = {}) {
  let backend;
  try { backend = new URL(developmentBackendUrl); } catch { /* fail closed */ }
  if (!validProxyKey(proxyKey) || !protectedSocketPath(socketPath) ||
    process.env.VERCEL || backend?.protocol !== "http:" || backend.hostname !== "127.0.0.1" ||
    !backend.port || backend.username || backend.password || backend.pathname !== "/" ||
    backend.search || backend.hash ||
    !ledger || typeof ledger.consume !== "function" ||
    typeof verifyAccess !== "function" ||
    typeof fetcher !== "function" || typeof now !== "function" ||
    !Number.isSafeInteger(deadline) || deadline <= now() || deadline > now() + WINDOW_MS)
    throw new Error("QA_CONTROL_INGRESS_CONFIG_DENIED");
  let busy = false;
  let shutdown;
  const server = createServer(async (request, response) => {
    response.setHeader("cache-control", "no-store");
    if (now() >= deadline) return deny(response, 410);
    try {
      if (!ledger.consume()) return deny(response, 429);
    } catch { return deny(response, 503); }
    if (busy) return deny(response, 429);
    busy = true;
    try {
      const route = controlRoute(request);
      if (!route || !permitted(request, route) ||
        !await verifyAccess(request.headers["cf-access-jwt-assertion"]))
        return deny(response);
      const body = request.method === "POST" ? await boundedBody(request) : undefined;
      if (route.kind === "login") {
        const form = new URLSearchParams(body.toString("utf8"));
        if (["email", "password", "next", "auth_source", "observer_account_type"]
          .some(key => form.getAll(key).length > 1) ||
          form.get("next") !== ENROLLMENT_PATH || form.get("auth_source") !== "observer" ||
          form.get("email")?.trim().toLowerCase() !== "owner-iphone@integration.qa.invalid" ||
          [...form.keys()].some(key => !["email", "password", "next", "auth_source", "observer_account_type"].includes(key)))
          return deny(response);
      }
      if (now() >= deadline) return deny(response, 410);
      const headers = { host: CONTROL_HOST, origin: `https://${CONTROL_HOST}`,
        "x-forwarded-proto": "https", "x-do-qa-proxy-key": proxyKey,
        "x-forwarded-host": CONTROL_HOST };
      if (request.method === "POST") headers["content-type"] = request.headers["content-type"];
      else delete headers.origin;
      const cookie = developmentCookies(request.headers.cookie);
      if (cookie && route.kind !== "asset") headers.cookie = cookie;
      const remainingMs = deadline - now();
      if (remainingMs <= 0) return deny(response, 410);
      const upstream = await fetcher(`http://127.0.0.1:3001${route.path}`, { method: request.method, headers, body,
        redirect: "manual", signal: AbortSignal.any([
          AbortSignal.timeout(4_000), AbortSignal.timeout(remainingMs)
        ]) });
      const redirectStatus = route.kind === "login" ? upstream.status === 303 :
        route.kind === "page" && [307, 308].includes(upstream.status);
      const redirect = redirectStatus ? safeLocation(upstream.headers.get("location")) : null;
      const type = upstream.headers.get("content-type") ?? "";
      const allowedType = route.kind === "control" ? type.startsWith("application/json") :
        route.kind === "page" ? type.startsWith("text/html") :
        route.kind === "asset" ? /^(?:text\/css|text\/javascript|application\/javascript|font\/|image\/|application\/font-)/.test(type) : false;
      if (route.kind === "login" ? !redirect : redirectStatus ? !redirect : upstream.status !== 200 || !allowedType)
        throw new Error("QA_UPSTREAM_DENIED");
      const result = redirect ? Buffer.alloc(0) : await boundedReply(upstream,
        route.kind === "control" ? MAX_REPLY_BYTES : route.kind === "asset" ? MAX_ASSET_BYTES : MAX_PAGE_BYTES);
      const streamedRedirect = route.kind === "page" && !redirect ?
        streamedPageRedirect(result, route.path) : null;
      if (typeof ledger.accountReply !== "function" || !ledger.accountReply(streamedRedirect ? 0 : result.length))
        return deny(response, 503);
      const cookies = route.kind === "login" || route.kind === "page" ? scopedSetCookies(upstream) : [];
      if (now() >= deadline) return deny(response, 410);
      response.writeHead(streamedRedirect ? 307 : redirect ? upstream.status : 200,
        { "content-type": redirect || streamedRedirect ? "text/plain; charset=utf-8" : type,
        "cache-control": "private, no-store, max-age=0", "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer", "content-security-policy": "frame-ancestors 'none'",
        ...(redirect || streamedRedirect ? { location: redirect || streamedRedirect } : {}),
        ...(cookies.length ? { "set-cookie": cookies } : {}) });
      response.end(streamedRedirect ? undefined : result);
    } catch { deny(response); }
    finally { busy = false; }
  });
  server.headersTimeout = 3_000;
  server.requestTimeout = 5_000;
  server.maxConnections = 2;
  server.setTimeout(5_000, socket => socket.destroy());
  return Object.freeze({
    async listen() {
      if (server.listening || now() >= deadline || !protectedSocketPath(socketPath))
        throw new Error("QA_CONTROL_EXPIRED");
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(socketPath, () => { server.off("error", reject); resolve(); });
      });
      try { chmodSync(socketPath, 0o600); }
      catch (error) { await new Promise(resolve => server.close(resolve)); throw error; }
      shutdown = setTimeout(() => {
        server.close();
        server.closeAllConnections();
      }, deadline - now());
      return socketPath;
    },
    async close() {
      clearTimeout(shutdown);
      if (server.listening) await new Promise(resolve => server.close(resolve));
    }
  });
}
