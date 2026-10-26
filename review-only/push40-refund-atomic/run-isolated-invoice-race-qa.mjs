// Disposable, synthetic PostgreSQL invoice/refund race qualification only.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const container = "digital-observer-pgqa-20261026";
const fixture = readFileSync(new URL("qa-fixture.sql", import.meta.url), "utf8");
const invoiceSql = readFileSync(new URL("invoice-source-uniqueness.sql", import.meta.url), "utf8");
const refundSql = readFileSync(new URL("forward.sql", import.meta.url), "utf8");
const indexName = "observer_invoices_source_payment_event_unique_idx";
const source1 = "66666666-6666-4666-8666-666666666666";
const source2 = "66666666-6666-4666-8666-666666666667";
const source3 = "66666666-6666-4666-8666-666666666668";
const invoice2 = "88888888-8888-4888-8888-888888888889";
const invoice3 = "88888888-8888-4888-8888-88888888888a";
const duplicateId = "88888888-8888-4888-8888-88888888888b";
const site = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherSite = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const actor = "11111111-1111-4111-8111-111111111111";

const lit = (value) => `'${String(value).replaceAll("'", "''")}'`;
function docker(args, options = {}) {
  const result = spawnSync("docker", args, { encoding: "utf8", maxBuffer: 2_000_000, ...options });
  if (result.error) throw result.error;
  return result;
}
function psql(database, input) {
  return docker(["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1",
    "-U", "postgres", "-d", database], { input });
}
function run(database, input) {
  const result = psql(database, input);
  if (result.status !== 0) throw new Error(`QA_SQL_FAILED: ${result.stderr.slice(0, 900)}`);
  return result.stdout.trim().split("\n").at(-1) ?? "";
}
function mustFail(result, code) {
  assert.notEqual(result.status, 0, `Expected ${code} failure`);
  assert.match(result.stderr, new RegExp(code));
}
function sourceCount(database, sourceId) {
  return Number(run(database, `select count(*) from public.observer_invoices
    where metadata->>'source_payment_event_id'=${lit(sourceId)}`));
}
function refundCall({ payment = source1, key = "qa-invoice-source-key-1", stable = "a".repeat(64) } = {}) {
  return `select id from public.authorize_digital_observer_refund_atomic(${lit(stable)},${lit(key)},
    ${lit(site)}::uuid,${lit(payment)}::uuid,1000,'ILS','Synthetic invoice race refund',${lit(actor)}::uuid)`;
}
function service(database, input) {
  return psql(database, `set role service_role;
    select set_config('request.jwt.claim.role','service_role',false);
    ${input}`);
}
function serviceValue(database, input) {
  const result = service(database, input);
  if (result.status !== 0) throw new Error(`QA_REFUND_FAILED: ${result.stderr.slice(0, 900)}`);
  return result.stdout.trim().split("\n").at(-1) ?? "";
}
function duplicateInvoice(id, sourceId) {
  return `insert into public.observer_invoices
    (id,observer_site_id,invoice_state,currency,metadata,immutable_invoice_id,invoice_number)
    values (${lit(id)},${lit(site)},'paid','ILS',jsonb_build_object(
      'source_payment_event_id',${lit(sourceId)},'checkout_intent_id','77777777-7777-4777-8777-777777777777'),
      ${lit(`other:${id}`)},${lit(`INV-${id}`)})`;
}
function asyncPsql(database, input, marker) {
  const child = spawn("docker", ["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1",
    "-U", "postgres", "-d", database], { stdio: ["pipe", "pipe", "pipe"] });
  let stdout = ""; let stderr = ""; let marked = false;
  let mark; let rejectMark;
  const signaled = new Promise((resolve, reject) => { mark = resolve; rejectMark = reject; });
  const completed = new Promise((resolve, reject) => {
    child.on("error", (error) => { rejectMark(error); reject(error); });
    child.on("close", (status) => { if (!marked) rejectMark(new Error(`QA_MARKER_MISSING: ${stderr}`)); resolve({ status, stdout, stderr }); });
  });
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
    if (!marked && stdout.includes(marker)) { marked = true; mark(); }
  });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.stdin.end(input);
  return { signaled, completed };
}
function pass(label) { process.stdout.write(`PASS ${label}\n`); }

