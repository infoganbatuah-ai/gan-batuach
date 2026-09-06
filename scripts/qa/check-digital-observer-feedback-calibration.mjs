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
    if (url.endsWith(".ts")) return {
      format: "module",
      shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
      }).outputText
    };
    return next(url, context);
  }
});

const {
  buildFeedbackQualityMetrics,
  calibrationRecommendation,
  decisionQualityFor
} = await import("../../lib/domain/digital-observer/feedback-calibration.ts");
const migration = readFileSync(new URL("../../supabase/migrations/20260906030000_digital_observer_feedback_calibration.sql", import.meta.url), "utf8");
const route = readFileSync(new URL("../../app/api/digital-observer/incidents/feedback/route.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../../app/digital-observer/incidents/page.tsx", import.meta.url), "utf8");
const panel = readFileSync(new URL("../../components/digital-observer/incident-feedback-panel.tsx", import.meta.url), "utf8");
const legacyReviewRoute = readFileSync(new URL("../../app/api/digital-observer/events/review/route.ts", import.meta.url), "utf8");
const adminPage = readFileSync(new URL("../../app/digital-observer/admin/quality/page.tsx", import.meta.url), "utf8");

const sample = (overrides = {}) => ({
  id: "sample-a",
  canonicalLabel: "TRUE_EXPECTED_ACTIVITY",
  environment: "PRODUCTION",
  incidentProvenance: "REAL_CAMERA_AI",
  reviewState: "REVIEWED",
  observerSiteId: "site-a",
  cameraSourceId: "camera-a",
  decision: "LOG_ONLY",
  verificationStatus: "CONFIRMED",
  verificationClassification: "OTHER_UNKNOWN",
  versionSnapshot: { model: [{ model: "ssd", version: "1" }], risk_engine: "risk-v1", verification: "verify-v2", decision: "decision-v1", baseline: "base-v1", rules: [] },
  ...overrides
});

// A — expected real activity is not a false detector result.
const expectedMetrics = buildFeedbackQualityMetrics([sample()]);
assert.equal(expectedMetrics.labels.TRUE_EXPECTED_ACTIVITY, 1);
assert.equal(expectedMetrics.labels.FALSE_DETECTION, 0);
assert.equal(decisionQualityFor("TRUE_EXPECTED_ACTIVITY", "LOG_ONLY"), "ALIGNED");

// B/K — tenant isolation and authorization are explicit in database and API contracts.
for (const required of [
  "can_label_digital_observer_site", "can_review_digital_observer_site", "observer_site_memberships",
  "FEEDBACK_SITE_ACCESS_DENIED", "GROUND_TRUTH_REVIEW_DENIED", "FEEDBACK_TARGET_SCOPE_MISMATCH"
]) assert(migration.includes(required), `missing feedback authorization guard: ${required}`);
assert(route.includes("getObserverSiteAccess") && route.includes("אין הרשאת Ground Truth"));

// C — correction appends history and supersedes the prior reviewed label.
for (const required of ["previous_feedback_id", "revision_number", "previous_review_id", "review_number", "SUPERSEDED"])
  assert(migration.includes(required), `missing revision history field: ${required}`);
const correctedMetrics = buildFeedbackQualityMetrics([
  sample({ id: "old", reviewState: "SUPERSEDED", canonicalLabel: "FALSE_DETECTION" }),
  sample({ id: "new", reviewState: "CORRECTED", canonicalLabel: "TRUE_EXPECTED_ACTIVITY" })
]);
assert.equal(correctedMetrics.reviewedIncidentCount, 1);
assert.equal(correctedMetrics.labels.FALSE_DETECTION, 0);

// D — a raw USER_LABEL is not reviewed Ground Truth.
assert(migration.includes("'raw_feedback', true") && migration.includes("'reviewed_ground_truth', false"));
assert(migration.includes("observer_ground_truth_reviews") && migration.includes("do-ground-truth-v1"));

// E — test, fixture, and mock provenance are excluded from Production metrics.
const isolated = buildFeedbackQualityMetrics([
  sample(),
  sample({ id: "test", environment: "TEST", canonicalLabel: "FALSE_DETECTION" }),
  sample({ id: "fixture", environment: "CALIBRATION_FIXTURE", canonicalLabel: "FALSE_DETECTION" }),
  sample({ id: "shadow", incidentProvenance: "SHADOW_AI", canonicalLabel: "FALSE_DETECTION" })
]);
assert.equal(isolated.reviewedIncidentCount, 1);
assert.equal(isolated.labels.FALSE_DETECTION, 0);

// F — reviewed FALSE_DETECTION becomes a calibration sample/signal, not a live change.
const falseDetection = buildFeedbackQualityMetrics([sample({ canonicalLabel: "FALSE_DETECTION", verificationStatus: "CONFIRMED" })]);
assert.equal(falseDetection.labels.FALSE_DETECTION, 1);
assert.equal(falseDetection.falseDetectionRate.denominator, 1);
assert(migration.includes("DETECTOR_REVIEW") && migration.includes("REVIEW_PERSON_DETECTOR_FALSE_POSITIVES"));

// G/H/30 — safe learning gate forbids live mutation and historical Risk rewriting.
const recommendation = calibrationRecommendation([sample()]);
assert.equal(recommendation.productionMutationAllowed, false);
assert.equal(recommendation.requiresHumanApproval, true);
assert.equal(recommendation.status, "INSUFFICIENT_SAMPLE");
for (const required of [
  "training_eligible = false", "raw_media_copied = false", "production_change_applied = false",
  "requires_human_approval = true", "historical_risk_rewritten", "automatic_learning_applied"
]) assert(migration.includes(required), `safe learning gate missing ${required}`);

// I — metrics remain separated by model/Risk/Verification/Decision/Baseline/rule versions.
const versioned = buildFeedbackQualityMetrics([
  sample(),
  sample({ id: "sample-b", versionSnapshot: { ...sample().versionSnapshot, verification: "verify-v3" } })
]);
assert.equal(versioned.versionGroups.length, 2);

// J — repeated requests use stable database idempotency constraints.
assert(migration.includes("unique (actor_id, idempotency_key)"));
assert(migration.includes("observer_ground_truth_reviewer_idempotency_uidx"));
assert(panel.includes("pendingKeys") && panel.includes("idempotency_key"));

// Product/admin integration and truthful language.
for (const required of ["TRUE_EXPECTED_ACTIVITY", "FALSE_DETECTION", "אינו משנה מיד מודל", "אישור כ‑Ground Truth"])
  assert(panel.includes(required), `feedback product panel missing ${required}`);
assert(page.includes("IncidentFeedbackPanel"));
assert(page.includes("createDigitalObserverAdminDataClient") && page.includes("observerAdmin && params?.site"),
  "authorized review admins must be able to open the linked real Incident without inheriting tenant access");
for (const required of ["False Detection Rate", "Recall", "Ground Truth", "גודל מדגם", "שינוי אוטומטי ב‑Production"])
  assert(adminPage.includes(required), `admin quality view missing ${required}`);
assert(!legacyReviewRoute.includes("record_digital_observer_feedback"), "legacy Event review must not create a competing calibration signal");
assert(route.includes("raw_feedback_is_ground_truth: false") && route.includes("automatic_production_mutation: false"));
assert(route.includes("id,ground_truth_review_id,scope_type"), "admin calibration API must expose the recommendation-to-review link");

console.log("Digital Observer feedback/calibration checks passed: canonical labels, authorization, revision history, Ground Truth separation, Production-only metrics, version awareness, idempotency, and the no-automatic-mutation learning gate.");
