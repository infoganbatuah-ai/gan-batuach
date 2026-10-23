import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { randomBytes } from "node:crypto";
import worker, { SyntheticQaSession } from "../../services/video-gateway/push44-synthetic-edge.mjs";
import { CH1, SYNTHETIC_QA, createSyntheticQaMediaGate, assertSyntheticQaDelegation } from "../../services/video-gateway/push44-ch1-private-media.mjs";
import { issueGatewayPlaybackGrant } from "../../lib/domain/gateway-device-enrollment.ts";
import { createSyntheticQaControl, SYNTHETIC_EDGE_ORIGIN } from "../../services/video-gateway/push44-synthetic-control.mjs";

function fixture(t) {
  const db = new DatabaseSync(":memory:"); t.after(() => db.close());
  const objects = new Map();
  const env = { RUN_ID: "synthetic-approval-20261023", EXPECTED_HOST: "synthetic.example.invalid",
    CONTROL_KEY: randomBytes(48).toString("base64url"), GRANT_SECRET: randomBytes(48).toString("base64url"),
    MEDIA: { put: async (key, bytes) => { objects.set(key, bytes); }, get: async key => {
      const bytes = objects.get(key); return bytes ? { size: bytes.length, arrayBuffer: async () => bytes } : null;
    } } };
  const state = { storage: { sql: { exec: (sql, ...args) => ({ toArray: () => db.prepare(sql).all(...args) }) },
    setAlarm: async () => {} } };
  // Cloudflare sql.exec executes immediately, including statements whose cursor
  // is never consumed. Preserve that behavior in the isolated SQLite adapter.
  state.storage.sql.exec = (sql, ...args) => { const rows = db.prepare(sql).all(...args); return { toArray: () => rows }; };
  const edge = new SyntheticQaSession(state, env); t.after(() => edge.stop());
  const request = (path, init = {}) => new Request(`https://${env.EXPECTED_HOST}${path}`, init);
  const operator = (path, init = {}) => edge.fetch(request(`/control/${path}`, {
    ...init, headers: { authorization: `Bearer ${env.CONTROL_KEY}`, ...init.headers }
  }));
  return { edge, env, state, db, objects, request, operator };
}
test("synthetic scope never accepts Home source/Site/enrollment or a caller-selected scope", () => {
  const d = { ...SYNTHETIC_QA, kind: "SYNTHETIC_QA_VIEW_ONLY", adminVerified: true, sourceOwnerVerified: true,
    revoked: false, approvalId: "synthetic-only-approval", purpose: "Synthetic-only independent QA", issuedAt: Date.now(), expiresAt: Date.now() + 1000 };
  assertSyntheticQaDelegation(d);
  for (const key of ["sourceId", "siteId", "tenantId", "gatewayId", "enrollmentId", "streamId", "sourceEnvironment"])
    assert.throws(() => assertSyntheticQaDelegation({ ...d, [key]: CH1[key] }));
});
test("edge outer handler rejects absent bindings, expired window and no client-selected DO", async () => {
  assert.equal((await worker.fetch(new Request("https://qa.invalid"), {})).status, 403);
  assert.equal((await worker.fetch(new Request("https://qa.invalid"), { RUN_ID: "synthetic-approval-001", EXPECTED_HOST: "qa.invalid", OPEN_UNTIL: 0, QA: {} })).status, 403);
});

