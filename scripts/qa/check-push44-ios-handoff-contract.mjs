import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { redeemQaHandoff, redeemObserverQaCode } from "../../review-only/push44-ios-handoff-contract/contract.mjs";

const code = "a".repeat(64);
const nonce = "b".repeat(64);
const callback = "https://qa-iphone-device-proof.ganbatuach.com/qa/device-proof/return";
const codeSha256 = createHash("sha256").update(code).digest("hex");

const base = Object.freeze({
  id: "synthetic-receipt",
  accountId: "qa-account-a",
  installationId: "qa-installation-a",
  sessionId: "qa-session-a",
  audience: "com.ganbatuach.app.qa",
  callback, nonce, codeSha256, issuedAt: 900,
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
        || receipt.audience !== expected.audience || receipt.callback !== expected.callback
        || receipt.nonce !== expected.nonce || receipt.codeSha256 !== expected.codeSha256) return false;
      receipt = { ...receipt, consumedAt: expected.now };
      consumes += 1;
      return true;
    }
  };
  const request = {
    receiptId: base.id, accountId: base.accountId, installationId: base.installationId,
    sessionId: base.sessionId, audience: base.audience, callback, code, nonce, now: 1_000,
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

test("20-way synthetic Gan contract race selects one winner only with an atomic adapter", async () => {
  const f = fixture();
  const results = await Promise.all(Array.from({ length: 20 }, () => redeemQaHandoff(f.store, f.request)));
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

for (const [name, receiptChanges, requestChanges] of [
  ["wrong code", {}, { code: "c".repeat(64) }],
  ["wrong nonce", {}, { nonce: "c".repeat(64) }],
  ["wrong callback", {}, { callback: "https://ganbatuach.com/qa/device-proof/return" }],
  ["overlong lifetime", { issuedAt: -120_000 }, {}],
  ["missing hash", { codeSha256: null }, {}]
]) test(`${name} cannot redeem a QA code`, async () => {
  const f = fixture(receiptChanges);
  assert.equal(await redeemQaHandoff(f.store, { ...f.request, ...requestChanges }), false);
  assert.equal(f.consumes, 0);
});

test("Observer redemption remains closed even with a supplied flag or Gan-only host", async () => {
  const observer = fixture({ audience: "com.digitalobserver.app.qa" });
  const request = { ...observer.request, audience: "com.digitalobserver.app.qa" };
  assert.equal(await redeemObserverQaCode(observer.store, request), false);
  assert.equal(await redeemObserverQaCode(observer.store, { ...request, audience: base.audience }, { enabled: true }), false);
  assert.equal(await redeemObserverQaCode(observer.store, { ...request,
    callback: "https://ganbatuach.com/qa/device-proof/return" }, { enabled: true }), false);
  assert.equal(await redeemObserverQaCode(observer.store, request, { enabled: true }), false);
  assert.equal(await redeemQaHandoff(observer.store, request), false);
  assert.equal(observer.consumes, 0);
});

test("Observer 20-way race cannot redeem without an approved origin", async () => {
  const observer = fixture({ audience: "com.digitalobserver.app.qa" });
  const request = { ...observer.request, audience: "com.digitalobserver.app.qa" };
  const results = await Promise.all(Array.from({ length: 20 }, () =>
    redeemObserverQaCode(observer.store, request, { enabled: true })));
  assert.equal(results.filter(Boolean).length, 0);
  assert.equal(observer.consumes, 0);
});

test("missing atomic store or missing binding fails closed", async () => {
  const f = fixture();
  assert.equal(await redeemQaHandoff(null, f.request), false);
  assert.equal(await redeemQaHandoff({ load: f.store.load }, f.request), false);
  assert.equal(await redeemQaHandoff(f.store, { ...f.request, installationId: "" }), false);
  assert.equal(await redeemQaHandoff({ load: async () => { throw new Error("store unavailable"); },
    consumeIfCurrent: async () => true }, f.request), false);
});
