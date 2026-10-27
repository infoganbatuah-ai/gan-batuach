#!/usr/bin/env node
// Review-only source inventory. Reads text; never connects to or executes SQL.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const manifest = JSON.parse(readFileSync(new URL("./HOME-RISK-CHAIN-ASSEMBLY-REVIEW-20261027.json", import.meta.url), "utf8"));
const hash = text => createHash("sha256").update(text).digest("hex");
const source = entry => entry.ref === "local"
  ? readFileSync(`${root}${entry.path}`, "utf8")
  : execFileSync("git", ["show", `${entry.ref}:${entry.path}`], { cwd: root, encoding: "utf8" });
const byId = new Map(manifest.sources.map(entry => [entry.id, entry]));
const texts = new Map(manifest.sources.map(entry => [entry.id, source(entry)]));

function verifyHash(entry, text) {
  assert.match(entry.sha256, /^[a-f0-9]{64}$/);
  assert.equal(hash(text), entry.sha256, `${entry.id}: source drift`);
}
function verifyGuard(id, text) {
  const guard = /RAISE\s+EXCEPTION\s+'(?:DRAFT_)?NOT_APPLIED:/i.exec(text)?.index ?? -1;
  const ddl = /\b(?:ALTER\s+TABLE|CREATE\s+(?:TABLE|FUNCTION|OR\s+REPLACE\s+FUNCTION))\b/i.exec(text)?.index ?? -1;
  assert.match(text, /^\s*(?:--[^\n]*\n)*BEGIN\s*;/i, `${id}: no transaction guard`);
  assert.ok(guard >= 0 && (ddl < 0 || guard < ddl), `${id}: guard must precede DDL`);
  assert.doesNotMatch(text, /^\s*COMMIT\s*;/im, `${id}: COMMIT forbidden`);
}
function verifyOrder(order) {
  const names = order.map(value => value.split(":")[0]);
  assert.equal(new Set(names).size, names.length, "duplicate order entry");
  assert.equal(names.length, byId.size, "missing source in future order");
  for (const name of names) assert.ok(byId.has(name), `unknown source: ${name}`);
  assert.ok(names.indexOf("frozen_binding") < names.indexOf("acceptance_source"), "frozen binding must precede acceptance");
  for (const [before, after] of [["claim_only_schema", "claim_writer"], ["claim_writer", "risk_persist"], ["risk_persist", "effect_plan"], ["effect_plan", "effect_receipt"]]) {
    assert.ok(names.indexOf(before) < names.indexOf(after), `${before} must precede ${after}`);
  }
}
function verifyOwners(parts) {
  const selected = ["home_source", "home_epoch_fence", "home_alignment", "registration_writer_fixture", "frozen_binding", "acceptance_source", "claim_only_schema", "claim_writer", "risk_persist", "effect_plan", "effect_receipt"];
  const incident = selected.flatMap(id => [...parts.get(id).matchAll(/ALTER\s+TABLE\s+observer_home_review\.event_bindings\s+ADD\s+COLUMN\s+incident_id\b/gi)].map(() => id));
  assert.deepEqual(incident, ["frozen_binding"], "incident_id DDL must have one owner");
  assert.match(parts.get("frozen_binding"), /binding_audit_ref/);
  assert.match(parts.get("risk_persist"), /audit_event_id/);
  assert.match(parts.get("effect_plan"), /audit_event_id/);
  assert.match(parts.get("effect_receipt"), /mandatory_audit_id/);
  assert.match(parts.get("claim_writer"), /owner_epoch/);
  const sketch = parts.get("claim_schema_sketch");
  assert.match(sketch, /CREATE\s+TABLE[^;]*observer_event_risk_effect_plans/i, "obsolete plan collision not identified");
  assert.match(sketch, /CREATE\s+TABLE[^;]*observer_event_risk_effect_receipts/i, "obsolete receipt collision not identified");
  assert.ok(manifest.excludedWholeFiles.includes("claim_schema_sketch"), "obsolete sketch must not be composed whole");
  assert.ok(manifest.excludedWholeFiles.includes("old_claim_rpc_sketch"), "older RPC sketch must not be composed whole");
  assert.ok(manifest.excludedWholeFiles.includes("home_acl_fixture"), "synthetic ACL must not become live ACL");
  verifyClaimOnly(parts.get("claim_only_schema"), sketch);
  const homeBind = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+observer_home_review\.bind_accepted_event_v1\s*\(\s*p_event_id\s+uuid\s*\)/i;
  assert.match(parts.get("home_source"), homeBind);
  assert.match(parts.get("frozen_binding"), homeBind);
  assert.deepEqual(manifest.intentionalFunctionOverride,
    ["observer_home_review.bind_accepted_event_v1(uuid):home_source->frozen_binding"]);
  // Old RPC sketch collides with the replacement claim writer; retain as a reference only.
  assert.match(parts.get("old_claim_rpc_sketch"), /CREATE\s+FUNCTION\s+public\.claim_event_risk_v1\s*\(/i);
  assert.match(parts.get("claim_writer"), /CREATE\s+FUNCTION\s+public\.claim_event_risk_v1\s*\(/i);
}
function verifyClaimOnly(text, sketch) {
  const create = /CREATE\s+TABLE\s+public\.observer_event_risk_claims\s*\(/gi;
  assert.equal([...text.matchAll(create)].length, 1, "claim table must have one DDL owner");
  assert.match(sketch, create, "source claim table anchor missing");
  assert.equal([...text.matchAll(/CREATE\s+INDEX\s+observer_event_risk_claim_recovery_idx\b/gi)].length, 1,
    "claim recovery index must have one DDL owner");
  assert.match(text, /PRIMARY KEY\s*\(signal_id,\s*risk_engine_version\)/i);
  for (const column of ["signal_id uuid NOT NULL", "risk_engine_version text NOT NULL", "tenant_id uuid NOT NULL", "observer_site_id uuid NOT NULL", "incident_id uuid NOT NULL", "owner_nonce uuid NOT NULL", "owner_epoch bigint NOT NULL DEFAULT 1", "lease_expires_at timestamptz NOT NULL", "risk_evaluation_id uuid", "created_at timestamptz NOT NULL", "updated_at timestamptz NOT NULL", "completed_at timestamptz"]) {
    assert.ok(text.includes(column) && sketch.includes(column), `claim column/source drift: ${column}`);
  }
  for (const status of ["CLAIMED", "RISK_PERSISTED", "EFFECTS_PENDING", "COMPLETED"]) {
    assert.match(text, new RegExp(`status = '${status}'`), `claim status missing: ${status}`);
    assert.match(sketch, new RegExp(`status = '${status}'`), `source status missing: ${status}`);
  }
  for (const name of ["observer_event_risk_claim_signal_fk", "observer_event_risk_claim_incident_fk", "observer_event_risk_claim_site_fk", "observer_event_risk_claim_site_tenant_fk", "observer_event_risk_claim_evaluation_fk", "observer_event_risk_claim_signal_site_fk", "observer_event_risk_claim_incident_site_fk", "observer_event_risk_claim_result_scope_fk"]) {
    assert.ok(text.includes(name) && sketch.includes(name), `claim FK/source drift: ${name}`);
  }
  assert.match(text, /ON\s+public\.observer_event_risk_claims\s*\(lease_expires_at\)\s+WHERE status <> 'COMPLETED'/i);
  assert.match(text, /ALTER TABLE public\.observer_event_risk_claims ENABLE ROW LEVEL SECURITY/i);
  assert.match(text, /REVOKE ALL ON TABLE public\.observer_event_risk_claims FROM PUBLIC, anon, authenticated/i);
  assert.doesNotMatch(text, /\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b/i, "claim-only must not own an RPC");
  assert.doesNotMatch(text, /\bCREATE\s+TABLE\s+(?:public\.)?observer_event_risk_effect_(?:plans|receipts)\b/i,
    "claim-only must not own Plan/Receipt");
  assert.doesNotMatch(text, /\b(?:ALTER|CREATE)\s+(?:TABLE|INDEX)\s+(?:public\.)?(?:observer_sites|observer_correlated_events|observer_intelligence_signals|digital_observer_risk_evaluations)\b/i,
    "claim-only must not change existing canonical tables");
  assert.ok(manifest.openGates.some(gate => gate.includes("referenced composite unique keys")),
    "unqualified FK dependencies must remain BLOCKED");
}

assert.equal(manifest.status, "REVIEW_ONLY_BLOCKED_NOT_EXECUTABLE");
assert.equal(manifest.baseline, "781f92a350f0f8e828e73f1b78afcb8018e7f0c9");
assert.equal(byId.size, manifest.sources.length, "duplicate source ID");
for (const entry of manifest.sources) {
  assert.ok(entry.role && entry.owns?.length && entry.requires && entry.locks && entry.acl, `${entry.id}: incomplete inventory`);
  verifyHash(entry, texts.get(entry.id));
  if (entry.path.endsWith(".sql")) verifyGuard(entry.id, texts.get(entry.id));
}
verifyOrder(manifest.futureIsolatedTestOrderOnly);
verifyOwners(texts);

let negative = 0;
const rejects = (fn, message) => { assert.throws(fn, message); negative++; };
rejects(() => verifyHash(byId.get("effect_plan"), `${texts.get("effect_plan")} `), /source drift/);
rejects(() => verifyGuard("claim_writer", texts.get("claim_writer").replace("DRAFT_NOT_APPLIED:", "UNGUARDED:")), /guard must precede DDL/);
const duplicate = new Map(texts);
duplicate.set("claim_writer", `${duplicate.get("claim_writer")}\nALTER TABLE observer_home_review.event_bindings ADD COLUMN incident_id uuid;`);
rejects(() => verifyOwners(duplicate), /one owner/);
const noAudit = new Map(texts);
noAudit.set("effect_receipt", noAudit.get("effect_receipt").replaceAll("mandatory_audit_id", "missing_audit_id"));
rejects(() => verifyOwners(noAudit), /mandatory_audit_id/);
rejects(() => verifyOrder([...manifest.futureIsolatedTestOrderOnly].reverse()), /frozen binding must precede acceptance/);
const collision = new Map(texts);
collision.set("old_claim_rpc_sketch", collision.get("old_claim_rpc_sketch").replace(/CREATE\s+FUNCTION\s+public\.claim_event_risk_v1/i, "CREATE FUNCTION public.not_the_claim"));
rejects(() => verifyOwners(collision), /claim_event_risk_v1/);
for (const [id, changed, expected] of [
  ["claim_only_schema", value => value.replace("observer_event_risk_claim_signal_site_fk", "missing_signal_scope_fk"), /claim FK\/source drift/],
  ["claim_only_schema", value => value.replace("status = 'EFFECTS_PENDING'", "status = 'SKIPPED'"), /claim status missing/],
  ["claim_only_schema", value => `${value}\nCREATE TABLE public.observer_event_risk_effect_plans (id uuid);`, /must not own Plan\/Receipt/],
  ["claim_only_schema", value => `${value}\nCREATE FUNCTION public.claim_event_risk_v1() RETURNS void LANGUAGE sql AS $$ SELECT NULL $$;`, /must not own an RPC/],
  ["claim_only_schema", value => value.replace("observer_event_risk_claim_recovery_idx", "wrong_index"), /recovery index must have one DDL owner/],
]) {
  const changedParts = new Map(texts);
  changedParts.set(id, changed(changedParts.get(id)));
  rejects(() => verifyOwners(changedParts), expected);
}

console.log(`PASS: ${manifest.sources.length} pinned review sources; claim-only FK/status/index/RLS contract, guards, order, DDL/function collision, receipt/audit and exclusion checks; ${negative} negative fixtures. Static only; NOT applied.`);
