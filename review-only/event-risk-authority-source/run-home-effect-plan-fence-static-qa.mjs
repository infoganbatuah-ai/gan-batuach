#!/usr/bin/env node
// Offline source-contract check only. Never runs SQL or starts PostgreSQL.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { adaptHomeEffectPlanFence } from "./adapt-home-effect-plan-fence.mjs";

const source = execFileSync("git", ["show",
  "784731da46aad974acfaa813e9efe948aab65204:review-only/event-risk-effect-plan-transaction/RPC-BODY-NOT-APPLIED.sql"],
{ encoding: "utf8" });
const { sql, editCount } = adaptHomeEffectPlanFence(source);
assert.equal(editCount, 5);
const identityLock = sql.indexOf("WHERE registration_id=v_acceptance.registration_id FOR SHARE");
const canonicalSignalLock = sql.indexOf("-- Continue the canonical Signal");
const riskReceiptCheck = sql.indexOf("v_risk_receipt.audit_event_id IS NULL");
const planInsert = sql.indexOf("INSERT INTO public.observer_event_risk_effect_plans");
assert.ok(identityLock > 0 && identityLock < canonicalSignalLock);
assert.ok(canonicalSignalLock < riskReceiptCheck && riskReceiptCheck < planInsert);
for (const gate of [
  "PLAN_HOME_AUTHORITY_REVOKED_OR_CHANGED",
  "PLAN_HOME_VERSION_CONFLICT",
  "PLAN_HOME_BINDING_CONFLICT",
  "PLAN_HOME_ACCEPTANCE_AUDIT_INVALID",
  "PLAN_HOME_BINDING_AUDIT_INVALID",
  "PLAN_HOME_OBSERVATION_CONFLICT",
  "PLAN_HOME_SIGNAL_CONFLICT",
  "observer_event_risk_persisted_v1",
]) assert.ok(sql.includes(gate), `missing static gate: ${gate}`);
assert.match(sql, /DRAFT_NOT_APPLIED/);
assert.doesNotMatch(sql, /^\s*COMMIT\s*;/im);
console.log("PASS: pinned Effect Plan source, exact anchors, lock-order and authority guards (static only)");
