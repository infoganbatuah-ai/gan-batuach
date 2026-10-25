import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { createHash, generateKeyPairSync, randomBytes, sign } from "node:crypto";
import { createPush44QaDeviceProof, qaDeviceKeyId, withPush44QaDeviceProof } from
  "../../services/video-gateway/push44-qa-device-proof.mjs";
import { SYNTHETIC_QA, CH1, createSyntheticQaMediaGate } from
  "../../services/video-gateway/push44-ch1-private-media.mjs";
import { issueGatewayPlaybackGrant } from "../../lib/domain/gateway-device-enrollment.ts";

function pair() {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = publicKey.export({ format: "jwk" });
  const raw = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, "base64url"), Buffer.from(jwk.y, "base64url")]);
  return { raw: raw.toString("base64url"), sign: value => sign("sha256", Buffer.from(value, "base64url"), privateKey).toString("base64url") };
}

function fixture(t) {
  const database = new DatabaseSync(":memory:"); t.after(() => database.close());
  const start = Date.now(); let elapsed = 0, active = true, ownerApproval = true, adminApproval = true;
  let sessionId = "synthetic-development-session-0001", viewerId = SYNTHETIC_QA.viewerId;
  const approved = pair(), second = pair();
  const consumed = new Set();
  const delegation = { ...SYNTHETIC_QA, kind: "SYNTHETIC_QA_VIEW_ONLY", adminVerified: true,
    sourceOwnerVerified: true, revoked: false, approvalId: "synthetic-media-approval-0001",
    purpose: "Isolated approved synthetic video QA", issuedAt: start, expiresAt: start + 300_000 };
  const approval = () => ({ approvalId: "owner-device-approval-0001", keyId: qaDeviceKeyId(approved.raw),
    viewerId: SYNTHETIC_QA.viewerId, tenantId: SYNTHETIC_QA.tenantId, siteId: SYNTHETIC_QA.siteId,
    sourceId: SYNTHETIC_QA.sourceId, sessionId, purpose: "Exact owner-approved QA installation",
    adminVerified: adminApproval, ownerVerified: ownerApproval, revoked: false, expiresAt: start + 300_000 });
  const principal = () => ({ verified: true, active, viewerId,
    environment: "LOCAL_SUPABASE", sessionId, deviceId: "untrusted-session-label" });
  const proof = createPush44QaDeviceProof({ database, authenticate: async () => principal(),
    readDelegation: async () => delegation, readApprovedEnrollment: async () => approval(),
    consumeApproval: async id => { if (consumed.has(id)) return false; consumed.add(id); return true; },
    authorizeOwnerAction: async () => ownerApproval && adminApproval,
    now: () => start + elapsed });
  const challenge = (operation, key = approved.raw, method = "GET", path = "/ch1/index.m3u8") =>
    proof.issueChallenge({ context: {}, operation, publicKey: key, method, path });
  const enroll = async (key = approved) => {
    const c = await challenge("ENROLL", key.raw, "POST", "/qa-device/enroll");
    return proof.enroll({ context: {}, publicKey: key.raw, challengeId: c.challengeId, signature: key.sign(c.payload) });
  };
  return { proof, database, approved, second, delegation, principal, challenge, enroll, approval,
    advance: ms => { elapsed += ms; }, setSession: value => { sessionId = value; },
    setViewer: value => { viewerId = value; },
    setActive: value => { active = value; }, setOwnerApproval: value => { ownerApproval = value; },
    setAdminApproval: value => { adminApproval = value; } };
}

test("approved P-256 key proves possession for one Development session and exact synthetic request", async t => {
  const f = fixture(t); await f.enroll();
  const c = await f.challenge("ACCESS");
  const p = await f.proof.verifyRequest({ context: {}, challengeId: c.challengeId,
    signature: f.approved.sign(c.payload), method: "GET", path: "/ch1/index.m3u8" });
  assert.equal(p.viewerId, SYNTHETIC_QA.viewerId);
  assert.equal(f.proof.currentKeyId(), qaDeviceKeyId(f.approved.raw));
  assert(f.proof.auditCount() >= 5);
  assert.equal(f.database.prepare("SELECT COUNT(*) AS n FROM push44_qa_binding").get().n, 1);
});

test("unapproved and second-device public keys cannot enroll, even under same owner login", async t => {
  const f = fixture(t);
  await assert.rejects(f.enroll(f.second), /QA_DEVICE_PROOF_DENIED/);
  f.setOwnerApproval(false); await assert.rejects(f.enroll(), /QA_DEVICE_PROOF_DENIED/);
  f.setOwnerApproval(true); f.setAdminApproval(false);
  await assert.rejects(f.enroll(), /QA_DEVICE_PROOF_DENIED/);
  f.setAdminApproval(true); await f.enroll();
  await assert.rejects(f.enroll(f.second), /QA_DEVICE_PROOF_DENIED/);
});

test("wrong key, invalid signature and replay are denied with consumed challenges", async t => {
  const f = fixture(t); await f.enroll();
  const c = await f.challenge("ACCESS");
  const bad = { context: {}, challengeId: c.challengeId,
    signature: f.second.sign(c.payload), method: "GET", path: "/ch1/index.m3u8" };
  await assert.rejects(f.proof.verifyRequest(bad), /QA_DEVICE_PROOF_DENIED/);
  await assert.rejects(f.proof.verifyRequest({ ...bad, signature: f.approved.sign(c.payload) }), /QA_DEVICE_PROOF_DENIED/);
  const good = await f.challenge("ACCESS");
  const input = { ...bad, challengeId: good.challengeId, signature: f.approved.sign(good.payload) };
  await f.proof.verifyRequest(input);
  await assert.rejects(f.proof.verifyRequest(input), /QA_DEVICE_PROOF_DENIED/);
});

