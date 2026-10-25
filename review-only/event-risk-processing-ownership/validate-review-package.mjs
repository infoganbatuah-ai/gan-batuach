import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const directory = new URL("./", import.meta.url);
const location = fileURLToPath(directory);
assert(!location.includes("/supabase/migrations/"), "review package must remain outside migration discovery");

const draft = readFileSync(new URL("DRAFT-NOT-APPLIED.sql", directory), "utf8");
const rpcBodies = readFileSync(new URL("RPC-BODIES-NOT-APPLIED.sql", directory), "utf8");
const watchAcl = readFileSync(new URL("WATCH-RULE-ACL-NOT-APPLIED.sql", directory), "utf8");
const watchAclRollback = readFileSync(new URL("WATCH-RULE-ACL-ROLLBACK-NOT-APPLIED.sql", directory), "utf8");
const implementation = readFileSync(new URL("SEVEN-RPC-IMPLEMENTATION.md", directory), "utf8");
const preflight = readFileSync(new URL("SITE-PREFLIGHT-READ-ONLY.sql", directory), "utf8");
const contract = readFileSync(new URL("RPC-CONTRACT.md", directory), "utf8");
const effects = readFileSync(new URL("EFFECT-RECOVERY-REVIEW.md", directory), "utf8");
const inventory = JSON.parse(readFileSync(new URL("OBJECT-INVENTORY.json", directory), "utf8"));
const mapping = readFileSync(new URL("HOME-MAPPING.md", directory), "utf8");
const permissions = readFileSync(new URL("PERMISSIONS-AND-RPCS.md", directory), "utf8");
const rollback = readFileSync(new URL("FORWARD-AND-ROLLBACK.md", directory), "utf8");
const blockers = readFileSync(new URL("BLOCKING-FACTS.md", directory), "utf8");
const route = readFileSync(new URL("../../app/api/video-gateway/cloud-events/route.ts", directory), "utf8");
const fencedWrites = readFileSync(new URL("../../lib/domain/digital-observer/event-risk-fenced-writes.ts", directory), "utf8");
const recovery = readFileSync(new URL("../../lib/domain/digital-observer/event-risk-recovery.ts", directory), "utf8");
const ownershipSnapshot = readFileSync(new URL("../../lib/domain/digital-observer/event-risk-ownership-snapshot.ts", directory), "utf8");
const completionReview = readFileSync(new URL("OWNERSHIP-SNAPSHOT-COMPLETION.md", directory), "utf8");
const snapshotCompatibility = readFileSync(new URL("SNAPSHOT-PERSISTENCE-COMPATIBILITY.md", directory), "utf8");
const finalReview = readFileSync(new URL("FINAL-MIGRATION-REVIEW.md", directory), "utf8");
const fourWriterMap = readFileSync(new URL("FOUR-WRITER-SOURCE-TRANSACTION-MAP.md", directory), "utf8");
const localRiskRowComparator = readFileSync(new URL("../../lib/domain/digital-observer/event-risk-source-row-map.ts", directory), "utf8");
const localRiskRowTests = readFileSync(new URL("../../scripts/qa/check-event-risk-source-row-map-local.mjs", directory), "utf8");

