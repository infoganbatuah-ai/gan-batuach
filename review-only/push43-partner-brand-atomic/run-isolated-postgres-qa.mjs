// Disposable, synthetic PostgreSQL qualification only. Never point at a project DB.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";

const container = "digital-observer-pgqa-20261026";
const directory = new URL("./", import.meta.url);
const fixture = readFileSync(new URL("qa-fixture.sql", directory), "utf8");
const guarded = readFileSync(new URL("forward.sql", directory), "utf8");
const signature = "public.save_digital_observer_partner_brand_atomic";
const ids = {
  owner: "11111111-1111-4111-8111-111111111111",
  admin: "22222222-2222-4222-8222-222222222222",
  outsider: "33333333-3333-4333-8333-333333333333",
  parent: "44444444-4444-4444-8444-444444444444",
  global: "55555555-5555-4555-8555-555555555555",
  org: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  foreignOrg: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  transferOrg: "99999999-9999-4999-8999-999999999999",
  partner: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  foreignPartner: "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
};
const baseBrand = {
  brand_name: "Synthetic QA Brand", product_name: "Synthetic QA Product",
  primary_color: "#112233", accent_color: "#445566",
  privacy_url: "https://qa.invalid/privacy", terms_url: "https://qa.invalid/terms",
  legally_required_notices: ["Synthetic legal notice"]
};
const lit = (value) => `'${String(value).replaceAll("'", "''")}'`;
const call = ({ actor = ids.owner, org = ids.org, partner = ids.partner,
  brand = baseBrand, correlation = "synthetic-qa-correlation", expected = null } = {}) =>
  `${signature}(${lit(partner)}::uuid,${lit(org)}::uuid,${lit(actor)}::uuid,` +
  `${lit(JSON.stringify(brand))}::jsonb,${lit(correlation)},${expected ? `${lit(expected)}::timestamptz` : "null"})`;

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
function service(database, input) {
  return psql(database, `set role service_role; select set_config('request.jwt.claim.role','service_role',false);\n${input}`);
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
function row(database) {
  return JSON.parse(run(database, `select row_to_json(b) from public.digital_observer_partner_brand_profiles b where partner_id='${ids.partner}'`));
}
function auditCount(database) {
  return Number(run(database, `select count(*) from public.digital_observer_enterprise_audit_events where resource_id='${ids.partner}'`));
}
function pass(label) { process.stdout.write(`PASS ${label}\n`); }

function asyncPsql(database, input, onOutput) {
  const child = spawn("docker", ["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1",
    "-U", "postgres", "-d", database], { stdio: ["pipe", "pipe", "pipe"] });
  let stdout = ""; let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; onOutput?.(stdout); });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.stdin.end(input);
  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