test("nonce expiry, method/path and session mismatch fail closed", async t => {
  const f = fixture(t); await f.enroll();
  const c = await f.challenge("ACCESS");
  await assert.rejects(f.proof.verifyRequest({ context: {}, challengeId: c.challengeId,
    signature: f.approved.sign(c.payload), method: "GET", path: "/ch1/segment-1.ts" }), /QA_DEVICE_PROOF_DENIED/);
  const expired = await f.challenge("ACCESS"); f.advance(30_001);
  await assert.rejects(f.proof.verifyRequest({ context: {}, challengeId: expired.challengeId,
    signature: f.approved.sign(expired.payload), method: "GET", path: "/ch1/index.m3u8" }), /QA_DEVICE_PROOF_DENIED/);
  f.setSession("another-development-session-0002");
  await assert.rejects(f.challenge("ACCESS"), /QA_DEVICE_PROOF_DENIED/);
  f.setSession("synthetic-development-session-0001");
  f.setViewer("another-development-account-0001");
  await assert.rejects(f.challenge("ACCESS"), /QA_DEVICE_PROOF_DENIED/);
  f.setViewer(SYNTHETIC_QA.viewerId);
  f.setActive(false); await assert.rejects(f.proof.assertActive({}), /QA_DEVICE_PROOF_DENIED/);
});

test("wrong tenant, Site and real Home scope never inherit synthetic device permission", async t => {
  const f = fixture(t); await f.enroll();
  for (const [field, value] of [["tenantId", CH1.tenantId], ["siteId", CH1.siteId],
    ["sourceId", CH1.sourceId], ["viewerId", "other-account"]]) {
    f.delegation[field] = value;
    await assert.rejects(f.challenge("ACCESS"));
    f.delegation[field] = SYNTHETIC_QA[field];
  }
  await assert.rejects(f.proof.issueChallenge({ context: {}, operation: "ACCESS",
    method: "GET", path: `/sources/${CH1.sourceId}` }), /QA_DEVICE_PROOF_DENIED/);
});

test("explicit owner-approved revocation is immediate; replacement needs fresh approval", async t => {
  const f = fixture(t); await f.enroll();
  f.setOwnerApproval(false);
  await assert.rejects(f.proof.revoke({ keyId: qaDeviceKeyId(f.approved.raw), purpose: "Owner requested revocation" }));
  f.setOwnerApproval(true);
  await f.proof.revoke({ keyId: qaDeviceKeyId(f.approved.raw), purpose: "Owner requested revocation" });
  await assert.rejects(f.challenge("ACCESS"), /QA_DEVICE_PROOF_DENIED/);
  await assert.rejects(f.enroll(), /QA_DEVICE_PROOF_DENIED/); // prior approval consumed
});

test("media gate requires fresh proof in addition to its existing lease and canonical session", async t => {
  const f = fixture(t); await f.enroll();
  const authenticator = withPush44QaDeviceProof(async () => f.principal(), f.proof);
  const secret = randomBytes(48).toString("base64url");
  const gate = createSyntheticQaMediaGate({ grantSecret: secret, authenticate: authenticator,
    readDelegation: async () => f.delegation, consumeApproval: async () => true, audit: () => true,
    readMedia: async () => { throw new Error("NO_EXTERNAL_MEDIA"); } });
  t.after(() => gate.stop());
  const grant = issueGatewayPlaybackGrant({ gateway_id: SYNTHETIC_QA.gatewayId,
    observer_site_id: SYNTHETIC_QA.siteId, camera_source_id: SYNTHETIC_QA.sourceId,
    gateway_stream_id: SYNTHETIC_QA.streamId }, secret);
  const c = await f.challenge("ACCESS", f.approved.raw, "POST", "/ch1/claim");
  const request = { method: "POST", url: "/ch1/claim", headers: {
    "x-do-qa-challenge": c.challengeId, "x-do-qa-signature": f.approved.sign(c.payload) } };
  await gate.claim(request, grant);
  assert.equal((await authenticator(request)).deviceId, qaDeviceKeyId(f.approved.raw));
  request.url = "/ch1/renew";
  await assert.rejects(authenticator(request), /QA_DEVICE_PROOF_DENIED/);
  const missing = { method: "GET", url: "/ch1/index.m3u8", headers: {} };
  await assert.rejects(gate.media(missing, missing.url, async () => {}));
  assert.equal(gate.metrics().submittedBytes, 0);
});

test("malformed keys, missing adapters and persistent-store errors cannot authorize", async t => {
  const f = fixture(t);
  assert.throws(() => qaDeviceKeyId("not-a-key"), /QA_DEVICE_PROOF_DENIED/);
  assert.throws(() => createPush44QaDeviceProof(), /QA_DEVICE_ADAPTERS_REQUIRED/);
  f.database.exec("DROP TABLE push44_qa_challenge");
  await assert.rejects(f.enroll());
  assert.equal(f.database.prepare("SELECT COUNT(*) AS n FROM push44_qa_binding").get().n, 0);
});

test("audit records contain no private key, session bearer token or signature", async t => {
  const f = fixture(t); await f.enroll();
  const rows = f.database.prepare("SELECT * FROM push44_qa_audit").all();
  const output = JSON.stringify(rows);
  assert(!output.includes(f.approved.raw));
  assert(!output.includes("synthetic-development-session"));
  assert(!output.includes("PRIVATE KEY"));
  assert(rows.every(row => /^[a-f0-9]{64}$/.test(row.digest)));
  const challenge = f.database.prepare("SELECT payload FROM push44_qa_challenge LIMIT 1").get();
  assert.equal(createHash("sha256").update(challenge.payload).digest("hex").length, 64);
});
