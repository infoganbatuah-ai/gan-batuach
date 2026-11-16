import assert from "node:assert/strict";
import { test } from "node:test";
import { pushAttestationPolicyAllows } from "../../lib/domain/push-attestation-policy.ts";

const nowMs = Date.parse("2026-11-16T12:00:00Z");
const digest = "a".repeat(64);
const ios = { source: "apple_app_attest", platform: "ios", build: "release", audience: "gan_management",
  provider: "apns", appId: "com.ganbatuach.app", challengeDigest: digest,
  issuedAtMs: nowMs - 30_000, expiresAtMs: nowMs + 30_000 };
const android = { ...ios, source: "google_play_integrity", platform: "android", provider: "fcm" };
const input = (verdict, expected = {}) => ({ verdict, expectedChallengeDigest: digest,
  expectedAudience: verdict.audience, expectedProvider: verdict.provider, expectedAppId: verdict.appId, nowMs, ...expected });

test("source-backed release pairings accept only synthetic already-verified verdicts", () => {
  assert.equal(pushAttestationPolicyAllows(input(ios)), true);
  assert.equal(pushAttestationPolicyAllows(input(android)), true);
});

test("audience, provider, app and challenge mismatches fail closed", () => {
  for (const verdict of [
    { ...ios, audience: "digital_observer" }, { ...ios, provider: "fcm" },
    { ...ios, appId: "com.digitalobserver.app.qa" }, { ...ios, source: "google_play_integrity" },
    { ...android, source: "apple_app_attest" }, { ...android, challengeDigest: "b".repeat(64) }
  ]) assert.equal(pushAttestationPolicyAllows(input(verdict)), false);
  assert.equal(pushAttestationPolicyAllows(input(ios, { expectedAudience: "digital_observer" })), false);
  assert.equal(pushAttestationPolicyAllows(input(ios, { expectedProvider: "fcm" })), false);
  assert.equal(pushAttestationPolicyAllows(input(ios, { expectedAppId: "other" })), false);
});

test("unknown app, QA, expiry, future issue, revoked and malformed digest deny", () => {
  for (const verdict of [
    { ...ios, build: "qa" }, { ...android, build: "qa", appId: "com.digitalobserver.app.qa", audience: "digital_observer" },
    { ...ios, appId: "unknown" }, { ...ios, platform: "unknown" },
    { ...ios, expiresAtMs: nowMs }, { ...ios, issuedAtMs: nowMs + 1 },
    { ...ios, expiresAtMs: nowMs + 10 * 60_000 }, { ...ios, revokedAtMs: nowMs - 1 }
  ]) assert.equal(pushAttestationPolicyAllows(input(verdict)), false);
  assert.equal(pushAttestationPolicyAllows(input(ios, { expectedChallengeDigest: "not-a-hash" })), false);
});
