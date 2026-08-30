import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const component = readFileSync("components/digital-observer/observer-intelligence-experience.tsx", "utf8");
const route = readFileSync("app/api/digital-observer/identity-candidates/route.ts", "utf8");
const migration = readFileSync("supabase/migrations/20260830010000_identity_candidate_access_class.sql", "utf8");

for (const value of ["household_resident", "authorized_visitor"]) {
  assert.ok(component.includes(value), `candidate UI missing ${value}`);
  assert.ok(route.includes(value), `candidate route missing ${value}`);
  assert.ok(migration.includes(value), `candidate migration missing ${value}`);
}
assert.ok(migration.includes("biometric_processing_active', false"), "classification must not silently enable matching");
assert.ok(migration.includes("observer_capability_audit_events"), "classification must be audited");
console.log("Identity candidate access classification QA PASS");
