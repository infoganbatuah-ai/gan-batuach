#!/usr/bin/env node
// Disposable PostgreSQL only: synthetic identities, network none, no mounts.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL(".", import.meta.url));
const sql = readFileSync(`${dir}REGISTRATION-WRITER-ISOLATED-NOT-APPLIED.sql`, "utf8");
const image = "public.ecr.aws/supabase/postgres:17.6.1.167";
const id = {
  registration: "11111111-1111-4111-8111-111111111111",
  tenant: "22222222-2222-4222-8222-222222222222",
  site: "33333333-3333-4333-8333-333333333333",
  source: "44444444-4444-4444-8444-444444444444",
  owner: "55555555-5555-4555-8555-555555555555",
  other: "66666666-6666-4666-8666-666666666666",
  authority: "77777777-7777-4777-8777-777777777777",
  session: "88888888-8888-4888-8888-888888888888",
  adminSession: "99999999-9999-4999-8999-999999999999",
  first: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  second: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  third: "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
};
let container;
let checks = 0;
function docker(args, input) {
  const r = spawnSync("docker", args, { input, encoding: "utf8", timeout: 30000, maxBuffer: 5000000 });
  if (r.error) throw r.error;
  return r;
}
function psqlArgs(user = "postgres") {
  return ["exec", "-i", container, "psql", "-X", "-h", "/tmp", "-U", user, "-d", "postgres",
    "-v", "ON_ERROR_STOP=1", "-A", "-t", "-q"];
}
function pg(statement) {
  const r = docker(psqlArgs(), statement);
  if (r.status !== 0) throw new Error(r.stderr.trim());
  return r.stdout.trim();
}
function denied(statement, pattern) {
  const r = docker(psqlArgs(), statement);
  assert.notEqual(r.status, 0, `unexpected success: ${statement.slice(0, 70)}`);
  assert.match(r.stderr, pattern);
  checks++;
}
function call({ request = id.first, expected = 0, session = id.session,
  authority = id.authority, registration = id.registration } = {}) {
  return `SELECT review_registration_writer.qualify_registration_v1(
    '${registration}','${request}','${authority}','${session}',${expected});`;
}
function caller(statement) { return `SET ROLE qa_registration_caller; ${statement}`; }
function asyncPg(statement) {
  const child = spawn("docker", psqlArgs(), { stdio: ["pipe", "pipe", "pipe"] });
  let output = "", error = "";
  child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
  child.stdout.on("data", x => { output += x; });
  child.stderr.on("data", x => { error += x; });
  child.stdin.end(statement);
  const done = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error("CONCURRENT_PSQL_TIMEOUT")); }, 12000);
    child.on("error", reject);
    child.on("close", code => { clearTimeout(timer); resolve({ code, output, error }); });
  });
  return { done, getOutput: () => output };
}
async function waitMarker(running, marker) {
  for (let i = 0; i < 100; i++) {
    if (running.getOutput().includes(marker)) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`MARKER_TIMEOUT:${marker}`);
}
try {
  assert.ok(sql.indexOf("DO $guard$") < sql.indexOf("CREATE ROLE qa_registration_owner"));
  assert.match(sql, /DRAFT_NOT_APPLIED/);
  assert.match(sql, /ROLLBACK;\s*$/);
  assert.equal(docker(["context", "show"]).stdout.trim(), "colima-gbi");
  assert.equal(docker(["image", "inspect", image, "--format", "{{.Id}}"]).status, 0);
  const started = docker(["run", "--detach", "--rm", "--network", "none", "--read-only",
    "--memory", "768m", "--cpus", "1", "--pids-limit", "128", "--user", "postgres",
    "--tmpfs", "/tmp:rw,nosuid,nodev,mode=1777", "--entrypoint", "/bin/sh", image,
    "-ec", "initdb -D /tmp/qa-data -A trust --no-instructions >/dev/null && exec postgres -D /tmp/qa-data -c listen_addresses= -c unix_socket_directories=/tmp"]);
  assert.equal(started.status, 0, started.stderr);
  container = started.stdout.trim();
  assert.match(container, /^[0-9a-f]{64}$/);
  const isolation = JSON.parse(docker(["inspect", container, "--format", "{{json .}}"] ).stdout);
  assert.equal(isolation.HostConfig.NetworkMode, "none");
  assert.deepEqual(isolation.Mounts, []);
  assert.equal(isolation.HostConfig.ReadonlyRootfs, true); checks++;
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (docker(["exec", container, "pg_isready", "-h", "/tmp", "-U", "postgres"]).status === 0) {
      ready = true; break;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready);
  denied(sql, /DRAFT_NOT_APPLIED/);
  assert.equal(pg("SELECT to_regclass('review_registration_writer.registration_versions') IS NULL;"), "t"); checks++;
  const first = sql.indexOf("CREATE ROLE qa_registration_owner");
  const last = sql.lastIndexOf("ROLLBACK;");
  assert.ok(first > 0 && last > first);
  pg(`BEGIN; ${sql.slice(first, last)} COMMIT;`);
  denied(caller(call()), /REGISTRATION_ABSENT_OR_REVOKED/);
  pg(`INSERT INTO review_registration_writer.registration_identities
    (registration_id,tenant_id,site_id,source_id,owner_profile_id)
    VALUES ('${id.registration}','${id.tenant}','${id.site}','${id.source}','${id.owner}');`);
  denied(caller(call()), /REGISTRATION_AUTHORITY_UNVERIFIED/);
  pg(`INSERT INTO review_registration_writer.authority_fixture VALUES
    ('${id.authority}','${id.registration}','${id.tenant}','${id.site}','${id.source}',
     '${id.owner}','${id.owner}','${"f".repeat(64)}',false,true,now()+interval '1 hour');`);
  denied(caller(call()), /REGISTRATION_AUTHORITY_UNVERIFIED/);
  pg(`UPDATE review_registration_writer.authority_fixture SET provenance_verified=true
    WHERE authority_ref='${id.authority}';`);
  denied(caller(call()), /REGISTRATION_CURRENT_SCOPE_CHANGED/);
  pg(`INSERT INTO review_registration_writer.current_scope_fixture VALUES
    ('${id.registration}','${id.tenant}','${id.site}','${id.source}','${id.owner}',true);
    INSERT INTO review_registration_writer.session_fixture VALUES
    ('${id.session}','${id.owner}','HomeOwner',true,now()+interval '1 hour'),
    ('${id.adminSession}','${id.owner}','PlatformAdmin',true,now()+interval '1 hour');`);
  denied(caller(call({ session: id.adminSession })), /REGISTRATION_ACTOR_UNVERIFIED/);
  denied(caller(call({ session: id.third })), /REGISTRATION_ACTOR_UNVERIFIED/);
  pg(`UPDATE review_registration_writer.current_scope_fixture SET tenant_id='${id.other}'
    WHERE registration_id='${id.registration}';`);
  denied(caller(call()), /REGISTRATION_CURRENT_SCOPE_CHANGED/);
  pg(`UPDATE review_registration_writer.current_scope_fixture SET tenant_id='${id.tenant}',site_id='${id.other}'
    WHERE registration_id='${id.registration}';`);
  denied(caller(call()), /REGISTRATION_CURRENT_SCOPE_CHANGED/);
  pg(`UPDATE review_registration_writer.current_scope_fixture SET site_id='${id.site}',source_id='${id.other}'
    WHERE registration_id='${id.registration}';`);
  denied(caller(call()), /REGISTRATION_CURRENT_SCOPE_CHANGED/);
  pg(`UPDATE review_registration_writer.current_scope_fixture SET source_id='${id.source}',owner_profile_id='${id.other}'
    WHERE registration_id='${id.registration}';`);
  denied(caller(call()), /REGISTRATION_CURRENT_SCOPE_CHANGED/);
  pg(`UPDATE review_registration_writer.current_scope_fixture SET owner_profile_id='${id.owner}'
    WHERE registration_id='${id.registration}';`);
  pg(`UPDATE review_registration_writer.authority_fixture SET authorized_actor_id='${id.other}'
    WHERE authority_ref='${id.authority}';`);
  denied(caller(call()), /REGISTRATION_ACTOR_UNVERIFIED/);
  pg(`UPDATE review_registration_writer.authority_fixture SET authorized_actor_id='${id.owner}',
    expires_at=now()-interval '1 minute' WHERE authority_ref='${id.authority}';`);
  denied(caller(call()), /REGISTRATION_AUTHORITY_UNVERIFIED/);
  pg(`UPDATE review_registration_writer.authority_fixture SET expires_at=now()+interval '1 hour'
    WHERE authority_ref='${id.authority}';`);
  denied("SET ROLE qa_registration_untrusted; " + call(), /permission denied/);
  denied(caller(`UPDATE review_registration_writer.registration_identities SET current_version=1;`), /permission denied/);
  denied(caller(`INSERT INTO review_registration_writer.registration_versions
    (registration_id,version) VALUES ('${id.registration}',1);`), /permission denied/);
  denied(caller(`INSERT INTO review_registration_writer.registration_audit
    (audit_ref,request_ref,registration_id,version,actor_id,authority_ref,action)
    VALUES (gen_random_uuid(),'${id.first}','${id.registration}',1,'${id.owner}',
      '${id.authority}','QUALIFIED');`), /permission denied/);
  const escalation = docker(psqlArgs("qa_registration_untrusted"), "SET ROLE qa_registration_owner;");
  assert.notEqual(escalation.status, 0);
  assert.match(escalation.stderr, /permission denied/); checks++;
  assert.equal(pg(caller(call())), "1"); checks++;
  assert.equal(pg(caller(call())), "1"); checks++;
  assert.equal(pg(`SELECT current_version FROM review_registration_writer.registration_identities;`), "1"); checks++;
  assert.equal(pg(`SELECT count(*) FROM review_registration_writer.registration_versions;`), "1"); checks++;
  assert.equal(pg(`SELECT count(*) FROM review_registration_writer.registration_audit;`), "1"); checks++;
  pg(`UPDATE review_registration_writer.authority_fixture SET fingerprint='${"e".repeat(64)}'
    WHERE authority_ref='${id.authority}';`);
  denied(caller(call()), /REGISTRATION_REPLAY_CONFLICT/);
  pg(`UPDATE review_registration_writer.authority_fixture SET fingerprint='${"f".repeat(64)}'
    WHERE authority_ref='${id.authority}';`);
  denied(caller(call({ request: id.first, expected: 1 })), /REGISTRATION_REPLAY_CONFLICT/);
  denied(caller(call({ request: id.second, expected: 0 })), /REGISTRATION_VERSION_STALE/);
  assert.equal(pg(caller(call({ request: id.second, expected: 1 }))), "2"); checks++;
  assert.equal(pg(`SELECT action FROM review_registration_writer.registration_audit WHERE version=2;`), "RENEWED"); checks++;
  denied("UPDATE review_registration_writer.registration_versions SET fingerprint='x';", /REGISTRATION_HISTORY_IMMUTABLE/);
  denied("DELETE FROM review_registration_writer.registration_audit;", /REGISTRATION_HISTORY_IMMUTABLE/);
  denied("TRUNCATE review_registration_writer.registration_versions;", /REGISTRATION_HISTORY_IMMUTABLE/);
  pg(`CREATE FUNCTION review_registration_writer.fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'SYNTHETIC_AUDIT_FAILURE'; END $$;
    CREATE TRIGGER fail_audit BEFORE INSERT ON review_registration_writer.registration_audit
    FOR EACH ROW EXECUTE FUNCTION review_registration_writer.fail_audit();`);
  denied(caller(call({ request: id.third, expected: 2 })), /SYNTHETIC_AUDIT_FAILURE/);
  assert.equal(pg(`SELECT current_version FROM review_registration_writer.registration_identities;`), "2"); checks++;
  assert.equal(pg("SELECT count(*) FROM review_registration_writer.registration_versions;"), "2"); checks++;
  pg("DROP TRIGGER fail_audit ON review_registration_writer.registration_audit; DROP FUNCTION review_registration_writer.fail_audit();");
  pg(`UPDATE review_registration_writer.session_fixture SET active=false WHERE session_ref='${id.session}';`);
  denied(caller(call({ request: id.third, expected: 2 })), /REGISTRATION_ACTOR_UNVERIFIED/);
  pg(`UPDATE review_registration_writer.session_fixture SET active=true WHERE session_ref='${id.session}';`);
  pg(`UPDATE review_registration_writer.registration_identities SET revoked=true WHERE registration_id='${id.registration}';`);
  denied(caller(call({ request: id.third, expected: 2 })), /REGISTRATION_ABSENT_OR_REVOKED/);
  pg(`UPDATE review_registration_writer.registration_identities SET revoked=false WHERE registration_id='${id.registration}';`);
  // Two writers compete for version 3; one commits, the other must observe a stale CAS.
  const winner = asyncPg(`SET ROLE qa_registration_caller; BEGIN; ${call({ request: id.third, expected: 2 })}
    SELECT 'FIRST_COMMITTED_LATER'; SELECT pg_sleep(2); COMMIT;`);
  await waitMarker(winner, "FIRST_COMMITTED_LATER");
  const loser = asyncPg(caller(call({ request: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", expected: 2 })));
  const [a, b] = await Promise.all([winner.done, loser.done]);
  assert.equal(a.code, 0, a.error);
  assert.notEqual(b.code, 0);
  assert.match(b.error, /REGISTRATION_VERSION_STALE/);
  assert.equal(pg("SELECT current_version FROM review_registration_writer.registration_identities;"), "3");
  assert.equal(pg("SELECT count(*) FROM review_registration_writer.registration_versions;"), "3");
  assert.equal(pg("SELECT count(*) FROM review_registration_writer.registration_audit;"), "3");
  checks += 4;
  console.log(`PASS: ${checks} isolated PostgreSQL registration-writer assertions; no live authority or adapter.`);
} finally {
  if (container) {
    const stopped = docker(["stop", "--time", "3", container]);
    if (stopped.status !== 0) { process.exitCode = 1; console.error("FAIL: disposable container cleanup"); }
  }
}
