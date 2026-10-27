#!/usr/bin/env node
// Review-only source check. Reads SQL as text; never executes SQL or starts a service.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { adaptCanonicalHomeAcceptance } from "./adapt-canonical-home-acceptance-fence.mjs";
import { adaptFrozenIncidentAcceptance } from "./adapt-frozen-incident-acceptance.mjs";
import { adaptHomeRiskPersistFence } from "./adapt-home-risk-persist-fence.mjs";
import { adaptHomeEffectPlanFence } from "./adapt-home-effect-plan-fence.mjs";

const dir = fileURLToPath(new URL(".", import.meta.url));
const local = name => readFileSync(`${dir}${name}`, "utf8");
const claim = readFileSync(`${dir}../event-risk-atomic-claim-qualification/RPC-BODIES-SOURCE-NOT-APPLIED.sql`, "utf8");
const frozen = local("FROZEN-INCIDENT-BINDING-NOT-APPLIED.sql");
const acceptanceFence = local("CANONICAL-ACCEPTANCE-FENCE-NOT-APPLIED.sql");
const gitText = (sha, path) => execFileSync("git", ["show", `${sha}:${path}`], { encoding: "utf8" });
const originals = {
  home: gitText("8e7c81f8cd47e6fa6aae802fb0a773852e6e2da3",
    "review-only/event-time-ownership-qualification/HOME-REGISTRATION-SOURCE-NOT-APPLIED.sql"),
  acceptance: gitText("a6bd2ba5", "review-only/event-time-acceptance-writer/ACCEPT-LIVE-HOME-SIGNAL-NOT-APPLIED.sql"),
  persist: gitText("364672482f0f314fb672fbc0cd9549be9737fb74",
    "review-only/event-risk-persist-transaction/RPC-BODY-NOT-APPLIED.sql"),
  plan: gitText("784731da46aad974acfaa813e9efe948aab65204",
    "review-only/event-risk-effect-plan-transaction/RPC-BODY-NOT-APPLIED.sql"),
};
const sha = value => createHash("sha256").update(value).digest("hex");
const expected = {
  frozen: "794ba2082b881d005c9c50d5cfca897192b74fa624f1a51024bf2c8228554385",
  claim: "cea5c4c0994310802d5a9824633df83f7018343176f2df22014161fc4bbeb4db",
  acceptanceFence: "ae92a12c7ee59b53b84edb1d98446e29484d4043e1e1c4c38e6f4e64e7ae8dd6",
  home: "b0e313f5d76e7faf6c2d104da3873205df6974a0a3faf9d2980a280aa89cc2e5",
  persist: "903f67acaf36f583bb75ee05622fba12cb032d0960a50797a49a046d4620bf73",
  plan: "b15ed3e668716ecfdba9affb43fe9c1779d0813dace29ab9feec385c80b013c4",
};
function assertPinned(name, value) {
  assert.equal(sha(value), expected[name], `${name} source drift`);
}
for (const [name, value] of Object.entries({ frozen, claim, acceptanceFence,
  home: originals.home, persist: originals.persist, plan: originals.plan })) {
  assertPinned(name, value);
}
const acceptance = adaptFrozenIncidentAcceptance(
  adaptCanonicalHomeAcceptance(originals.acceptance).sql).sql;
const persist = adaptHomeRiskPersistFence(originals.persist).sql;
const plan = adaptHomeEffectPlanFence(originals.plan).sql;

