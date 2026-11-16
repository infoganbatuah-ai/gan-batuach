import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { consumeStoredQaChallenge } from "../../review-only/push44-qa-device-proof/challenge-store-adapter.mjs";
import { qaDeviceProofMessage } from "../../lib/domain/digital-observer/qa-device-proof-server.ts";

const keys = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const other = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const challengeId = "11111111-1111-4111-8111-111111111111";
const context = {
  id: challengeId, nonce: "a".repeat(64), accountId: "account-a", sessionId: "session-a",
  installationId: "installation-a", audience: "com.ganbatuach.app.qa", issuedAt: 990,
  expiresAt: 1_010, consumedAt: null, revokedAt: null,
  publicKeySpkiBase64: keys.publicKey.export({ type: "spki", format: "der" }).toString("base64")
};
const signature = sign("sha256", qaDeviceProofMessage(context), keys.privateKey).toString("base64");

function fixture(changes = {}) {
  let row = { ...context, ...changes };
  let writes = 0;
  let liveSession = true;
  const statements = [];
  const db = { query: async (sql, values) => {
    statements.push({ sql, values });
    if (sql.startsWith("SELECT c.id")) return { rows: row ? [{ ...row }] : [] };
    assert.match(sql, /^SELECT observer_qa_private\.consume_device_handoff_challenge/);
    // Model the required single database compare-and-update function.
    if (!liveSession || !row || row.consumedAt !== null || row.revokedAt !== null || row.expiresAt <= 1_000
      || values[1] !== row.accountId || values[2] !== row.sessionId
      || values[3] !== row.installationId || values[4] !== row.audience
      || values[5] !== row.nonce || values[6] !== row.publicKeySpkiBase64) return { rows: [{ consumed: false }] };
    row = { ...row, consumedAt: 1_000 };
    writes++;
    return { rows: [{ consumed: true }] };
  } };
  const input = { challengeId, accountId: context.accountId, sessionId: context.sessionId,
    installationId: context.installationId, audience: context.audience,
    signatureBase64: signature, now: 1_000 };
  const verifyLiveSession = async () => liveSession
    ? { accountId: context.accountId, sessionId: context.sessionId } : null;
  return { db, input, verifyLiveSession, statements,
    revokeSession() { liveSession = false; }, get writes() { return writes; } };
}

test("valid challenge is consumed once, including concurrent replay", async () => {
  const f = fixture();
  const results = await Promise.all(Array.from({ length: 8 }, () => consumeStoredQaChallenge(f.db, f.input, f.verifyLiveSession)));
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(f.writes, 1);
  assert.match(f.statements.find(({ sql }) => sql.includes("consume_device_handoff_challenge"))?.sql ?? "", /\$1::uuid/);
});

for (const [name, inputChange, rowChange] of [
  ["expired", {}, { expiresAt: 1_000 }],
  ["revoked", {}, { revokedAt: 999 }],
  ["wrong account", { accountId: "account-b" }, {}],
  ["wrong session", { sessionId: "session-b" }, {}],
  ["wrong installation", { installationId: "installation-b" }, {}],
  ["wrong audience", { audience: "other-app" }, {}],
  ["wrong key", { signatureBase64: sign("sha256", qaDeviceProofMessage(context), other.privateKey).toString("base64") }, {}]
]) test(`${name} fails without consuming`, async () => {
  const f = fixture(rowChange);
  assert.equal(await consumeStoredQaChallenge(f.db, { ...f.input, ...inputChange }, f.verifyLiveSession), false);
  assert.equal(f.writes, 0);
});

test("unavailable storage fails closed", async () => {
  const f = fixture();
  assert.equal(await consumeStoredQaChallenge({ query: async () => { throw new Error("offline"); } }, f.input, f.verifyLiveSession), false);
  assert.equal(await consumeStoredQaChallenge(null, f.input, f.verifyLiveSession), false);
});

test("revoked session and unavailable verifier fail closed", async () => {
  const f = fixture();
  f.revokeSession();
  assert.equal(await consumeStoredQaChallenge(f.db, f.input, f.verifyLiveSession), false);
  assert.equal(await consumeStoredQaChallenge(f.db, f.input), false);
  assert.equal(f.writes, 0);
});

test("changed authenticated account or session is denied", async () => {
  const f = fixture();
  assert.equal(await consumeStoredQaChallenge(f.db, f.input,
    async () => ({ accountId: "other", sessionId: f.input.sessionId })), false);
  assert.equal(await consumeStoredQaChallenge(f.db, f.input,
    async () => ({ accountId: f.input.accountId, sessionId: "other" })), false);
  assert.equal(f.writes, 0);
});

test("standalone Observer challenge consumes only under its own product audience", async () => {
  const observer = { ...context, audience: "com.digitalobserver.app.qa" };
  const f = fixture({ audience: observer.audience });
  const observerSignature = sign("sha256", qaDeviceProofMessage(observer), keys.privateKey).toString("base64");
  assert.equal(await consumeStoredQaChallenge(f.db, { ...f.input, audience: observer.audience,
    signatureBase64: signature }, f.verifyLiveSession), false, "Gan-signed bytes cannot satisfy Observer");
  assert.equal(await consumeStoredQaChallenge(f.db, { ...f.input, audience: observer.audience,
    signatureBase64: observerSignature }, f.verifyLiveSession), true);
  assert.equal(f.writes, 1);
});

test("unknown product audience fails before any challenge lookup", async () => {
  const f = fixture();
  assert.equal(await consumeStoredQaChallenge(f.db, { ...f.input, audience: "unknown.qa" }, f.verifyLiveSession), false);
  assert.equal(f.statements.length, 0);
});

test("review-only SQL proposes private scoped tables and bounded expiry", () => {
  const sql = readFileSync(new URL("../../review-only/push44-qa-device-proof/proposed-schema.sql", import.meta.url), "utf8");
  assert.match(sql, /CREATE SCHEMA observer_qa_private/);
  assert.match(sql, /REVOKE ALL ON SCHEMA observer_qa_private FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /auth_session_id uuid NOT NULL/);
  assert.match(sql, /UNIQUE \(id, account_profile_id, audience\)/);
  assert.match(sql, /FOREIGN KEY \(installation_id, account_profile_id, audience\)/);
  assert.match(sql, /approved_installations\(account_profile_id, audience\)/);
  assert.match(sql, /approved_one_qa_installation_per_account/);
  assert.match(sql, /expires_at <= issued_at \+ interval '60 seconds'/);
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(sql, /FOR SHARE/);
  assert.match(sql, /REVOKE ALL ON FUNCTION observer_qa_private\.consume_device_handoff_challenge/);
  assert.doesNotMatch(sql, /GRANT .* TO (?:anon|authenticated|PUBLIC)/);
});
