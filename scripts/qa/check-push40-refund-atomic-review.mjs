import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const proposal = read("../../review-only/push40-refund-atomic/forward.sql");
const activeMigration = read("../../supabase/migrations/20261019010000_digital_observer_push40_commercial_billing.sql");
const activeService = read("../../lib/domain/digital-observer/commercial-billing-service.ts");
const signature = "authorize_digital_observer_refund_atomic(text,text,uuid,uuid,bigint,text,text,uuid)";

test("proposal stays guarded, additive and separate from the active refund path", () => {
  assert.match(proposal, /^-- REVIEW ONLY[\s\S]*REVIEW_ONLY_REFUND_ATOMIC_SQL_MUST_NOT_RUN/);
  assert.match(proposal, /create function public\.authorize_digital_observer_refund_atomic\(/);
  assert.match(proposal, new RegExp(`revoke all on function public\\.${signature.replaceAll("(", "\\(").replaceAll(")", "\\)")}`));
  assert.ok(activeMigration.includes("create or replace function public.authorize_digital_observer_refund("));
  assert.ok(!activeMigration.includes("authorize_digital_observer_refund_atomic"));
  assert.ok(activeService.includes('admin.rpc("authorize_digital_observer_refund"'));
  assert.ok(!activeService.includes('admin.rpc("authorize_digital_observer_refund_atomic"'));
});

test("one proposed transaction contains exact scope, payment fence and mandatory audit", () => {
  assert.match(proposal, /language plpgsql security invoker set search_path = ''/);
  assert.match(proposal, /payment_outcome <> 'confirmed'/);
  assert.match(proposal, /signature_valid is distinct from true/);
  assert.match(proposal, /digital_observer_payment_events[\s\S]*for update/);
  assert.match(proposal, /observer_site_memberships[\s\S]*member_role in \('owner','admin'\)/);
  assert.match(proposal, /REFUND_INVOICE_BINDING_REQUIRED/);
  assert.match(proposal, /REFUND_IDEMPOTENCY_CONFLICT/);
  assert.match(proposal, /REFUND_AUDIT_REPAIR_REQUIRED/);
  assert.match(proposal, /prior_total \+ p_amount_minor::numeric > payment.amount_minor::numeric/);
  assert.match(proposal, /insert into public\.digital_observer_refunds[\s\S]*insert into public\.digital_observer_financial_audit/);
});

test("existing service audit is a separate call and still requires future adapter change", () => {
  const start = activeService.indexOf("export async function requestRefund(");
  const end = activeService.indexOf("export async function runCommercialReconciliation", start);
  const current = activeService.slice(start, end);
  assert.ok(current.indexOf('admin.rpc("authorize_digital_observer_refund"') < current.indexOf("await audit(admin"));
});
