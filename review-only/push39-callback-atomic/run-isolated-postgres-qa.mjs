// Synthetic, networkless PostgreSQL only. Never target a canonical database.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const container = "digital-observer-pgqa-20261026";
const prefix = "do_p39_callback_qa_";
const delivery = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const sql = readFileSync(new URL("forward.sql", import.meta.url), "utf8");
const fixture = readFileSync(new URL("qa-fixture.sql", import.meta.url), "utf8");
const lit = (value) => `'${String(value).replaceAll("'", "''")}'`;
const pass = (name) => process.stdout.write(`PASS ${name}\n`);

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
  assert.equal(result.status, 0, result.stderr.slice(0, 1100));
  return result.stdout.trim().split("\n").at(-1) ?? "";
}
function failure(result, expected) {
  assert.notEqual(result.status, 0, `expected ${expected} denial`);
  assert.match(result.stderr, new RegExp(expected));
}
function invoke(database, event, outcome, opts = {}) {
  const target = opts.delivery ?? delivery;
  const provider = opts.provider ?? "provider-a";
  const metadata = opts.metadata ?? "{}";
  const occurred = opts.occurred ?? "null";
  const statement = `select * from public.record_digital_observer_provider_callback_atomic(
    ${lit(target)}::uuid,${lit(provider)},${lit(event)},${lit(outcome)},
    ${occurred === "null" ? "null" : `${lit(occurred)}::timestamptz`},${lit(metadata)}::jsonb);`;
  return psql(database, `set role service_role; ${statement}`);
}
function invokeValue(database, event, outcome, opts) {
  const result = invoke(database, event, outcome, opts);
  assert.equal(result.status, 0, result.stderr.slice(0, 1100));
  return result.stdout.trim().split("\n").at(-1);
}
function asyncInvoke(database, event, outcome) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", ["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1",
      "-U", "postgres", "-d", database], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = ""; let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stdout, stderr }));
    child.stdin.end(`set role service_role; select * from public.record_digital_observer_provider_callback_atomic(
      ${lit(delivery)}::uuid,'provider-a',${lit(event)},${lit(outcome)},null,'{}'::jsonb);`);
  });
}

if (process.argv[2] !== "--execute-disposable-qa") throw new Error("Explicit disposable QA flag required");
assert.match(sql, /^-- REVIEW ONLY[\s\S]*REVIEW_ONLY_PUSH39_CALLBACK_ATOMIC_MUST_NOT_RUN/);
const marker = sql.indexOf("-- CANDIDATE_START");
assert(marker > 0);
const candidate = `begin;\n${sql.slice(marker)}`;
const inspected = docker(["inspect", container, "--format", "{{json .}}"]);
assert.equal(inspected.status, 0);
const metadata = JSON.parse(inspected.stdout);
assert.equal(metadata.Name, `/${container}`);
assert.equal(metadata.State.Status, "running");
assert.equal(metadata.HostConfig.NetworkMode, "none");
assert.deepEqual(metadata.Mounts, []);
assert.deepEqual(metadata.HostConfig.PortBindings ?? {}, {});
assert.deepEqual(metadata.NetworkSettings.Ports ?? {}, {});
pass("exact QA container is networkless, unmounted and port-closed");

