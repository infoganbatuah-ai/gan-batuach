import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { generateKeyPairSync, sign } from "node:crypto";
import { createPush44QaDeviceProof, qaDeviceKeyId } from "../../services/video-gateway/push44-qa-device-proof.mjs";
import { createPush44QaEnrollmentApproval } from "../../services/video-gateway/push44-qa-enrollment-approval.mjs";
import { createPush44QaDeviceTransport, createPush44QaLocalOperator } from "../../services/video-gateway/push44-qa-device-transport.mjs";
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
  const token = ["synthetic", Buffer.from(JSON.stringify({ sub: SYNTHETIC_QA.viewerId,
    session_id: sessionId, exp: Math.floor(Date.now() / 1000) + 300 })).toString("base64url"), "synthetic"].join(".");
  let runtimeOk = true, sessionOk = true;
  const operator = createPush44QaLocalOperator({ database: db, expectedRuntimeSha: sha,
    readSessionToken: async context => context.headers.authorization?.slice(7),
    readApprovedSession: async () => ({ sessionId, deviceId: "owner-iphone-approved-0001", revoked: false }),
    readDelegation: async () => ({ ...SYNTHETIC_QA, kind: "SYNTHETIC_QA_VIEW_ONLY",
      adminVerified: true, sourceOwnerVerified: true, revoked: false,
      approvalId: "synthetic-media-approval-0001", purpose: "Approved exact synthetic QA",
      issuedAt: Date.now() - 1000, expiresAt: Date.now() + 250_000 }),
    verifyOwnerAction: async input => input.ownerAction === "host-approved-owner-action",
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
  await operator.authorizeEnrollment({ context, keyId: qaDeviceKeyId(device.publicKey),
    purpose: "Approved exact owner QA installation", ownerAction: "host-approved-owner-action" });
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
