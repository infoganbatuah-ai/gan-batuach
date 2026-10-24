import { createServer } from "node:http";
import { createRemoteJWKSet, jwtVerify } from "jose";

// This module never starts a listener on import. A separate, owner-approved
// activation must supply the protected proxy key and local SQLite database.
export const CONTROL_HOST = "qa-iphone-device-proof.ganbatuach.com";
export const CONTROL_PATH = "/api/digital-observer/qa-device";
export const ACCESS_ISSUER = "https://spring-feather-ce4e.cloudflareaccess.com";
export const ACCESS_AUDIENCE = "b7eb4b1d10599071db3635118062272b8dec09328c3467a4f3a8677b704245a6";
export const ACCESS_OWNER = "info.ganbatuah@gmail.com";
const ORIGIN = `http://127.0.0.1:3001${CONTROL_PATH}`;
const WINDOW_MS = 30 * 60_000;
const MAX_ATTEMPTS = 1_000;
const MAX_ATTEMPTS_PER_MINUTE = 60;
const MAX_BODY_BYTES = 2_048;
const MAX_REPLY_BYTES = 8_192;
const MAX_ACCOUNTED_BYTES = 12 * 1024 * 1024;
const RESERVED_BYTES_PER_ATTEMPT = MAX_BODY_BYTES + MAX_REPLY_BYTES;

const validProxyKey = value => typeof value === "string" && /^[A-Za-z0-9_-]{43,96}$/.test(value);
const deny = (response, status = 403) => {
  response.writeHead(status, { "content-type": "application/json", "cache-control": "no-store",
    "x-content-type-options": "nosniff" });
  response.end('{"error":"QA_CONTROL_DENIED"}');
};

export function createPush44AccessVerifier({ keySet = createRemoteJWKSet(
  new URL(`${ACCESS_ISSUER}/cdn-cgi/access/certs`)), now = Date.now } = {}) {
  if (typeof now !== "function") throw new Error("QA_ACCESS_CLOCK_REQUIRED");
  return async assertion => {
    if (typeof assertion !== "string" || assertion.length > 8192 ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(assertion)) return false;
    try {
      const { payload } = await jwtVerify(assertion, keySet, {
        issuer: ACCESS_ISSUER, audience: ACCESS_AUDIENCE,
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
  return Object.freeze({
    consume: () => {
      const minute = Math.floor(now() / 60_000);
      return Number.isSafeInteger(minute) && consume.run(RESERVED_BYTES_PER_ATTEMPT,
        minute, minute, deadline, MAX_ATTEMPTS, RESERVED_BYTES_PER_ATTEMPT,
        MAX_ACCOUNTED_BYTES, minute, MAX_ATTEMPTS_PER_MINUTE).changes === 1;
    },
    stats: () => read.get()
  });
}

function permitted(request) {
  const headers = request.headers;
  const length = headers["content-length"];
  const counts = new Map();
  for (let i = 0; i < request.rawHeaders.length; i += 2) {
    const name = request.rawHeaders[i].toLowerCase();
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  if (["host", "origin", "x-forwarded-proto", "cf-access-jwt-assertion", "content-type"]
    .some(name => counts.get(name) !== 1) || (counts.get("content-length") ?? 0) > 1)
    return false;
  return request.socket.remoteAddress === "127.0.0.1" && request.method === "POST" &&
    request.url === CONTROL_PATH && headers.host === CONTROL_HOST &&
    headers.origin === `https://${CONTROL_HOST}` &&
    headers["x-forwarded-proto"] === "https" &&
    headers["content-type"] === "application/json" &&
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

async function boundedReply(response) {
  if (!response.body || response.status !== 200 ||
    !response.headers.get("content-type")?.startsWith("application/json")) throw new Error("QA_UPSTREAM_DENIED");
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_REPLY_BYTES) throw new Error("QA_REPLY_LIMIT");
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  return Buffer.concat(chunks);
}

function developmentCookies(raw) {
  if (typeof raw !== "string") return undefined;
  const selected = raw.split(";").map(part => part.trim()).filter(part =>
    /^sb-[A-Za-z0-9_-]+(?:\.[0-9]+)?=/.test(part));
  return selected.length ? selected.join("; ") : undefined;
}

export function createPush44QaControlIngress({ proxyKey, ledger, deadline, verifyAccess,
  fetcher = fetch, now = Date.now } = {}) {
  if (!validProxyKey(proxyKey) || !ledger || typeof ledger.consume !== "function" ||
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
      if (!permitted(request) || !await verifyAccess(request.headers["cf-access-jwt-assertion"]))
        return deny(response);
      const body = await boundedBody(request);
      if (now() >= deadline) return deny(response, 410);
      const headers = { host: CONTROL_HOST, origin: `https://${CONTROL_HOST}`,
        "x-forwarded-proto": "https", "x-do-qa-proxy-key": proxyKey,
        "content-type": "application/json" };
      const cookie = developmentCookies(request.headers.cookie);
      if (cookie) headers.cookie = cookie;
      const remainingMs = deadline - now();
      if (remainingMs <= 0) return deny(response, 410);
      const upstream = await fetcher(ORIGIN, { method: "POST", headers, body,
        redirect: "manual", signal: AbortSignal.any([
          AbortSignal.timeout(4_000), AbortSignal.timeout(remainingMs)
        ]) });
      const result = await boundedReply(upstream);
      if (now() >= deadline) return deny(response, 410);
      response.writeHead(200, { "content-type": "application/json", "cache-control": "no-store",
        "x-content-type-options": "nosniff" });
      response.end(result);
    } catch { deny(response); }
    finally { busy = false; }
  });
  server.headersTimeout = 3_000;
  server.requestTimeout = 5_000;
  server.maxConnections = 2;
  server.setTimeout(5_000, socket => socket.destroy());
  return Object.freeze({
    async listen() {
      if (server.listening || now() >= deadline) throw new Error("QA_CONTROL_EXPIRED");
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => { server.off("error", reject); resolve(); });
      });
      shutdown = setTimeout(() => {
        server.close();
        server.closeAllConnections();
      }, deadline - now());
      return `http://127.0.0.1:${server.address().port}`;
    },
    async close() {
      clearTimeout(shutdown);
      if (server.listening) await new Promise(resolve => server.close(resolve));
    }
  });
}