assert.equal(run("postgres", `select count(*) from pg_database where datname like '${prefix}%'`), "0");
const database = `${prefix}${randomBytes(4).toString("hex")}`;
let created = false;
try {
  run("postgres", `create database ${database} template template0`);
  created = true;
  run(database, fixture);
  failure(psql(database, sql), "REVIEW_ONLY_PUSH39_CALLBACK_ATOMIC_MUST_NOT_RUN");
  assert.equal(run(database, `select to_regprocedure('public.record_digital_observer_provider_callback_atomic(uuid,text,text,text,timestamptz,jsonb)') is null`), "t");
  pass("review guard aborts and candidate is not installed");
  run(database, candidate);

  failure(psql(database, `set role anon; select * from public.record_digital_observer_provider_callback_atomic(
    '${delivery}','provider-a','anon','success',null,'{}');`), "permission denied");
  failure(psql(database, `set role authenticated; select * from public.record_digital_observer_provider_callback_atomic(
    '${delivery}','provider-a','auth','success',null,'{}');`), "permission denied");
  pass("PUBLIC, anon and authenticated cannot execute service-only RPC");

  failure(invoke(database, "wrong-provider", "success", { provider: "provider-b" }), "CALLBACK_PROVIDER_OR_SCOPE_MISMATCH");
  failure(invoke(database, "wrong-site", "success", { delivery: other }), "CALLBACK_PROVIDER_OR_SCOPE_MISMATCH");
  assert.equal(run(database, "select count(*) from public.digital_observer_provider_callbacks"), "0");
  pass("provider, Site and recipient-bound delivery scope fail closed");

  assert.equal(invokeValue(database, "event-1", "success", { occurred: "2026-10-26T10:00:00Z", metadata: '{"code":"ok"}' }), "f|f|delivered");
  assert.equal(invokeValue(database, "event-1", "success", { occurred: "2026-10-26T12:00:00+02:00", metadata: '{"code":"ok"}' }), "t|f|delivered");
  failure(invoke(database, "event-1", "permanent_failure"), "CALLBACK_EVENT_ID_CONFLICT");
  failure(invoke(database, "event-1", "success", { occurred: "2026-10-26T10:01:00Z" }), "CALLBACK_EVENT_ID_CONFLICT");
  failure(invoke(database, "event-1", "success", { occurred: "2026-10-26T10:00:00Z", metadata: '{"code":"changed"}' }), "CALLBACK_EVENT_ID_CONFLICT");
  assert.equal(run(database, "select count(*) from public.digital_observer_provider_callbacks"), "1");
  pass("atomic success, semantic replay and conflicting event-ID rejection");

  assert.equal(invokeValue(database, "event-2", "acknowledged"), "f|f|acknowledged");
  assert.equal(run(database, `select acknowledged_at is not null and terminal_at is not null
    from public.digital_observer_notification_deliveries where id='${delivery}'`), "t");
  assert.equal(invokeValue(database, "event-3", "permanent_failure"), "f|t|acknowledged");
  assert.equal(invokeValue(database, "event-3", "permanent_failure"), "t|f|acknowledged");
  pass("delivered-to-acknowledged; later terminal callback recorded without state rollback");

  run(database, `update public.digital_observer_notification_deliveries set delivery_status='sent',
    acknowledged_at=null,terminal_at=null where id='${other}';`);
  const failed = psql(database, `begin; set role service_role; set local qa.fail_update='on';
    select * from public.record_digital_observer_provider_callback_atomic(
      '${other}','provider-b','rollback-event','success',null,'{}'); commit;`);
  failure(failed, "QA_DELIVERY_UPDATE_FAILED");
  assert.equal(run(database, "select count(*) from public.digital_observer_provider_callbacks where provider_event_id='rollback-event'"), "0");
  assert.equal(run(database, `select delivery_status from public.digital_observer_notification_deliveries where id='${other}'`), "sent");
  pass("delivery update failure rolls back callback evidence and state together");

  assert.equal(invokeValue(database, "other-event", "timeout", { delivery: other, provider: "provider-b" }), "f|f|retry_scheduled");
  assert.equal(run(database, `select next_retry_at is not null from public.digital_observer_notification_deliveries where id='${other}'`), "t");
  failure(invoke(database, "not-eligible", "success", { delivery: other, provider: "provider-b" }), "CALLBACK_DELIVERY_NOT_ELIGIBLE");
  assert.equal(run(database, "select count(*) from public.digital_observer_provider_callbacks where provider_event_id='not-eligible'"), "0");
  pass("retry scheduling and ineligible-state rejection do not orphan callbacks");

  run(database, `update public.digital_observer_notification_deliveries set delivery_status='sent',
    expires_at=null where id='${other}'`);
  failure(invoke(database, "missing-expiry", "success", { delivery: other, provider: "provider-b" }), "CALLBACK_EXPIRY_MISSING");
  assert.equal(run(database, "select count(*) from public.digital_observer_provider_callbacks where provider_event_id='missing-expiry'"), "0");
  run(database, `update public.digital_observer_notification_deliveries set expires_at='2000-01-01T00:00:00Z'
    where id='${other}'`);
  assert.equal(invokeValue(database, "expired-event", "success", { delivery: other, provider: "provider-b" }), "f|f|expired");
  assert.equal(run(database, `select delivery_status from public.digital_observer_notification_deliveries where id='${other}'`), "expired");
  pass("missing expiry fails closed; expired delivery cannot become delivered");

  run(database, `update public.digital_observer_notification_deliveries set delivery_status='sent',
    next_retry_at=null,expires_at='2100-01-01T00:00:00Z' where id='${other}'`);
  const crossSite = invoke(database, "event-1", "success", { delivery: other, provider: "provider-b" });
  assert.equal(crossSite.status, 0, crossSite.stderr);
  // Different provider keys have independent event namespaces; same provider/event
  // cannot be rebound to another delivery even in the same Site.
  run(database, `insert into public.digital_observer_notification_deliveries
    (id,observer_site_id,recipient_profile_id,channel,provider_mode,delivery_status,
     attempt_count,max_attempts,expires_at,authorization_snapshot,metadata)
    values ('33333333-3333-4333-8333-333333333333',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa',
      'email','production','sent',1,3,'2100-01-01T00:00:00Z',
      '{"profile_id":"aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa"}',
      '{"provider_key":"provider-a"}')`);
  failure(invoke(database, "event-1", "success", { delivery: "33333333-3333-4333-8333-333333333333" }), "CALLBACK_EVENT_ID_CONFLICT");
  pass("same provider event cannot be rebound to a different recipient/delivery");

  run(database, `update public.digital_observer_notification_deliveries set recipient_profile_id=null
    where id='33333333-3333-4333-8333-333333333333'`);
  assert.equal(invokeValue(database, "deleted-recipient-evidence", "success", {
    delivery: "33333333-3333-4333-8333-333333333333" }), "f|f|delivered");
  pass("historical callback evidence remains recordable after recipient FK deletion via decision snapshot");

  run(database, `update public.digital_observer_notification_deliveries set
    recipient_profile_id='aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa',
    authorization_snapshot='{"profile_id":"bbbbbbbb-0000-4000-8000-bbbbbbbbbbbb"}'::jsonb
    where id='33333333-3333-4333-8333-333333333333'`);
  failure(invoke(database, "mismatched-recipient", "success", {
    delivery: "33333333-3333-4333-8333-333333333333" }), "CALLBACK_PROVIDER_OR_SCOPE_MISMATCH");
  pass("current recipient and immutable decision snapshot mismatch is denied");

  run(database, `update public.digital_observer_notification_deliveries set delivery_status='sent' where id='${delivery}'`);
  const concurrent = await Promise.all([asyncInvoke(database, "race-event", "success"), asyncInvoke(database, "race-event", "success")]);
  assert(concurrent.every((x) => x.status === 0), concurrent.map((x) => x.stderr).join("; "));
  assert.deepEqual(concurrent.map((x) => x.stdout.trim().split("\n").at(-1)).sort(), ["f|f|delivered", "t|f|delivered"]);
  assert.equal(run(database, "select count(*) from public.digital_observer_provider_callbacks where provider_event_id='race-event'"), "1");
  pass("two concurrent identical callbacks yield one commit and one semantic replay");

  run(database, `update public.digital_observer_notification_deliveries set delivery_status='sent' where id='${delivery}'`);
  const competing = await Promise.all([asyncInvoke(database, "race-success", "success"),
    asyncInvoke(database, "race-failure", "permanent_failure")]);
  assert(competing.every((x) => x.status === 0), competing.map((x) => x.stderr).join("; "));
  assert.equal(run(database, "select count(*) from public.digital_observer_provider_callbacks where provider_event_id like 'race-%'"), "3");
  assert(["delivered", "terminal_failure"].includes(run(database,
    `select delivery_status from public.digital_observer_notification_deliveries where id='${delivery}'`)));
  assert.equal(competing.filter((x) => x.stdout.includes("|t|")).length, 1);
  pass("competing callback outcomes serialize; second evidence cannot roll state backward");

  run(database, `update public.digital_observer_provider_channels set provider_key='provider-a'
    where observer_site_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    update public.digital_observer_notification_deliveries set metadata='{"provider_key":"provider-a"}'::jsonb,
    delivery_status='sent' where id='${other}'`);
  failure(invoke(database, "event-1", "success", { delivery: other, provider: "provider-a" }), "CALLBACK_EVENT_ID_CONFLICT");
  pass("global provider/event identity cannot be rebound across Sites");

  assert.equal(run(database, `select count(*) from public.digital_observer_provider_callbacks c
    join public.digital_observer_notification_deliveries d on d.id=c.delivery_id
    where c.observer_site_id<>d.observer_site_id`), "0");
  pass("synthetic callback Site binding remains consistent");
} finally {
  if (created) {
    const dropped = docker(["exec", container, "dropdb", "--if-exists", "-U", "postgres", database]);
    assert.equal(dropped.status, 0, dropped.stderr);
  }
  assert.equal(run("postgres", `select count(*) from pg_database where datname like '${prefix}%'`), "0");
  pass("disposable QA database removed; matching catalog count zero");
}