test("external request abort propagates bounded cleanup to the single private DO", async () => {
  const controller = new AbortController(), cookie = `__Host-DOCH1QA=${randomBytes(32).toString("base64url")}`;
  const calls = [], pending = [];
  const env = { RUN_ID: "synthetic-approval-001", EXPECTED_HOST: "synthetic.example.invalid", OPEN_UNTIL: Date.now() + 1000,
    CONTROL_KEY: randomBytes(48).toString("base64url"), QA: { idFromName: id => id, get: () => ({ fetch: async request => {
      calls.push(request); return new Response("synthetic");
    } }) } };
  const response = await worker.fetch(new Request(`https://${env.EXPECTED_HOST}/ch1/index.m3u8`, {
    headers: { cookie }, signal: controller.signal
  }), env, { waitUntil: promise => pending.push(promise) });
  assert.equal(response.status, 200); controller.abort(); await Promise.all(pending);
  assert.equal(calls.length, 2); assert.equal(new URL(calls[1].url).pathname, "/control/disconnect");
  assert.equal(calls[1].headers.get("cookie"), cookie);
  assert.equal(calls[1].headers.get("authorization"), `Bearer ${env.CONTROL_KEY}`);
});
test("private synthetic R2 origin has no Home connection; no anonymous media/control access", async t => {
  const f = fixture(t);
  assert.equal((await f.edge.fetch(f.request("/control/prepare", { method: "POST" }))).status, 403);
  assert.equal(f.objects.size, 0);
  const result = await f.operator("prepare", { method: "POST" }); assert.equal(result.status, 200);
  assert.equal(f.objects.size, 1); assert(f.objects.has("synthetic-motion.ts"));
  assert.equal((await f.operator("prepare", { method: "POST" })).status, 403);
  for (const path of ["/ch1/index.m3u8", "/ch1/segment-0.ts", "/api/internal", `/sources/${CH1.sourceId}`])
    assert.equal((await f.edge.fetch(f.request(path))).status, 403);
});

