import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";
import { createSyntheticQaMediaGate, SYNTHETIC_QA, CH1_LIMITS } from "./push44-ch1-private-media.mjs";
import fixture from "../../scripts/qa/fixtures/push44-synthetic-motion-ts.json" with { type: "json" };

// Cloudflare transport adapter for the SAME gate, not a new media/auth engine.
// One globally named Durable Object owns the only approval/lease. R2 is private;
// the host's outbound control polling carries no media or Development JWT.
const cookiePattern = /^__Host-DOCH1QA=[A-Za-z0-9_-]{43}$/;
const secretEqual = (a, b) => typeof a === "string" && typeof b === "string" &&
  a.length >= 43 && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const headers = { "cache-control": "private, no-store", "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff", "x-qa-source": "SYNTHETIC_NOT_CH1",
  "content-security-policy": "default-src 'none'; media-src 'self'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'" };
const page = `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>בדיקת מדיה סינתטית</title><h1>בדיקה סינתטית בלבד — לא מצלמה</h1><form action="/session" method="post"><label>קוד הבדיקה המוגן <input name="code" type="password" maxlength="64" autocomplete="off" required></label><button>כניסה לבדיקה</button></form></html>`;
const player = `<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>SYNTHETIC QA</title><h1>תוכן סינתטי בלבד — לא CH1</h1><p>עד חמש דקות, צופה אחד. בסיום הגישה נסגרת.</p><video controls playsinline autoplay muted src="/ch1/index.m3u8" style="max-width:100%"></video></html>`;

