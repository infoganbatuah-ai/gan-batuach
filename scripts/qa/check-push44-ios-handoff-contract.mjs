import assert from "node:assert/strict";
import { test } from "node:test";
import { redeemQaHandoff } from "../../review-only/push44-ios-handoff-contract/contract.mjs";

const base = Object.freeze({
  id: "synthetic-receipt",
  accountId: "qa-account-a",
  installationId: "qa-installation-a",
  sessionId: "qa-session-a",
  audience: "com.ganbatuach.app.qa",
  expiresAt: 1_010,
  consumedAt: null,
  revokedAt: null
});

function fixture(overrides = {}) {
  let receipt = { ...base, ...overrides };
  let consumes = 0;
  const store = {
    load: async (id) => id === receipt.id ? { ...receipt } : null,
    consumeIfCurrent: async (id, expected) => {
      if (id !== receipt.id || receipt.consumedAt !== null || receipt.revokedAt !== null
        || receipt.expiresAt <= expected.now || receipt.sessionId !== expected.sessionId
        || receipt.accountId !== expected.accountId || receipt.installationId !== expected.installationId
        || receipt.audience !== expected.audience) return false;
      receipt = { ...receipt, consumedAt: expected.now };
      consumes += 1;
      return true;
    }
  };
  const request = {
    receiptId: base.id, accountId: base.accountId, installationId: base.installationId,
    sessionId: base.sessionId, audience: base.audience, now: 1_000,
    activeSession: true, deviceProofValid: true
  };
  return { store, request, get consumes() { return consumes; } };
}

test("a matching Development session and device proof consumes exactly once", async () => {
  const f = fixture();
  assert.equal(await redeemQaHandoff(f.store, f.request), true);
  assert.equal(await redeemQaHandoff(f.store, f.request), false);
  assert.equal(f.consumes, 1);
});

test("concurrent redemption selects one winner only when the adapter consumes atomically", async () => {
  const f = fixture();
  const results = await Promise.all(Array.from({ length: 10 }, () => redeemQaHandoff(f.store, f.request)));
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(f.consumes, 1);
});

for (const [name, receiptChanges, requestChanges] of [
  ["expired", { expiresAt: 1_000 }, {}],
  ["other account", {}, { accountId: "qa-account-b" }],
  ["other installation", {}, { installationId: "qa-installation-b" }],
  ["other session", {}, { sessionId: "qa-session-b" }],
  ["wrong callback audience", {}, { audience: "com.other.app" }],
  ["revoked session", {}, { activeSession: false }],
  ["invalid device proof", {}, { deviceProofValid: false }],
  ["revoked receipt", { revokedAt: 999 }, {}]
]) test(`${name} cannot consume a QA handoff`, async () => {
  const f = fixture(receiptChanges);
  assert.equal(await redeemQaHandoff(f.store, { ...f.request, ...requestChanges }), false);
  assert.equal(f.consumes, 0);
});

test("missing atomic store or missing binding fails closed", async () => {
  const f = fixture();
  assert.equal(await redeemQaHandoff(null, f.request), false);
  assert.equal(await redeemQaHandoff({ load: f.store.load }, f.request), false);
  assert.equal(await redeemQaHandoff(f.store, { ...f.request, installationId: "" }), false);
  assert.equal(await redeemQaHandoff({ load: async () => { throw new Error("store unavailable"); },
    consumeIfCurrent: async () => true }, f.request), false);
});
