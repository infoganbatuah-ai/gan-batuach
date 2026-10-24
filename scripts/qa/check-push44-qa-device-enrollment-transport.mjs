import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { generateKeyPairSync, sign } from "node:crypto";
import { request as httpRequest } from "node:http";
import { createPush44QaDeviceProof, qaDeviceKeyId } from "../../services/video-gateway/push44-qa-device-proof.mjs";
import { createPush44QaEnrollmentApproval } from "../../services/video-gateway/push44-qa-enrollment-approval.mjs";
import { createPush44QaDeviceTransport, createPush44QaLocalOperator } from "../../services/video-gateway/push44-qa-device-transport.mjs";
import { createPush44QaOwnerAction } from "../../services/video-gateway/push44-qa-owner-action.mjs";
import { createPush44QaDevelopmentOwnerReader } from "../../services/video-gateway/push44-qa-development-owner.mjs";
import { SYNTHETIC_QA } from "../../services/video-gateway/push44-ch1-private-media.mjs";

function key() {
  const pair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = pair.publicKey.export({ format: "jwk" });
  const raw = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, "base64url"), Buffer.from(jwk.y, "base64url")]);
  return { publicKey: raw.toString("base64url"),
    sign: payload => sign("sha256", Buffer.from(payload, "base64url"), pair.privateKey).toString("base64url") };
}

function fixture(t) {
  const db = new DatabaseSync(":memory:"); t.after(() => db.close());
  const first = key(), second = key(); let clock = Date.now(), sessionActive = true;
  let permitted = true, tenant = SYNTHETIC_QA.tenantId;
  const session = () => ({ verified: true, active: sessionActive,
    environment: "LOCAL_SUPABASE", viewerId: SYNTHETIC_QA.viewerId,
    sessionId: "synthetic-development-session-0001" });
  const delegation = () => ({ ...SYNTHETIC_QA, tenantId: tenant,
    kind: "SYNTHETIC_QA_VIEW_ONLY", adminVerified: true, sourceOwnerVerified: true,
    revoked: false, approvalId: "synthetic-media-approval-0001",
    purpose: "Isolated synthetic device qualification", issuedAt: clock - 1000, expiresAt: clock + 250_000 });
  const approvals = createPush44QaEnrollmentApproval({ database: db,
    authenticate: async () => session(), readDelegation: async () => delegation(),
    verifyOwnerAction: async ({ ownerAction }) => permitted && ownerAction === "host-approved-owner-action",
    now: () => clock });
  const proof = createPush44QaDeviceProof({ database: db, authenticate: async () => session(),
    readDelegation: async () => delegation(),
    readApprovedEnrollment: approvals.readApprovedEnrollment,
    consumeApproval: approvals.consumeApproval,
    authorizeOwnerAction: async () => permitted, now: () => clock });
  const transport = createPush44QaDeviceTransport({ proof, database: db, authenticate: async request =>
    request.headers.authorization === `Bearer ${"synthetic.".repeat(8)}token` ? session() : null });
  t.after(async () => transport.close());
  return { db, first, second, approvals, proof, transport, session,
    setPermit: value => { permitted = value; }, setSession: value => { sessionActive = value; },
    setTenant: value => { tenant = value; }, advance: ms => { clock += ms; } };
}

const approve = (f, device = f.first) => f.approvals.authorize({ context: {},
  keyId: qaDeviceKeyId(device.publicKey), purpose: "Approved exact owner QA installation",
  ownerAction: "host-approved-owner-action" });

test("trusted owner action creates one durable 60-second approval; second pending device denied", async t => {
  const f = fixture(t);
  f.setPermit(false);
  await assert.rejects(approve(f), /QA_ENROLLMENT_APPROVAL_DENIED/);
  f.setPermit(true);
  const approved = await approve(f);
  assert.equal(approved.expiresAt - Date.now() < 61_000, true);
  await assert.rejects(approve(f, f.second), /QA_ENROLLMENT_APPROVAL_DENIED/);
  const record = await f.approvals.readApprovedEnrollment();
  assert.equal(record.keyId, qaDeviceKeyId(f.first.publicKey));
  assert.equal(record.siteId, SYNTHETIC_QA.siteId);
  assert.equal(record.tenantId, SYNTHETIC_QA.tenantId);
  assert.equal(await f.approvals.consumeApproval(approved.approvalId), true);
  assert.equal(await f.approvals.consumeApproval(approved.approvalId), false);
  assert.equal(await f.approvals.readApprovedEnrollment(), null);
});

