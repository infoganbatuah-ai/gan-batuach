import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { legalApprovalMatchesPolicy } from "../../lib/domain/digital-observer/privacy-compliance.ts";

const approval = { approvalStatus: "approved", revokedAt: null,
  approvalPurpose: "authorized household access", requestedPurpose: "authorized household access",
  approvalJurisdiction: "IL", policyJurisdiction: "IL" };

test("written approval cannot cross the policy jurisdiction boundary", () => {
  assert.equal(legalApprovalMatchesPolicy(approval), true);
  assert.equal(legalApprovalMatchesPolicy({ ...approval, approvalJurisdiction: "US" }), false);
  assert.equal(legalApprovalMatchesPolicy({ ...approval, approvalJurisdiction: null }), false);
  assert.equal(legalApprovalMatchesPolicy({ ...approval, policyJurisdiction: null }), false);
  assert.equal(legalApprovalMatchesPolicy({ ...approval, approvalPurpose: "another purpose" }), false);
  assert.equal(legalApprovalMatchesPolicy({ ...approval, revokedAt: "2026-11-17T00:00:00Z" }), false);
});

test("stored approval reader supplies both authoritative jurisdictions", () => {
  const service = readFileSync(new URL("../../lib/domain/digital-observer/privacy-compliance-service.ts", import.meta.url), "utf8");
  assert.match(service, /legalApprovalMatchesPolicy\(/);
  assert.match(service, /approvalJurisdiction: approval\?\.jurisdiction \?\? null/);
  assert.match(service, /policyJurisdiction: profile\?\.jurisdiction \?\? null/);
});
