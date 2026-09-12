import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const migration = read("supabase/migrations/20260912050000_management_enrollment_activation.sql");
const api = read("app/api/garden/enrollment-requests/[id]/activation/route.ts");
const form = read("components/manual-enrollment-activation-form.tsx");

test("one evidence-backed activation transaction owns the terminal transition", () => {
  assert.match(migration, /activate_enrollment_from_evidence/);
  assert.match(migration, /req\.status<>'awaiting_payment'/);
  assert.match(migration, /status='activated'/);
  assert.match(migration, /activated_enrollment_id=enrollment\.id/);
});

test("reservation, enrollment and Classroom occupancy convert exactly once", () => {
  assert.match(migration, /enrollment_request_id=req\.id and garden_id=req\.garden_id and classroom_id=req\.requested_classroom_id for update/);
  assert.match(migration, /hold\.status<>'active'/);
  assert.match(migration, /child_one_active_garden_enrollment_idx/);
  assert.match(migration, /status='consumed',consumed_at=now_at/);
  assert.match(migration, /child_classroom_current_unique|is_current/);
});

test("manual arrangement is manager-only, structured and not provider-paid", () => {
  assert.match(migration, /record_manual_enrollment_arrangement/);
  assert.match(migration, /can_manage_garden\(req\.garden_id\)/);
  assert.match(migration, /'bank_transfer','standing_order','checks'/);
  assert.match(migration, /covered_until >= covered_from/);
  assert.match(migration, /evidence_kind='manual_arrangement' then 'arranged'/);
  assert.match(api, /getManagementGardenContext/);
  assert.match(form, /הסדר תשלום ידני/);
});

test("electronic confirmation is system-only and mock providers fail closed", () => {
  assert.match(migration, /auth\.role\(\)<>'service_role'/);
  assert.match(migration, /target_provider_mode not in \('live','verified_test'\)/);
  assert.match(migration, /verified_test_requires_qa_request/);
  assert.doesNotMatch(api, /paid\s*[:=]\s*true|confirm_electronic_enrollment_payment/);
});

test("provider and manager retries serialize and return the existing activation", () => {
  assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\(target_request_id::text,0\)\)/);
  assert.match(migration, /unique\(garden_id,idempotency_key\)/);
  assert.match(migration, /unique\(provider_mode,provider_event_id\)/);
  assert.match(migration, /'idempotent',true/);
});

test("confirmed evidence failure becomes explicit reconciliation", () => {
  assert.match(migration, /exception when others/);
  assert.match(migration, /payment_reconciliation_required/);
  assert.match(migration, /reconciliation_reason/);
});

test("one active Garden cancels or reconciles other pending requests", () => {
  assert.match(migration, /child_profile_id=file\.id and id<>req\.id/);
  assert.match(migration, /another_garden_enrollment_activated/);
  assert.match(migration, /set status='released'/);
});

test("Parent tuition evidence remains separate from platform subscription", () => {
  assert.match(migration, /Parent-to-Garden tuition only/);
  assert.doesNotMatch(migration, /subscription_plan|garden_subscription|700/);
});
