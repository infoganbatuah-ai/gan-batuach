import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, realpathSync, readFileSync, rmSync, writeFileSync, chmodSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { request } from "node:https";
import { once } from "node:events";
import { gunzipSync } from "node:zlib";
import { CH1, CH1_LIMITS, assertCh1Delegation, createCh1MediaGate, validateCh1Playlist,
  createCh1HttpsServer } from "../../services/video-gateway/push44-ch1-private-media.mjs";
import { issueGatewayPlaybackGrant } from "../../lib/domain/gateway-device-enrollment.ts";
import { createCh1OperatorJournal } from "../../services/video-gateway/push44-ch1-operator-journal.mjs";
import { createCh1PassiveReader } from "../../services/video-gateway/push44-ch1-passive-reader.mjs";
import { createCh1DevelopmentAuthenticator } from "../../services/video-gateway/push44-ch1-development-session.mjs";
import { createCh1CookieCustody } from "../../services/video-gateway/push44-ch1-cookie-custody.mjs";

const playlist = sequence => Buffer.from(`#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:2\n#EXT-X-MEDIA-SEQUENCE:${sequence}\n#EXTINF:2,\nsegment-${sequence}.ts\n`);
function fixture(overrides = {}) {
  const secret = randomBytes(48).toString("base64url");
  const start = Date.now(); let elapsed = 0, wallOffset = 0;
  const principal = { verified: true, active: true, viewerId: CH1.viewerId,
    environment: CH1.viewerEnvironment, sessionId: "synthetic-session", deviceId: "synthetic-owner-device" };
  const delegation = { ...CH1, kind: "CH1_VIEW_ONLY_DELEGATION", approvalId: "synthetic-approval-0001",
    adminVerified: true, sourceOwnerVerified: true, revoked: false,
    purpose: "Isolated deterministic media qualification", issuedAt: start, expiresAt: start + 300_000 };
  const events = [], consumed = new Set(); let reads = 0, delivered = 0, objectSize = 1024;
  const issue = input => issueGatewayPlaybackGrant({ gateway_id: CH1.gatewayId, observer_site_id: CH1.siteId,
    camera_source_id: CH1.sourceId, gateway_stream_id: CH1.streamId, ...input }, secret);
  const options = {
    grantSecret: secret, wallNow: () => start + elapsed + wallOffset, monotonicNow: () => elapsed,
    authenticate: async () => principal,
    readDelegation: async () => delegation,
    consumeApproval: async id => { if (consumed.has(id)) return false; consumed.add(id); return true; },
    audit: event => { events.push(event); return true; },
    readMedia: async ({ pathname }) => { reads++; return { source: CH1, producedAt: start + elapsed,
      sequence: 7, body: pathname.endsWith("m3u8") ? playlist(7) : Buffer.alloc(objectSize) }; },
    ...overrides
  };
  const gate = createCh1MediaGate(options);
  return { gate, options, principal, delegation, events, issue,
    advance: ms => { elapsed += ms; }, setWallOffset: ms => { wallOffset = ms; }, size: bytes => { objectSize = bytes; },
    read: path => gate.media({}, path, async body => { delivered += body.length; }),
    count: () => ({ reads, delivered }),
    claim: () => gate.claim({}, issue()) };
}
async function opened(t, overrides) {
  const f = fixture(overrides); t.after(() => f.gate.stop()); await f.claim(); return f;
}
test("scope pins source enrollment, tenant, Site, owner and both environments", () => {
  const f = fixture(); assertCh1Delegation(f.delegation);
  for (const key of Object.keys(CH1)) assert.throws(() => assertCh1Delegation({ ...f.delegation, [key]: "wrong" }));
  for (const patch of [{ adminVerified: false }, { sourceOwnerVerified: false }, { revoked: true },
    { expiresAt: Date.now() - 1 }, { expiresAt: Date.now() + 600_000 }, { purpose: "" }])
    assert.throws(() => assertCh1Delegation({ ...f.delegation, ...patch }));
});
test("missing trusted adapters and TLS fail closed; import does not activate", () => {
  assert.throws(() => createCh1MediaGate()); assert.throws(() => createCh1HttpsServer({}));
});
test("Development session adapter requires canonical verification, SHA and approved session binding", async () => {
  const claims = { sub: CH1.viewerId, session_id: "synthetic-session", exp: Math.floor(Date.now() / 1000) + 300 };
  const token = ["synthetic", Buffer.from(JSON.stringify(claims)).toString("base64url"), "synthetic"].join(".");
  const sha = "a".repeat(40);
  const runtime = { environment: "DEVELOPMENT / INTEGRATION", backend: "LOCAL_SUPABASE", production: false, commit: sha };
  let accepted = true;
  const approved = { sessionId: claims.session_id, deviceId: "synthetic-device", revoked: false };
  const options = { expectedRuntimeSha: sha, readSessionToken: async () => token,
    readApprovedSession: async () => approved,
    fetcher: async url => {
      assert.match(url, /^http:\/\/127\.0\.0\.1:3000\/api\//);
      return new Response(JSON.stringify(url.endsWith("version") ? runtime :
        { data: { session: { active: true, profile_id: CH1.viewerId } } }), { status: accepted ? 200 : 401 });
    } };
  const auth = createCh1DevelopmentAuthenticator(options);
  assert.equal((await auth({})).viewerId, CH1.viewerId);
  accepted = false; assert.equal(await auth({}), null); accepted = true;
  runtime.production = true; assert.equal(await auth({}), null); runtime.production = false;
  approved.sessionId = "other"; assert.equal(await auth({}), null);
  assert.throws(() => createCh1DevelopmentAuthenticator({ ...options, expectedRuntimeSha: "unknown" }));
});
test("passive reader pins existing generation and source; supports actual padded HLS names", async () => {
  const temporary = realpathSync(mkdtempSync(join(tmpdir(), "push44-ch1-passive-")));
  const generation = "11111111-1111-4111-8111-111111111111";
  const directory = join(temporary, `${CH1.streamId}-${generation}`);
  try {
    mkdirSync(directory);
    const bytes = Buffer.from(playlist(7).toString().replace("segment-7.ts", "segment-000007.ts"));
    writeFileSync(join(directory, "index.m3u8"), bytes);
    writeFileSync(join(directory, "segment-000007.ts"), Buffer.from("synthetic media"));
    const read = createCh1PassiveReader({ directory, generation });
    const input = { source: CH1, pathname: "/ch1/index.m3u8", maxBytes: CH1_LIMITS.objectBytes, signal: new AbortController().signal };
    assert.equal((await read(input)).sequence, 7);
    await assert.rejects(read({ ...input, source: { ...CH1, sourceId: "other" } }));
    await assert.rejects(read({ ...input, pathname: "/ch1/../secret" }));
    symlinkSync(join(directory, "index.m3u8"), join(directory, "segment-8.ts"));
    await assert.rejects(read({ ...input, pathname: "/ch1/segment-8.ts" }));
    await assert.rejects(read({ ...input, signal: AbortSignal.abort() }));
    assert.throws(() => createCh1PassiveReader({ directory: temporary, generation }));
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});
test("protected operator journal: durable exclusive consumption, revocation and metadata-only audit", () => {
  const directory = mkdtempSync(join(tmpdir(), "push44-ch1-journal-"));
  try {
    chmodSync(directory, 0o700);
    const f = fixture(), path = join(directory, "delegation.json");
    writeFileSync(path, JSON.stringify(f.delegation), { mode: 0o600 });
    const journal = createCh1OperatorJournal(directory);
    assert.equal(journal.readDelegation().sourceId, CH1.sourceId);
    assert.equal(journal.consumeApproval(f.delegation.approvalId), true);
    assert.equal(journal.consumeApproval(f.delegation.approvalId), false);
    assert.throws(() => createCh1OperatorJournal(directory));
    assert.equal(journal.audit({ event: "TRANSFER_RESERVED", sourceId: CH1.sourceId }), true);
    assert.equal(journal.audit({ event: "TEST", token: "must-not-persist" }), false);
    assert.equal(readFileSync(join(directory, "ch1-audit.jsonl"), "utf8").includes("must-not-persist"), false);
    f.delegation.revoked = true; writeFileSync(path, JSON.stringify(f.delegation));
    assert.throws(() => journal.readDelegation());
    chmodSync(directory, 0o777); assert.throws(() => createCh1OperatorJournal(directory));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
test("anonymous, expired, revoked, wrong owner and domain sessions denied", async t => {
  for (const patch of [{ verified: false }, { active: false }, { viewerId: "wrong" },
    { environment: "PRODUCTION" }, { sessionId: "" }, { deviceId: "" }]) {
    const f = fixture(); t.after(() => f.gate.stop()); Object.assign(f.principal, patch);
    await assert.rejects(f.claim()); assert.equal(f.count().reads, 0);
  }
});
test("wrong camera/Site/Gateway/stream and malformed grant rejected by existing core", async t => {
  for (const patch of [{ camera_source_id: "wrong" }, { observer_site_id: "wrong" },
    { gateway_id: "wrong" }, { gateway_stream_id: "wrong" }]) {
    const f = fixture(); t.after(() => f.gate.stop()); await assert.rejects(f.gate.claim({}, f.issue(patch)));
  }
  const f = fixture(); await assert.rejects(f.gate.claim({}, "invalid"));
});
test("one atomic claim, one viewer, no lease reset or replay", async t => {
  const f = fixture(); t.after(() => f.gate.stop());
  const results = await Promise.allSettled([f.claim(), f.claim()]);
  assert.equal(results.filter(x => x.status === "fulfilled").length, 1);
  f.principal.deviceId = "another-device"; await assert.rejects(f.read("/ch1/index.m3u8"));
  f.principal.deviceId = "synthetic-owner-device";
  const token = f.issue(); await f.gate.renew({}, token); await assert.rejects(f.gate.renew({}, token));
  await assert.rejects(f.claim());
});
test("durable approval cannot be reused by a second process", async t => {
  const consumed = new Set(); const consumeApproval = async id => {
    if (consumed.has(id)) return false; consumed.add(id); return true;
  };
  const a = fixture({ consumeApproval }), b = fixture({ consumeApproval });
  t.after(() => { a.gate.stop(); b.gate.stop(); }); await a.claim(); await assert.rejects(b.claim());
});
test("revocation checked again after upstream read; no bytes escape", async t => {
  const f = fixture(); t.after(() => f.gate.stop());
  const g = createCh1MediaGate({ ...f.options, readMedia: async () => {
    f.principal.active = false; return { source: CH1, producedAt: Date.now(), sequence: 7, body: playlist(7) };
  } }); t.after(() => g.stop()); await g.claim({}, f.issue());
  await assert.rejects(g.media({}, "/ch1/index.m3u8", () => assert.fail("revoked delivery")));
});
test("grant expiry, delegation expiry and revocation deny access", async t => {
  const f = await opened(t); f.advance(45_001); await assert.rejects(f.read("/ch1/index.m3u8"), /GRANT_EXPIRED/);
  const g = await opened(t); g.delegation.revoked = true; await assert.rejects(g.read("/ch1/index.m3u8"));
  const h = await opened(t); h.advance(300_001); await assert.rejects(h.read("/ch1/index.m3u8"));
  const revoked = await opened(t); revoked.gate.revoke();
  await assert.rejects(revoked.read("/ch1/index.m3u8"), /GRANT_REVOKED/);
  await assert.rejects(revoked.gate.renew({}, revoked.issue()), /GRANT_REVOKED/);
});
test("300-second deadline survives renewal, reconnect and wall-clock rollback", async t => {
  const f = await opened(t); f.advance(299_999); f.setWallOffset(-299_999); await f.gate.renew({}, f.issue());
  f.advance(1); await assert.rejects(f.read("/ch1/index.m3u8"), /DURATION_EXHAUSTED/);
  assert.equal(f.gate.metrics().stopped, true);
});
test("100 MiB aggregate atomic budget counts repeats and cannot be refunded", async t => {
  const f = await opened(t); await f.read("/ch1/index.m3u8"); f.size(3 * 1024 * 1024);
  for (let i = 0; i < 33; i++) await f.read("/ch1/segment-7.ts");
  const before = f.gate.metrics().reservedBytes;
  f.size(512 * 1024);
  const results = await Promise.allSettled([f.read("/ch1/segment-7.ts"), f.read("/ch1/segment-7.ts")]);
  assert.equal(results.filter(x => x.status === "fulfilled").length, 1);
  assert.ok(before <= CH1_LIMITS.bytes); assert.ok(f.count().delivered <= CH1_LIMITS.bytes);
  assert.equal(f.gate.metrics().reason, "BYTE_LIMIT");
});
test("request cap prevents tiny-object request-cost bypass", async t => {
  const f = await opened(t); await f.read("/ch1/index.m3u8"); f.size(1);
  for (let i = 1; i < CH1_LIMITS.requests; i++) await f.read("/ch1/segment-7.ts");
  await assert.rejects(f.read("/ch1/segment-7.ts"), /REQUEST_LIMIT/);
});
test("upstream/accounting failure permanently closes the one-shot gate", async t => {
  const f = await opened(t, { readMedia: async () => { throw new Error("storage down"); } });
  await assert.rejects(f.read("/ch1/index.m3u8")); assert.equal(f.gate.metrics().stopped, true);
});
test("in-flight reads receive abort on deadline/cleanup; no delivery after stop", async t => {
  let finish, aborted = false;
  const f = await opened(t, { readMedia: ({ signal }) => new Promise(resolve => {
    finish = () => resolve({ body: playlist(7), source: CH1, producedAt: Date.now(), sequence: 7 });
    signal.addEventListener("abort", () => { aborted = true; finish(); }, { once: true });
  }) });
  const pending = f.read("/ch1/index.m3u8");
  while (!finish) await new Promise(resolve => setImmediate(resolve));
  f.gate.stop("DURATION_EXHAUSTED"); await assert.rejects(pending);
  assert.equal(aborted, true); assert.equal(f.count().delivered, 0); assert.equal(f.gate.metrics().active, 0);
});
test("isolated HTTPS contract: authenticated media only, no Range/query/internal routes", async t => {
  const temporary = mkdtempSync(join(tmpdir(), "push44-ch1-tls-"));
  const key = join(temporary, "key.pem"), cert = join(temporary, "cert.pem");
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
    "-subj", "/CN=localhost", "-keyout", key, "-out", cert], { stdio: "ignore" });
  let authenticated = true;
  const f = fixture(); const gate = createCh1MediaGate({ ...f.options,
    authenticate: async req => authenticated && (!req.headers || req.headers["x-synthetic-auth"] === "yes") ? f.principal : null });
  await gate.claim({}, f.issue());
  const server = createCh1HttpsServer({ tls: { key: readFileSync(key), cert: readFileSync(cert) }, gate });
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    rmSync(temporary, { recursive: true, force: true }); });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const get = (path, headers = {}) => new Promise((resolve, reject) => {
    const outgoing = request({ hostname: "127.0.0.1", port: server.address().port,
      path, headers, rejectUnauthorized: false }, res => {
      const chunks = []; res.on("data", x => chunks.push(x));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    }); outgoing.on("error", reject); outgoing.end();
  });
  assert.equal((await get("/ch1/index.m3u8")).status, 403);
  const auth = { "x-synthetic-auth": "yes" };
  const ok = await get("/ch1/index.m3u8", auth); assert.equal(ok.status, 200);
  assert.match(ok.headers["cache-control"], /no-store/);
  assert.equal((await get("/ch1/segment-7.ts", auth)).status, 200);
  for (const path of ["/admin", "/api/auth", "/ch1/index.m3u8?token=anything", "/ch1/../secret"])
    assert.equal((await get(path, auth)).status, 403);
  assert.equal((await get("/ch1/segment-7.ts", { ...auth, range: "bytes=0-10" })).status, 403);
  authenticated = false; assert.equal((await get("/ch1/segment-7.ts", auth)).status, 403);
});
test("interrupted delivery closes gate and retains reserved bytes", async t => {
  const f = await opened(t);
  await assert.rejects(f.gate.media({}, "/ch1/index.m3u8", async () => { throw new Error("socket closed"); }));
  assert.ok(f.gate.metrics().reservedBytes > 0); assert.equal(f.gate.metrics().stopped, true);
  await assert.rejects(f.read("/ch1/index.m3u8"));
});
test("audit failure cannot leak media; audit contains no secrets or principal tokens", async t => {
  const f = await opened(t); await f.read("/ch1/index.m3u8");
  assert.equal(JSON.stringify(f.events).includes("synthetic-session"), false);
  const secretKeys = /token|secret|credential|grant|password/i;
  assert.equal(f.events.some(x => Object.keys(x).some(k => secretKeys.test(k))), false);
  const g = fixture({ audit: () => false }); t.after(() => g.gate.stop()); await assert.rejects(g.claim());
});
test("stale, future, oversized and mis-scoped media rejected", async t => {
  for (const patch of [{ producedAt: Date.now() - 60_000 }, { producedAt: Date.now() + 60_000 },
    { source: { ...CH1, sourceId: "wrong" } }, { body: Buffer.alloc(CH1_LIMITS.objectBytes + 1) }]) {
    const f = fixture(); const g = createCh1MediaGate({ ...f.options,
      readMedia: async () => ({ source: CH1, producedAt: Date.now(), sequence: 7, body: playlist(7), ...patch }) });
    t.after(() => g.stop()); await g.claim({}, f.issue());
    await assert.rejects(g.media({}, "/ch1/index.m3u8", () => assert.fail("invalid delivery")));
  }
});
test("playlist ordering, non-regression, continuity and credential-free relative paths", () => {
  assert.match(validateCh1Playlist(playlist(7)).toString(), /\/ch1\/segment-7.ts/);
  assert.throws(() => validateCh1Playlist(playlist(6), 7));
  for (const replacement of ["https://evil.test/segment.ts", "../segment.ts", "segment-8.ts", "segment-7.ts?token=x"])
    assert.throws(() => validateCh1Playlist(Buffer.from(playlist(7).toString().replace("segment-7.ts", replacement))));
  for (const tag of ["#EXT-X-KEY:URI=evil", "#EXT-X-MAP:URI=evil", "#EXT-X-ENDLIST"])
    assert.throws(() => validateCh1Playlist(Buffer.concat([playlist(7), Buffer.from(tag)])));
});
test("client reconnect preserves accounting and unadvertised segments are denied", async t => {
  const f = await opened(t); await assert.rejects(f.read("/ch1/segment-7.ts"));
  await f.read("/ch1/index.m3u8"); await f.read("/ch1/segment-7.ts");
  const before = f.gate.metrics().reservedBytes;
  await f.read("/ch1/index.m3u8"); await f.read("/ch1/segment-7.ts");
  assert.ok(f.gate.metrics().reservedBytes > before); await assert.rejects(f.read("/ch1/segment-8.ts"));
  f.gate.stop(); assert.equal(f.gate.metrics().active, 0);
});

test("complete isolated owner/session/delegation/cookie/TLS/passive-media contract", async t => {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), "push44-ch1-e2e-")));
  const generation = "22222222-2222-4222-8222-222222222222";
  const mediaRoot = join(directory, `${CH1.streamId}-${generation}`);
  mkdirSync(mediaRoot); chmodSync(directory, 0o700);
  const sample = JSON.parse(readFileSync(new URL("./fixtures/push44-ch1-synthetic-ts.json", import.meta.url), "utf8"));
  assert.equal(sample.kind, "SYNTHETIC_BLUE_COLOR_NOT_CAMERA");
  const synthetic = Buffer.from(sample.base64, "base64");
  assert.equal(synthetic[0], 0x47); assert.equal(synthetic.length % 188, 0);
  writeFileSync(join(mediaRoot, "index.m3u8"), playlist(7));
  writeFileSync(join(mediaRoot, "segment-7.ts"), synthetic);
  const f = fixture(), delegationFile = join(directory, "delegation.json");
  writeFileSync(delegationFile, JSON.stringify(f.delegation), { mode: 0o600 });
  const journal = createCh1OperatorJournal(directory);
  let serverAccepted = true;
  const claims = { sub: CH1.viewerId, session_id: "synthetic-session", exp: Math.floor(Date.now() / 1000) + 300 };
  const token = ["synthetic", Buffer.from(JSON.stringify(claims)).toString("base64url"), "synthetic"].join(".");
  const sha = "b".repeat(40), approved = { sessionId: claims.session_id, deviceId: "synthetic-phone", revoked: false };
  const verifySession = createCh1DevelopmentAuthenticator({ expectedRuntimeSha: sha, readSessionToken: async value => value,
    readApprovedSession: async () => approved,
    fetcher: async url => new Response(JSON.stringify(url.endsWith("version") ?
      { environment: "DEVELOPMENT / INTEGRATION", backend: "LOCAL_SUPABASE", production: false, commit: sha } :
      { data: { session: { active: true, profile_id: CH1.viewerId } } }), { status: serverAccepted ? 200 : 401 }) });
  let elapsed = 0;
  const custody = createCh1CookieCustody({ verifySession, now: () => f.delegation.issuedAt + elapsed });
  const setCookie = await custody.bind(token), cookie = setCookie.split(";")[0];
  assert.match(setCookie, /Secure; HttpOnly; SameSite=Strict; Max-Age=300/);
  await assert.rejects(custody.bind(token));
  const gate = createCh1MediaGate({ ...f.options, ...journal, authenticate: custody.authenticate,
    readMedia: createCh1PassiveReader({ directory: mediaRoot, generation }) });
  await gate.claim({ headers: { cookie } }, f.issue());
  const key = join(directory, "key.pem"), cert = join(directory, "cert.pem");
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
    "-subj", "/CN=localhost", "-keyout", key, "-out", cert], { stdio: "ignore" });
  const server = createCh1HttpsServer({ tls: { key: readFileSync(key), cert: readFileSync(cert) }, gate });
  t.after(async () => { custody.revoke(); gate.stop(); server.closeAllConnections();
    await new Promise(resolve => server.close(resolve)); rmSync(directory, { recursive: true, force: true }); });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  const get = (path, value = cookie) => new Promise((resolve, reject) => {
    const outgoing = request({ hostname: "127.0.0.1", port: server.address().port, path,
      rejectUnauthorized: false, headers: { cookie: value, "accept-encoding": "gzip" } }, res => {
      const chunks = []; res.on("data", x => chunks.push(x));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    }); outgoing.on("error", reject); outgoing.end();
  });
  assert.equal((await get("/ch1/index.m3u8", "")).status, 403);
  assert.equal((await get("/ch1/index.m3u8", `${cookie}; ${cookie}`)).status, 403);
  const manifest = await get("/ch1/index.m3u8"); assert.equal(manifest.status, 200);
  assert.equal(manifest.headers["content-encoding"], "gzip");
  assert.match(gunzipSync(manifest.body).toString(), /\/ch1\/segment-7.ts/);
  assert.equal(gunzipSync(manifest.body).includes(Buffer.from(token)), false);
  const segment = await get("/ch1/segment-7.ts"); assert.equal(segment.status, 200);
  assert.equal(segment.headers["content-type"], "video/mp2t"); assert.deepEqual(segment.body, synthetic);
  const before = gate.metrics().reservedBytes; await get("/ch1/segment-7.ts");
  assert.ok(gate.metrics().reservedBytes > before);
  assert.equal(gate.metrics().reservedBytes, manifest.body.length + synthetic.length * 2);
  serverAccepted = false; assert.equal((await get("/ch1/segment-7.ts")).status, 403); serverAccepted = true;
  const revoked = { ...f.delegation, revoked: true }; writeFileSync(delegationFile, JSON.stringify(revoked));
  assert.equal((await get("/ch1/segment-7.ts")).status, 403);
  writeFileSync(delegationFile, JSON.stringify(f.delegation)); elapsed = 300_000;
  assert.equal((await get("/ch1/segment-7.ts")).status, 403);
  gate.revoke(); assert.equal(gate.metrics().active, 0);
  const audit = readFileSync(join(directory, "ch1-audit.jsonl"), "utf8");
  assert.equal(audit.includes(token), false); assert.equal(audit.includes(cookie), false);
  assert.match(audit, /TRANSFER_RESERVED/); assert.match(audit, /GRANT_REVOKED/);
});