test("outbound host control uses canonical session verification, never sends a JWT to Cloudflare", async () => {
  const now = Date.now(), sha = "b".repeat(40), code = randomBytes(32).toString("base64url");
  const claims = { sub: SYNTHETIC_QA.viewerId, session_id: "verified-development-session", exp: Math.floor(now / 1000) + 300 };
  const token = ["synthetic", Buffer.from(JSON.stringify(claims)).toString("base64url"), "synthetic"].join(".");
  let job = { id: "1", type: "bind", code }, reply, valid = true;
  const options = { origin: SYNTHETIC_EDGE_ORIGIN, controlKey: randomBytes(48).toString("base64url"),
    grantSecret: randomBytes(48).toString("base64url"), bindCode: code, accessToken: token,
    expectedRuntimeSha: sha, sessionId: claims.session_id, deviceId: "operator-confirmed-phone",
    fetcher: async (url, init) => {
      if (url.startsWith(SYNTHETIC_EDGE_ORIGIN)) {
        assert(!JSON.stringify(init).includes(token));
        if (url.endsWith("/poll")) return new Response(JSON.stringify([job]));
        if (url.endsWith("/respond")) reply = JSON.parse(init.body);
        return new Response("OK");
      }
      assert.match(url, /^http:\/\/127\.0\.0\.1:3000\/api\//);
      return new Response(JSON.stringify(url.endsWith("/version") ?
        { environment: "DEVELOPMENT / INTEGRATION", backend: "LOCAL_SUPABASE", production: false, commit: sha } :
        { data: { session: { active: valid, profile_id: SYNTHETIC_QA.viewerId } } }));
    } };
  const host = createSyntheticQaControl(options);
  await host.step(); assert(reply.result.cookie); assert(reply.result.principal.verified);
  job = { id: "2", type: "authenticate", cookie: reply.result.cookie };
  await host.step(); assert(reply.result.principal);
  valid = false; await host.step(); assert.deepEqual(reply.result, {});
  await host.stop(); await assert.rejects(host.step(), /CONTROL_CLOSED/);
  assert.throws(() => createSyntheticQaControl({ ...options, origin: "https://gan-batuach.vercel.app" }));
});

test("control transport errors fail closed and return no credential-bearing error", async () => {
  const options = { origin: SYNTHETIC_EDGE_ORIGIN, controlKey: randomBytes(48).toString("base64url"),
    grantSecret: randomBytes(48).toString("base64url"), bindCode: randomBytes(32).toString("base64url"),
    accessToken: "synthetic-memory-only-token".repeat(3), expectedRuntimeSha: "b".repeat(40),
    sessionId: "verified-session", deviceId: "owner-phone", fetcher: async () => { throw new Error("sensitive provider failure"); } };
  const host = createSyntheticQaControl(options);
  await assert.rejects(host.step(), error => error.message === "SYNTHETIC_CONTROL_FAILED_CLOSED");
  await assert.rejects(host.step(), /CONTROL_CLOSED/);
});
test("untrusted host, mixed HTTP, query/Range and oversized/unbounded POST rejected", async t => {
  const f = fixture(t);
  for (const request of [new Request("https://other.invalid/"), new Request(`http://${f.env.EXPECTED_HOST}/`),
    f.request("/?token=x"), f.request("/", { headers: { range: "bytes=0-1" } }),
    f.request("/session", { method: "POST", headers: { origin: `https://${f.env.EXPECTED_HOST}` }, body: "code=x" })])
    assert.equal((await f.edge.fetch(request)).status, 403);
});
test("durable counters survive object reconstruction; consumed run cannot reopen", async t => {
  const f = fixture(t);
  await f.edge.fetch(f.request("/"));
  const bytes = f.edge.row().bytes; assert(bytes > 0);
  f.db.prepare("UPDATE qa_run SET consumed=1 WHERE id=1").run();
  const restarted = new SyntheticQaSession(f.state, f.env); t.after(() => restarted.stop());
  assert.equal((await restarted.fetch(f.request("/"))).status, 403);
  assert(restarted.row().bytes > bytes);
});
test("edge-wide 100MiB stops even non-media routes", async t => {
  const f = fixture(t);
  f.db.prepare("UPDATE qa_run SET bytes=? WHERE id=1").run(100 * 1024 * 1024 - 2);
  assert.equal((await f.edge.fetch(f.request("/"))).status, 403); assert(f.edge.closed);
  assert(f.edge.row().bytes <= 100 * 1024 * 1024);
});
test("accounting write failure cannot return an unaccounted response", async t => {
  const f = fixture(t), execute = f.state.storage.sql.exec;
  f.state.storage.sql.exec = (sql, ...args) => {
    if (sql.startsWith("UPDATE qa_run SET bytes=")) throw new Error("ACCOUNTING_UNAVAILABLE");
    return execute(sql, ...args);
  };
  await assert.rejects(f.edge.fetch(f.request("/")), /ACCOUNTING_UNAVAILABLE/);
  assert.equal(f.edge.row().bytes, 0); assert.equal(f.objects.size, 0);
});
test("total-request cap fails closed before an extra media or control request", async t => {
  const f = fixture(t);
  f.db.prepare("UPDATE qa_run SET requests=6000 WHERE id=1").run();
  assert.equal((await f.edge.fetch(f.request("/"))).status, 403); assert(f.edge.closed);
});
test("absolute persisted deadline stops control/player and prevents restart reopening", async t => {
  const f = fixture(t);
  f.db.prepare("UPDATE qa_run SET consumed=1,deadline=? WHERE id=1").run(Date.now() - 1);
  assert.equal((await f.edge.fetch(f.request("/"))).status, 403); assert(f.edge.closed);
});
test("explicit revocation rejects future access without deleting recovery evidence", async t => {
  const f = fixture(t);
  assert.equal((await f.operator("revoke", { method: "POST" })).status, 200);
  assert.equal((await f.edge.fetch(f.request("/"))).status, 403);
  assert(f.edge.row().requests >= 2);
});
test("synthetic gate uses existing grant algorithm and rejects real Home grant", async t => {
  const secret = randomBytes(48).toString("base64url"), now = Date.now();
  const gate = createSyntheticQaMediaGate({ grantSecret: secret,
    authenticate: async () => ({ verified: true, active: true, viewerId: SYNTHETIC_QA.viewerId,
      environment: "LOCAL_SUPABASE", sessionId: "synthetic-session", deviceId: "synthetic-device" }),
    readDelegation: async () => ({ ...SYNTHETIC_QA, kind: "SYNTHETIC_QA_VIEW_ONLY", adminVerified: true,
      sourceOwnerVerified: true, revoked: false, purpose: "Isolated synthetic gate qualification", approvalId: "synthetic-only-approval", issuedAt: now, expiresAt: now + 300000 }),
    consumeApproval: async () => true, audit: () => true, readMedia: async () => { throw new Error("MUST_NOT_READ"); }
  }); t.after(() => gate.stop());
  const grant = issueGatewayPlaybackGrant({ gateway_id: CH1.gatewayId, observer_site_id: CH1.siteId,
    camera_source_id: CH1.sourceId, gateway_stream_id: CH1.streamId }, secret);
  await assert.rejects(gate.claim({}, grant), /GRANT_DENIED/);
});

test("complete isolated outbound-control/cookie/existing-gate/private-R2 flow, then session revocation", async t => {
  const f = fixture(t), code = randomBytes(32).toString("base64url"), cookie = `__Host-DOCH1QA=${randomBytes(32).toString("base64url")}`;
  let active = true, done = false;
  const principal = { verified: true, active: true, viewerId: SYNTHETIC_QA.viewerId,
    environment: "LOCAL_SUPABASE", sessionId: "synthetic-verified-session", deviceId: "synthetic-owner-phone" };
  const host = (async () => {
    while (!done) {
      const jobs = await (await f.operator("poll")).json();
      for (const job of jobs) {
        const allowed = active && (job.type === "bind" ? job.code === code : job.cookie === cookie);
        const grant = issueGatewayPlaybackGrant({ gateway_id: SYNTHETIC_QA.gatewayId, observer_site_id: SYNTHETIC_QA.siteId,
          camera_source_id: SYNTHETIC_QA.sourceId, gateway_stream_id: SYNTHETIC_QA.streamId }, f.env.GRANT_SECRET);
        const body = JSON.stringify({ id: job.id, result: allowed ? { cookie, principal, grant, grantExpires: Date.now() + 45000 } : {} });
        await f.operator("respond", { method: "POST", headers: { "content-length": String(Buffer.byteLength(body)) }, body });
      }
      await new Promise(resolve => setTimeout(resolve, 1));
    }
  })();
  try {
    await f.operator("prepare", { method: "POST" });
    const body = `code=${code}`;
    const login = await f.edge.fetch(f.request("/session", { method: "POST", body,
      headers: { origin: `https://${f.env.EXPECTED_HOST}`, "content-length": String(body.length) } }));
    assert.equal(login.status, 200); assert.match(login.headers.get("set-cookie"), /Secure; HttpOnly; SameSite=Strict/);
    assert.match(await login.text(), /סינתטי/);
    assert.equal((await f.edge.fetch(f.request("/session", { method: "POST", body,
      headers: { origin: `https://${f.env.EXPECTED_HOST}`, "content-length": String(body.length) } }))).status, 403);
    const read = path => f.edge.fetch(f.request(path, { headers: { cookie } }));
    const playlist = await read("/ch1/index.m3u8"); assert.equal(playlist.status, 200);
    const segmentPath = (await playlist.text()).split("\n").find(line => line.startsWith("/ch1/segment-"));
    const segment = await read(segmentPath); assert.equal(segment.status, 200);
    assert.equal(segment.headers.get("x-qa-source"), "SYNTHETIC_NOT_CH1");
    assert((await segment.arrayBuffer()).byteLength > 1024);
    assert(f.edge.row().bytes > f.edge.gate.metrics().submittedBytes);
    active = false;
    assert.equal((await read(segmentPath)).status, 403);
    assert.equal((await read(`/sources/${CH1.sourceId}`)).status, 403);
    assert(f.db.prepare("SELECT COUNT(*) AS n FROM qa_audit").get().n > 0);
  } finally { done = true; await host; }
});
