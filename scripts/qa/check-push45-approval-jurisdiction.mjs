import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as privacyContract from "../../lib/domain/digital-observer/privacy-compliance.ts";

const { legalApprovalMatchesPolicy } = privacyContract;

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

test("stored approval decision follows real service wiring and denies mismatched or premature records", async () => {
  const service = readFileSync(new URL("../../lib/domain/digital-observer/privacy-compliance-service.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(service, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  const exports = {};
  runInNewContext(compiled, {
    exports,
    require: (name) => {
      if (name === "server-only") return {};
      if (name === "node:crypto") return {};
      if (name === "./privacy-compliance") return privacyContract;
      throw new Error(`Unexpected import: ${name}`);
    }
  });

  const profile = {
    id: "policy-a", active: true, legal_decision_state: "EXTERNALLY_APPROVED",
    stated_purpose: "authorized household access", jurisdiction: "IL", organization_id: "tenant-a"
  };
  const approval = {
    approval_status: "approved", stated_purpose: "authorized household access", jurisdiction: "IL",
    effective_at: "2020-01-01T00:00:00Z", expires_at: null, revoked_at: null
  };
  const input = {
    siteId: "site-a", tenantId: "tenant-a", capability: "FACE_DETECTION", context: "HOME",
    purpose: "authorized household access", humanReviewerId: "reviewer-a"
  };
  const evaluate = async (storedProfile, storedApproval, request = input) => {
    const tables = [];
    const db = {
      from(table) {
        tables.push(table);
        const query = {
          select: () => query, eq: () => query, order: () => query, limit: () => query,
          maybeSingle: async () => ({
            data: table === "digital_observer_privacy_policy_profiles" ? storedProfile : storedApproval,
            error: null
          })
        };
        return query;
      }
    };
    const decision = await exports.evaluateStoredPrivacyApproval(db, request);
    assert.deepEqual(tables, ["digital_observer_privacy_policy_profiles", "digital_observer_legal_approvals"]);
    return decision;
  };

  assert.equal((await evaluate(profile, approval)).reason, "APPROVED");
  assert.equal((await evaluate({ ...profile, organization_id: "tenant-b" }, approval)).reason, "APPROVAL_SCOPE_MISMATCH");
  assert.equal((await evaluate(profile, { ...approval, jurisdiction: "US" })).reason, "APPROVAL_SCOPE_MISMATCH");
  assert.equal((await evaluate(profile, { ...approval, effective_at: "2999-01-01T00:00:00Z" })).reason, "APPROVAL_NOT_YET_EFFECTIVE");
  assert.equal((await evaluate(profile, { ...approval, revoked_at: "2020-02-01T00:00:00Z" })).reason, "APPROVAL_SCOPE_MISMATCH");
});
