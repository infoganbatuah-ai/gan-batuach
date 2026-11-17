import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(new URL("../../package.json", import.meta.url));
const ts = require("typescript");
const source = readFileSync(new URL("../../lib/domain/digital-observer/privacy-compliance.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022
} }).outputText;
const contract = {};
new Function("exports", compiled)(contract);
const now = new Date("2026-11-17T12:00:00Z");
const approval = { capability: "FACE_RECOGNITION", context: "HOME", purpose: "owner approved",
  tenantId: "tenant", siteId: "site", policyActive: true, decisionState: "EXTERNALLY_APPROVED",
  approvalScopeMatches: true, humanReviewRequired: true, humanReviewerId: "reviewer" };
const retention = { dataClass: "DIGITAL_OBSERVER_EVIDENCE", activeLegalHold: false,
  externalSystemOwnsData: false, externalDeletionConfirmed: false, policyDecision: "EXTERNALLY_APPROVED" };

test("malformed legal approval expiry cannot authorize sensitive activation", () => {
  assert.equal(contract.evaluatePrivacyGate({ ...approval, approvalExpiresAt: "not-a-date" }, now).reason,
    "APPROVAL_EXPIRY_INVALID");
  assert.equal(contract.evaluatePrivacyGate({ ...approval, approvalExpiresAt: "2020-01-01T00:00:00Z" }, now).reason,
    "APPROVAL_EXPIRED");
  assert.equal(contract.evaluatePrivacyGate({ ...approval, approvalExpiresAt: "2026-11-18T00:00:00Z" }, now).reason,
    "APPROVED");
});

test("malformed retention expiry cannot make evidence deletion eligible", () => {
  assert.deepEqual(contract.evaluateRetentionDisposition({ ...retention, expiresAt: "not-a-date" }, now),
    { action: "REVIEW", reason: "INVALID_EXPIRY" });
  assert.deepEqual(contract.evaluateRetentionDisposition({ ...retention, expiresAt: "2020-01-01T00:00:00Z" }, now),
    { action: "DELETE_ELIGIBLE", reason: "EXPIRED_AND_UNHELD" });
  assert.deepEqual(contract.evaluateRetentionDisposition({ ...retention, expiresAt: "not-a-date", activeLegalHold: true }, now),
    { action: "PRESERVE", reason: "LEGAL_HOLD" });
});
