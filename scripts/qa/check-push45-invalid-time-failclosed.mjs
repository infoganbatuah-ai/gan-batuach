import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluatePrivacyGate, evaluateRetentionDisposition, isLegalHoldActive } from "../../lib/domain/digital-observer/privacy-compliance.ts";

const now = new Date("2026-11-17T12:00:00.000Z");
const approval = { capability: "FACE_RECOGNITION", context: "HOME", purpose: "test",
  tenantId: "tenant", siteId: "site", policyActive: true, decisionState: "EXTERNALLY_APPROVED",
  approvalScopeMatches: true, approvalEffectiveAt: "2026-11-16T00:00:00Z", humanReviewRequired: true, humanReviewerId: "reviewer" };
const retention = { dataClass: "DIGITAL_OBSERVER_EVIDENCE", activeLegalHold: false,
  externalSystemOwnsData: false, externalDeletionConfirmed: false, policyDecision: "EXTERNALLY_APPROVED" };

test("malformed approval expiration cannot activate a sensitive capability", () => {
  assert.equal(evaluatePrivacyGate({ ...approval, approvalExpiresAt: "not-a-date" }, now).allowed, false);
  assert.equal(evaluatePrivacyGate({ ...approval, approvalExpiresAt: "2026-11-18T12:00:00Z" }, now).allowed, true);
});

test("malformed retention expiration cannot make evidence deletion-eligible", () => {
  assert.notEqual(evaluateRetentionDisposition({ ...retention, expiresAt: "not-a-date" }, now).action, "DELETE_ELIGIBLE");
  assert.equal(evaluateRetentionDisposition({ ...retention, expiresAt: "2026-11-16T12:00:00Z" }, now).action, "DELETE_ELIGIBLE");
});

test("malformed active hold dates retain the hold rather than permit deletion", () => {
  assert.equal(isLegalHoldActive({ status: "active", startsAt: "not-a-date" }, now), true);
  assert.equal(isLegalHoldActive({ status: "active", startsAt: "2026-11-01T00:00:00Z", endsAt: "not-a-date" }, now), true);
  assert.equal(isLegalHoldActive({ status: "released", startsAt: "not-a-date" }, now), false);
});
