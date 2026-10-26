// Explicitly disposable, networkless synthetic PostgreSQL qualification only.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const container = "digital-observer-pgqa-20261026";
const prefix = "do_p39_dispatch_qa_";
const site = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const recipient = "aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa";
const delivery = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const provider = "digital-observer-sandbox-email";
const forward = readFileSync(new URL("forward.sql", import.meta.url), "utf8");
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
function statement({ id = delivery, expectedSite = site, expectedRecipient = recipient,
  attempt = 1, providerKey = provider, mode = "sandbox", outcome = "success",
  message = "synthetic-message", retrySeconds = null, errorCode = null,
  confirmed = true, usage = 1 } = {}) {
  return `select * from public.persist_digital_observer_dispatch_result_atomic(
    ${lit(id)}::uuid,${lit(expectedSite)}::uuid,${lit(expectedRecipient)}::uuid,
    ${attempt},${lit(providerKey)},${lit(mode)},${lit(outcome)},
    ${message === null ? "null" : lit(message)},${retrySeconds === null ? "null" : retrySeconds},
    ${errorCode === null ? "null" : lit(errorCode)},${confirmed},${usage});`;
}
function invoke(database, input) { return psql(database, `set role service_role; ${statement(input)}`); }
function value(database, input) {
  const result = invoke(database, input);
  assert.equal(result.status, 0, result.stderr.slice(0, 1100));
  return result.stdout.trim().split("\n").at(-1) ?? "";
}
function asyncInvoke(database, input) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", ["exec", "-i", container, "psql", "-X", "-qAt",
      "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", database],
    { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = ""; let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stdout, stderr }));
    child.stdin.end(`set role service_role; ${statement(input)}`);
  });
}
function counts(database, id = delivery) {
  return run(database, `select d.delivery_status||'|'||d.attempt_count||'|'||count(a.id)
    from public.digital_observer_notification_deliveries d
    left join public.digital_observer_delivery_attempts a on a.delivery_id=d.id
    where d.id=${lit(id)}::uuid group by d.id`);
}

if (process.argv[2] !== "--execute-disposable-qa") throw new Error("Explicit disposable QA flag required");
assert.match(forward, /^-- REVIEW ONLY[\s\S]*REVIEW_ONLY_PUSH39_DISPATCH_ATOMIC_MUST_NOT_RUN/);
const marker = forward.indexOf("-- CANDIDATE_START");
assert(marker > 0);
const candidate = `begin;\n${forward.slice(marker)}`;
const inspected = docker(["inspect", container, "--format", "{{json .}}"]);
assert.equal(inspected.status, 0);
const containerState = JSON.parse(inspected.stdout);
assert.equal(containerState.Name, `/${container}`);
assert.equal(containerState.State.Status, "running");
assert.equal(containerState.HostConfig.NetworkMode, "none");
assert.deepEqual(containerState.Mounts, []);
assert.deepEqual(containerState.HostConfig.PortBindings ?? {}, {});
assert.deepEqual(containerState.NetworkSettings.Ports ?? {}, {});
pass("exact QA container has no network, mounts or published ports");