if (process.argv[2] !== "--execute-disposable-qa") throw new Error("Explicit disposable QA flag required");
assert.match(invoiceSql, /^-- REVIEW ONLY[\s\S]*REVIEW_ONLY_INVOICE_SOURCE_UNIQUENESS_MUST_NOT_RUN/);
assert.match(refundSql, /^-- REVIEW ONLY[\s\S]*REVIEW_ONLY_REFUND_ATOMIC_SQL_MUST_NOT_RUN/);
const invoiceOffset = invoiceSql.indexOf("-- CANDIDATE_START");
const refundOffset = refundSql.indexOf("create function public.authorize_digital_observer_refund_atomic(");
assert(invoiceOffset > 0 && refundOffset > 0);
const invoiceCandidate = `begin;\n${invoiceSql.slice(invoiceOffset)}`; // Strip guard in memory only.
const refundCandidate = refundSql.slice(refundOffset);
const inspected = docker(["inspect", container, "--format", "{{json .}}"]);
assert.equal(inspected.status, 0);
const metadata = JSON.parse(inspected.stdout);
assert.equal(metadata.Name, `/${container}`);
assert.equal(metadata.State.Status, "running");
assert.equal(metadata.HostConfig.NetworkMode, "none");
assert.deepEqual(metadata.Mounts, []);
assert.deepEqual(metadata.HostConfig.PortBindings ?? {}, {});
assert.deepEqual(metadata.NetworkSettings.Ports ?? {}, {});
pass("exact PostgreSQL QA container is networkless, unmounted and port-closed");

