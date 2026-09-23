import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../../supabase/migrations/20260920170000_retire_generated_plaintext_credentials.sql", import.meta.url),
  "utf8"
);
assert.match(migration, /drop column if exists temporary_password/i);
assert.doesNotMatch(migration, /update\s+[^;]*temporary_password/i, "retirement migration must not transform or preserve plaintext credentials");

const fixtures = [
  { id: "active-verified", auth: true, active: true, verified: true, recoveryAvailable: true, recoveryProved: false },
  { id: "active-unverified", auth: true, active: true, verified: false, recoveryAvailable: true, recoveryProved: false },
  { id: "inactive-verified", auth: true, active: false, verified: true, recoveryAvailable: true, recoveryProved: false },
  { id: "inactive-unverified", auth: true, active: false, verified: false, recoveryAvailable: true, recoveryProved: false },
  { id: "orphan", auth: false, active: false, verified: false, recoveryAvailable: false, recoveryProved: false },
  { id: "synthetic", auth: true, active: true, verified: true, recoveryAvailable: true, recoveryProved: false, synthetic: true },
  { id: "already-recovered", auth: true, active: true, verified: true, recoveryAvailable: true, recoveryProved: true }
];

function classify(record) {
  if (!record.auth) return "ORPHANED_LEGACY";
  if (record.synthetic) return "SYNTHETIC_QA";
  if (record.recoveryProved) return "SAFE_TO_PURGE_AFTER_RECOVERY_PROOF";
  return "REQUIRES_USER_RECOVERY";
}

function phaseTwoSafe(records) {
  return records.every((record) => {
    const classification = classify(record);
    return classification === "ORPHANED_LEGACY" || classification === "SYNTHETIC_QA" || classification === "SAFE_TO_PURGE_AFTER_RECOVERY_PROOF";
  });
}

assert.equal(classify(fixtures[0]), "REQUIRES_USER_RECOVERY");
assert.equal(classify(fixtures[1]), "REQUIRES_USER_RECOVERY");
assert.equal(classify(fixtures[2]), "REQUIRES_USER_RECOVERY");
assert.equal(classify(fixtures[3]), "REQUIRES_USER_RECOVERY");
assert.equal(classify(fixtures[4]), "ORPHANED_LEGACY");
assert.equal(classify(fixtures[5]), "SYNTHETIC_QA");
assert.equal(classify(fixtures[6]), "SAFE_TO_PURGE_AFTER_RECOVERY_PROOF");
assert.equal(phaseTwoSafe(fixtures), false, "migration 12 must remain blocked while legitimate accounts lack recovery proof");

const afterRecovery = fixtures.map((record) => record.auth && !record.synthetic ? { ...record, recoveryProved: true } : record);
assert.equal(phaseTwoSafe(afterRecovery), true, "migration 12 should become eligible after every legitimate Auth identity has recovery proof");

console.log("Legacy credential remediation rehearsal PASS: unresolved legitimate accounts block phase 2; recovery proof unlocks retirement without retaining plaintext.");
