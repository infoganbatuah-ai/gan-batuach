import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { evaluatePrivacyGate } from "../../lib/domain/digital-observer/privacy-compliance.ts";

const now = new Date("2026-11-17T12:00:00.000Z");
const base = { capability: "FACE_RECOGNITION", context: "HOME", purpose: "authorized household access",
  tenantId: "tenant", siteId: "site", policyActive: true, decisionState: "EXTERNALLY_APPROVED",
  approvalScopeMatches: true, approvalEffectiveAt: "2026-11-16T00:00:00Z", humanReviewRequired: true, humanReviewerId: "reviewer" };

test("a future or missing legal effective date cannot activate a sensitive capability", () => {
  assert.equal(evaluatePrivacyGate({ ...base, approvalEffectiveAt: "2026-11-18T00:00:00Z" }, now).allowed, false);
  assert.equal(evaluatePrivacyGate({ ...base, approvalEffectiveAt: null }, now).allowed, false);
  assert.equal(evaluatePrivacyGate({ ...base, approvalEffectiveAt: "bad" }, now).allowed, false);
  assert.equal(evaluatePrivacyGate({ ...base, approvalEffectiveAt: "2026-11-16T00:00:00Z" }, now).allowed, true);
});

test("the stored-approval reader passes the authoritative effective timestamp to the gate", () => {
  const service = readFileSync(new URL("../../lib/domain/digital-observer/privacy-compliance-service.ts", import.meta.url), "utf8");
  assert.match(service, /approvalEffectiveAt: approval\?\.effective_at \?\? null/);
});
