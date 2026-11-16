import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { registerHooks } from "node:module";
import { test } from "node:test";
registerHooks({
  resolve(specifier, context, next) {
    return specifier.startsWith(".") && context.parentURL?.endsWith(".ts")
      ? next(`${specifier}.ts`, context) : next(specifier, context);
  }
});
const { issuePushBindingOfflineContract } = await import("../../lib/domain/push-binding-issuer.ts");
const { pushRegistrationChallengeHash } = await import("../../lib/domain/push-registration-challenge.ts");

const nowMs = Date.parse("2026-11-16T12:00:00Z");
const challenge = { audience: "gan_management", provider: "apns", appId: "com.ganbatuach.app",
  profileId: "profile-A", installationId: "install-A", providerToken: "synthetic-provider-token",
  nonce: "nonce-A", expiresAt: "2026-11-16T12:01:00.000Z" };
const digest = pushRegistrationChallengeHash(challenge);
const verdict = { source: "apple_app_attest", platform: "ios", build: "release",
  audience: "gan_management", provider: "apns", appId: "com.ganbatuach.app",
  challengeDigest: digest, issuedAtMs: nowMs - 1000, expiresAtMs: nowMs + 20_000 };

function fixture() {
  const consumed = new Set();
  const receipts = [];
  const expectations = [];
  return { consumed, receipts, expectations, adapters: {
    verifyEvidence: async (evidence, expected) => {
      expectations.push(expected);
      return evidence === "synthetic-signed-evidence" ? verdict : null;
    },
    consumeAndPersist: async (nonce, receipt) => {
      if (consumed.has(nonce)) return false;
      consumed.add(nonce); receipts.push(receipt); return true;
    }
  } };
}
const issue = (options = {}) => issuePushBindingOfflineContract({
  authenticatedProfileId: challenge.profileId, challenge, untrustedEvidence: "synthetic-signed-evidence", nowMs, ...options
});

test("default-off and missing trusted adapters cannot issue a binding", async () => {
  const f = fixture();
  assert.deepEqual(await issue({ adapters: f.adapters }), { status: "denied", reason: "disabled" });
  assert.deepEqual(await issue({ enabled: true }), { status: "denied", reason: "missing_adapter" });
  assert.deepEqual(await issue({ enabled: true, adapters: { verifyEvidence: f.adapters.verifyEvidence } }),
    { status: "denied", reason: "missing_adapter" });
  assert.equal(f.receipts.length, 0);
});

test("synthetic trusted adapters bind exact token hash and consume nonce once", async () => {
  const f = fixture();
  const input = { enabled: true, adapters: f.adapters };
  const first = await issue(input);
  assert.equal(first.status, "issued");
  assert.equal(first.receipt.tokenSha256, createHash("sha256").update(challenge.providerToken).digest("hex"));
  assert.equal(first.receipt.challengeDigest, digest);
  assert.equal(first.receipt.profileId, challenge.profileId);
  assert.equal(first.receipt.appId, challenge.appId);
  assert.equal(first.receipt.expiresAt, new Date(verdict.expiresAtMs).toISOString());
  assert.deepEqual(f.expectations[0], {
    challengeDigest: digest, authenticatedProfileId: challenge.profileId,
    installationId: challenge.installationId,
    tokenSha256: createHash("sha256").update(challenge.providerToken).digest("hex"),
    audience: challenge.audience, provider: challenge.provider, appId: challenge.appId
  });
  assert.equal(JSON.stringify(first).includes(challenge.providerToken), false);
  assert.deepEqual(await issue(input), { status: "denied", reason: "persistence_denied" });
  assert.equal(f.receipts.length, 1);
});

test("profile, exact token, app, nonce, expiry and revocation fail closed", async () => {
  for (const changed of [
    { authenticatedProfileId: "profile-B" },
    { challenge: { ...challenge, providerToken: "other-token" } },
    { challenge: { ...challenge, appId: "com.digitalobserver.app.qa", audience: "digital_observer" } },
    { challenge: { ...challenge, nonce: "different-nonce" } },
    { nowMs: Date.parse(challenge.expiresAt) }
  ]) {
    const f = fixture();
    const result = await issue({ enabled: true, adapters: f.adapters, ...changed });
    assert.equal(result.status, "denied");
    assert.equal(f.receipts.length, 0);
  }
  const f = fixture();
  const revoked = { ...verdict, revokedAtMs: nowMs - 1 };
  const result = await issue({ enabled: true, adapters: { ...f.adapters, verifyEvidence: async () => revoked } });
  assert.deepEqual(result, { status: "denied", reason: "unverified_evidence" });
  assert.equal(f.receipts.length, 0);
});

test("unverified, forged, failed and throwing adapters never produce a binding", async () => {
  const direct = fixture();
  assert.deepEqual(await issue({ enabled: true, adapters: direct.adapters, untrustedEvidence: verdict }),
    { status: "denied", reason: "unverified_evidence" });
  assert.deepEqual(await issue({ enabled: true, adapters: direct.adapters, untrustedEvidence: null }),
    { status: "denied", reason: "unverified_evidence" });
  assert.equal(direct.receipts.length, 0);
  for (const verifyEvidence of [async () => null, async () => ({ ...verdict, challengeDigest: "b".repeat(64) }),
    async () => { throw new Error("provider_down"); }]) {
    const f = fixture();
    const result = await issue({ enabled: true, adapters: { ...f.adapters, verifyEvidence } });
    assert.equal(result.status, "denied");
    assert.equal(f.receipts.length, 0);
  }
  const f = fixture();
  const result = await issue({ enabled: true, adapters: { ...f.adapters, consumeAndPersist: async () => false } });
  assert.deepEqual(result, { status: "denied", reason: "persistence_denied" });
});