test("expiry, wrong tenant, session revocation and owner revocation fail closed", async t => {
  const f = fixture(t); await approve(f);
  f.setTenant("wrong-tenant");
  await assert.rejects(approve(f), /DELEGATION_DENIED/);
  f.setTenant(SYNTHETIC_QA.tenantId);
  f.setSession(false);
  await assert.rejects(approve(f), /QA_ENROLLMENT_APPROVAL_DENIED/);
  f.setSession(true);
  f.advance(60_001);
  assert.equal(await f.approvals.readApprovedEnrollment(), null);
  const next = await approve(f);
  assert(next.approvalId);
  await f.approvals.revoke({ context: {}, purpose: "Owner revokes pending enrollment", ownerAction: "host-approved-owner-action" });
  assert.equal(await f.approvals.readApprovedEnrollment(), null);
});

test("loopback-only transport completes enrollment/proof; copied token without key and replay denied", async t => {
  const f = fixture(t); await approve(f);
  const origin = await f.transport.listen();
  const send = async (path, body, headers = {}) => {
    const response = await fetch(`${origin}${path}`, { method: "POST", headers: {
      authorization: `Bearer ${"synthetic.".repeat(8)}token`, "content-type": "application/json", ...headers },
      body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  const enrollChallenge = await send("/qa-device/challenge", { operation: "ENROLL", publicKey: f.first.publicKey,
    method: "POST", path: "/qa-device/enroll" });
  assert.equal(enrollChallenge.status, 200);
  const enrolled = await send("/qa-device/enroll", { publicKey: f.first.publicKey,
    challengeId: enrollChallenge.body.challengeId, signature: f.first.sign(enrollChallenge.body.payload) });
  assert.equal(enrolled.status, 200);
  assert.equal((await send("/qa-device/enroll", { publicKey: f.first.publicKey,
    challengeId: enrollChallenge.body.challengeId, signature: f.first.sign(enrollChallenge.body.payload) })).status, 403);
  const challenge = await send("/qa-device/challenge", { operation: "ACCESS", method: "GET", path: "/ch1/index.m3u8" });
  assert.equal(challenge.status, 200);
  assert.equal((await send("/qa-device/prove", { challengeId: challenge.body.challengeId,
    signature: f.second.sign(challenge.body.payload), method: "GET", path: "/ch1/index.m3u8" })).status, 403);
  assert.equal((await send("/qa-device/prove", { challengeId: challenge.body.challengeId,
    signature: f.first.sign(challenge.body.payload), method: "GET", path: "/ch1/index.m3u8" })).status, 403);
  const next = await send("/qa-device/challenge", { operation: "ACCESS", method: "GET", path: "/ch1/index.m3u8" });
  assert.equal((await send("/qa-device/prove", { challengeId: next.body.challengeId,
    signature: f.first.sign(next.body.payload), method: "GET", path: "/ch1/index.m3u8" })).status, 200);
  assert.equal((await send("/qa-device/prove", { challengeId: next.body.challengeId,
    signature: f.first.sign(next.body.payload), method: "GET", path: "/ch1/index.m3u8" })).status, 403);
  assert.equal((await send("/qa-device/challenge", { operation: "ACCESS", method: "GET",
    path: "/ch1/index.m3u8" }, { origin: "https://untrusted.invalid" })).status, 403);
  assert.equal((await send("/qa-device/challenge", { operation: "ACCESS", method: "GET",
    path: "/ch1/index.m3u8" }, { authorization: "Bearer invalid" })).status, 403);
  assert.equal((await send("/qa-device/challenge", { operation: "ACCESS", method: "GET",
    path: "/ch1/index.m3u8", publicKey: f.second.publicKey })).status, 403);
  assert.equal((await send("/qa-device/challenge", { operation: "ACCESS", method: "GET",
    path: "/sources/real-home-camera" })).status, 403);
  f.setSession(false);
  assert.equal((await send("/qa-device/challenge", { operation: "ACCESS", method: "GET",
    path: "/ch1/index.m3u8" })).status, 403);
  f.setSession(true);
  f.setTenant("wrong-tenant");
  assert.equal((await send("/qa-device/challenge", { operation: "ACCESS", method: "GET",
    path: "/ch1/index.m3u8" })).status, 403);
  f.setTenant(SYNTHETIC_QA.tenantId);
  assert.equal((await send("/qa-device/revoke", { keyId: qaDeviceKeyId(f.first.publicKey),
    purpose: "Owner revokes this QA installation" })).status, 200);
  assert.equal((await send("/qa-device/challenge", { operation: "ACCESS", method: "GET",
    path: "/ch1/index.m3u8" })).status, 403);
  const output = JSON.stringify(f.db.prepare("SELECT * FROM push44_qa_enrollment_audit").all());
  assert(!output.includes(f.first.publicKey));
  assert(!output.includes("synthetic-development-session"));
  const transportAudit = JSON.stringify(f.db.prepare("SELECT * FROM push44_qa_transport_audit").all());
  assert(transportAudit.includes("ACCEPTED") && transportAudit.includes("DENIED"));
  assert(!transportAudit.includes(f.first.publicKey) && !transportAudit.includes("Bearer"));
  f.db.prepare("UPDATE push44_qa_transport_limit SET attempts=1000 WHERE id=1").run();
  assert.equal((await send("/qa-device/challenge", { operation: "ACCESS", method: "GET",
    path: "/ch1/index.m3u8" })).status, 403);
});

test("operator composes canonical LOCAL_SUPABASE session verification and fails closed on runtime drift", async t => {
  const db = new DatabaseSync(":memory:"); t.after(() => db.close());
  const sha = "f".repeat(40), sessionId = "synthetic-development-session-0001";
  const ownerProfileId = "00000000-0000-4000-8000-000000000044";
  const ownerSessionId = "separate-owner-session-00000001";
  const token = ["synthetic", Buffer.from(JSON.stringify({ sub: SYNTHETIC_QA.viewerId,
    session_id: sessionId, exp: Math.floor(Date.now() / 1000) + 300 })).toString("base64url"), "synthetic"].join(".");
  let runtimeOk = true, sessionOk = true;
  let ownerPresent = true;
  const operator = createPush44QaLocalOperator({ database: db, expectedRuntimeSha: sha,
    expectedOwnerProfileId: ownerProfileId,
    readSessionToken: async context => context.headers.authorization?.slice(7),
    readApprovedSession: async () => ({ sessionId, deviceId: "owner-iphone-approved-0001", revoked: false }),
    readDelegation: async () => ({ ...SYNTHETIC_QA, kind: "SYNTHETIC_QA_VIEW_ONLY",
      adminVerified: true, sourceOwnerVerified: true, revoked: false,
      approvalId: "synthetic-media-approval-0001", purpose: "Approved exact synthetic QA",
      issuedAt: Date.now() - 1000, expiresAt: Date.now() + 250_000 }),
    readOwnerAuthorization: async () => ({ verified: true, active: true, owner: true,
      environment: SYNTHETIC_QA.viewerEnvironment, profileId: ownerProfileId,
      sessionId: ownerSessionId, tenantId: SYNTHETIC_QA.tenantId, siteId: SYNTHETIC_QA.siteId,
      expiresAt: Date.now() + 30_000 }),
    confirmHostPresence: async () => ownerPresent,
    fetcher: async url => {
      assert.match(url, /^http:\/\/127\.0\.0\.1:3000\/api\//);
      if (url.endsWith("/version")) return new Response(JSON.stringify({ environment: "DEVELOPMENT / INTEGRATION",
        backend: "LOCAL_SUPABASE", production: false, commit: runtimeOk ? sha : "a".repeat(40) }));
      return new Response(JSON.stringify({ data: { session: { active: sessionOk,
        profile_id: SYNTHETIC_QA.viewerId } } }), { status: sessionOk ? 200 : 401 });
    } });
  t.after(async () => operator.close());
  const context = { headers: { authorization: `Bearer ${token}` } };
  const device = key();
  ownerPresent = false;
  await assert.rejects(operator.authorizeEnrollment({ context, keyId: qaDeviceKeyId(device.publicKey),
    purpose: "Approved exact owner QA installation" }), /QA_OWNER_ACTION_DENIED/);
  ownerPresent = true;
  await operator.authorizeEnrollment({ context, keyId: qaDeviceKeyId(device.publicKey),
    purpose: "Approved exact owner QA installation" });
  const origin = await operator.listen();
  const challenge = () => fetch(`${origin}/qa-device/challenge`, { method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ operation: "ENROLL", publicKey: device.publicKey,
      method: "POST", path: "/qa-device/enroll" }) });
  assert.equal((await challenge()).status, 200);
  runtimeOk = false;
  assert.equal((await challenge()).status, 403);
  runtimeOk = true; sessionOk = false;
  assert.equal((await challenge()).status, 403);
});

test("host action requires owner record and fresh presence, rejects caller assertions", async () => {
  let owner = true, present = true, session = "separate-owner-session-00000001";
  let siteId = SYNTHETIC_QA.siteId, expiresAt = Date.now() + 30_000;
  const ownerProfileId = "00000000-0000-4000-8000-000000000044";
  const now = Date.now();
  const principal = { verified: true, active: true, environment: SYNTHETIC_QA.viewerEnvironment,
    viewerId: SYNTHETIC_QA.viewerId, sessionId: "synthetic-development-session-0001" };
  const check = createPush44QaOwnerAction({ now: () => now, expectedOwnerProfileId: ownerProfileId,
    readOwnerAuthorization: async () => ({ verified: true, active: true, owner,
      environment: SYNTHETIC_QA.viewerEnvironment, profileId: ownerProfileId,
      sessionId: session, tenantId: SYNTHETIC_QA.tenantId, siteId,
      expiresAt }),
    confirmHostPresence: async () => present });
  const action = { context: {}, principal, keyId: "a".repeat(43),
    purpose: "Approve one synthetic QA installation", operation: "AUTHORIZE_ENROLLMENT" };
  assert.equal(await check(action), true);
  await assert.rejects(check({ ...action, ownerAction: "caller-approved" }), /QA_OWNER_ACTION_DENIED/);
  owner = false;
  await assert.rejects(check(action), /QA_OWNER_ACTION_DENIED/);
  owner = true; present = false;
  await assert.rejects(check(action), /QA_OWNER_ACTION_DENIED/);
  present = true; session = principal.sessionId;
  await assert.rejects(check(action), /QA_OWNER_ACTION_DENIED/);
  session = "separate-owner-session-00000001"; siteId = "wrong-site";
  await assert.rejects(check(action), /QA_OWNER_ACTION_DENIED/);
  siteId = SYNTHETIC_QA.siteId; expiresAt = now - 1;
  await assert.rejects(check(action), /QA_OWNER_ACTION_DENIED/);
});

test("separate Development owner reader uses verified Auth session and denies QA parent or revocation", async () => {
  const ownerId = "00000000-0000-4000-8000-000000000044";
  const expires = Math.floor(Date.now() / 1000) + 300;
  const token = ["header", Buffer.from(JSON.stringify({ sub: ownerId,
    session_id: "separate-owner-session-00000001", exp: expires })).toString("base64url"),
    "signature"].join(".");
  let role = "parent", active = true, userId = ownerId;
  let userEmail = "owner@verified.example", profileEmail = userEmail, confirmed = true;
  let gardenId = null, appRole = "parent", approval = {
    version: 1, ownerId, environment: SYNTHETIC_QA.viewerEnvironment,
    tenantId: SYNTHETIC_QA.tenantId, siteId: SYNTHETIC_QA.siteId,
    viewerId: SYNTHETIC_QA.viewerId, purpose: "APPROVE_ONE_QA_DEVICE_ENROLLMENT",
    issuedAt: Date.now() - 1000, expiresAt: Date.now() + 60_000 };
  const read = createPush44QaDevelopmentOwnerReader({
    supabaseUrl: "http://127.0.0.1:54321/", publishableKey: "local-publishable-key-for-synthetic-test",
    expectedOwnerProfileId: ownerId, expectedOwnerEmail: "owner@verified.example",
    readOwnerToken: async () => token,
    clientFactory: () => ({ auth: { getUser: async () => ({ data: { user: { id: userId, email: userEmail,
      email_confirmed_at: confirmed ? "2026-10-24T00:00:00Z" : null,
      app_metadata: { role: appRole, push44_qa_enrollment_approver: approval } } }, error: null }) },
      rpc: async () => ({ data: active, error: null }),
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({
        data: { id: ownerId, email: profileEmail, role, active: true, garden_id: gardenId }, error: null }) }) }) }) }) });
  assert.equal((await read()).owner, true);
  userEmail = "admin@integration.qa.invalid";
  await assert.rejects(read(), /QA_DEVELOPMENT_OWNER_DENIED/);
  userEmail = "owner@verified.example"; profileEmail = "admin@integration.qa.invalid";
  await assert.rejects(read(), /QA_DEVELOPMENT_OWNER_DENIED/);
  profileEmail = userEmail; confirmed = false;
  await assert.rejects(read(), /QA_DEVELOPMENT_OWNER_DENIED/);
  confirmed = true;
  role = "admin"; await assert.rejects(read(), /QA_DEVELOPMENT_OWNER_DENIED/);
  role = "parent"; appRole = "admin"; await assert.rejects(read(), /QA_DEVELOPMENT_OWNER_DENIED/);
  appRole = "parent"; gardenId = SYNTHETIC_QA.siteId;
  await assert.rejects(read(), /QA_DEVELOPMENT_OWNER_DENIED/);
  gardenId = null; approval = null;
  await assert.rejects(read(), /QA_DEVELOPMENT_OWNER_DENIED/);
  approval = { version: 1, ownerId, environment: SYNTHETIC_QA.viewerEnvironment,
    tenantId: SYNTHETIC_QA.tenantId, siteId: SYNTHETIC_QA.siteId,
    viewerId: SYNTHETIC_QA.viewerId, purpose: "APPROVE_ONE_QA_DEVICE_ENROLLMENT",
    issuedAt: Date.now() - 120_000, expiresAt: Date.now() - 60_000 };
  await assert.rejects(read(), /QA_DEVELOPMENT_OWNER_DENIED/);
  approval.expiresAt = Date.now() + 60_000;
  approval.tenantId = "wrong-tenant";
  await assert.rejects(read(), /QA_DEVELOPMENT_OWNER_DENIED/);
  approval.tenantId = SYNTHETIC_QA.tenantId; approval.siteId = "wrong-site";
  await assert.rejects(read(), /QA_DEVELOPMENT_OWNER_DENIED/);
  approval.siteId = SYNTHETIC_QA.siteId; approval.viewerId = "wrong-device";
  await assert.rejects(read(), /QA_DEVELOPMENT_OWNER_DENIED/);
  approval.viewerId = SYNTHETIC_QA.viewerId;
  approval.issuedAt = Date.now() - 31 * 60_000;
  await assert.rejects(read(), /QA_DEVELOPMENT_OWNER_DENIED/);
  approval.issuedAt = Date.now() - 1000;
  active = false; await assert.rejects(read(), /QA_DEVELOPMENT_OWNER_DENIED/);
  active = true; userId = SYNTHETIC_QA.viewerId;
  await assert.rejects(read(), /QA_DEVELOPMENT_OWNER_DENIED/);
  assert.throws(() => createPush44QaDevelopmentOwnerReader({ supabaseUrl: "https://kuaywzvucllxjsxarogb.supabase.co/",
    publishableKey: "local-publishable-key-for-synthetic-test", expectedOwnerProfileId: ownerId,
    expectedOwnerEmail: "owner@verified.example",
    readOwnerToken: async () => token }), /QA_DEVELOPMENT_OWNER_DENIED/);
  assert.throws(() => createPush44QaDevelopmentOwnerReader({ supabaseUrl: "http://127.0.0.1:54321/",
    publishableKey: "local-publishable-key-for-synthetic-test", expectedOwnerProfileId: ownerId,
    expectedOwnerEmail: "admin@integration.qa.invalid", readOwnerToken: async () => token }),
  /QA_DEVELOPMENT_OWNER_DENIED/);
  assert.throws(() => createPush44QaDevelopmentOwnerReader({ supabaseUrl: "http://127.0.0.1:54321/",
    publishableKey: "local-publishable-key-for-synthetic-test", expectedOwnerProfileId: ownerId,
    readOwnerToken: async () => token }), /QA_DEVELOPMENT_OWNER_DENIED/);
});