const prefix = "do_p40_invoice_qa_";
assert.equal(run("postgres", `select count(*) from pg_database where datname like '${prefix}%'`), "0");
const database = `${prefix}${randomBytes(4).toString("hex")}`;
let created = false;
try {
  run("postgres", `create database ${database} template template0`);
  created = true;
  run(database, fixture);
  // Simulate the two existing independent unique keys; neither keys payment.
  run(database, `alter table public.observer_invoices add column immutable_invoice_id text;
    alter table public.observer_invoices add column invoice_number text;
    update public.observer_invoices set immutable_invoice_id='stable:'||id::text,
      invoice_number='INV-'||id::text;
    create unique index qa_immutable_invoice_id on public.observer_invoices(immutable_invoice_id);
    create unique index qa_invoice_number on public.observer_invoices(invoice_number)`);
  mustFail(psql(database, invoiceSql), "REVIEW_ONLY_INVOICE_SOURCE_UNIQUENESS_MUST_NOT_RUN");
  assert.equal(run(database, `select to_regclass('public.${indexName}') is null`), "t");
  pass("unchanged review guard prevents index creation");

  run(database, duplicateInvoice(duplicateId, source1));
  assert.equal(sourceCount(database, source1), 2);
  mustFail(psql(database, invoiceCandidate), "REFUND_INVOICE_SOURCE_DUPLICATE");
  assert.equal(sourceCount(database, source1), 2, "failed preflight must retain both synthetic invoices");
  assert.equal(run(database, `select to_regclass('public.${indexName}') is null`), "t");
  run(database, `delete from public.observer_invoices where id=${lit(duplicateId)}::uuid`);
  pass("duplicate preflight aborts transaction without deleting either invoice");

  run(database, `update public.observer_invoices set metadata=jsonb_build_object('source_payment_event_id','not-a-uuid')
    where id=${lit(invoice2)}::uuid`);
  mustFail(psql(database, invoiceCandidate), "REFUND_INVOICE_SOURCE_METADATA_INVALID");
  assert.equal(run(database, `select metadata->>'source_payment_event_id' from public.observer_invoices
    where id=${lit(invoice2)}::uuid`), "not-a-uuid");
  run(database, `update public.observer_invoices set metadata='{}'::jsonb where id=${lit(invoice2)}::uuid`);
  run(database, invoiceCandidate);
  assert.equal(run(database, `select i.indisunique and i.indisvalid from pg_index i
    where i.indexrelid='public.${indexName}'::regclass`), "t");
  assert.equal(sourceCount(database, source1), 1);
  pass("malformed legacy metadata aborts; missing legacy source remains but cannot qualify");

  run(database, refundCandidate);
  mustFail(service(database, `${refundCall({ payment: source2, key: "qa-missing-invoice-2" })};`), "REFUND_INVOICE_BINDING_REQUIRED");
  const firstRefund = serviceValue(database, `${refundCall()};`);
  assert.match(firstRefund, /^[0-9a-f-]{36}$/);
  assert.equal(Number(run(database, `select count(*) from public.digital_observer_financial_audit`)), 1);
  pass("one exact paid invoice qualifies; legacy invoice without source does not");

  run(database, `update public.observer_invoices set metadata=jsonb_build_object(
    'source_payment_event_id',${lit(source2)},'checkout_intent_id','77777777-7777-4777-8777-777777777778')
    where id=${lit(invoice2)}::uuid`);
  run(database, `update public.observer_invoices set observer_site_id=${lit(otherSite)}::uuid where id=${lit(invoice2)}::uuid`);
  mustFail(service(database, `${refundCall({ payment: source2, key: "qa-cross-site-invoice" })};`), "REFUND_INVOICE_BINDING_REQUIRED");
  run(database, `update public.observer_invoices set observer_site_id=${lit(site)}::uuid,
    metadata=jsonb_set(metadata,'{checkout_intent_id}','"77777777-7777-4777-8777-777777777780"')
    where id=${lit(invoice2)}::uuid`);
  mustFail(service(database, `${refundCall({ payment: source2, key: "qa-wrong-checkout" })};`), "REFUND_INVOICE_BINDING_REQUIRED");
  run(database, `update public.observer_invoices set metadata=jsonb_build_object(
    'source_payment_event_id','99999999-9999-4999-8999-999999999999',
    'checkout_intent_id','77777777-7777-4777-8777-777777777778') where id=${lit(invoice2)}::uuid`);
  mustFail(service(database, `${refundCall({ payment: source2, key: "qa-wrong-payment" })};`), "REFUND_INVOICE_BINDING_REQUIRED");
  pass("cross-Site, wrong-checkout and wrong-payment invoice bindings deny refund");

  // A second connection stages a paid invoice but rolls back. Read committed
  // refund must see no committed match; original legacy row remains untouched.
  const staged = asyncPsql(database, `begin;
    ${duplicateInvoice(duplicateId, source2)};
    select 'INVOICE_STAGED'; select pg_sleep(1); rollback;`, "INVOICE_STAGED");
  await staged.signaled;
  mustFail(service(database, `${refundCall({ payment: source2, key: "qa-uncommitted-invoice" })};`), "REFUND_INVOICE_BINDING_REQUIRED");
  const stagedResult = await staged.completed;
  assert.equal(stagedResult.status, 0, stagedResult.stderr);
  assert.equal(sourceCount(database, source2), 0);
  assert.equal(Number(run(database, `select count(*) from public.observer_invoices where id=${lit(invoice2)}::uuid`)), 1);
  pass("uncommitted invoice does not qualify; rollback preserves original legacy record");

  // Restore source2's fixture row. During refund's still-open transaction,
  // another connection attempts a second invoice for source3. The unique
  // expression index must reject it even with a different immutable ID.
  run(database, `update public.observer_invoices set metadata=jsonb_build_object(
    'source_payment_event_id',${lit(source2)},'checkout_intent_id','77777777-7777-4777-8777-777777777778')
    where id=${lit(invoice2)}::uuid`);
  const refundRace = asyncPsql(database, `begin; set role service_role;
    select set_config('request.jwt.claim.role','service_role',false);
    ${refundCall({ payment: source3, key: "qa-race-refund-3", stable: "b".repeat(64) })};
    select 'REFUND_STAGED'; select pg_sleep(1); commit;`, "REFUND_STAGED");
  await refundRace.signaled;
  mustFail(psql(database, `${duplicateInvoice(duplicateId, source3)};`), "duplicate key value violates unique constraint");
  const refundRaceResult = await refundRace.completed;
  assert.equal(refundRaceResult.status, 0, refundRaceResult.stderr);
  assert.equal(sourceCount(database, source3), 1);
  assert.equal(Number(run(database, `select count(*) from public.digital_observer_refunds where payment_event_id=${lit(source3)}::uuid`)), 1);
  assert.equal(Number(run(database, `select count(*) from public.digital_observer_financial_audit`)), 2);
  assert.equal(Number(run(database, `select count(*) from public.observer_invoices where id=${lit(invoice3)}::uuid`)), 1);
  pass("concurrent duplicate invoice insertion is rejected while refund commits once with audit");
} finally {
  if (created) {
    const result = psql("postgres", `drop database ${database} with (force)`);
    if (result.status !== 0) throw new Error(`QA_DATABASE_CLEANUP_FAILED: ${result.stderr.slice(0, 600)}`);
  }
  assert.equal(run("postgres", `select count(*) from pg_database where datname like '${prefix}%'`), "0");
  pass("disposable database removed; matching PostgreSQL catalog count is zero");
}