export class SyntheticQaSession {
  constructor(state, env) {
    this.state = state; this.env = env; this.jobs = new Map(); this.sequence = 0;
    this.queue = []; this.gate = null; this.cookie = null; this.closed = false; this.prepared = false; this.preparing = false;
    const sql = state.storage.sql;
    sql.exec("CREATE TABLE IF NOT EXISTS qa_run (id INTEGER PRIMARY KEY CHECK(id=1), consumed INTEGER NOT NULL DEFAULT 0, deadline INTEGER NOT NULL DEFAULT 0, bytes INTEGER NOT NULL DEFAULT 0, requests INTEGER NOT NULL DEFAULT 0)");
    sql.exec("INSERT OR IGNORE INTO qa_run(id) VALUES(1)");
    sql.exec("CREATE TABLE IF NOT EXISTS qa_audit (id INTEGER PRIMARY KEY, event TEXT NOT NULL, bytes INTEGER NOT NULL, timestamp INTEGER NOT NULL)");
    // Losing the in-memory owner/session/lease must NEVER reopen its allowance.
    if (this.row().consumed) this.closed = true;
  }
  row() { return this.state.storage.sql.exec("SELECT * FROM qa_run WHERE id=1").toArray()[0]; }
  stop() {
    this.closed = true; this.cookie = null; this.gate?.stop("QA_CLOSED");
    for (const job of this.jobs.values()) { clearTimeout(job.timer); job.reject(new Error("QA_CLOSED")); }
    this.jobs.clear(); this.queue.length = 0;
  }
  async rpc(type, input) {
    if (this.closed || this.jobs.size >= 8) throw new Error("CONTROL_UNAVAILABLE");
    const id = String(++this.sequence);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.jobs.delete(id); reject(new Error("CONTROL_TIMEOUT")); }, 3500);
      this.jobs.set(id, { resolve, reject, timer }); this.queue.push({ id, type, ...input });
    });
  }
  response(body, status = 200, extra = {}) {
    const bytes = Buffer.byteLength(body);
    const before = this.row();
    // Additional edge-wide body accounting includes player/control/error bodies.
    // TLS/HTTP overhead is not a claimed wire-byte metric; Workers egress is free.
    if (before.bytes + bytes > CH1_LIMITS.bytes) { this.stop(); return new Response(null, { status: 403, headers }); }
    this.state.storage.sql.exec("UPDATE qa_run SET bytes=bytes+? WHERE id=1", bytes);
    return new Response(body, { status, headers: { ...headers, ...extra } });
  }
  async prepare() {
    if (this.gate || this.row().consumed || this.closed || this.preparing || this.prepared) throw new Error("RUN_USED");
    this.preparing = true;
    if (!this.env.MEDIA || !this.env.CONTROL_KEY || !this.env.GRANT_SECRET) throw new Error("MISSING_BINDING");
    // The only origin bytes are this reviewed generator fixture, never a URL,
    // filesystem reader, Home source, proxy fetch or camera connection.
    const bytes = Buffer.from(fixture.base64, "base64");
    await this.env.MEDIA.put("synthetic-motion.ts", bytes, { httpMetadata: { contentType: "video/mp2t" } });
    this.prepared = true;
    return { kind: fixture.kind, storedBytes: bytes.length };
  }
  async bind(code) {
    if (this.gate || this.row().consumed || this.closed || !this.prepared) throw new Error("RUN_USED");
    const result = await this.rpc("bind", { code });
    if (!cookiePattern.test(result.cookie || "")) throw new Error("SESSION_DENIED");
    this.cookie = result.cookie;
    const issuedAt = Date.now(), expiresAt = issuedAt + CH1_LIMITS.durationMs;
    const delegation = { ...SYNTHETIC_QA, kind: "SYNTHETIC_QA_VIEW_ONLY", adminVerified: true,
      sourceOwnerVerified: true, revoked: false, approvalId: this.env.RUN_ID,
      purpose: "Owner-approved synthetic-only iPhone qualification", issuedAt, expiresAt };
    const gate = createSyntheticQaMediaGate({ grantSecret: this.env.GRANT_SECRET,
      authenticate: async request => {
        if (request.headers.get("cookie") !== this.cookie || this.closed) return null;
        const reply = await this.rpc("authenticate", { cookie: this.cookie });
        return reply.principal;
      },
      readDelegation: async () => ({ ...delegation, revoked: this.closed }),
      consumeApproval: async () => {
        const changed = this.state.storage.sql.exec("UPDATE qa_run SET consumed=1,deadline=? WHERE id=1 AND consumed=0 RETURNING id", expiresAt).toArray();
        return changed.length === 1;
      },
      audit: event => {
        this.state.storage.sql.exec("INSERT INTO qa_audit(event,bytes,timestamp) VALUES(?,?,?)", event.event, event.reservedBytes, Date.now());
        return true;
      },
      readMedia: async ({ source, pathname, signal }) => {
        if (signal.aborted || source.sourceId !== SYNTHETIC_QA.sourceId) throw new Error("SOURCE_DENIED");
        const sequence = Math.floor((Date.now() - issuedAt) / 2000);
        if (pathname.endsWith("m3u8")) return { source, producedAt: Date.now(), sequence,
          body: Buffer.from(`#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:2\n#EXT-X-MEDIA-SEQUENCE:${sequence}\n#EXT-X-INDEPENDENT-SEGMENTS\n#EXT-X-DISCONTINUITY\n#EXTINF:2,\nsegment-${sequence}.ts\n`) };
        const object = await this.env.MEDIA.get("synthetic-motion.ts");
        if (!object || object.size > 128 * 1024) throw new Error("SYNTHETIC_ORIGIN_UNAVAILABLE");
        return { source, producedAt: Date.now(), body: Buffer.from(await object.arrayBuffer()) };
      }
    });
    this.gate = gate;
    await gate.claim(new Request("https://qa.invalid/ch1/index.m3u8", { headers: { cookie: this.cookie } }), result.grant);
    this.grantExpires = result.grantExpires;
    await this.state.storage.setAlarm(expiresAt);
  }
  async alarm() { this.stop(); }
  async fetch(request) {
    try {
      const url = new URL(request.url);
      if (url.protocol !== "https:" || url.hostname !== this.env.EXPECTED_HOST || url.search || request.headers.has("range"))
        return this.response("DENIED", 403);
      const before = this.row();
      this.state.storage.sql.exec("UPDATE qa_run SET requests=requests+1 WHERE id=1");
      if (before.requests >= 6000 || before.bytes >= CH1_LIMITS.bytes ||
        (before.deadline && Date.now() >= before.deadline)) this.stop();
      const operator = secretEqual(request.headers.get("authorization"), `Bearer ${this.env.CONTROL_KEY}`);
      const path = url.pathname;
      if (operator && path === "/control/disconnect" && request.method === "POST" &&
        this.cookie && request.headers.get("cookie") === this.cookie) {
        this.stop(); return this.response("CLOSED");
      }
      if (operator && path === "/control/revoke" && request.method === "POST") { this.stop(); return this.response("CLOSED"); }
      if (this.closed) return this.response("CLOSED", 403);
      if (operator && path === "/control/prepare" && request.method === "POST") return this.response(JSON.stringify(await this.prepare()));
      if (operator && path === "/control/poll" && request.method === "GET") {
        const jobs = this.queue.splice(0, 8).filter(job => this.jobs.has(job.id));
        return this.response(JSON.stringify(jobs), 200, { "content-type": "application/json" });
      }
      if (operator && path === "/control/respond" && request.method === "POST") {
        if (!/^\d{1,4}$/.test(request.headers.get("content-length") || "") ||
          Number(request.headers.get("content-length")) > 4096) return this.response("DENIED", 403);
        const text = await request.text(); if (Buffer.byteLength(text) > 4096) throw new Error("BODY_TOO_LARGE");
        const { id, result } = JSON.parse(text), job = this.jobs.get(id);
        if (!job) return this.response("DENIED", 403);
        clearTimeout(job.timer); this.jobs.delete(id); job.resolve(result); return this.response("OK");
      }
      if (operator && path === "/control/status" && request.method === "GET")
        return this.response(JSON.stringify({ ...this.row(), media: this.gate?.metrics() || null }), 200, { "content-type": "application/json" });
      if (path === "/" && request.method === "GET") return this.response(page, 200, { "content-type": "text/html;charset=utf-8" });
      if (path === "/session" && request.method === "POST") {
        if (request.headers.get("origin") !== url.origin || !/^\d{1,3}$/.test(request.headers.get("content-length") || "") ||
          Number(request.headers.get("content-length")) > 128)
          return this.response("DENIED", 403);
        const text = await request.text(); if (text.length > 128) throw new Error("BODY_TOO_LARGE");
        const code = new URLSearchParams(text).get("code");
        if (!/^[A-Za-z0-9_-]{43}$/.test(code || "")) return this.response("DENIED", 403);
        await this.bind(code);
        return this.response(player, 200, { "content-type": "text/html;charset=utf-8",
          "set-cookie": `${this.cookie}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=300` });
      }
      if (path.startsWith("/ch1/") && request.method === "GET" && this.gate) {
        if (Date.now() + 10_000 >= this.grantExpires) {
          const reply = await this.rpc("authenticate", { cookie: request.headers.get("cookie") });
          await this.gate.renew(request, reply.grant); this.grantExpires = reply.grantExpires;
        }
        let response;
        await this.gate.media(request, path, async (body, info) => {
          if (info.signal.aborted) throw new Error("TRANSFER_ABORTED");
          response = this.response(body, 200, { "content-type": info.contentType });
        });
        return response;
      }
      return this.response("DENIED", 403);
    } catch { return this.response("MEDIA_UNAVAILABLE", 403); }
  }
}

