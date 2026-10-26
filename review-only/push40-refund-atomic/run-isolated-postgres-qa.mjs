// Disposable synthetic PostgreSQL test. No canonical database or payment provider.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";

const container = "digital-observer-pgqa-20261026";
const directory = new URL("./", import.meta.url);
const fixture = readFileSync(new URL("qa-fixture.sql", directory), "utf8");
const guarded = readFileSync(new URL("forward.sql", directory), "utf8");
const signature = "public.authorize_digital_observer_refund_atomic(text,text,uuid,uuid,bigint,text,text,uuid)";
const ids = {
  owner: "11111111-1111-4111-8111-111111111111",
  admin: "22222222-2222-4222-8222-222222222222",
  foreign: "33333333-3333-4333-8333-333333333333",
  global: "44444444-4444-4444-8444-444444444444",
  viewer: "55555555-5555-4555-8555-555555555555",
  site: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  foreignSite: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  gardenSite: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  payment1: "66666666-6666-4666-8666-666666666666",
  payment2: "66666666-6666-4666-8666-666666666667",
  payment3: "66666666-6666-4666-8666-666666666668",
  foreignPayment: "66666666-6666-4666-8666-666666666669",
  invoice2: "88888888-8888-4888-8888-888888888889"
};
const lit = (value) => `'${String(value).replaceAll("'", "''")}'`;
function refundCall({ stable = "a".repeat(64), key = "qa-idempotency-001", site = ids.site,
  payment = ids.payment1, amount = 4000, currency = "ILS", reason = "Synthetic refund reason",
  actor = ids.owner } = {}) {
  return `public.authorize_digital_observer_refund_atomic(${lit(stable)},${lit(key)},${lit(site)}::uuid,` +
    `${lit(payment)}::uuid,${amount},${lit(currency)},${lit(reason)},${lit(actor)}::uuid)`;
}
const selectRefund = (input) => `select row_to_json(t) from ${refundCall(input)} t`;
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
  if (result.status !== 0) throw new Error(`QA_SQL_FAILED: ${result.stderr.slice(0, 1000)}`);
  return result.stdout.trim().split("\n").at(-1) ?? "";
}
function service(database, input, roleClaim = "service_role") {
  return psql(database, `set role service_role; select set_config('request.jwt.claim.role',${lit(roleClaim)},false);\n${input}`);
}
function serviceValue(database, input) {
  const result = service(database, input);
  if (result.status !== 0) throw new Error(`QA_SERVICE_SQL_FAILED: ${result.stderr.slice(0, 1000)}`);
  return result.stdout.trim().split("\n").at(-1) ?? "";
}
function mustFail(result, code) {
  assert.notEqual(result.status, 0, `Expected ${code} denial`);
  assert.match(result.stderr, new RegExp(code));
}
function count(database, table, condition = "true") {
  return Number(run(database, `select count(*) from public.${table} where ${condition}`));
}
function pass(label) { process.stdout.write(`PASS ${label}\n`); }
function asyncPsql(database, input) {
  const child = spawn("docker", ["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1",
    "-U", "postgres", "-d", database], { stdio: ["pipe", "pipe", "pipe"] });
  let stdout = ""; let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.stdin.end(input);
  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

if (process.argv[2] !== "--execute-disposable-qa") throw new Error("Explicit disposable QA flag required");
assert.match(guarded, /^-- REVIEW ONLY[\s\S]*REVIEW_ONLY_REFUND_ATOMIC_SQL_MUST_NOT_RUN/);
const offset = guarded.indexOf("create function public.authorize_digital_observer_refund_atomic(");
assert.ok(offset > 0, "Candidate missing after guard");
const candidate = guarded.slice(offset); // In-memory guard removal; no file mutation.
const inspected = docker(["inspect", container, "--format", "{{json .}}"]);
assert.equal(inspected.status, 0);
const metadata = JSON.parse(inspected.stdout);
assert.equal(metadata.Name, `/${container}`);
assert.equal(metadata.State.Status, "running");
assert.equal(metadata.HostConfig.NetworkMode, "none");
assert.deepEqual(metadata.Mounts, []);
assert.deepEqual(metadata.HostConfig.PortBindings ?? {}, {});
assert.deepEqual(metadata.NetworkSettings.Ports ?? {}, {});
const database = `do_p40_refund_qa_${randomBytes(4).toString("hex")}`;
assert.equal(run("postgres", `select count(*) from pg_database where datname=${lit(database)}`), "0");
let created = false;
try {
  run("postgres", `create database ${database} template template0`);
  created = true;
  run(database, fixture);
  mustFail(psql(database, guarded), "REVIEW_ONLY_REFUND_ATOMIC_SQL_MUST_NOT_RUN");
  assert.equal(run(database, `select to_regprocedure(${lit(signature)}) is null`), "t");
  pass("unchanged review guard aborts before installation");
  run(database, candidate);
  pass("proposed function installed only in disposable fixture");

  assert.equal(run(database, `select has_function_privilege('service_role',${lit(signature)},'EXECUTE'),
    has_function_privilege('anon',${lit(signature)},'EXECUTE'),
    has_function_privilege('authenticated',${lit(signature)},'EXECUTE')`), "t|f|f");
  for (const role of ["anon", "authenticated"]) {
    mustFail(psql(database, `set role ${role}; select set_config('request.jwt.claim.role','service_role',false);
      ${selectRefund()};`), "permission denied");
  }
  mustFail(service(database, `${selectRefund()};`, "authenticated"), "REFUND_SERVICE_ROLE_REQUIRED");
  mustFail(psql(database, `set role service_role; ${selectRefund()};`), "REFUND_SERVICE_ROLE_REQUIRED");
  pass("ACL denies anon/authenticated, including forged/missing request role");

  const ownerResult = JSON.parse(serviceValue(database, `${selectRefund()};`));
  assert.equal(ownerResult.amount_minor, 4000);
  assert.equal(ownerResult.invoice_id, "88888888-8888-4888-8888-888888888888");
  assert.equal(count(database, "digital_observer_refunds"), 1);
  assert.equal(count(database, "digital_observer_financial_audit"), 1);
  const replay = JSON.parse(serviceValue(database, `${selectRefund()};`));
  assert.equal(replay.id, ownerResult.id);
  assert.equal(count(database, "digital_observer_financial_audit"), 1);
  for (const change of [
    { amount: 4001 }, { currency: "USD" }, { actor: ids.admin },
    { reason: "Different synthetic reason" }, { payment: ids.payment2 },
    { stable: "b".repeat(64) }
  ]) mustFail(service(database, `${selectRefund(change)};`), "REFUND_IDEMPOTENCY_CONFLICT");
  pass("authorized owner create, one audit, equivalent replay, semantic conflict denial");

  for (const actor of [ids.foreign, ids.global, ids.viewer]) {
    mustFail(service(database, `${selectRefund({ actor, key: "qa-idempotency-foreign", stable: "c".repeat(64) })};`), "REFUND_ACTOR_DENIED");
  }
  mustFail(service(database, `${selectRefund({ site: ids.foreignSite, key: "qa-idempotency-wrongsite" })};`), "REFUND_ACTOR_DENIED");
  mustFail(service(database, `${selectRefund({ site: ids.gardenSite, key: "qa-idempotency-garden" })};`), "REFUND_SITE_DENIED");
  mustFail(service(database, `${selectRefund({ payment: ids.foreignPayment, key: "qa-idempotency-crosspay" })};`), "REFUND_CONFIRMED_PAYMENT_REQUIRED");
  run(database, `update public.observer_site_memberships set active=false where profile_id='${ids.admin}'`);
  mustFail(service(database, `${selectRefund({ actor: ids.admin, payment: ids.payment2, key: "qa-idempotency-revoked" })};`), "REFUND_ACTOR_DENIED");
  run(database, `update public.observer_site_memberships set active=true where profile_id='${ids.admin}'`);
  pass("foreign/global/viewer/Garden/wrong Site and revoked membership denied");

  mustFail(service(database, `${selectRefund({ payment: ids.payment2, amount: 9000, key: "qa-idempotency-excess" })};`), "REFUND_AMOUNT_INVALID");
  mustFail(service(database, `${selectRefund({ payment: ids.payment2, currency: "USD", key: "qa-idempotency-currency" })};`), "REFUND_CURRENCY_MISMATCH");
  mustFail(service(database, `${selectRefund({ amount: 0, key: "qa-idempotency-zero" })};`), "REFUND_ARGUMENT_INVALID");
  mustFail(service(database, `${selectRefund({ reason: "x", key: "qa-idempotency-reason" })};`), "REFUND_ARGUMENT_INVALID");
  mustFail(service(database, `${selectRefund({ stable: "short", key: "qa-idempotency-stable" })};`), "REFUND_ARGUMENT_INVALID");
  mustFail(service(database, `${selectRefund({ amount: 7000, key: "qa-idempotency-overcap", stable: "d".repeat(64) })};`), "REFUND_AMOUNT_INVALID");
  pass("amount, currency, input shape and cumulative refund ceiling enforced");

  run(database, `update public.digital_observer_payment_events set signature_valid=false where id='${ids.payment2}'`);
  mustFail(service(database, `${selectRefund({ payment: ids.payment2, key: "qa-idempotency-unsigned" })};`), "REFUND_CONFIRMED_PAYMENT_REQUIRED");
  run(database, `update public.digital_observer_payment_events set signature_valid=true where id='${ids.payment2}'`);
  run(database, `update public.observer_invoices set metadata='{}'::jsonb where id='${ids.invoice2}'`);
  mustFail(service(database, `${selectRefund({ payment: ids.payment2, key: "qa-idempotency-noinvoice" })};`), "REFUND_INVOICE_BINDING_REQUIRED");
  run(database, `update public.observer_invoices set metadata=jsonb_build_object(
    'source_payment_event_id','${ids.payment2}','checkout_intent_id','77777777-7777-4777-8777-777777777778') where id='${ids.invoice2}'`);
  run(database, `update public.observer_invoices set observer_site_id='${ids.foreignSite}' where id='${ids.invoice2}'`);
  mustFail(service(database, `${selectRefund({ payment: ids.payment2, key: "qa-idempotency-foreigninvoice" })};`), "REFUND_INVOICE_BINDING_REQUIRED");
  run(database, `update public.observer_invoices set observer_site_id='${ids.site}' where id='${ids.invoice2}'`);
  run(database, `insert into public.observer_invoices(id,observer_site_id,invoice_state,currency,metadata)
    select '88888888-8888-4888-8888-88888888888b',observer_site_id,invoice_state,currency,metadata
    from public.observer_invoices where id='${ids.invoice2}'`);
  mustFail(service(database, `${selectRefund({ payment: ids.payment2, key: "qa-idempotency-dupinvoice" })};`), "REFUND_INVOICE_BINDING_REQUIRED");
  run(database, "delete from public.observer_invoices where id='88888888-8888-4888-8888-88888888888b'");
  pass("unsigned payment and missing, cross-Site or duplicate invoice denied");

  const beforeAuditFailure = count(database, "digital_observer_refunds", `payment_event_id='${ids.payment2}'`);
  const auditBeforeFailure = count(database, "digital_observer_financial_audit");
  mustFail(service(database, `select set_config('qa.audit_fail','on',false);
    ${selectRefund({ payment: ids.payment2, actor: ids.admin, key: "qa-idempotency-audit", stable: "e".repeat(64) })};`), "QA_AUDIT_FAILURE");
  assert.equal(count(database, "digital_observer_refunds", `payment_event_id='${ids.payment2}'`), beforeAuditFailure);
  assert.equal(count(database, "digital_observer_financial_audit"), auditBeforeFailure);
  const adminResult = JSON.parse(serviceValue(database, `${selectRefund({ payment: ids.payment2, actor: ids.admin,
    key: "qa-idempotency-admin", stable: "f".repeat(64), amount: 3000 })};`));
  assert.equal(adminResult.requested_by, ids.admin);
  assert.equal(count(database, "digital_observer_financial_audit"), 2);
  pass("mandatory audit failure rolls refund back; authorized Site admin succeeds");

  run(database, `insert into public.digital_observer_refunds
    (stable_refund_id,idempotency_key,observer_site_id,payment_event_id,invoice_id,refund_status,
     amount_minor,currency,requested_by,authorized_by,safe_reason)
    values('${"1".repeat(64)}','qa-idempotency-legacy','${ids.site}','${ids.payment2}',
      '${ids.invoice2}','authorized',1000,'ILS','${ids.owner}','${ids.owner}','Synthetic refund reason')`);
  mustFail(service(database, `${selectRefund({ payment: ids.payment2, key: "qa-idempotency-legacy",
    stable: "1".repeat(64), amount: 1000 })};`), "REFUND_AUDIT_REPAIR_REQUIRED");
  pass("legacy refund without matching audit requires explicit repair");

  const raceScript = (stable, key) => `set role service_role;
    select set_config('request.jwt.claim.role','service_role',false);
    ${selectRefund({ payment: ids.payment3, stable, key, amount: 6000 })};`;
  const races = await Promise.all([
    asyncPsql(database, raceScript("2".repeat(64), "qa-idempotency-race-a")),
    asyncPsql(database, raceScript("3".repeat(64), "qa-idempotency-race-b"))
  ]);
  assert.equal(races.filter((race) => race.status === 0).length, 1);
  mustFail(races.find((race) => race.status !== 0), "REFUND_AMOUNT_INVALID");
  assert.equal(count(database, "digital_observer_refunds", `payment_event_id='${ids.payment3}'`), 1);
  assert.equal(Number(run(database, `select sum(amount_minor) from public.digital_observer_refunds where payment_event_id='${ids.payment3}'`)), 6000);
  pass("concurrent distinct-key refunds serialize under payment lock; one winner");
} finally {
  if (created) {
    const result = psql("postgres", `drop database ${database} with (force)`);
    if (result.status !== 0) throw new Error(`QA_DATABASE_CLEANUP_FAILED: ${result.stderr.slice(0, 500)}`);
  }
  assert.equal(run("postgres", `select count(*) from pg_database where datname=${lit(database)}`), "0");
  pass("disposable QA database removed");
}
