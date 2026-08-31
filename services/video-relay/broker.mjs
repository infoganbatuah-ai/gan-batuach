import { createHash, randomBytes } from "node:crypto";
import { ASSET, BROWSER_ORIGINS, MEDIA_MAX_BYTES, RELAY_ORIGIN, SESSION_TTL_MS, sanitizePlaylist } from "../video-gateway/relay-protocol.mjs";

const opaque = () => randomBytes(32).toString("base64url");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const same = (a, b) => a.gateway_id === b.gateway_id && a.observer_site_id === b.observer_site_id;
const identityKey = (id) => JSON.stringify([id.observer_site_id, id.gateway_id]);
const statusError = (status, code) => Object.assign(new Error(code), { status });

export async function boundedBody(request, max) {
  if (Number(request.headers.get("content-length") || 0) > max) throw statusError(413, "request_too_large");
  const reader = request.body?.getReader();
  if (!reader) return {};
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) throw statusError(413, "request_too_large");
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally { await reader.cancel().catch(() => {}); }
}

// Each replica owns a bounded set of Gateway connections. Production routing
// must keep a Gateway and its viewer sessions on the same replica.
export function createMediaBroker({ authorize, now = Date.now, pollMs = 20_000, taskMs = 15_000, maxGateways = 1000 }) {
  const gateways = new Map();
  const sessions = new Map();
  const claimed = new Map();
  let closed = false;

  function sweep() {
    for (const [id, session] of sessions) if (session.exp <= now()) sessions.delete(id);
    for (const [id, exp] of claimed) if (exp <= now()) claimed.delete(id);
    for (const [id, gateway] of gateways) {
      if (gateway.lastSeen + 60_000 < now() && !gateway.poll && !gateway.tasks.size) gateways.delete(id);
    }
  }
  const maintenance = setInterval(sweep, 10_000);
  maintenance.unref();

  function gatewayFor(identity, create = false) {
    const key = identityKey(identity);
    if (!gateways.has(key) && create) {
      sweep();
      if (gateways.size >= maxGateways) throw statusError(503, "relay_capacity_reached");
      gateways.set(key, { identity, lastSeen: now(), tasks: new Map(), poll: null });
    }
    return gateways.get(key);
  }

  function dispatch(gateway) {
    if (!gateway.poll) return;
    const tasks = [...gateway.tasks.values()].filter((item) => !item.delivered).slice(0, 8);
    if (!tasks.length) return;
    for (const task of tasks) task.delivered = true;
    const resolve = gateway.poll;
    gateway.poll = null;
    resolve(tasks.map((task) => ({ id: task.id, ...task.command })));
  }

  function enqueue(identity, command, signal) {
    const gateway = gatewayFor(identity);
    if (!gateway || gateway.lastSeen + 30_000 < now()) throw statusError(503, "gateway_offline");
    if (gateway.tasks.size >= 32) throw statusError(429, "gateway_busy");
    if (signal.aborted) throw statusError(499, "viewer_disconnected");
    return new Promise((resolve, reject) => {
      const id = opaque();
      let timer;
      const finish = (error, result) => {
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        gateway.tasks.delete(id);
        if (error) reject(error); else resolve(result);
      };
      const abort = () => finish(statusError(499, "viewer_disconnected"));
      timer = setTimeout(() => finish(statusError(504, "gateway_timeout")), taskMs);
      signal.addEventListener("abort", abort, { once: true });
      gateway.tasks.set(id, { id, command, delivered: false, finish });
      dispatch(gateway);
    });
  }

  async function handle(request) {
    const url = new URL(request.url);
    const origin = request.headers.get("origin");
    const headers = { "cache-control": "private, no-store, max-age=0", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", vary: "Origin" };
    if (origin && BROWSER_ORIGINS.has(origin)) headers["access-control-allow-origin"] = origin;
    const json = (body, status = 200) => Response.json(body, { status, headers });
    try {
      if (closed) throw statusError(503, "relay_stopping");
      if (origin && !BROWSER_ORIGINS.has(origin)) throw statusError(403, "origin_not_allowed");
      if (url.pathname === "/health" && request.method === "GET") return json({ ok: true, role: "media_relay", version: 1, records_media: false });
      if (request.method === "OPTIONS" && (url.pathname === "/playback/claim" || url.pathname.startsWith("/media/"))) {
        return new Response(null, { status: 204, headers: { ...headers, "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type" } });
      }
      if (request.method === "POST" && ["/gateway/poll", "/gateway/result"].includes(url.pathname)) {
        const token = request.headers.get("authorization")?.replace(/^Bearer /, "") || "";
        const identity = await authorize("transport", token);
        if (!identity || identity.expires_at <= now()) throw statusError(401, "gateway_unauthorized");
        const gateway = gatewayFor(identity, true);
        gateway.lastSeen = now();
        if (url.pathname === "/gateway/poll") {
          if (gateway.poll) throw statusError(409, "poll_already_pending");
          const tasks = await new Promise((resolve) => {
            let timer;
            const done = (value) => {
              clearTimeout(timer);
              request.signal.removeEventListener("abort", abort);
              if (gateway.poll === done) gateway.poll = null;
              resolve(value);
            };
            const abort = () => done([]);
            timer = setTimeout(() => done([]), Math.min(pollMs, identity.expires_at - now()));
            request.signal.addEventListener("abort", abort, { once: true });
            gateway.poll = done;
            dispatch(gateway);
          });
          return json({ tasks });
        }
        const result = await boundedBody(request, Math.ceil(MEDIA_MAX_BYTES * 4 / 3) + 4096);
        const task = gateway.tasks.get(result.id);
        if (!task || !task.delivered) throw statusError(409, "task_expired");
        if (task.command.kind === "claim") {
          if (result.ok !== true || result.session_id !== task.command.session_id) task.finish(statusError(503, "source_unavailable"));
          else task.finish(null, true);
        } else if (result.ok !== true || typeof result.base64 !== "string") {
          task.finish(statusError(503, "media_unavailable"));
        } else {
          const data = Buffer.from(result.base64, "base64");
          if (!data.length || data.length > MEDIA_MAX_BYTES) task.finish(statusError(502, "invalid_media"));
          else task.finish(null, data);
        }
        return json({ accepted: true });
      }
      if (url.pathname === "/playback/claim" && request.method === "POST") {
        const payload = await boundedBody(request, 5000);
        if (typeof payload.grant !== "string" || payload.grant.length > 4096) throw statusError(400, "invalid_grant");
        const identity = await authorize("viewer", payload.grant);
        if (!identity || identity.expires_at <= now()) throw statusError(401, "grant_expired");
        const gateway = gatewayFor(identity);
        if (!gateway || gateway.lastSeen + 30_000 < now()) throw statusError(503, "gateway_offline");
        sweep();
        const usedKey = hash(payload.grant);
        if (claimed.has(usedKey)) throw statusError(409, "grant_replayed");
        if ([...sessions.values()].filter((session) => same(session, identity)).length >= 32) throw statusError(429, "viewer_limit");
        if (claimed.size >= maxGateways * 64 || sessions.size >= maxGateways * 32) throw statusError(503, "relay_capacity_reached");
        // Reserve synchronously before waiting for the Gateway. The cloud also
        // atomically consumes the grant nonce, surviving Relay restarts.
        claimed.set(usedKey, identity.expires_at);
        const sessionId = opaque();
        const token = opaque();
        const expiresAt = now() + SESSION_TTL_MS;
        sessions.set(sessionId, { ...identity, tokenHash: hash(token), exp: expiresAt, ready: false });
        try {
          await enqueue(identity, { kind: "claim", session_id: sessionId, grant: payload.grant, expires_at: expiresAt }, request.signal);
          const session = sessions.get(sessionId);
          if (!session || session.exp <= now()) throw statusError(401, "session_expired");
          session.ready = true;
          return json({ status: "starting", playback: { hls_url: `${RELAY_ORIGIN}/media/${sessionId}/index.m3u8?token=${token}` }, expires_in_seconds: Math.floor((expiresAt - now()) / 1000), private_source_hidden: true });
        } catch (error) { sessions.delete(sessionId); throw error; }
      }
      const match = url.pathname.match(/^\/media\/([a-zA-Z0-9_-]{43})\/(index\.m3u8|segment-\d{1,12}\.ts)$/);
      if (match && request.method === "GET" && ASSET.test(match[2])) {
        const session = sessions.get(match[1]);
        const token = url.searchParams.get("token") || "";
        if (!session?.ready || session.exp <= now() || token.length !== 43 || hash(token) !== session.tokenHash) throw statusError(401, "session_expired");
        const bytes = await enqueue(session, { kind: "asset", session_id: match[1], asset: match[2] }, request.signal);
        if (session.exp <= now()) throw statusError(401, "session_expired");
        const playlist = match[2] === "index.m3u8";
        return new Response(playlist ? sanitizePlaylist(bytes.toString("utf8"), token) : bytes, {
          headers: { ...headers, "content-type": playlist ? "application/vnd.apple.mpegurl" : "video/mp2t" }
        });
      }
      return json({ error: "not_found" }, 404);
    } catch (error) {
      return json({ error: Number.isInteger(error.status) ? error.message : "relay_request_failed", retryable: (error.status || 500) >= 500 }, error.status || 500);
    }
  }

  function close() {
    closed = true;
    clearInterval(maintenance);
    for (const gateway of gateways.values()) {
      gateway.poll?.([]);
      for (const task of gateway.tasks.values()) task.finish(statusError(503, "relay_stopping"));
    }
    gateways.clear(); sessions.clear(); claimed.clear();
  }
  return { handle, close };
}
