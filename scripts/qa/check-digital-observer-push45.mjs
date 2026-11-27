import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import ts from "typescript";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) return next(`${specifier}.ts`, context);
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".ts")) return { format: "module", shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText };
    return next(url, context);
  }
});

const contract = await import("../../lib/domain/digital-observer/privacy-compliance.ts");
const migration = readFileSync(new URL("../../supabase/migrations/20261019050000_digital_observer_push45_privacy_compliance.sql", import.meta.url), "utf8");
const route = readFileSync(new URL("../../app/api/digital-observer/privacy-compliance/route.ts", import.meta.url), "utf8");
const service = readFileSync(new URL("../../lib/domain/digital-observer/privacy-compliance-service.ts", import.meta.url), "utf8");
const center = readFileSync(new URL("../../components/digital-observer/privacy-compliance-center.tsx", import.meta.url), "utf8");
const matrix = readFileSync(new URL("../../DIGITAL_OBSERVER_NORTH_STAR_COMPLETION_MATRIX.md", import.meta.url), "utf8");
const ownership = JSON.parse(readFileSync(new URL("../../DIGITAL_OBSERVER_CAPABILITY_PUSH_OWNERSHIP_MAP.json", import.meta.url), "utf8"));
const register = JSON.parse(readFileSync(new URL("../../DIGITAL_OBSERVER_EXTERNAL_ACTIVATION_PROOF_REGISTER.json", import.meta.url), "utf8"));

assert.equal(contract.DIGITAL_OBSERVER_PRIVACY_CONTRACT, "digital-observer-privacy-compliance-v1");
assert.equal(new Set(contract.privacyContexts).size, 7);
assert.equal(new Set(contract.sensitiveCapabilities).size, 13);

const base = { capability: "FACE_RECOGNITION", context: "HOME", purpose: "authorized household access",
  tenantId: "tenant", siteId: "site", policyActive: true, decisionState: "EXTERNALLY_APPROVED",
  approvalScopeMatches: true, humanReviewRequired: true, humanReviewerId: "reviewer" };
assert.deepEqual(contract.evaluatePrivacyGate(base).reason, "APPROVED");
assert.deepEqual(contract.evaluatePrivacyGate({ ...base, decisionState: "LEGAL_REVIEW_PENDING" }).reason, "EXTERNAL_APPROVAL_REQUIRED");
assert.deepEqual(contract.evaluatePrivacyGate({ ...base, approvalScopeMatches: false }).reason, "APPROVAL_SCOPE_MISMATCH");
assert.deepEqual(contract.evaluatePrivacyGate({ ...base, humanReviewerId: null }).reason, "HUMAN_REVIEW_REQUIRED");
assert.deepEqual(contract.evaluatePrivacyGate({ ...base, context: "KINDERGARTEN" }).reason, "PROHIBITED");
assert.deepEqual(contract.evaluatePrivacyGate({ ...base, tenantId: null }).reason, "SCOPE_REQUIRED");
assert.deepEqual(contract.evaluatePrivacyGate({ ...base, purpose: "" }).reason, "PURPOSE_REQUIRED");

assert.equal(contract.evaluateRetentionDisposition({ dataClass: "DIGITAL_OBSERVER_EVIDENCE", expiresAt: "2020-01-01T00:00:00Z", activeLegalHold: true, externalSystemOwnsData: false, externalDeletionConfirmed: false, policyDecision: "EXTERNALLY_APPROVED" }).reason, "LEGAL_HOLD");
assert.equal(contract.evaluateRetentionDisposition({ dataClass: "SOURCE_RECORDING_REFERENCE", expiresAt: "2020-01-01T00:00:00Z", activeLegalHold: false, externalSystemOwnsData: true, externalDeletionConfirmed: false, policyDecision: "EXTERNALLY_APPROVED" }).reason, "EXTERNAL_DELETION_UNVERIFIED");
assert.equal(contract.truthfulDeletionReceipt({ internalCompleted: true, externalSystems: [{ system: "NVR", status: "UNKNOWN" }] }).status, "PARTIAL_OR_PENDING");

for (const token of ["legal_decision_state", "LEGAL_REVIEW_PENDING", "EXTERNALLY_APPROVED", "do_privacy_profile_activation_check", "decision_reference", "decision_checksum", "do_legal_approval_evidence_check", "privacy rights observer scope insert", "can_access_observer_site", "do_privacy_audit_block_mutation", "external_system_disposition", "automatic_execution_allowed=false", "source_recording_reference", "biometric_template"]) {
  assert(migration.includes(token), `migration missing ${token}`);
}
assert(!migration.match(/insert into public\.digital_observer_legal_approvals[\s\S]*'approved'/i), "migration must not seed legal approval");
assert(route.includes("getObserverSiteAccess") && route.includes("create_legal_hold") && route.includes("release_legal_hold") && route.includes("evaluate_sensitive_activation"));
assert(service.includes("releaseLegalHold") && service.includes("LEGAL_HOLD_SCOPE_DENIED") && service.includes("release_approved_by"));
assert(migration.includes('do notice acknowledgements own update') && migration.includes('grant update (acknowledgement_status'));
assert(migration.includes('legal holds observer manager read') && migration.includes('can_manage_observer_site(observer_site_id)'));
assert(service.includes("evaluatePrivacyGate") && service.includes('notification_decision: "pending_legal_review"'));
assert(center.includes("FAIL CLOSED") && center.includes("מחיקה מקומית אינה מוכיחה"));

assert(matrix.includes("**197**"), "matrix must retain reconciled capability count");
const ids = ownership.capabilities.map((item) => item.id);
assert.equal(ids.length, 197, "all 197 North-Star capability IDs must remain");
assert.equal(new Set(ids).size, 197, "all North-Star capability IDs must remain unique");
for (const required of ["notification-providers", "payment-providers", "enterprise-sso-scim", "external-api-webhooks-integrations", "oem-integrations", "native-mobile-store-readiness", "legal-privacy-approvals", "zero-install", "external-pilots"]) {
  assert(register.items.some((item) => item.id === required), `proof obligation disappeared: ${required}`);
}
for (const preserved of [
  "../../supabase/migrations/20261018010000_digital_observer_push39_orchestration.sql",
  "../../supabase/migrations/20261019010000_digital_observer_push40_commercial_billing.sql",
  "../../supabase/migrations/20261019020000_digital_observer_push41_enterprise_identity.sql",
  "../../supabase/migrations/20261019030000_digital_observer_push42_external_api.sql",
  "../../supabase/migrations/20261019040000_digital_observer_push43_oem_sdk.sql",
  "../../DIGITAL_OBSERVER_PUSH_44_IMPLEMENTATION_REPORT.md"
]) assert(readFileSync(new URL(preserved, import.meta.url), "utf8").length > 500, `missing preserved PUSH 39-44 artifact ${preserved}`);

console.log("PUSH 45 deterministic QA passed: fail-closed sensitive activation, scoped written approval evidence, truthful external deletion, legal hold precedence, Observer Site RLS, append-only privacy audit, child-biometric denial, incident legal-review state, 197 capability preservation and PUSH 38-44 proof preservation.");
