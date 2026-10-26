import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const proposal = read("../../review-only/push40-refund-atomic/invoice-source-uniqueness.sql");
const refundProposal = read("../../review-only/push40-refund-atomic/forward.sql");
const migration = read("../../supabase/migrations/20261019010000_digital_observer_push40_commercial_billing.sql");
const service = read("../../lib/domain/digital-observer/commercial-billing-service.ts");
const qa = read("../../review-only/push40-refund-atomic/run-isolated-invoice-race-qa.mjs");

test("source-payment uniqueness proposal is guarded, additive and not in active migration", () => {
  assert.match(proposal, /^-- REVIEW ONLY[\s\S]*REVIEW_ONLY_INVOICE_SOURCE_UNIQUENESS_MUST_NOT_RUN/);
  assert.match(proposal, /lock table public\.observer_invoices in share mode/);
  assert.match(proposal, /REFUND_INVOICE_SOURCE_DUPLICATE/);
  assert.match(proposal, /REFUND_INVOICE_SOURCE_METADATA_INVALID/);
  assert.match(proposal, /create unique index observer_invoices_source_payment_event_unique_idx\s+on public\.observer_invoices \(\(\(metadata->>'source_payment_event_id'\)::uuid\)\)/);
  assert.ok(!migration.includes("observer_invoices_source_payment_event_unique_idx"));
  assert.match(migration, /observer_invoices_immutable_id_idx[\s\S]*immutable_invoice_id/);
});

test("canonical writers distinguish draft checkout from paid source-payment binding", () => {
  const draft = service.slice(service.indexOf("async function ensureDraftInvoice("), service.indexOf("export async function createCheckoutIntent("));
  const activation = service.slice(service.indexOf("async function activateVerifiedCheckout("), service.indexOf("async function confirmRefund("));
  assert.match(draft, /immutable_invoice_id: immutableInvoiceId/);
  assert.match(draft, /metadata: \{ internal_commercial_record: true, legal_tax_document: false, checkout_intent_id: input\.checkoutId \}/);
  assert.ok(!draft.includes("source_payment_event_id"));
  assert.match(activation, /source_payment_event_id: paymentEvent\.id/);
  assert.match(activation, /invoice_state: "paid"/);
  assert.match(refundProposal, /REFUND_INVOICE_BINDING_REQUIRED/);
});

test("QA enforces exact isolated-container guard and tests both concurrent transactions", () => {
  assert.match(qa, /NetworkMode, "none"/);
  assert.match(qa, /metadata\.Mounts, \[\]/);
  assert.match(qa, /PortBindings \?\? \{\}/);
  assert.match(qa, /create database \$\{database\} template template0/);
  assert.match(qa, /REFUND_STAGED/);
  assert.match(qa, /INVOICE_STAGED/);
  assert.match(qa, /drop database \$\{database\} with \(force\)/);
});