if (process.argv[2] !== "--execute-disposable-qa") {
  throw new Error("Explicit --execute-disposable-qa required");
}
assert.match(guarded, /^-- REVIEW ONLY[\s\S]*REVIEW_ONLY_PARTNER_BRAND_SQL_MUST_NOT_RUN/);
const start = guarded.indexOf("create or replace function public.save_digital_observer_partner_brand_atomic(");
assert.ok(start > 0, "Guarded candidate missing");
const candidate = guarded.slice(start); // Guard omitted in memory; file unchanged.
const inspected = docker(["inspect", container, "--format", "{{json .}}"]);
assert.equal(inspected.status, 0, "QA container unavailable");
const metadata = JSON.parse(inspected.stdout);
assert.equal(metadata.Name, `/${container}`);
assert.equal(metadata.State.Status, "running");
assert.equal(metadata.HostConfig.NetworkMode, "none");
assert.deepEqual(metadata.Mounts, []);
assert.deepEqual(metadata.HostConfig.PortBindings ?? {}, {});
assert.deepEqual(metadata.NetworkSettings.Ports ?? {}, {});
const database = `do_p43_brand_qa_${randomBytes(4).toString("hex")}`;
const existing = run("postgres", `select count(*) from pg_database where datname=${lit(database)}`);
assert.equal(existing, "0");
let created = false;
try {
  run("postgres", `create database ${database} template template0`);
  created = true;
  run(database, fixture);
  mustFail(psql(database, guarded), "REVIEW_ONLY_PARTNER_BRAND_SQL_MUST_NOT_RUN");
  assert.equal(run(database, `select to_regprocedure('${signature}(uuid,uuid,uuid,jsonb,text,timestamptz)') is null`), "t");
  pass("review guard aborts unchanged file before function installation");
  run(database, candidate);
  pass("candidate installed only in disposable synthetic database");

  const privileges = run(database, `select has_function_privilege('service_role', '${signature}(uuid,uuid,uuid,jsonb,text,timestamptz)', 'EXECUTE'),
    has_function_privilege('anon', '${signature}(uuid,uuid,uuid,jsonb,text,timestamptz)', 'EXECUTE'),
    has_function_privilege('authenticated', '${signature}(uuid,uuid,uuid,jsonb,text,timestamptz)', 'EXECUTE')`);
  assert.equal(privileges, "t|f|f");
  for (const role of ["anon", "authenticated"]) {
    const result = psql(database, `set role ${role}; select set_config('request.jwt.claim.role','service_role',false); select ${call()};`);
    mustFail(result, "permission denied");
  }
  mustFail(psql(database, `set role service_role; select set_config('request.jwt.claim.role','authenticated',false); select ${call()};`), "PARTNER_BRAND_SERVICE_ROLE_REQUIRED");
  mustFail(psql(database, `set role service_role; select ${call()};`), "PARTNER_BRAND_SERVICE_ROLE_REQUIRED");
  pass("service role ACL and forged request-role denial in SQL fixture");

  const createdRow = JSON.parse(serviceValue(database, `select row_to_json(${call()})`));
  assert.equal(createdRow.brand_name, baseBrand.brand_name);
  assert.equal(createdRow.domain_status, "unverified");
  assert.equal(auditCount(database), 1);
  const initialTime = createdRow.updated_at;
  const adminBrand = { ...baseBrand, brand_name: "Admin edit" };
  const adminRow = JSON.parse(serviceValue(database, `select row_to_json(${call({ actor: ids.admin, brand: adminBrand, expected: initialTime })})`));
  assert.equal(adminRow.brand_name, "Admin edit");
  assert.equal(auditCount(database), 2);
  mustFail(service(database, `select ${call({ expected: initialTime })}`), "PARTNER_BRAND_STALE_WRITE");
  pass("owner create, membership admin update, CAS stale, mandatory audit");

  const denied = [
    [{ actor: ids.outsider }, "PARTNER_BRAND_ACTOR_DENIED"],
    [{ actor: ids.parent }, "PARTNER_BRAND_ACTOR_DENIED"],
    [{ actor: ids.global }, "PARTNER_BRAND_ACTOR_DENIED"],
    [{ org: ids.foreignOrg }, "PARTNER_BRAND_SCOPE_DENIED"],
    [{ partner: ids.foreignPartner }, "PARTNER_BRAND_SCOPE_DENIED"],
    [{ brand: { ...baseBrand, domain_status: "verified_sandbox" } }, "PARTNER_BRAND_FIELD_DENIED"],
    [{ brand: { ...baseBrand, privacy_url: "ftp://qa.invalid" } }, "PARTNER_BRAND_OPTIONAL_VALUE_INVALID"],
    [{ brand: { ...baseBrand, privacy_url: "https://%" } }, "PARTNER_BRAND_OPTIONAL_VALUE_INVALID"],
    [{ brand: { ...baseBrand, legally_required_notices: [] } }, "PARTNER_BRAND_PAYLOAD_INVALID"],
    [{ brand: { ...baseBrand, legally_required_notices: ["x"] } }, "PARTNER_BRAND_NOTICE_INVALID"]
  ];
  for (const [input, expectedError] of denied) mustFail(service(database, `select ${call(input)}`), expectedError);
  assert.equal(auditCount(database), 2);
  pass("foreign, parent, global, cross-organization and malformed payload denial");

  run(database, `update public.digital_observer_organization_memberships set active=false where profile_id='${ids.admin}'`);
  mustFail(service(database, `select ${call({ actor: ids.admin, expected: adminRow.updated_at })}`), "PARTNER_BRAND_ACTOR_DENIED");
  run(database, `update public.digital_observer_organization_memberships set active=true where profile_id='${ids.admin}'`);
  pass("revoked membership denied; authorization remains server-side");

  run(database, `update public.digital_observer_partner_brand_profiles set domain_status='verified_sandbox' where partner_id='${ids.partner}'`);
  const verifiedTime = row(database).updated_at;
  const unchanged = JSON.parse(serviceValue(database, `select row_to_json(${call({ brand: { ...baseBrand, brand_name: "No domain edit" }, expected: verifiedTime })})`));
  assert.equal(unchanged.domain_status, "verified_sandbox");
  const changed = JSON.parse(serviceValue(database, `select row_to_json(${call({ brand: { ...baseBrand, customer_domain: "qa.invalid" }, expected: unchanged.updated_at })})`));
  assert.equal(changed.domain_status, "unverified");
  assert.equal(changed.customer_domain, "qa.invalid");
  const cleared = JSON.parse(serviceValue(database, `select row_to_json(${call({ brand: { ...baseBrand, customer_domain: null }, expected: changed.updated_at })})`));
  assert.equal(cleared.customer_domain, null);
  assert.equal(cleared.domain_status, "unverified");
  pass("unchanged, changed and null customer domain transitions");

  const beforeFailure = row(database);
  const auditBeforeFailure = auditCount(database);
  mustFail(service(database, `select set_config('qa.audit_fail','on',false); select ${call({ expected: beforeFailure.updated_at })}`), "QA_AUDIT_FAILURE");
  assert.deepEqual(row(database), beforeFailure);
  assert.equal(auditCount(database), auditBeforeFailure);
  pass("forced audit failure rolls back brand and timestamp");

  run(database, `update public.digital_observer_partners set partner_status='suspended' where id='${ids.partner}'`);
  mustFail(service(database, `select ${call({ expected: beforeFailure.updated_at })}`), "PARTNER_BRAND_SCOPE_DENIED");
  run(database, `update public.digital_observer_partners set partner_status='sandbox' where id='${ids.partner}'`);
  run(database, `update public.digital_observer_organizations set status='suspended' where id='${ids.org}'`);
  mustFail(service(database, `select ${call({ expected: beforeFailure.updated_at })}`), "PARTNER_BRAND_ORGANIZATION_DENIED");
  run(database, `update public.digital_observer_organizations set status='active' where id='${ids.org}'`);
  pass("suspended partner and organization denied");

  let readyResolve;
  const ready = new Promise((resolve) => { readyResolve = resolve; });
  const hold = asyncPsql(database, `begin; update public.digital_observer_partners set partner_status='suspended' where id='${ids.partner}';
    select 'QA_LOCK_HELD'; select pg_sleep(1.2); commit;`, (output) => {
      if (output.includes("QA_LOCK_HELD")) readyResolve();
    });
  await ready;
  const blocked = await asyncPsql(database, `set role service_role; select set_config('request.jwt.claim.role','service_role',false);
    select ${call({ expected: beforeFailure.updated_at })};`);
  const holdResult = await hold;
  assert.equal(holdResult.status, 0, holdResult.stderr);
  mustFail(blocked, "PARTNER_BRAND_SCOPE_DENIED");
  assert.deepEqual(row(database), beforeFailure);
  run(database, `update public.digital_observer_partners set partner_status='sandbox' where id='${ids.partner}'`);
  pass("concurrent partner suspension serializes before brand write");

  let transferResolve;
  const transferred = new Promise((resolve) => { transferResolve = resolve; });
  const holdTransfer = asyncPsql(database, `begin; update public.digital_observer_partners
    set organization_id='${ids.transferOrg}' where id='${ids.partner}';
    select 'QA_TRANSFER_LOCK_HELD'; select pg_sleep(1.2); commit;`, (output) => {
      if (output.includes("QA_TRANSFER_LOCK_HELD")) transferResolve();
    });
  await transferred;
  const ownershipBlocked = await asyncPsql(database, `set role service_role;
    select set_config('request.jwt.claim.role','service_role',false);
    select ${call({ expected: beforeFailure.updated_at })};`);
  const transferResult = await holdTransfer;
  assert.equal(transferResult.status, 0, transferResult.stderr);
  mustFail(ownershipBlocked, "PARTNER_BRAND_SCOPE_DENIED");
  assert.deepEqual(row(database), beforeFailure);
  run(database, `update public.digital_observer_partners set organization_id='${ids.org}' where id='${ids.partner}'`);
  pass("concurrent partner ownership transfer serializes before brand write");

  const casScript = (name) => `set role service_role; select set_config('request.jwt.claim.role','service_role',false);
    select row_to_json(${call({ brand: { ...baseBrand, brand_name: name }, expected: beforeFailure.updated_at })});`;
  const races = await Promise.all([
    asyncPsql(database, casScript("Racer A")), asyncPsql(database, casScript("Racer B"))
  ]);
  assert.equal(races.filter((race) => race.status === 0).length, 1);
  mustFail(races.find((race) => race.status !== 0), "PARTNER_BRAND_STALE_WRITE");
  assert.ok(["Racer A", "Racer B"].includes(row(database).brand_name));
  pass("two concurrent CAS updates commit exactly one winner");
} finally {
  if (created) {
    const result = psql("postgres", `drop database ${database} with (force)`);
    if (result.status !== 0) throw new Error(`QA_DATABASE_CLEANUP_FAILED: ${result.stderr.slice(0, 500)}`);
  }
  assert.equal(run("postgres", `select count(*) from pg_database where datname=${lit(database)}`), "0");
  pass("disposable QA database removed; no synthetic database remains");
}