const executable = text => text.split("\n").filter(line => !line.trimStart().startsWith("--")).join("\n");
const draftExecutable = executable(draft);
const rpcExecutable = executable(rpcBodies);
const aclExecutable = executable(watchAcl);
const aclRollbackExecutable = executable(watchAclRollback);
const preflightExecutable = executable(preflight);
assert.match(draftExecutable, /^\s*BEGIN;\s*DO \$draft_guard\$/);
assert.match(draftExecutable, /RAISE EXCEPTION 'DRAFT_NOT_APPLIED/);
assert.doesNotMatch(draftExecutable, /^\s*(?:COMMIT|ROLLBACK)\s*;/im);
assert.doesNotMatch(draftExecutable, /\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b/i);
assert.doesNotMatch(draftExecutable, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE)\s+(?:INTO\s+|FROM\s+)?public\./i);
for (const guarded of [rpcExecutable, aclExecutable, aclRollbackExecutable]) {
  assert.match(guarded, /^\s*BEGIN;\s*DO \$draft_guard\$/);
  assert.match(guarded, /RAISE EXCEPTION 'DRAFT_NOT_APPLIED/);
  assert.doesNotMatch(guarded, /^\s*(?:COMMIT|ROLLBACK)\s*;/im);
}
assert.equal((rpcExecutable.match(/\bCREATE FUNCTION public\./g) ?? []).length, 3);
const definedSignatures = [...rpcExecutable.matchAll(
  /CREATE FUNCTION public\.(\w+)\(([^)]*)\) RETURNS (jsonb|uuid)/g
)].map(([, name, argumentsText, result]) => {
  const types = argumentsText.split(",").map(argument => argument.trim().split(/\s+/).at(-1));
  return `public.${name}(${types.join(",")}) RETURNS ${result}`;
});
assert.equal(definedSignatures.length, 3, "all proposed bodies need statically recognizable signatures");
for (const signature of definedSignatures) {
  assert(inventory.rpcSignatures.includes(signature), `unexpected RPC signature: ${signature}`);
}
assert.doesNotMatch(rpcExecutable, /SECURITY DEFINER/i);
assert.equal((rpcExecutable.match(/current_user <> 'service_role'/g) ?? []).length, 3);
for (const name of ["claim", "renew", "recover_expired"]) {
  assert.match(rpcExecutable, new RegExp(`CREATE FUNCTION public\\.${name}_event_risk(?:_lease)?_v1\\(`));
}
for (const name of ["persist_event_risk_v1", "start_event_risk_effects_v1",
  "record_event_risk_effect_v1", "complete_event_risk_v1"]) {
  assert.doesNotMatch(rpcExecutable, new RegExp(`CREATE FUNCTION public\\.${name}\\(`));
  assert.match(implementation, new RegExp(`${name}[\\s\\S]*?BLOCKED`));
  assert.match(fourWriterMap, new RegExp(`## ${name} — source-mapped; SQL BLOCKED`));
}
assert.match(fourWriterMap, /No SQL\/RPC was executed/);
assert.match(fourWriterMap, /retention and legal-hold/);
assert.match(localRiskRowComparator, /export function compareSuppliedRiskRowForReview/);
assert.match(localRiskRowComparator, /assertFencedWrite\(state, context\)/);
assert.match(localRiskRowComparator, /isDeepStrictEqual\(suppliedRow\[column\], value\)/);
assert.doesNotMatch(localRiskRowComparator, /\b(?:createClient|db\.from|db\.rpc|fetch\()\b/);
assert.match(localRiskRowTests, /SOURCE_ROW_SEMANTIC_MATCH_ONLY/);
assert.equal((rpcExecutable.match(/REVOKE ALL ON FUNCTION public\./g) ?? []).length, 3);
assert.equal((rpcExecutable.match(/GRANT EXECUTE ON FUNCTION public\./g) ?? []).length, 3);
assert.doesNotMatch(aclExecutable, /\b(?:ALTER DEFAULT PRIVILEGES|CREATE FUNCTION|DROP FUNCTION)\b/i);
assert.equal((aclExecutable.match(/public\.record_digital_observer_watch_rule_evaluation\(/g) ?? []).length, 1);
assert.equal((aclRollbackExecutable.match(/public\.record_digital_observer_watch_rule_evaluation\(/g) ?? []).length, 1);
assert.match(aclExecutable, /FROM anon, authenticated/);
assert.doesNotMatch(aclExecutable, /\bGRANT\b/i);
assert.match(aclRollbackExecutable, /TO anon, authenticated/);
assert.doesNotMatch(aclRollbackExecutable, /\bREVOKE\b/i);
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
assert.equal(inventory.offlineBodyStatus.appliedOrActivated, false);
assert.equal(inventory.offlineBodyStatus.proposedGuarded.length, 3);
assert.equal(inventory.offlineBodyStatus.blockedNoBody.length, 4);
assert.deepEqual(
  new Set([...inventory.offlineBodyStatus.proposedGuarded, ...inventory.offlineBodyStatus.blockedNoBody]),
  new Set(inventory.rpcSignatures.map(signature => signature.match(/^public\.(\w+)\(/)?.[1]))
);
for (const signature of inventory.rpcSignatures) {
  assert(permissions.includes(signature), `permission review must include ${signature}`);
  assert(implementation.includes(signature.replace(/^public\./, "")), `implementation matrix must include ${signature}`);
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
assert.doesNotMatch(route, /event-risk-fenced-writes/);
assert.doesNotMatch(route, /event-risk-ownership-snapshot/);
assert.doesNotMatch(route, /event-risk-source-row-map/);
for (const functionName of ["persistFencedRisk", "startFencedEffects", "recordFencedEffect", "completeFencedRisk"]) {
  assert.match(fencedWrites, new RegExp(`export function ${functionName}\\(`));
}
assert.match(recovery, /"MANDATORY_DECISION_AUDIT"/);
for (const functionName of ["validateAuthoritativeEventRiskOwnership", "createDecisionTimeRecipientSnapshot",
  "validatePrePersistEventOwnership", "bindPostReadRiskOwnership",
  "preserveDecisionTimeSnapshot", "qualifyAtomicCompletionPlan"]) {
  assert.match(ownershipSnapshot, new RegExp(`export function ${functionName}\\(|export async function ${functionName}\\(`));
}
assert.match(ownershipSnapshot, /PRE_PERSIST_EVENT_CHAIN_VALIDATED/);
assert.match(ownershipSnapshot, /POST_READ_RISK_SCOPE_BOUND/);
assert.match(ownershipSnapshot, /riskDecisionId: input\.riskDecisionId/);
assert.doesNotMatch(route, /validatePrePersistEventOwnership|bindPostReadRiskOwnership/);
assert.match(draftExecutable, /recipient_snapshot_fingerprint text NOT NULL/);
assert.match(draftExecutable, /recipient_snapshot_schema_version integer NOT NULL/);
assert.match(draftExecutable, /jsonb_typeof\(recipient_snapshot\) = 'object'/);
assert.match(draftExecutable, /required_evidence_references jsonb NOT NULL/);
assert.match(draftExecutable, /ownership_evidence_ref text NOT NULL/);
assert.doesNotMatch(draftExecutable, /\b(?:DROP\s+TABLE|TRUNCATE\s+TABLE|DELETE\s+FROM)\b/i);
assert.match(completionReview, /PERSISTENCE AND RPC APPLICATION BLOCKED/);
assert.match(snapshotCompatibility, /NONE of the existing canonical stores is compatible/);
for (const candidate of ["digital_observer_risk_evaluations", "digital_observer_decision_intents",
  "digital_observer_action_intents", "digital_observer_notification_deliveries",
  "digital_observer_incident_verifications", "observer_correlated_events", "immutable_audit_events"]) {
  assert(snapshotCompatibility.includes(candidate), `snapshot review missing ${candidate}`);
}
assert.match(snapshotCompatibility, /required_evidence_references jsonb NOT\s+NULL/);
assert.match(snapshotCompatibility, /Retention[\s\S]*?UNKNOWN/i);
for (const section of ["## A.", "## B.", "## C.", "## D–G.", "## H.", "## I.", "## J.", "## K.", "## L."]) {
  assert(finalReview.includes(section), `final review missing ${section}`);
}
for (const required of ["NOT APPLIED", "APPLY BLOCKED", "Retention is **UNRESOLVED**",
  "Lossless rollback remains BLOCKED", "NOT RUN", "No database connection"]) {
  assert(finalReview.includes(required), `final review missing boundary: ${required}`);
}

console.log("Review-package containment checks passed: three abort-guarded offline SQL bodies, four disconnected write transitions, exact ACL scope, no runtime claim activation.");