test("prepared HTTPS ingress requires exact host, TLS assertion and private origin key", async t => {
  const f = fixture(t); await approve(f);
  const hostname = "qa-iphone-device-proof.ganbatuach.com";
  const localIngressKey = "k".repeat(43);
  let clock = Date.now();
  const expiresAt = clock + 30 * 60_000;
  assert.throws(() => createPush44QaDeviceTransport({ proof: f.proof, database: f.db,
    authenticate: async () => f.session(), trustedIngress: {
      hostname: "qa-iphone-other.ganbatuach.com", localIngressKey, expiresAt } }),
  /QA_DEVICE_INGRESS_CONFIG_DENIED/);
  const edge = createPush44QaDeviceTransport({ proof: f.proof, database: f.db,
    authenticate: async request => request.headers.authorization === `Bearer ${"synthetic.".repeat(8)}token`
      ? f.session() : null,
    trustedIngress: { hostname, localIngressKey, expiresAt }, now: () => clock });
  t.after(async () => edge.close());
  const origin = await edge.listen();
  const headers = { host: hostname, origin: `https://${hostname}`,
    "x-forwarded-host": hostname, "x-forwarded-proto": "https",
    "x-do-qa-ingress-key": localIngressKey, "content-type": "application/json",
    authorization: `Bearer ${"synthetic.".repeat(8)}token` };
  const body = JSON.stringify({ operation: "ENROLL", publicKey: f.first.publicKey,
    method: "POST", path: "/qa-device/enroll" });
  const send = (changes, payload = body, path = "/qa-device/challenge") => new Promise((resolve, reject) => {
    const request = httpRequest(`${origin}${path}`, { method: "POST",
      headers: { ...headers, ...changes } }, response => {
      response.resume(); response.on("end", () => resolve({ status: response.statusCode }));
    });
    request.on("error", reject); request.end(payload);
  });
  assert.equal((await send({})).status, 200);
  assert.equal((await send({ "x-do-qa-ingress-key": "wrong" })).status, 403);
  assert.equal((await send({ host: "other.ganbatuach.com" })).status, 403);
  assert.equal((await send({ "x-forwarded-proto": "http" })).status, 403);
  assert.equal((await send({ host: new URL(origin).host, origin: "https://untrusted.invalid" })).status, 403);
  assert.equal((await send({}, body, "/ch1/index.m3u8")).status, 403);
  assert.equal((await send({}, body, "/api/auth/admin")).status, 403);
  assert.equal((await send({}, "x".repeat(2049))).status, 403);
  assert.equal((await send({}, JSON.stringify({ operation: "ENROLL", publicKey: f.first.publicKey,
    method: "POST", path: "/qa-device/enroll", sourceId: "real-camera" }))).status, 403);
  clock = expiresAt;
  assert.equal((await send({})).status, 403);
});
