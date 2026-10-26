#!/usr/bin/env node
// Synthetic PostgreSQL only. Creates/removes a networkless, mountless container.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL(".", import.meta.url));
const base = readFileSync(`${dir}REGISTRATION-WRITER-ISOLATED-NOT-APPLIED.sql`, "utf8");
const fence = readFileSync(`${dir}REGISTRATION-ACCEPTANCE-FENCE-ISOLATED-NOT-APPLIED.sql`, "utf8");
const image = "public.ecr.aws/supabase/postgres:17.6.1.167";
const row = n => ({
  registration: `${n}1111111-1111-4111-8111-111111111111`,
  tenant: `${n}2222222-2222-4222-8222-222222222222`,
  site: `${n}3333333-3333-4333-8333-333333333333`,
  source: `${n}4444444-4444-4444-8444-444444444444`,
  authority: `${n}7777777-7777-4777-8777-777777777777`,
  request: `${n}aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,
  event: `${n}bbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb`,
  otherEvent: `${n}ccccccc-cccc-4ccc-8ccc-cccccccccccc`
});
const one = row(1), two = row(2);
const owner = "55555555-5555-4555-8555-555555555555";
const otherOwner = "66666666-6666-4666-8666-666666666666";
const session = "88888888-8888-4888-8888-888888888888";
const admin = "99999999-9999-4999-8999-999999999999";
const digest = "f".repeat(64);
let container, checks = 0;
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
  assert.notEqual(r.status, 0, `unexpected success: ${statement.slice(0, 80)}`);
  assert.match(r.stderr, pattern); checks++;
}
function role(statement) { return `SET ROLE qa_registration_caller; ${statement}`; }
function qualify(r) {
  return `SELECT review_registration_writer.qualify_registration_v1(
    '${r.registration}','${r.request}','${r.authority}','${session}',0);`;
}
function accept(r, { event = r.event, epoch = 0, tenant = r.tenant, site = r.site,
  source = r.source, actorSession = session, fingerprint = digest } = {}) {
  return `SELECT review_registration_writer.synthetic_accept_first_v1(
    '${r.registration}','${event}','${actorSession}',${epoch},
    '${tenant}','${site}','${source}','${fingerprint}');`;
}
function revoke(r, { epoch = 0, actorSession = session } = {}) {
  return `SELECT review_registration_writer.revoke_registration_v1(
    '${r.registration}',${epoch},'${actorSession}');`;
}
function stripGuard(statement, first) {
  assert.match(statement, /DRAFT_NOT_APPLIED/);
  assert.ok(statement.indexOf("DO $guard$") < statement.indexOf(first));
  assert.match(statement, /ROLLBACK;\s*$/);
  return statement.slice(statement.indexOf(first), statement.lastIndexOf("ROLLBACK;"));
}
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
  denied(base, /DRAFT_NOT_APPLIED/);
  denied(fence, /DRAFT_NOT_APPLIED/);
  assert.equal(pg("SELECT to_regclass('review_registration_writer.synthetic_acceptance_receipts') IS NULL;"), "t"); checks++;
  pg(`BEGIN; ${stripGuard(base, "CREATE ROLE qa_registration_owner")} COMMIT;`);
  pg(`BEGIN; ${stripGuard(fence, "ALTER TABLE review_registration_writer.registration_identities")} COMMIT;`);
  pg(`INSERT INTO review_registration_writer.session_fixture VALUES
    ('${session}','${owner}','HomeOwner',true,now()+interval '1 hour'),
    ('${admin}','${owner}','PlatformAdmin',true,now()+interval '1 hour');`);
  for (const r of [one, two]) {
    pg(`INSERT INTO review_registration_writer.registration_identities
      (registration_id,tenant_id,site_id,source_id,owner_profile_id)
      VALUES ('${r.registration}','${r.tenant}','${r.site}','${r.source}','${owner}');
      INSERT INTO review_registration_writer.current_scope_fixture VALUES
      ('${r.registration}','${r.tenant}','${r.site}','${r.source}','${owner}',true);
      INSERT INTO review_registration_writer.authority_fixture VALUES
      ('${r.authority}','${r.registration}','${r.tenant}','${r.site}','${r.source}',
       '${owner}','${owner}','${digest}',true,true,now()+interval '1 hour');`);
    assert.equal(pg(role(qualify(r))), "1"); checks++;
  }
  denied(role(accept(one, { tenant: two.tenant })), /FENCE_NEW_ACCEPTANCE_DENIED/);
  denied(role(accept(one, { site: two.site })), /FENCE_NEW_ACCEPTANCE_DENIED/);
  denied(role(accept(one, { source: two.source })), /FENCE_NEW_ACCEPTANCE_DENIED/);
  denied(role(accept(one, { epoch: 1 })), /FENCE_NEW_ACCEPTANCE_DENIED/);
  denied(role(accept(one, { actorSession: admin })), /FENCE_SESSION_UNVERIFIED/);
  denied(role(revoke(one, { actorSession: admin })), /FENCE_SESSION_UNVERIFIED/);
  pg(`UPDATE review_registration_writer.current_scope_fixture SET owner_profile_id='${otherOwner}'
    WHERE registration_id='${two.registration}';`);
  denied(role(accept(two)), /FENCE_CURRENT_SCOPE_CHANGED/);
  denied(role(revoke(two)), /FENCE_CURRENT_SCOPE_CHANGED/);
  pg(`UPDATE review_registration_writer.current_scope_fixture SET owner_profile_id='${owner}'
    WHERE registration_id='${two.registration}';`);
  denied("SET ROLE qa_registration_untrusted; " + accept(one), /permission denied/);
  denied(role(`UPDATE review_registration_writer.registration_identities SET revoked=true;`), /permission denied/);
  denied(role(`INSERT INTO review_registration_writer.fence_audit
    (audit_ref,action,registration_id,owner_epoch,version,actor_id)
    VALUES (gen_random_uuid(),'REVOKED','${one.registration}',1,1,'${owner}');`), /permission denied/);
  denied(role(`INSERT INTO review_registration_writer.synthetic_acceptance_receipts
    (event_id) VALUES ('${one.event}');`), /permission denied/);
  const escalation = docker(psqlArgs("qa_registration_untrusted"), "SET ROLE qa_registration_owner;");
  assert.notEqual(escalation.status, 0); assert.match(escalation.stderr, /permission denied/); checks++;
  // A failing mandatory audit must roll back both possible state transitions.
  pg(`CREATE FUNCTION review_registration_writer.fail_fence_audit() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'SYNTHETIC_FENCE_AUDIT_FAILURE'; END $$;
    CREATE TRIGGER fail_fence_audit BEFORE INSERT ON review_registration_writer.fence_audit
    FOR EACH ROW EXECUTE FUNCTION review_registration_writer.fail_fence_audit();`);
  denied(role(accept(one)), /SYNTHETIC_FENCE_AUDIT_FAILURE/);
  denied(role(revoke(two)), /SYNTHETIC_FENCE_AUDIT_FAILURE/);
  assert.equal(pg("SELECT count(*) FROM review_registration_writer.synthetic_acceptance_receipts;"), "0"); checks++;
  assert.equal(pg(`SELECT owner_epoch||':'||revoked FROM review_registration_writer.registration_identities
    WHERE registration_id='${two.registration}';`), "0:false"); checks++;
  pg("DROP TRIGGER fail_fence_audit ON review_registration_writer.fence_audit; DROP FUNCTION review_registration_writer.fail_fence_audit();");
  // Ordering A: first acceptance holds the identity row; revocation waits.
  const firstAccept = asyncPg(`SET ROLE qa_registration_caller; BEGIN; ${accept(one)}
    SELECT 'ACCEPT_READY'; SELECT pg_sleep(2); COMMIT;`);
  await waitMarker(firstAccept, "ACCEPT_READY");
  const followingRevoke = asyncPg(role(revoke(one)));
  const [accepted, revoked] = await Promise.all([firstAccept.done, followingRevoke.done]);
  assert.equal(accepted.code, 0, accepted.error);
  assert.equal(revoked.code, 0, revoked.error);
  assert.match(revoked.output, /1/); checks++;
  assert.equal(pg(`SELECT count(*) FROM review_registration_writer.synthetic_acceptance_receipts
    WHERE registration_id='${one.registration}';`), "1"); checks++;
  assert.equal(pg(role(accept(one))), one.event); checks++;
  denied(role(accept(one, { fingerprint: "e".repeat(64) })), /FENCE_REPLAY_CONFLICT/);
  denied(role(accept(one, { site: two.site })), /FENCE_REPLAY_CONFLICT/);
  denied(role(accept(one, { event: one.otherEvent })), /FENCE_NEW_ACCEPTANCE_DENIED/);
  denied(role(qualify(one)), /REGISTRATION_ABSENT_OR_REVOKED/);
  denied(role(revoke(one)), /FENCE_REVOKE_STALE_OR_ABSENT/);
  // Ordering B: revocation wins, so the waiting first acceptance cannot commit.
  const firstRevoke = asyncPg(`SET ROLE qa_registration_caller; BEGIN; ${revoke(two)}
    SELECT 'REVOKE_READY'; SELECT pg_sleep(2); COMMIT;`);
  await waitMarker(firstRevoke, "REVOKE_READY");
  const followingAccept = asyncPg(role(accept(two)));
  const [revokedFirst, deniedAfter] = await Promise.all([firstRevoke.done, followingAccept.done]);
  assert.equal(revokedFirst.code, 0, revokedFirst.error);
  assert.notEqual(deniedAfter.code, 0);
  assert.match(deniedAfter.error, /FENCE_NEW_ACCEPTANCE_DENIED/); checks++;
  assert.equal(pg(`SELECT count(*) FROM review_registration_writer.synthetic_acceptance_receipts
    WHERE registration_id='${two.registration}';`), "0"); checks++;
  pg(`UPDATE review_registration_writer.session_fixture SET active=false WHERE session_ref='${session}';`);
  denied(role(accept(one)), /FENCE_SESSION_UNVERIFIED/);
  denied(role(accept(two, { event: two.otherEvent })), /FENCE_SESSION_UNVERIFIED/);
  pg(`UPDATE review_registration_writer.session_fixture SET active=true WHERE session_ref='${session}';`);
  pg(`UPDATE review_registration_writer.current_scope_fixture SET owner_profile_id='${otherOwner}'
    WHERE registration_id='${one.registration}';`);
  denied(role(accept(one, { event: one.otherEvent })), /FENCE_NEW_ACCEPTANCE_DENIED/);
  assert.equal(pg(role(accept(one))), one.event); checks++;
  denied("UPDATE review_registration_writer.synthetic_acceptance_receipts SET observation_fingerprint='x';",
    /REGISTRATION_HISTORY_IMMUTABLE/);
  denied("DELETE FROM review_registration_writer.fence_audit;", /REGISTRATION_HISTORY_IMMUTABLE/);
  assert.equal(pg("SELECT count(*) FROM review_registration_writer.fence_audit;"), "3"); checks++;
  console.log(`PASS: ${checks} isolated PostgreSQL fence assertions; no live Home authority or event writer.`);
} finally {
  if (container) {
    const stopped = docker(["stop", "--time", "3", container]);
    if (stopped.status !== 0) { process.exitCode = 1; console.error("FAIL: disposable container cleanup"); }
  }
}
