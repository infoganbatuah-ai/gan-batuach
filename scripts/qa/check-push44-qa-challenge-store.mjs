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
  const statements = [];
  const db = { query: async (sql, values) => {
    statements.push({ sql, values });
    if (sql.includes("SELECT")) return { rows: row ? [{ ...row }] : [] };
    assert.match(sql, /^UPDATE observer_qa_private\.device_handoff_challenges/);
    // Model the required single database compare-and-update statement.
    if (!row || row.consumedAt !== null || row.revokedAt !== null || row.expiresAt <= 1_000
      || values[1] !== row.accountId || values[2] !== row.sessionId
      || values[3] !== row.installationId || values[4] !== row.audience
      || values[5] !== row.nonce || values[6] !== row.publicKeySpkiBase64) return { rows: [] };
    row = { ...row, consumedAt: 1_000 };
    writes++;
    return { rows: [{ id: challengeId }] };
  } };
  const input = { challengeId, accountId: context.accountId, sessionId: context.sessionId,
    installationId: context.installationId, audience: context.audience,
    activeSession: true, signatureBase64: signature, now: 1_000 };
  return { db, input, statements, get writes() { return writes; } };
}

test("valid challenge is consumed once, including concurrent replay", async () => {
  const f = fixture();
  const results = await Promise.all(Array.from({ length: 8 }, () => consumeStoredQaChallenge(f.db, f.input)));
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(f.writes, 1);
  assert.match(f.statements.find(({ sql }) => sql.startsWith("UPDATE"))?.sql ?? "", /consumed_at IS NULL/);
});

for (const [name, inputChange, rowChange] of [
  ["expired", {}, { expiresAt: 1_000 }],
  ["revoked", {}, { revokedAt: 999 }],
  ["wrong account", { accountId: "account-b" }, {}],
  ["wrong session", { sessionId: "session-b" }, {}],
  ["wrong installation", { installationId: "installation-b" }, {}],
  ["wrong audience", { audience: "other-app" }, {}],
  ["revoked session", { activeSession: false }, {}],
  ["wrong key", { signatureBase64: sign("sha256", qaDeviceProofMessage(context), other.privateKey).toString("base64") }, {}]
]) test(`${name} fails without consuming`, async () => {
  const f = fixture(rowChange);
  assert.equal(await consumeStoredQaChallenge(f.db, { ...f.input, ...inputChange }), false);
  assert.equal(f.writes, 0);
});

test("unavailable storage fails closed", async () => {
  const f = fixture();
  assert.equal(await consumeStoredQaChallenge({ query: async () => { throw new Error("offline"); } }, f.input), false);
  assert.equal(await consumeStoredQaChallenge(null, f.input), false);
});

test("review-only SQL proposes private scoped tables and bounded expiry", () => {
  const sql = readFileSync(new URL("../../review-only/push44-qa-device-proof/proposed-schema.sql", import.meta.url), "utf8");
  assert.match(sql, /CREATE SCHEMA IF NOT EXISTS observer_qa_private/);
  assert.match(sql, /REVOKE ALL ON SCHEMA observer_qa_private FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /auth_session_id uuid NOT NULL/);
  assert.match(sql, /UNIQUE \(id, account_profile_id\)/);
  assert.match(sql, /approved_one_qa_installation_per_account/);
  assert.match(sql, /expires_at <= issued_at \+ interval '60 seconds'/);
  assert.doesNotMatch(sql, /GRANT .* TO (?:anon|authenticated|PUBLIC)/);
});
