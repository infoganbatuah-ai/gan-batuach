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
  for (const [before, after] of [["claim_writer", "risk_persist"], ["risk_persist", "effect_plan"], ["effect_plan", "effect_receipt"]]) {
    assert.ok(names.indexOf(before) < names.indexOf(after), `${before} must precede ${after}`);
  }
}
function verifyOwners(parts) {
  const selected = ["home_source", "home_epoch_fence", "home_alignment", "registration_writer_fixture", "frozen_binding", "acceptance_source", "claim_writer", "risk_persist", "effect_plan", "effect_receipt"];
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
  const homeBind = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+observer_home_review\.bind_accepted_event_v1\s*\(\s*p_event_id\s+uuid\s*\)/i;
  assert.match(parts.get("home_source"), homeBind);
  assert.match(parts.get("frozen_binding"), homeBind);
  assert.deepEqual(manifest.intentionalFunctionOverride,
    ["observer_home_review.bind_accepted_event_v1(uuid):home_source->frozen_binding"]);
  // Old RPC sketch collides with the replacement claim writer; retain as a reference only.
  assert.match(parts.get("old_claim_rpc_sketch"), /CREATE\s+FUNCTION\s+public\.claim_event_risk_v1\s*\(/i);
  assert.match(parts.get("claim_writer"), /CREATE\s+FUNCTION\s+public\.claim_event_risk_v1\s*\(/i);
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

console.log(`PASS: ${manifest.sources.length} pinned review sources; guards, order, DDL/function collision, receipt/audit and exclusion checks; ${negative} negative fixtures. Static only; NOT applied.`);
