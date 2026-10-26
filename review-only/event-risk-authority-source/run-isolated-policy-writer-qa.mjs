#!/usr/bin/env node
// New disposable PostgreSQL only: synthetic identities, network none, no mounts.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL(".", import.meta.url));
const candidate = readFileSync(`${dir}POLICY-WRITER-ISOLATED-NOT-APPLIED.sql`, "utf8");
const image = "public.ecr.aws/supabase/postgres:17.6.1.167";
const id = {
  tenant: "11111111-1111-4111-8111-111111111111",
  otherTenant: "22222222-2222-4222-8222-222222222222",
  site: "33333333-3333-4333-8333-333333333333",
  otherSite: "44444444-4444-4444-8444-444444444444",
  owner: "55555555-5555-4555-8555-555555555555",
  member: "66666666-6666-4666-8666-666666666666",
  otherMember: "77777777-7777-4777-8777-777777777777",
  authority: "88888888-8888-4888-8888-888888888888",
  session: "99999999-9999-4999-8999-999999999999",
  recipient: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  otherRecipient: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  setting: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  otherSetting: "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
};
let container;
let checks = 0;
function docker(args, input) {
  const r = spawnSync("docker", args, { input, encoding: "utf8", timeout: 30000, maxBuffer: 5000000 });
  if (r.error) throw r.error;
  return r;
}
function args() {
  return ["exec", "-i", container, "psql", "-X", "-h", "/tmp", "-U", "postgres", "-d", "postgres",
    "-v", "ON_ERROR_STOP=1", "-A", "-t", "-q"];
}
function pg(statement) {
  const r = docker(args(), statement);
  if (r.status !== 0) throw new Error(r.stderr.trim());
  return r.stdout.trim();
}
function denied(statement, pattern) {
  const r = docker(args(), statement);
  assert.notEqual(r.status, 0, `unexpected SQL success: ${statement.slice(0, 80)}`);
  assert.match(r.stderr, pattern);
  checks++;
}
function write({ tenant = id.tenant, site = id.site, session = id.session,
  authority = id.authority, expected = 0, recipient = id.recipient,
  active = true, setting = null, enabled = null } = {}) {
  const nullable = x => x == null ? "NULL" : `'${x}'`;
  return `SELECT review_policy_writer.write_policy_v1('${tenant}','${site}','${session}',
    '${authority}',${expected},${nullable(recipient)},${active == null ? "NULL" : active},
    ${nullable(setting)},${enabled == null ? "NULL" : enabled});`;
}
function caller(statement) { return `SET ROLE qa_policy_caller; ${statement}`; }
function asyncPg(statement) {
  const child = spawn("docker", args(), { stdio: ["pipe", "pipe", "pipe"] });
  let output = ""; let error = "";
  child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
  child.stdout.on("data", chunk => { output += chunk; });
  child.stderr.on("data", chunk => { error += chunk; });
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
  assert.ok(candidate.indexOf("BEGIN;") < candidate.indexOf("CREATE ROLE qa_policy_owner"));
  assert.ok(candidate.indexOf("DO $guard$") < candidate.indexOf("CREATE ROLE qa_policy_owner"));
  assert.match(candidate, /DRAFT_NOT_APPLIED/);
  assert.match(candidate, /ROLLBACK;\s*$/);
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
  assert.equal(isolation.HostConfig.ReadonlyRootfs, true);
  checks++;
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (docker(["exec", container, "pg_isready", "-h", "/tmp", "-U", "postgres"]).status === 0) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready);
  denied(candidate, /DRAFT_NOT_APPLIED/);
  assert.equal(pg("SELECT to_regclass('review_policy_writer.policy_versions') IS NULL;"), "t"); checks++;
  const first = candidate.indexOf("CREATE ROLE qa_policy_owner");
  const last = candidate.lastIndexOf("ROLLBACK;");
  assert.ok(first > 0 && last > first);
  pg(`BEGIN; ${candidate.slice(first, last)} COMMIT;`);
  denied(caller(write()), /POLICY_AUTHORITY_UNVERIFIED/);
  pg(`INSERT INTO review_policy_writer.site_authority_fixture VALUES
    ('${id.site}','${id.tenant}','${id.owner}','${id.authority}',true);
    INSERT INTO review_policy_writer.site_member_fixture VALUES
    ('${id.site}','${id.owner}',true),('${id.site}','${id.member}',true);
    INSERT INTO review_policy_writer.current_recipients VALUES
    ('${id.recipient}','${id.site}','${id.member}',false,'["in_app","email"]'),
    ('${id.otherRecipient}','${id.otherSite}','${id.otherMember}',false,'["in_app"]');
    INSERT INTO review_policy_writer.current_channel_settings VALUES
    ('${id.setting}','${id.site}','${id.member}','in_app',false,'["high","critical"]'),
    ('${id.otherSetting}','${id.otherSite}','${id.otherMember}','in_app',false,'["high"]');`);
  denied(caller(write()), /POLICY_SESSION_UNVERIFIED/);
  pg(`INSERT INTO review_policy_writer.owner_session_fixture VALUES
    ('${id.session}','${id.owner}',true,clock_timestamp()-interval '1 minute');`);
  denied(caller(write()), /POLICY_SESSION_UNVERIFIED/);
  pg(`UPDATE review_policy_writer.owner_session_fixture
    SET expires_at=clock_timestamp()+interval '1 hour' WHERE session_ref='${id.session}';`);
  denied(caller(write()), /POLICY_HEAD_UNINITIALIZED/);
  pg(`INSERT INTO review_policy_writer.policy_head VALUES ('${id.site}','${id.tenant}',0);`);
  pg(`UPDATE review_policy_writer.site_member_fixture SET active=false
    WHERE site_id='${id.site}' AND profile_id='${id.owner}';`);
  denied(caller(write()), /POLICY_OWNER_MEMBERSHIP_UNVERIFIED/);
  pg(`UPDATE review_policy_writer.site_member_fixture SET active=true
    WHERE site_id='${id.site}' AND profile_id='${id.owner}';`);
  pg(`UPDATE review_policy_writer.owner_session_fixture SET active=false
    WHERE session_ref='${id.session}';`);
  denied(caller(write()), /POLICY_SESSION_UNVERIFIED/);
  pg(`UPDATE review_policy_writer.owner_session_fixture SET active=true
    WHERE session_ref='${id.session}';`);
  denied(caller(write({ tenant: id.otherTenant })), /POLICY_AUTHORITY_UNVERIFIED/);
  denied(caller(write({ site: id.otherSite })), /POLICY_AUTHORITY_UNVERIFIED/);
  denied(caller(write({ recipient: id.otherRecipient })), /POLICY_RECIPIENT_INELIGIBLE/);
  denied(caller(write({ recipient: null, active: null, setting: id.otherSetting, enabled: true })),
    /POLICY_SETTING_INELIGIBLE/);
  const external = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  pg(`INSERT INTO review_policy_writer.current_recipients VALUES
    ('${external}','${id.site}',NULL,false,'["email"]');`);
  denied(caller(write({ recipient: external })), /POLICY_RECIPIENT_INELIGIBLE/);
  const ineligible = "ffffffff-ffff-4fff-8fff-ffffffffffff";
  pg(`INSERT INTO review_policy_writer.current_channel_settings VALUES
    ('${ineligible}','${id.site}','${id.otherMember}','push',false,'["high"]');`);
  denied(caller(write({ recipient: null, active: null, setting: ineligible, enabled: true })),
    /POLICY_SETTING_INELIGIBLE/);
  denied("SET ROLE qa_policy_untrusted; " + write(), /permission denied/);
  denied(caller(`UPDATE review_policy_writer.current_recipients SET active=true
    WHERE id='${id.recipient}';`), /permission denied/);
  denied(caller(`INSERT INTO review_policy_writer.policy_versions VALUES
    ('${id.site}','${id.tenant}',1,'{}','${"0".repeat(64)}',gen_random_uuid(),now());`), /permission denied/);
  denied(caller(`INSERT INTO review_policy_writer.mandatory_audit
    (id,site_id,tenant_id,actor_profile_id,authority_ref,version,fingerprint)
    VALUES (gen_random_uuid(),'${id.site}','${id.tenant}','${id.owner}','${id.authority}',1,
      '${"0".repeat(64)}');`), /permission denied/);
  assert.equal(pg(caller(write())), "1"); checks++;
  assert.equal(pg(`SELECT current_version FROM review_policy_writer.policy_head WHERE site_id='${id.site}';`), "1"); checks++;
  assert.equal(pg(`SELECT count(*) FROM review_policy_writer.policy_versions;`), "1"); checks++;
  assert.equal(pg(`SELECT count(*) FROM review_policy_writer.mandatory_audit;`), "1"); checks++;
  const snapshot = JSON.parse(pg("SELECT snapshot::text FROM review_policy_writer.policy_versions WHERE version=1;"));
  assert.deepEqual(snapshot.recipients.map(x => x.profileId), [id.member]);
  assert.deepEqual(snapshot.recipients[0].channels, ["email", "in_app"]);
  assert.deepEqual(snapshot.settings, []);
  assert.equal(JSON.stringify(snapshot).includes("secret://"), false);
  checks++;
  const malformed = "12121212-1212-4212-8212-121212121212";
  pg(`INSERT INTO review_policy_writer.current_recipients VALUES
    ('${malformed}','${id.site}','${id.member}',true,'["unknown"]');`);
  denied(caller(write({ expected: 1, recipient: null, active: null,
    setting: id.setting, enabled: true })), /POLICY_CURRENT_ELIGIBILITY_UNVERIFIED/);
  assert.equal(pg(`SELECT current_version FROM review_policy_writer.policy_head
    WHERE site_id='${id.site}';`), "1"); checks++;
  pg(`DELETE FROM review_policy_writer.current_recipients WHERE id='${malformed}';`);
  denied(caller(write()), /POLICY_VERSION_STALE/);
  denied(caller(write({ expected: 1, recipient: null, active: null, setting: id.setting, enabled: true,
    tenant: id.otherTenant })), /POLICY_AUTHORITY_UNVERIFIED/);
  assert.equal(pg(caller(write({ expected: 1, recipient: null, active: null,
    setting: id.setting, enabled: true }))), "2"); checks++;
  const snapshot2 = JSON.parse(pg("SELECT snapshot::text FROM review_policy_writer.policy_versions WHERE version=2;"));
  assert.equal(snapshot2.settings[0].profileId, id.member); checks++;
  denied("UPDATE review_policy_writer.policy_versions SET fingerprint='x';", /POLICY_HISTORY_IMMUTABLE/);
  denied("DELETE FROM review_policy_writer.mandatory_audit;", /POLICY_HISTORY_IMMUTABLE/);
  denied("TRUNCATE review_policy_writer.policy_versions;", /POLICY_HISTORY_IMMUTABLE/);
  pg(`CREATE FUNCTION review_policy_writer.fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'SYNTHETIC_AUDIT_FAILURE'; END $$;
    CREATE TRIGGER fail_audit BEFORE INSERT ON review_policy_writer.mandatory_audit
    FOR EACH ROW EXECUTE FUNCTION review_policy_writer.fail_audit();`);
  denied(caller(write({ expected: 2, active: false })), /SYNTHETIC_AUDIT_FAILURE/);
  assert.equal(pg(`SELECT active FROM review_policy_writer.current_recipients WHERE id='${id.recipient}';`), "t"); checks++;
  assert.equal(pg(`SELECT current_version FROM review_policy_writer.policy_head WHERE site_id='${id.site}';`), "2"); checks++;
  assert.equal(pg("SELECT count(*) FROM review_policy_writer.policy_versions;"), "2"); checks++;
  pg("DROP TRIGGER fail_audit ON review_policy_writer.mandatory_audit; DROP FUNCTION review_policy_writer.fail_audit();");
  // Two sessions race on the same policy head; the loser is stale, not a
  // second writer. The first holds its transaction after the function returns.
  const winner = asyncPg(`SET ROLE qa_policy_caller; BEGIN; ${write({ expected: 2, active: false })}
    SELECT 'FIRST_COMMITTED_LATER'; SELECT pg_sleep(2); COMMIT;`);
  await waitMarker(winner, "FIRST_COMMITTED_LATER");
  const start = Date.now();
  const loser = asyncPg(caller(write({ expected: 2, active: false })));
  const [a, b] = await Promise.all([winner.done, loser.done]);
  assert.equal(a.code, 0, a.error);
  assert.notEqual(b.code, 0);
  assert.match(b.error, /POLICY_VERSION_STALE/);
  assert.ok(Date.now() - start >= 1000);
  assert.equal(pg(`SELECT current_version FROM review_policy_writer.policy_head WHERE site_id='${id.site}';`), "3");
  assert.equal(pg("SELECT count(*) FROM review_policy_writer.policy_versions;"), "3");
  assert.equal(pg("SELECT count(*) FROM review_policy_writer.mandatory_audit;"), "3");
  checks += 4;
  console.log(`PASS: ${checks} isolated PostgreSQL policy-writer assertions; no live authority or adapter.`);
} finally {
  if (container) {
    const stopped = docker(["stop", "--time", "3", container]);
    if (stopped.status !== 0) { process.exitCode = 1; console.error("FAIL: disposable container cleanup"); }
  }
}