assert.equal(run("postgres", `select count(*) from pg_database where datname like '${prefix}%'`), "0");
const database = `${prefix}${randomBytes(4).toString("hex")}`;
let created = false;
try {
  run("postgres", `create database ${database} template template0`);
  created = true;
  run(database, fixture);
  failure(psql(database, forward), "REVIEW_ONLY_PUSH39_DISPATCH_ATOMIC_MUST_NOT_RUN");
  assert.equal(run(database, `select to_regprocedure('public.persist_digital_observer_dispatch_result_atomic(uuid,uuid,uuid,integer,text,text,text,text,integer,text,boolean,numeric)') is null`), "t");
  run(database, candidate);
  pass("review guard aborts; candidate installed only in disposable database");

  for (const role of ["anon", "authenticated"]) {
    failure(psql(database, `set role ${role}; ${statement()}`), "permission denied");
  }
  pass("PUBLIC, anon and authenticated denied; only service role eligible");

  for (const input of [
    { expectedSite: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
    { expectedRecipient: "bbbbbbbb-0000-4000-8000-bbbbbbbbbbbb" },
    { providerKey: "wrong-provider" },
    { attempt: 2 },
    { mode: "production" }
  ]) failure(invoke(database, input), /MODE_MISMATCH|CLAIM_OR_SCOPE_MISMATCH/.source);
  assert.equal(counts(database), "dispatching|0|0");
  pass("Site, recipient, provider, attempt epoch and mode mismatches deny without writes");

  failure(psql(database, `begin; set role service_role; set local qa.fail_insert='on';
    ${statement()} commit;`), "QA_ATTEMPT_INSERT_FAILED");
  assert.equal(counts(database), "dispatching|0|0");
  failure(psql(database, `begin; set role service_role; set local qa.fail_update='on';
    ${statement()} commit;`), "QA_DELIVERY_UPDATE_FAILED");
  assert.equal(counts(database), "dispatching|0|0");
  pass("insert and delivery-update failures roll both writes back");

  run(database, `insert into public.digital_observer_delivery_attempts
    (delivery_id,observer_site_id,attempt_number,provider_key,provider_mode,request_id,outcome)
    values (${lit(delivery)}::uuid,${lit(site)}::uuid,1,${lit(provider)},'sandbox','stable-qa-a:1','success')`);
  failure(invoke(database, {}), "DISPATCH_ATTEMPT_DUPLICATE_UNVERIFIED");
  assert.equal(counts(database), "dispatching|0|1");
  run(database, `update public.digital_observer_delivery_attempts set outcome='permanent_failure'
    where delivery_id=${lit(delivery)}::uuid`);
  failure(invoke(database, {}), "DISPATCH_ATTEMPT_DUPLICATE_UNVERIFIED");
  assert.equal(counts(database), "dispatching|0|1");
  run(database, `delete from public.digital_observer_delivery_attempts where delivery_id=${lit(delivery)}::uuid`);
  pass("identical and conflicting pre-existing attempts both fail closed, never advance state");

  const successful = value(database, {});
  assert.match(successful, /\|sent\|1\|$/);
  assert.equal(counts(database), "sent|1|1");
  assert.equal(run(database, `select metadata->>'external_message_sent' from
    public.digital_observer_notification_deliveries where id=${lit(delivery)}::uuid`), "true");
  failure(invoke(database, {}), "DISPATCH_CLAIM_OR_SCOPE_MISMATCH");
  assert.equal(counts(database), "sent|1|1");
  pass("successful result and attempt persist together; replay cannot count or send again");

  run(database, `update public.digital_observer_notification_deliveries
    set delivery_status='dispatching',attempt_count=1 where id=${lit(delivery)}::uuid`);
  const retry = value(database, { attempt: 2, outcome: "rate_limit", message: null,
    retrySeconds: 60, errorCode: "SANDBOX_RATE_LIMIT", confirmed: false });
  assert.match(retry, /\|retry_scheduled\|2\|/);
  assert.equal(counts(database), "retry_scheduled|2|2");
  assert.equal(run(database, `select retryable and retry_after is not null from
    public.digital_observer_delivery_attempts where delivery_id=${lit(delivery)}::uuid
    and attempt_number=2`), "t");
  pass("second attempt uses bounded retry and immutable per-attempt identity");

  const otherInput = { id: other, expectedSite: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    expectedRecipient: "bbbbbbbb-0000-4000-8000-bbbbbbbbbbbb" };
  const concurrent = await Promise.all([asyncInvoke(database, { ...otherInput, outcome: "success" }),
    asyncInvoke(database, { ...otherInput, outcome: "unknown_outcome", message: null,
      confirmed: false })]);
  assert.equal(concurrent.filter((x) => x.status === 0).length, 1, concurrent.map((x) => x.stderr).join("; "));
  assert.match(concurrent.find((x) => x.status !== 0).stderr, /DISPATCH_CLAIM_OR_SCOPE_MISMATCH/);
  assert.equal(Number(run(database, `select count(*) from public.digital_observer_delivery_attempts
    where delivery_id=${lit(other)}::uuid`)), 1);
  const otherStatus = run(database, `select delivery_status from public.digital_observer_notification_deliveries
    where id=${lit(other)}::uuid`);
  assert(["sent", "unknown_outcome"].includes(otherStatus));
  pass("two competing results serialize: only one fenced attempt and state transition commit");

  run(database, `insert into public.digital_observer_notification_deliveries
    (id,observer_site_id,recipient_profile_id,channel,provider_mode,delivery_status,
     attempt_count,max_attempts,expires_at,stable_delivery_id,authorization_snapshot,metadata)
    values ('33333333-3333-4333-8333-333333333333',${lit(site)}::uuid,
      ${lit(recipient)}::uuid,'email','sandbox','dispatching',0,3,
      '2100-01-01T00:00:00Z','stable-qa-unknown',
      '{"profile_id":"aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa"}',
      '{"provider_key":"digital-observer-sandbox-email","external_message_sent":false}')`);
  const unknown = value(database, { id: "33333333-3333-4333-8333-333333333333",
    outcome: "unknown_outcome", message: null, confirmed: false });
  assert.match(unknown, /\|unknown_outcome\|1\|$/);
  assert.equal(run(database, `select metadata->>'external_message_sent' from
    public.digital_observer_notification_deliveries where id='33333333-3333-4333-8333-333333333333'`), "false");
  assert.equal(run(database, `select retryable from public.digital_observer_delivery_attempts
    where delivery_id='33333333-3333-4333-8333-333333333333'`), "f");
  pass("unknown external result is not delivery success and is not blindly retried");

  run(database, `insert into public.digital_observer_notification_deliveries
    (id,observer_site_id,recipient_profile_id,channel,provider_mode,delivery_status,
     attempt_count,max_attempts,expires_at,stable_delivery_id,authorization_snapshot,metadata)
    values ('44444444-4444-4444-8444-444444444444',${lit(site)}::uuid,
      ${lit(recipient)}::uuid,'email','sandbox','dispatching',0,3,
      '2100-01-01T00:00:00Z','stable-qa-disabled',
      '{"profile_id":"aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa"}',
      '{"provider_key":"digital-observer-sandbox-email","external_message_sent":false}')`);
  failure(invoke(database, { id: "44444444-4444-4444-8444-444444444444",
    mode: "disabled", outcome: "success" }), "DISPATCH_DISABLED_MODE_OUTCOME_INVALID");
  const blocked = value(database, { id: "44444444-4444-4444-8444-444444444444",
    mode: "disabled", outcome: "blocked", message: null, confirmed: false,
    usage: 0, errorCode: "PROVIDER_DISABLED" });
  assert.match(blocked, /\|terminal_failure\|1\|$/);
  pass("disabled adapter may record blocked evidence but cannot claim successful send");

  assert.equal(run(database, `select count(*) from public.digital_observer_delivery_attempts a
    join public.digital_observer_notification_deliveries d on d.id=a.delivery_id
    where a.observer_site_id<>d.observer_site_id`), "0");
  pass("attempt Site remains bound to locked delivery");
} finally {
  if (created) {
    const dropped = docker(["exec", container, "dropdb", "--if-exists", "-U", "postgres", database]);
    assert.equal(dropped.status, 0, dropped.stderr);
  }
  assert.equal(run("postgres", `select count(*) from pg_database where datname like '${prefix}%'`), "0");
  pass("disposable QA database removed; matching catalog count zero");
}
