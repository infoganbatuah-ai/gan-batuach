#!/usr/bin/env node
// Offline text/contract checks only: no SQL execution, service or database.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { adaptHomeEffectReceiptFence } from "./adapt-home-effect-receipt-fence.mjs";

const dir = fileURLToPath(new URL(".", import.meta.url));
const source = execFileSync("git", ["show",
  "e14464047b9aab5bb359d7012b50e14de7a0ad36:review-only/event-risk-effect-receipt-transaction/RPC-BODY-NOT-APPLIED.sql"],
{ encoding: "utf8" });
const frozen = readFileSync(`${dir}FROZEN-INCIDENT-BINDING-NOT-APPLIED.sql`, "utf8");
const claim = readFileSync(`${dir}../event-risk-atomic-claim-qualification/RPC-BODIES-SOURCE-NOT-APPLIED.sql`, "utf8");
const { sql, editCount } = adaptHomeEffectReceiptFence(source);
assert.equal(editCount, 5);

function validate(candidate) {
  const guard = candidate.indexOf("DRAFT_NOT_APPLIED");
  const ddl = candidate.indexOf("CREATE TABLE public.observer_event_risk_effect_receipts");
  const identity = candidate.indexOf("SELECT * INTO v_registration");
  const signal = candidate.indexOf("SELECT * INTO v_signal");
  const receipt = candidate.indexOf("SELECT * INTO v_receipt FROM public.observer_event_risk_effect_receipts");
  const fresh = candidate.indexOf("IF v_receipt.signal_id IS NULL THEN");
  const revoked = candidate.indexOf("v_registration.revoked IS DISTINCT FROM false");
  const epoch = candidate.indexOf("v_registration.owner_epoch IS DISTINCT FROM v_acceptance.owner_epoch");
  const newAudit = candidate.indexOf("INSERT INTO public.immutable_audit_events", fresh);
  const newReceipt = candidate.indexOf("INSERT INTO public.observer_event_risk_effect_receipts", fresh);
  const replay = candidate.indexOf("ELSE\n    v_reused := true;", newReceipt);
  const replayEnd = candidate.indexOf("  END IF;", replay);
  assert.ok(guard > 0 && guard < ddl, "guard must abort before DDL");
  assert.doesNotMatch(candidate, /^\s*COMMIT\s*;/im);
  assert.ok(identity > ddl && identity < signal && /FOR SHARE\s*;/.test(candidate.slice(identity, signal)),
    "Home identity lock must precede Signal");
  assert.match(candidate, /v_registration\.owner_epoch < v_acceptance\.owner_epoch/);
  assert.match(candidate, /v_binding\.incident_id IS DISTINCT FROM v_incident\.id/);
  assert.match(candidate, /q\.action='ACCEPTED'[\s\S]*?q\.owner_epoch=v_acceptance\.owner_epoch/);
  assert.match(candidate, /q\.action='BOUND' AND q\.audit_ref=v_binding\.binding_audit_ref/);
  assert.match(candidate, /v_signal\.metadata IS DISTINCT FROM v_home_metadata/);
  assert.ok(receipt > signal && fresh > receipt && revoked > fresh && epoch > fresh
    && newAudit > revoked && newAudit > epoch && newReceipt > newAudit
    && replay > newReceipt && replayEnd > replay,
  "new-write Home fence must follow receipt lookup and precede both inserts");
  assert.equal(candidate.split("v_registration.revoked IS DISTINCT FROM false").length - 1, 1,
    "revocation check belongs only to fresh-write branch");
  assert.doesNotMatch(candidate.slice(replay, replayEnd),
    /\b(?:INSERT|UPDATE|DELETE)\b/i, "historical replay must not mutate receipt/audit");
  assert.match(candidate, /p_effect_key IS DISTINCT FROM 'EVENT_INCIDENT_LINK'/);
  assert.match(candidate, /SECURITY INVOKER/);
  assert.match(candidate, /REVOKE ALL ON public\.observer_event_risk_effect_receipts/);
  assert.doesNotMatch(candidate, /^\s*GRANT\s+(?:EXECUTE|INSERT|UPDATE|DELETE)\b/im);
}
validate(sql);
assert.match(frozen, /ADD COLUMN incident_id uuid REFERENCES public\.observer_correlated_events\(id\)/);
assert.doesNotMatch(claim,
  /ALTER\s+TABLE\s+observer_home_review\.event_bindings\s+ADD\s+COLUMN\s+incident_id\b/i);
assert.match(sql, /REFERENCES public\.observer_event_risk_effect_plans\(signal_id,risk_engine_version\)/);
assert.match(sql, /target_link_id uuid NOT NULL REFERENCES public\.observer_correlated_event_links\(id\)/);
assert.match(sql, /mandatory_audit_id uuid NOT NULL UNIQUE REFERENCES public\.immutable_audit_events\(id\)/);

let negativeChecks = 0;
function catches(value, pattern) {
  assert.throws(() => validate(value), pattern);
  negativeChecks++;
}
catches(sql.replace("v_registration.revoked IS DISTINCT FROM false", "false"),
  /new-write Home fence/);
catches(sql.replace("v_registration.owner_epoch IS DISTINCT FROM v_acceptance.owner_epoch", "false"),
  /new-write Home fence/);
catches(sql.replace("v_binding.incident_id IS DISTINCT FROM v_incident.id", "false"),
  /incident_id/);
catches(sql.replace("q.action='BOUND' AND q.audit_ref=v_binding.binding_audit_ref", "false"),
  /binding_audit_ref/);
const reversed = sql.replace("SELECT * INTO v_registration", "__SWAP__")
  .replace("SELECT * INTO v_signal", "SELECT * INTO v_registration")
  .replace("__SWAP__", "SELECT * INTO v_signal");
catches(reversed, /identity lock must precede Signal/);
catches(sql.replace("DRAFT_NOT_APPLIED", "unguarded"), /guard must abort/);
catches(sql.replace("ELSE\n    v_reused := true;\n  END IF;", "ELSE\n    v_reused := true;\n    DELETE FROM public.observer_event_risk_effect_receipts;\n  END IF;"),
  /historical replay must not mutate/);
assert.throws(() => adaptHomeEffectReceiptFence(source + " "), /Expected values to be strictly equal/);
negativeChecks++;
console.log(`PASS: pinned guarded receipt writer, Home-first lock, fresh-write fence and immutable replay; ${negativeChecks} negative fixtures (static only)`);
