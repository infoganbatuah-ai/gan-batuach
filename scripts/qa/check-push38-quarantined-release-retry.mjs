import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const manager = readFileSync("services/video-gateway/edge-update-manager.mjs", "utf8");
const command = readFileSync("scripts/qa/retry-push38-homeqa-connector-after-endpoint-reconciliation.mjs", "utf8");

test("manager retry requires signed release, exact rollback state, reason, and pinned remediation evidence", () => {
  assert.match(manager, /authorizeQuarantinedReleaseRetry/);
  assert.match(manager, /EDGE_UPDATE_RETRY_EVIDENCE_REQUIRED/);
  assert.match(manager, /state\.state !== "ROLLED_BACK"/);
  assert.match(manager, /originalFailurePreserved/);
  assert.match(manager, /delayedRecoveryCategories/);
  assert.match(manager, /item\.category === expectedFailureCategory/);
  assert.match(manager, /record\.reason !== expectedFailureCategory/);
  assert.match(manager, /this\.verifySlot\(current\)/);
  assert.match(manager, /this\.verifySlot\(failedPointer\)/);
});

test("retry removes only the verified failed slot and records an audit authorization", () => {
  assert.match(manager, /rmSync\(failedSlot, \{ recursive: true \}\)/);
  assert.match(manager, /quarantined\.filter\(\(item\) => item\.release_id !== manifest\.release_id\)/);
  assert.match(manager, /quarantine-retry-authorizations\.json/);
  assert.match(manager, /remediation_evidence_sha256/);
});

test("live command binds exact release, device, source, failure, and endpoint evidence", () => {
  for (const value of [
    "db267b52-6282-4944-bcee-5d4857698fb0",
    "7465c0f2-ba57-4299-b22e-f20cedb91c23",
    "qa-p38-health-connector-startup-d44b7e4262f9",
    "EDGE_UPDATE_CAMERA_PROGRESSION_FAILED",
    "P38_QA_DIAGNOSTIC_HOLD"
  ]) assert.match(command, new RegExp(value));
  assert.match(command, /endpointEvidence\.health_after\?\.media\?\.progressing !== 1/);
  assert.match(command, /cohort_percent !== 0/);
  assert.match(command, /status='ACTIVE'/);
});

test("normal OTA remains responsible for install and failed retry is re-quarantined", () => {
  assert.match(command, /ota_agent_owns_install: true/);
  assert.match(command, /manager\.quarantineRelease\(manifest, FAILURE\)/);
  assert.doesNotMatch(command, /adapter\.install|manager\.apply/);
});
