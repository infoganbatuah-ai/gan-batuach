// Prepared source-only regression cases. This module is not invoked in the
// source-preparation unit. It imports only the pure admission contract.
import assert from "node:assert/strict";
import test from "node:test";
import {
  CaptureAdmissionError, captureResult, requireCaptureSource,
  requireDevelopmentVersion, requireRegressionScenarios,
  requireSyntheticIdentities, requiredRegressionIds,
} from "./uxv6-capture-admission-contract.mjs";

const sha = "a".repeat(40);
const root = "/Volumes/DIGITAL_OBSERVER/Development/gan-batuach/gan-uxv6-fixture-test";
const source = {
  branch: "integration/development", sourceSha: sha, expectedSha: sha,
  baseUrl: "http://127.0.0.1:3000", environment: "DEVELOPMENT / INTEGRATION",
  productionAllowed: false, projectId: "gan-batuach-integration",
  runtimeRoot: "/Volumes/DIGITAL_OBSERVER/Development/gan-batuach",
  outputRoot: root, outputExists: false, workingTreeClean: true,
};
const version = {
  environment: "DEVELOPMENT / INTEGRATION", commit: sha,
  backend: "LOCAL_SUPABASE", production: false,
  startedAt: "2026-11-04T10:00:00.000Z",
};
const targets = requiredRegressionIds.map(id => ({
  id, route: "/dashboard/fixture", role: "Synthetic QA", reference: "approved.png",
}));
const viewports = [
  { label: "desktop", width: 1440, height: 1024 },
  { label: "mobile", width: 390, height: 844 },
];
const unassignedEmail = "unassigned@integration.qa.invalid";
const ownerEmail = "owner@integration.qa.invalid";
const users = [
  { id: "00000000-0000-4000-8000-000000000598", email: unassignedEmail,
    role: "parent", qaScenario: "PARENT_UNASSIGNED_NO_CHILD", password: "fixture-only" },
  { id: "00000000-0000-4000-8000-000000000599", email: ownerEmail,
    role: "owner", password: "fixture-only" },
];
const fixture = { environment: "DEVELOPMENT / INTEGRATION", users };
const denied = (fn, code) => assert.throws(fn,
  error => error instanceof CaptureAdmissionError && error.code === code);

test("source admission allows only the exact cleanly named Development target", () => {
  assert.equal(requireCaptureSource(source).sourceSha, sha);
  denied(() => requireCaptureSource({ ...source, branch: "main" }), "WRONG_BRANCH");
  denied(() => requireCaptureSource({ ...source, sourceSha: "b".repeat(40) }), "WRONG_SHA");
  denied(() => requireCaptureSource({ ...source, workingTreeClean: false }), "DIRTY_SOURCE");
  denied(() => requireCaptureSource({ ...source, baseUrl: "http://127.0.0.1:3200" }), "UNSAFE_TARGET");
  denied(() => requireCaptureSource({ ...source, baseUrl: "https://production.example" }), "UNSAFE_TARGET");
  denied(() => requireCaptureSource({ ...source, productionAllowed: true }), "UNSAFE_ENVIRONMENT");
  denied(() => requireCaptureSource({ ...source, projectId: "production" }), "UNSAFE_ENVIRONMENT");
  denied(() => requireCaptureSource({ ...source, outputRoot: "qa-evidence/v5-domain-regression" }), "UNSAFE_OUTPUT");
  denied(() => requireCaptureSource({ ...source, outputRoot: root + "/nested" }), "UNSAFE_OUTPUT");
  denied(() => requireCaptureSource({ ...source, outputRoot: root, outputExists: true }), "OUTPUT_EXISTS");
});

test("all sixteen named regression scenarios remain required and unique", () => {
  assert.equal(requireRegressionScenarios(targets).length, 16);
  denied(() => requireRegressionScenarios(targets.slice(1)), "SCENARIO_INVENTORY");
  denied(() => requireRegressionScenarios([...targets.slice(1), targets[1]]), "SCENARIO_INVENTORY");
  denied(() => requireRegressionScenarios(targets.map((item, i) =>
    i === 0 ? { ...item, route: "//external.example" } : item)), "SCENARIO_INVENTORY");
});