const worker = {
  async fetch(request, env, context) {
    if (!/^[A-Za-z0-9_-]{16,96}$/.test(env.RUN_ID || "") || !env.QA || !env.EXPECTED_HOST ||
      !Number.isSafeInteger(Number(env.OPEN_UNTIL)) || Date.now() >= Number(env.OPEN_UNTIL) ||
      Number(env.OPEN_UNTIL) - Date.now() > CH1_LIMITS.durationMs)
      return new Response(null, { status: 403, headers });
    // There is no client-selected namespace, run, source, upstream or DO ID.
    const session = env.QA.get(env.QA.idFromName(env.RUN_ID));
    // Cloudflare requires enable_request_signal; stream.cancel alone is not a
    // reliable disconnect signal. Only the DO can verify the viewer cookie.
    if (new URL(request.url).pathname.startsWith("/ch1/") && cookiePattern.test(request.headers.get("cookie") || "")) {
      const disconnect = () => context.waitUntil(session.fetch(new Request(`https://${env.EXPECTED_HOST}/control/disconnect`, {
        method: "POST", headers: { authorization: `Bearer ${env.CONTROL_KEY}`, cookie: request.headers.get("cookie") }
      })));
      if (request.signal.aborted) { disconnect(); return new Response(null, { status: 403, headers }); }
      request.signal.addEventListener("abort", disconnect, { once: true });
    }
    return session.fetch(request);
  }
};
export default worker;