function assertGuarded(name, text) {
  const guard = /RAISE\s+EXCEPTION\s+'(?:DRAFT_)?NOT_APPLIED:/i.exec(text)?.index ?? -1;
  const firstDdl = text.search(/\b(?:ALTER\s+TABLE|CREATE\s+(?:TABLE|FUNCTION|OR\s+REPLACE\s+FUNCTION))\b/i);
  assert.match(text, /^\s*(?:--[^\n]*\n)*BEGIN\s*;/i, `${name}: missing transaction guard`);
  assert.ok(guard > 0 && firstDdl > guard, `${name}: abort must precede DDL`);
  assert.doesNotMatch(text, /^\s*COMMIT\s*;/im, `${name}: COMMIT forbidden`);
}
function assertIdentityBeforeSignal(name, text) {
  const identity = text.indexOf("SELECT * INTO v_registration");
  const signal = text.indexOf("SELECT * INTO v_signal");
  assert.ok(identity > 0 && signal > identity, `${name}: reverse/missing identity lock order`);
  assert.match(text.slice(identity, signal), /FOR SHARE\s*;/,
    `${name}: identity row must be locked before Signal`);
}
function validate(parts) {
  for (const [name, value] of Object.entries(parts)) assertGuarded(name, value);
  const columnDdl = /ALTER\s+TABLE\s+observer_home_review\.event_bindings\s+ADD\s+COLUMN\s+incident_id\b/gi;
  const definitions = Object.values(parts).flatMap(value => [...value.matchAll(columnDdl)]);
  assert.equal(definitions.length, 1, "event_bindings.incident_id must have one DDL owner");
  assert.match(parts.frozen, /ADD\s+COLUMN\s+incident_id\s+uuid\s+REFERENCES\s+public\.observer_correlated_events\(id\)/i);
  assert.match(parts.frozen, /ADD\s+CONSTRAINT\s+event_binding_incident_required[\s\S]*?CHECK\s*\(incident_id IS NOT NULL\)\s+NOT VALID/i);
  assert.match(parts.frozen, /INSERT INTO observer_home_review\.event_bindings[\s\S]*?acceptance_ref,incident_id,/i);
  assert.match(parts.frozen, /q\.audit_ref=b\.binding_audit_ref AND q\.action='BOUND'/);
  assert.match(parts.acceptance, /bind_accepted_event_v1\(s\.id\)/);
  assert.match(parts.claim, /v_binding\.incident_id IS DISTINCT FROM v_incident\.id/);
  assert.match(parts.claim, /q\.audit_ref = v_binding\.binding_audit_ref/);
  assert.match(parts.persist, /v_binding\.incident_id IS DISTINCT FROM v_incident\.id/);
  assert.match(parts.persist, /q\.audit_ref=v_binding\.binding_audit_ref/);
  assert.match(parts.persist, /INSERT INTO public\.observer_event_risk_persistence_receipts/);
  assert.match(parts.persist, /audit_event_id/);
  assert.match(parts.plan, /v_binding\.incident_id IS DISTINCT FROM v_incident\.id/);
  assert.match(parts.plan, /q\.audit_ref=v_binding\.binding_audit_ref/);
  assert.match(parts.plan, /v_risk_receipt\.audit_event_id IS NULL/);
  assert.match(parts.plan, /v_risk_receipt\.owner_epoch IS NULL/);
  for (const name of ["claim", "persist", "plan"]) assertIdentityBeforeSignal(name, parts[name]);
}
const parts = { frozen, claim, acceptance, persist, plan };
validate(parts);
let negativeChecks = 0;
function catches(change, pattern) {
  assert.throws(() => validate({ ...parts, ...change }), pattern);
  negativeChecks++;
}
const duplicate = "\nALTER TABLE observer_home_review.event_bindings ADD COLUMN incident_id uuid;\n";
catches({ claim: claim + duplicate }, /one DDL owner/);
catches({ frozen: frozen.replace(/ADD\s+COLUMN\s+incident_id\s+uuid/, "ADD COLUMN wrong_id uuid") },
  /one DDL owner/);
catches({ claim: claim.replaceAll("v_binding.binding_audit_ref", "v_binding.missing_audit_ref") },
  /binding_audit_ref/);
catches({ plan: plan.replaceAll("v_risk_receipt.audit_event_id", "v_risk_receipt.missing_audit_id") },
  /audit_event_id/);
const reversed = plan.replace("SELECT * INTO v_registration", "__SWAP__")
  .replace("SELECT * INTO v_signal", "SELECT * INTO v_registration")
  .replace("__SWAP__", "SELECT * INTO v_signal");
catches({ plan: reversed }, /reverse\/missing identity lock order/);
catches({ frozen: frozen.replace("DRAFT_NOT_APPLIED", "unguarded") },
  /abort must precede DDL/);
assert.throws(() => assertPinned("plan", originals.plan + " "), /source drift/);
negativeChecks++;
console.log(`PASS: five guarded chain sources, one incident_id DDL owner, lock/receipt/audit dependencies; ${negativeChecks} negative fixtures (static only)`);
