import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { handleQaHandoff } from "../../review-only/push44-qa-device-proof/handoff-http-gate.mjs";
import { consumeStoredQaChallenge } from "../../review-only/push44-qa-device-proof/challenge-store-adapter.mjs";
import { qaDeviceProofMessage } from "../../lib/domain/digital-observer/qa-device-proof-server.ts";

const source = readFileSync(new URL("../../lib/domain/digital-observer/qa-handoff-composition.ts", import.meta.url), "utf8");
const compile = (enabled) => ts.transpileModule(enabled
  ? source.replace("const QA_HANDOFF_ACTIVATED = false;", "const QA_HANDOFF_ACTIVATED = true;")
    .replace("now: () => Date.now()", "now: () => 1_000") : source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022
  } }).outputText;
const accountId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const installationId = "33333333-3333-4333-8333-333333333333";
const challengeId = "44444444-4444-4444-8444-444444444444";
const keys = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const rowTemplate = {
  id: challengeId, nonce: "a".repeat(64), accountId, sessionId, installationId,
  audience: "com.digitalobserver.app.qa", issuedAt: 990, expiresAt: 1_010,
  consumedAt: null, revokedAt: null,
  publicKeySpkiBase64: keys.publicKey.export({ type: "spki", format: "der" }).toString("base64")
};
const signature = sign("sha256", qaDeviceProofMessage(rowTemplate), keys.privateKey).toString("base64");
const endpoint = "https://qa-iphone-device-proof.ganbatuach.com/api/digital-observer/qa-device-proof/handoff";
const request = (body = {}) => new Request(endpoint, { method: "POST",
  headers: { "content-type": "application/json" }, body: JSON.stringify({ challengeId, installationId,
    signatureBase64: signature, ...body }) });

function fixture({ enabled = false, authSequence = [{ accountId, sessionId }], storageError = false,
  rateError = false, rowChange = {} } = {}) {
  let row = { ...rowTemplate, ...rowChange };
  let authCalls = 0;
  let dbCalls = 0;
  let rateCalls = 0;
  const authenticate = async () => authSequence[Math.min(authCalls++, authSequence.length - 1)];
  const db = { query: async (sql, values) => {
    dbCalls++;
    if (storageError) throw new Error("storage unavailable");
    if (sql.startsWith("SELECT c.id")) return { rows: [{ ...row }] };
    assert.match(sql, /observer_qa_private\.consume_device_handoff_challenge/);
    if (row.consumedAt !== null || row.revokedAt !== null || row.expiresAt <= 1_000
      || values[1] !== row.accountId || values[2] !== row.sessionId
      || values[3] !== row.installationId || values[4] !== row.audience
      || values[6] !== row.publicKeySpkiBase64) return { rows: [{ consumed: false }] };
    row = { ...row, consumedAt: 1_000 };
    return { rows: [{ consumed: true }] };
  } };
  const compiledUnit = { exports: {} };
  vm.runInNewContext(compile(enabled), { module: compiledUnit, exports: compiledUnit.exports,
    require: (id) => {
      if (id === "server-only") return {};
      if (id === "node:crypto") return { createHash: () => ({ update: () => ({ digest: () => "a".repeat(64) }) }) };
      if (id === "@/lib/security/rate-limit") return { assertRateLimit: async (key, route, limit, windowSeconds) => {
        rateCalls++;
        assert.equal(key, "a".repeat(64));
        assert.equal(route, "push44-qa-handoff");
        assert.equal(limit, 30);
        assert.equal(windowSeconds, 60);
        if (rateError) throw new Error("rate store unavailable");
      } };
      if (id === "./qa-verified-session-server") return { getQaVerifiedSession: authenticate };
      if (id.endsWith("handoff-http-gate.mjs")) return { handleQaHandoff };
      if (id.endsWith("challenge-store-adapter.mjs")) return { consumeStoredQaChallenge };
      throw new Error(`Unexpected import: ${id}`);
    } });
  return { create: compiledUnit.exports.createQaHandoffHandler, db, authenticate,
    get rateCalls() { return rateCalls; },
    get authCalls() { return authCalls; }, get dbCalls() { return dbCalls; } };
}

test("default-off composition does not call Auth or DB", async () => {
  const f = fixture();
  assert.equal((await f.create(f.db)(request())).status, 404);
  assert.equal(f.authCalls, 0);
  assert.equal(f.dbCalls, 0);
  assert.equal(f.rateCalls, 0);
});

test("server identity plus valid signature consumes once", async () => {
  const f = fixture({ enabled: true });
  const handle = f.create(f.db);
  assert.equal((await handle(request())).status, 204);
  assert.equal((await handle(request())).status, 403);
  assert.equal(f.rateCalls, 2);
  assert.equal(f.authCalls, 4); // Authenticate and revalidate for each request.
});

test("composition denies on atomic rate-store failure before Auth or receipt", async () => {
  const f = fixture({ enabled: true, rateError: true });
  assert.notEqual((await f.create(f.db)(request())).status, 204);
  assert.equal(f.rateCalls, 1);
  assert.equal(f.authCalls, 0);
  assert.equal(f.dbCalls, 0);
});

for (const [name, options, body] of [
  ["client account injection", {}, { accountId: "other" }],
  ["client session injection", {}, { sessionId: "other" }],
  ["wrong signature", {}, { signatureBase64: "YQ==" }],
  ["revoked live session", { authSequence: [{ accountId, sessionId }, null] }, {}],
  ["changed account", { authSequence: [{ accountId, sessionId }, { accountId: "other", sessionId }] }, {}],
  ["revoked receipt", { rowChange: { revokedAt: 999 } }, {}],
  ["Gan receipt on Observer endpoint", { rowChange: { audience: "com.ganbatuach.app.qa" } }, {}],
  ["other installation", { rowChange: { installationId: "55555555-5555-4555-8555-555555555555" } }, {}],
  ["expired receipt", { rowChange: { expiresAt: 1_000 } }, {}],
  ["storage unavailable", { storageError: true }, {}]
]) test(`${name} fails closed`, async () => {
  const f = fixture({ enabled: true, ...options });
  assert.notEqual((await f.create(f.db)(request(body))).status, 204);
});