test("unassigned parent must be an explicitly supplied existing synthetic identity", () => {
  const admitted = requireSyntheticIdentities({
    metadata: fixture, requiredEmails: [ownerEmail], unassignedEmail,
  });
  assert.equal(admitted.get(unassignedEmail).id, users[0].id);
  denied(() => requireSyntheticIdentities({
    metadata: { ...fixture, users: [users[1]] }, requiredEmails: [ownerEmail], unassignedEmail,
  }), "MISSING_FIXTURE");
  denied(() => requireSyntheticIdentities({
    metadata: { ...fixture, users: [{ ...users[0], qaScenario: undefined }, users[1]] },
    requiredEmails: [ownerEmail], unassignedEmail,
  }), "INVALID_FIXTURE");
  denied(() => requireSyntheticIdentities({
    metadata: { ...fixture, users: [{ ...users[0], role: "staff" }, users[1]] },
    requiredEmails: [ownerEmail], unassignedEmail,
  }), "INVALID_FIXTURE");
  denied(() => requireSyntheticIdentities({
    metadata: { ...fixture, users: [...users, users[0]] },
    requiredEmails: [ownerEmail], unassignedEmail,
  }), "MISSING_FIXTURE");
  denied(() => requireSyntheticIdentities({
    metadata: { ...fixture, users: [{ ...users[0], password: "" }, users[1]] },
    requiredEmails: [ownerEmail], unassignedEmail,
  }), "MISSING_FIXTURE");
});

test("running app must identify exact local Development commit and backend", () => {
  assert.equal(requireDevelopmentVersion(version, sha).commit, sha);
  denied(() => requireDevelopmentVersion({ ...version, commit: "b".repeat(40) }, sha), "WRONG_VERSION");
  denied(() => requireDevelopmentVersion({ ...version, production: true }, sha), "WRONG_VERSION");
  denied(() => requireDevelopmentVersion({ ...version, backend: "REMOTE" }, sha), "WRONG_VERSION");
  denied(() => requireDevelopmentVersion({ ...version, startedAt: "bad" }, sha), "WRONG_VERSION");
});

test("complete screenshots are evidence awaiting visual review, never a PASS verdict", () => {
  const captures = targets.flatMap(target => viewports.map(viewport => ({
    id: target.id, viewport: `${viewport.width}x${viewport.height}`,
    file: `${root}/screenshots/${target.id}-${viewport.label}.webp`,
    sha256: "b".repeat(64), status: "PASS",
  })));
  const result = captureResult({ targets, viewports, captures, sourceSha: sha, version });
  assert.equal(result.captures.length, 32);
  assert.equal(result.mechanicalStatus, "CAPTURED");
  assert.equal(result.visualReview, "NOT_REVIEWED");
  assert.equal(result.status, "CAPTURED_PENDING_VISUAL_REVIEW");
  assert.equal(result.captures.every(row => row.status === "CAPTURED_PENDING_VISUAL_REVIEW"), true);
  const incomplete = captureResult({
    targets, viewports, captures: captures.slice(0, -1), sourceSha: sha, version,
    failedAt: { id: targets.at(-1).id, viewport: "390x844" },
  });
  assert.equal(incomplete.status, "CAPTURE_INCOMPLETE");
  assert.equal(incomplete.captures.at(-1).status, "CAPTURE_FAILED");
  assert.equal(incomplete.captures.some(row => row.status === "PASS"), false);
  const closeFailure = captureResult({
    targets, viewports, captures, sourceSha: sha, version,
    failedAt: { id: targets.at(-1).id, viewport: "390x844" },
  });
  assert.equal(closeFailure.status, "CAPTURE_INCOMPLETE");
  denied(() => captureResult({
    targets, viewports, captures: [...captures, captures[0]], sourceSha: sha, version,
  }), "CAPTURE_INVENTORY");
});
