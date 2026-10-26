#!/usr/bin/env node
// Disposable synthetic PG17 fixture only: no network, mounts, ports or live data.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { snapshotDigestsV1 } from "../event-risk-canonical-digest/canonical-v1.mjs";

const dir = fileURLToPath(new URL(".", import.meta.url));
const canonical = readFileSync(`${dir}../event-risk-canonical-digest/CANONICAL-V1-NOT-APPLIED.sql`, "utf8");
const freezeSql = readFileSync(`${dir}ATOMIC-FREEZE-NOT-APPLIED.sql`, "utf8");
const aclSql = readFileSync(`${dir}FUNCTION-ONLY-ACL-NOT-APPLIED.sql`, "utf8");
const image = "public.ecr.aws/supabase/postgres:17.6.1.167";
let container;
let checks = 0;
function docker(args, input) {
  const r = spawnSync("docker", args, { input, encoding: "utf8", timeout: 30000, maxBuffer: 5000000 });
  if (r.error) throw r.error;
  return r;
}
function pgArgs(role = "postgres") {
  return ["exec", "-i", container, "psql", "-X", "-h", "/tmp", "-U", role,
    "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-q"];
}
function query(sql, role = "postgres") {
  const r = docker(pgArgs(role), sql);
  if (r.status !== 0) throw new Error(r.stderr.trim());
  return r.stdout.trim();
}
function deny(sql, role, pattern) {
  const r = docker(pgArgs(role), sql);
  assert.notEqual(r.status, 0, `unexpected success: ${role}`);
  assert.match(r.stderr, pattern);
  checks++;
}
function asJson(value) {
  return `convert_from(decode('${Buffer.from(JSON.stringify(value)).toString("hex")}', 'hex'),'UTF8')::jsonb`;
}
const scope = { tenantId: "11111111-1111-4111-8111-111111111111",
  siteId: "33333333-3333-4333-8333-333333333333",
  sourceId: "55555555-5555-4555-8555-555555555555",
  eventId: "77777777-7777-4777-8777-777777777777",
  incidentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  riskDecisionId: "11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
function record(eventId = scope.eventId, auditEventId = "88888888-8888-4888-8888-888888888888") {
  const scoped = { ...scope, eventId };
  const content = { schemaVersion: 1, scope: scoped, decisionCode: "LOG_ONLY",
    severity: "HIGH", settingsVersion: "synthetic-v1", policyVersion: "synthetic-v1",
    capturedAt: "2026-10-27T00:00:00.000Z",
    recipients: [{ recipientRef: "synthetic", channels: [{ channel: "in_app", enabled: true,
      severityLevels: ["HIGH"] }] }] };
  const { fingerprint, digest } = snapshotDigestsV1(content, scoped.tenantId, scoped.siteId);
  return { ...scoped, engineVersion: "do-risk-v1",
    ownershipEvidenceRef: "synthetic-ownership-receipt",
    settingsAuthorityRef: "synthetic-settings-receipt", digestAlgorithm: "canonical-v1",
    content, fingerprint, digest, auditEventId };
}
function call(value) { return `SELECT review_atomic.freeze_server_v1(${asJson(value)});`; }
function asyncQuery(sql, role = "do_freeze_executor") {
  const child = spawn("docker", pgArgs(role), { stdio: ["pipe", "pipe", "pipe"] });
  let out = ""; let err = "";
  child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
  child.stdout.on("data", chunk => { out += chunk; });
  child.stderr.on("data", chunk => { err += chunk; });
  child.stdin.end(sql);
  const done = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error("CONCURRENT_TIMEOUT")); }, 10000);
    child.on("error", reject);
    child.on("close", code => { clearTimeout(timer); resolve({ code, out, err }); });
  });
  return { done, output: () => out };
}
async function marker(proc, value) {
  for (let i = 0; i < 100; i++) {
    if (proc.output().includes(value)) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`MARKER_TIMEOUT: ${value}`);
}
try {
  assert.equal(docker(["context", "show"]).stdout.trim(), "colima-gbi");
  assert.equal(docker(["image", "inspect", image, "--format", "{{.Id}}"]).status, 0);
  const started = docker(["run", "--detach", "--rm", "--network", "none", "--read-only",
    "--memory", "768m", "--cpus", "1", "--pids-limit", "128", "--user", "postgres",
    "--tmpfs", "/tmp:rw,nosuid,nodev,mode=1777", "--entrypoint", "/bin/sh", image,
    "-ec", "initdb -D /tmp/qa-data -A trust --no-instructions >/dev/null && exec postgres -D /tmp/qa-data -c listen_addresses= -c unix_socket_directories=/tmp"]);
  assert.equal(started.status, 0, started.stderr);
  container = started.stdout.trim();
  assert.match(container, /^[a-f0-9]{64}$/);
  const isolation = JSON.parse(docker(["inspect", container, "--format", "{{json .}}"] ).stdout);
  assert.equal(isolation.HostConfig.NetworkMode, "none");
  assert.deepEqual(isolation.Mounts, []);
  assert.equal(isolation.HostConfig.ReadonlyRootfs, true);
  checks++;
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (docker(["exec", container, "pg_isready", "-h", "/tmp", "-U", "postgres"]).status === 0) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready);
  assert.match(query("SHOW server_version;"), /^17\.6/); checks++;
  deny(aclSql, "postgres", /DRAFT_NOT_APPLIED/);
  const canonicalBody = canonical.slice(canonical.indexOf("CREATE SCHEMA review_digest;"));
  const freezeBody = freezeSql.slice(freezeSql.indexOf("CREATE SCHEMA review_atomic;"));
  const aclBody = aclSql.slice(aclSql.indexOf("CREATE ROLE do_freeze_writer NOLOGIN NOINHERIT;"));
  assert.ok(canonicalBody.startsWith("CREATE SCHEMA review_digest;"));
  assert.ok(freezeBody.startsWith("CREATE SCHEMA review_atomic;"));
  assert.ok(aclBody.startsWith("CREATE ROLE do_freeze_writer NOLOGIN NOINHERIT;"));
  query(`BEGIN; CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN; ${canonicalBody}\n${freezeBody}\n${aclBody}\nCOMMIT;`);

  assert.equal(query("SELECT rolcanlogin::text||','||rolinherit::text||','||rolsuper::text FROM pg_roles WHERE rolname='do_freeze_writer';"), "false,false,false"); checks++;
  assert.equal(query("SELECT rolcanlogin::text||','||rolinherit::text||','||rolsuper::text FROM pg_roles WHERE rolname='do_freeze_executor';"), "true,false,false"); checks++;
  assert.equal(query("SELECT count(*) FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid WHERE r.rolname='do_freeze_writer';"), "0"); checks++;
  assert.equal(query("SELECT count(*) FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid WHERE r.rolname='do_freeze_executor';"), "0"); checks++;
  assert.equal(query("SELECT p.prosecdef::text||','||r.rolname FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE p.oid='review_atomic.freeze_server_v1(jsonb)'::regprocedure;"), "true,do_freeze_writer"); checks++;
  assert.equal(query("SELECT session_user||','||current_user;", "do_freeze_executor"), "do_freeze_executor,do_freeze_executor"); checks++;
  deny("SET ROLE do_freeze_writer;", "do_freeze_executor", /permission denied to set role/);

  for (const table of ["frozen_decision", "mandatory_audit"]) {
    for (const privilege of ["INSERT", "UPDATE", "DELETE"]) {
      assert.equal(query(`SELECT has_table_privilege('do_freeze_executor','review_atomic.${table}','${privilege}');`), "f"); checks++;
    }
  }
  assert.equal(query("SELECT has_function_privilege('do_freeze_executor','review_atomic.freeze_server_v1(jsonb)','EXECUTE');"), "t"); checks++;
  for (const role of ["anon", "authenticated", "service_role"]) {
    assert.equal(query(`SELECT has_function_privilege('${role}','review_atomic.freeze_server_v1(jsonb)','EXECUTE');`), "f"); checks++;
    assert.equal(query(`SELECT has_function_privilege('${role}','review_atomic.freeze_canonical_v1(jsonb)','EXECUTE');`), "f"); checks++;
  }
  assert.equal(query("SELECT count(*) FROM pg_proc p, LATERAL aclexplode(p.proacl) a WHERE p.oid='review_atomic.freeze_server_v1(jsonb)'::regprocedure AND a.grantee=0 AND a.privilege_type='EXECUTE';"), "0"); checks++;
  assert.equal(query("SELECT count(*) FROM pg_proc p, LATERAL aclexplode(p.proacl) a WHERE p.oid='review_atomic.freeze_canonical_v1(jsonb)'::regprocedure AND a.grantee=0 AND a.privilege_type='EXECUTE';"), "0"); checks++;
  for (const table of ["frozen_decision", "mandatory_audit"]) {
    deny(`INSERT INTO review_atomic.${table} DEFAULT VALUES;`, "do_freeze_executor", /permission denied/);
    deny(`UPDATE review_atomic.${table} SET created_at=clock_timestamp();`, "do_freeze_executor", /permission denied/);
    deny(`DELETE FROM review_atomic.${table};`, "do_freeze_executor", /permission denied/);
  }
  deny(`SELECT review_atomic.freeze_canonical_v1(${asJson(record())});`, "do_freeze_executor", /permission denied/);
  deny(`SET ROLE anon; ${call(record())}`, "postgres", /permission denied/);
  deny(`SET ROLE authenticated; ${call(record())}`, "postgres", /permission denied/);
  deny(`SET ROLE service_role; ${call(record())}`, "postgres", /permission denied/);
  assert.equal(query(call(record()), "do_freeze_executor"), "INSERTED"); checks++;
  assert.equal(query(call(record()), "do_freeze_executor"), "REPLAY_IDENTICAL"); checks++;

  // An accidental EXECUTE grant still cannot turn a different login into the
  // approved direct server login, even if it can SET ROLE to executor.
  query("CREATE ROLE qa_untrusted LOGIN NOINHERIT; GRANT do_freeze_executor TO qa_untrusted WITH INHERIT FALSE, SET TRUE; GRANT USAGE ON SCHEMA review_atomic TO qa_untrusted;");
  deny(`SET ROLE do_freeze_executor; ${call(record())}`, "qa_untrusted", /FREEZE_CALLER_DENIED/);
  assert.equal(query("SET ROLE do_freeze_executor; SELECT session_user||','||current_user;", "qa_untrusted"), "qa_untrusted,do_freeze_executor"); checks++;
  deny("SET ROLE do_freeze_writer;", "qa_untrusted", /permission denied to set role/);
  query("REVOKE do_freeze_executor FROM qa_untrusted;");
  deny("SET ROLE do_freeze_executor;", "qa_untrusted", /permission denied to set role/);

  const auditFail = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  query(`CREATE FUNCTION review_atomic.fail_selected_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.audit_event_id='${auditFail}'::uuid THEN
      RAISE EXCEPTION 'SYNTHETIC_AUDIT_FAILURE'; END IF; RETURN NEW; END; $$;
    CREATE TRIGGER fixture_audit_failure BEFORE INSERT ON review_atomic.mandatory_audit
      FOR EACH ROW EXECUTE FUNCTION review_atomic.fail_selected_audit();`);
  const failedEvent = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  deny(call(record(failedEvent, auditFail)), "do_freeze_executor", /SYNTHETIC_AUDIT_FAILURE/);
  assert.equal(query(`SELECT count(*) FROM review_atomic.frozen_decision WHERE event_id='${failedEvent}';`), "0"); checks++;
  assert.equal(query(`SELECT count(*) FROM review_atomic.mandatory_audit WHERE event_id='${failedEvent}';`), "0"); checks++;

  const raceEvent = "12121212-1212-4212-8212-121212121212";
  const raceRecord = record(raceEvent, "56565656-5656-4656-8656-565656565656");
  const first = asyncQuery(`BEGIN; ${call(raceRecord)} SELECT 'FIRST_INSERTED'; SELECT pg_sleep(2); COMMIT;`);
  await marker(first, "FIRST_INSERTED");
  const second = asyncQuery(call(raceRecord));
  const [a,b] = await Promise.all([first.done,second.done]);
  assert.equal(a.code, 0, a.err); assert.equal(b.code, 0, b.err);
  assert.match(a.out, /INSERTED/); assert.match(b.out, /REPLAY_IDENTICAL/); checks++;
  assert.equal(query(`SELECT count(*) FROM review_atomic.frozen_decision WHERE event_id='${raceEvent}';`), "1"); checks++;
  assert.equal(query(`SELECT count(*) FROM review_atomic.mandatory_audit WHERE event_id='${raceEvent}';`), "1"); checks++;
  console.log(`PASS: ${checks} isolated function-only freeze ACL assertions; trusted authority remains BLOCKED.`);
} finally {
  if (container) {
    const stopped = docker(["stop", "--time", "3", container]);
    if (stopped.status !== 0) { process.exitCode = 1; console.error("FAIL: disposable container cleanup"); }
  }
}
