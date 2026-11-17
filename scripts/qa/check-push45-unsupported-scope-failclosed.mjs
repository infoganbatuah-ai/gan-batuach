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
const retention = { dataClass: "DIGITAL_OBSERVER_EVIDENCE", expiresAt: "2020-01-01T00:00:00Z",
  activeLegalHold: false, externalSystemOwnsData: false, externalDeletionConfirmed: false,
  policyDecision: "EXTERNALLY_APPROVED" };

test("unknown stored context or capability cannot inherit an approved sensitive decision", () => {
  assert.equal(contract.evaluatePrivacyGate(approval, now).reason, "APPROVED");
  for (const changed of [{ context: "UNREVIEWED_CONTEXT" }, { capability: "UNREVIEWED_CAPABILITY" }]) {
    assert.equal(contract.evaluatePrivacyGate({ ...approval, ...changed }, now).reason, "UNSUPPORTED_SCOPE");
  }
});

test("unknown retention class cannot become deletion eligible", () => {
  assert.deepEqual(contract.evaluateRetentionDisposition(retention, now),
    { action: "DELETE_ELIGIBLE", reason: "EXPIRED_AND_UNHELD" });
  assert.deepEqual(contract.evaluateRetentionDisposition({ ...retention, dataClass: "UNREVIEWED_CLASS" }, now),
    { action: "REVIEW", reason: "UNSUPPORTED_DATA_CLASS" });
  assert.deepEqual(contract.evaluateRetentionDisposition({ ...retention, dataClass: "UNREVIEWED_CLASS", activeLegalHold: true }, now),
    { action: "PRESERVE", reason: "LEGAL_HOLD" });
});
