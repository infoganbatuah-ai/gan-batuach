import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const directory = new URL("./", import.meta.url);
const location = fileURLToPath(directory);
assert(!location.includes("/supabase/migrations/"), "review package must remain outside migration discovery");

const draft = readFileSync(new URL("DRAFT-NOT-APPLIED.sql", directory), "utf8");
const preflight = readFileSync(new URL("SITE-PREFLIGHT-READ-ONLY.sql", directory), "utf8");
const contract = readFileSync(new URL("RPC-CONTRACT.md", directory), "utf8");
const effects = readFileSync(new URL("EFFECT-RECOVERY-REVIEW.md", directory), "utf8");
const inventory = JSON.parse(readFileSync(new URL("OBJECT-INVENTORY.json", directory), "utf8"));
const mapping = readFileSync(new URL("HOME-MAPPING.md", directory), "utf8");
const permissions = readFileSync(new URL("PERMISSIONS-AND-RPCS.md", directory), "utf8");
const rollback = readFileSync(new URL("FORWARD-AND-ROLLBACK.md", directory), "utf8");
const blockers = readFileSync(new URL("BLOCKING-FACTS.md", directory), "utf8");
const route = readFileSync(new URL("../../app/api/video-gateway/cloud-events/route.ts", directory), "utf8");

const executable = text => text.split("\n").filter(line => !line.trimStart().startsWith("--")).join("\n");
const draftExecutable = executable(draft);
const preflightExecutable = executable(preflight);
assert.match(draftExecutable, /^\s*BEGIN;\s*DO \$draft_guard\$/);
assert.match(draftExecutable, /RAISE EXCEPTION 'DRAFT_NOT_APPLIED/);
assert.doesNotMatch(draftExecutable, /^\s*(?:COMMIT|ROLLBACK)\s*;/im);
assert.doesNotMatch(draftExecutable, /\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b/i);
assert.doesNotMatch(draftExecutable, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\s+(?:INTO\s+|FROM\s+)?public\./i);
assert.doesNotMatch(preflightExecutable, /\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|GRANT|REVOKE|TRUNCATE)\b/i);
assert.match(contract, /complete_event_risk_v1[\s\S]*BLOCKED DESIGN GATE/);
assert.doesNotMatch(draftExecutable, /tenant_scope_key\s+text/i);
assert.equal(inventory.status, "DRAFT_NOT_APPLIED");
assert.equal(inventory.tenantCandidate, "public.digital_observer_organizations.id");
assert.equal(inventory.tenantCandidateStatus, "PROPOSED_NOT_HISTORICALLY_VERIFIED");
assert(inventory.objects.length >= 18, "inventory must include existing and proposed objects");
for (const object of inventory.objects) {
  assert(object.name && object.type && object.state && object.source && object.rollback, "inventory object fields required");
  if (object.state === "PROPOSED_GUARDED") {
    const identifier = object.name.replace(/^public\./, "").split(".").at(-1);
    assert(draftExecutable.includes(identifier), `guarded SQL must mention ${object.name}`);
  }
}
assert.equal(inventory.rpcSignatures.length, 7);
for (const signature of inventory.rpcSignatures) {
  assert(permissions.includes(signature), `permission review must include ${signature}`);
}
for (const table of ["observer_event_risk_claims", "observer_event_risk_effect_plans", "observer_event_risk_effect_receipts"]) {
  assert.match(draftExecutable, new RegExp(`CREATE TABLE public\\.${table}\\s*\\(`));
  assert.match(draftExecutable, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`));
  assert.match(draftExecutable, new RegExp(`REVOKE ALL ON TABLE public\\.${table} FROM PUBLIC, anon, authenticated;`));
}
assert.match(mapping, /historical/i);
assert.match(permissions, /effective ACL UNKNOWN|effective permissions/i);
assert.match(rollback, /BLOCKED|blocked/);
assert.match(blockers, /APPLY BLOCKED/);
assert.match(effects, /Completion boundary — BLOCKED/);
for (const required of ["Watch-rule evaluations", "Incident risk projection", "Verification", "Decision intent", "In-app notification journal", "Media-fault metadata and audit", "Digital Guard action dispatch", "Home scope — BLOCKED"]) {
  assert(effects.includes(required), `effect review must cover ${required}`);
}
assert.doesNotMatch(route, /claim_event_risk_v1|persist_event_risk_v1|complete_event_risk_v1/);
assert.doesNotMatch(route, /model-a-ownership|event-risk-recovery/);

console.log("Review-package containment checks passed: migration guard, read-only preflight, no runtime claim activation.");
