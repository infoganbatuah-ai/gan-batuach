#!/usr/bin/env node
// Test only in a new networkless/mountless disposable PostgreSQL container.
// No existing Supabase database, role, grant or credential is accessed.
import assert from "node:assert/strict";
import { spawnSync, execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { adaptHomeQualification } from "./adapt-home-qualification-chain.mjs";
import { adaptCanonicalHomeAcceptance } from "./adapt-canonical-home-acceptance-fence.mjs";

const dir = fileURLToPath(new URL(".", import.meta.url));
const image = "public.ecr.aws/supabase/postgres:17.6.1.167";
const gitText = (sha, path) => execFileSync("git", ["show", `${sha}:${path}`], { encoding: "utf8" });
const fixture = gitText("a6bd2ba5", "review-only/event-time-acceptance-writer/isolated-schema.sql");
const source = gitText("a1089050", "review-only/event-time-ownership-qualification/HOME-REGISTRATION-SOURCE-NOT-APPLIED.sql");
const originalAcceptance = gitText("a6bd2ba5", "review-only/event-time-acceptance-writer/ACCEPT-LIVE-HOME-SIGNAL-NOT-APPLIED.sql");
const originalQualification = readFileSync(`${dir}REGISTRATION-WRITER-ISOLATED-NOT-APPLIED.sql`, "utf8");
const fence = readFileSync(`${dir}CANONICAL-ACCEPTANCE-FENCE-NOT-APPLIED.sql`, "utf8");
const alignment = readFileSync(`${dir}CHAIN-ALIGNMENT-NOT-APPLIED.sql`, "utf8");
const acl = readFileSync(`${dir}HOME-CHAIN-ACL-NOT-APPLIED.sql`, "utf8");
const qualification = adaptHomeQualification(originalQualification).sql;
const acceptance = adaptCanonicalHomeAcceptance(originalAcceptance).sql;
const owner = "11111111-1111-4111-8111-111111111111";
const tenant = "22222222-2222-4222-8222-222222222222";
const site = "44444444-4444-4444-8444-444444444444";
const camera = "66666666-6666-4666-8666-666666666666";
const reg = "88888888-8888-4888-8888-888888888888";
const ownerSession = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const gateway = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const authority = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const request = "ffffffff-ffff-4fff-8fff-ffffffffffff";
let container, checks = 0;
function docker(args, input) {
  const r = spawnSync("docker", args, { input, encoding: "utf8", timeout: 30000, maxBuffer: 5000000 });
  if (r.error) throw r.error;
  return r;
}
function psqlArgs(user = "postgres") {
  return ["exec", "-i", container, "psql", "-X", "-h", "/tmp", "-U", user,
    "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-q"];
}
function pg(statement, user = "postgres") {
  const r = docker(psqlArgs(user), statement);
  if (r.status !== 0) throw new Error(r.stderr.trim());
  return r.stdout.trim();
}
function denied(statement, pattern, user) {
  const r = docker(psqlArgs(user), statement);
  assert.notEqual(r.status, 0, `unexpected SQL success as ${user}: ${statement.slice(0, 80)}`);
  assert.match(r.stderr, pattern); checks++;
}
function strip(s, start) {
  assert.ok(s.indexOf("DO $") >= 0 && s.indexOf(start) > s.indexOf("DO $"));
  const end = s.lastIndexOf("ROLLBACK;");
  return s.slice(s.indexOf(start), end > s.indexOf(start) ? end : undefined);
}
const qualify = `SELECT observer_home_review.qualify_registration_v1(
  '${reg}','${request}','${authority}','${ownerSession}',0);`;
const revoke = `SELECT observer_home_review.qa_revoke_registration_v1(
  '${reg}',0,'${ownerSession}');`;
function accept(sourceId, at) {
  const observation = { siteId: site, sourceId, cameraId: camera,
    streamId: "synthetic-stream", eventType: "person_entered", severity: "medium",
    confidence: 0.812345, occurredAt: at, trackId: "synthetic-track",
    evidenceKind: "line_crossing", recordingRequired: false,
    modelProvenance: null, verificationEvidence: null };
  return `SELECT observer_home_review.accept_live_home_signal_v1(
    '${reg}','${JSON.stringify(observation)}'::jsonb,0,'${gateway}');`;
}
function count(table) { return Number(pg(`SELECT count(*) FROM ${table};`)); }
try {
  for (const s of [fixture, source, fence, alignment, acl, originalQualification, originalAcceptance])
    assert.match(s, /(?:ISOLATED_FIXTURE_ONLY|NOT_APPLIED|DRAFT_NOT_APPLIED)/);
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
  denied(acl, /DRAFT_NOT_APPLIED/, "postgres");
  assert.equal(pg("SELECT to_regclass('observer_home_review.registration_versions') IS NULL;"), "t"); checks++;
  pg(`BEGIN; ${strip(fixture, "CREATE ROLE anon LOGIN;")} COMMIT;`);
  pg(`BEGIN; ${strip(source, "CREATE SCHEMA observer_home_review;")} COMMIT;`);
  pg(`BEGIN; ${strip(fence, "ALTER TABLE observer_home_review.registration_identities")} COMMIT;`);
  pg(`BEGIN; ${strip(alignment, "ALTER TABLE observer_home_review.registration_versions")} COMMIT;`);
  pg(`BEGIN; ${qualification} REVOKE ALL ON FUNCTION
    observer_home_review.qualify_registration_v1(uuid,uuid,uuid,uuid,bigint)
    FROM PUBLIC,anon,authenticated,service_role; COMMIT;`);
  pg(`BEGIN; ${strip(acceptance, "CREATE FUNCTION observer_home_review.accept_live_home_signal_v1(")} COMMIT;`);
  pg(`BEGIN; ${strip(acl, "CREATE ROLE qa_home_chain_writer")} COMMIT;`);

  // Fixture identity/authority rows are installed by the disposable DBA, not
  // by the executor and never with a direct registration version seed.
  pg(`INSERT INTO observer_home_review.registration_identities
      (registration_id,tenant_id,site_id,source_id,owner_profile_id,owner_epoch,revoked)
      VALUES ('${reg}','${tenant}','${site}','${camera}','${owner}',0,false);
    INSERT INTO observer_home_review.qa_current_scope_fixture VALUES
      ('${reg}','${tenant}','${site}','${camera}','${owner}',true);
    INSERT INTO observer_home_review.qa_owner_authority_fixture
      (registration_id,tenant_id,site_id,source_id,owner_profile_id,verified,active,
       expires_at,authority_ref,authorized_actor_id,fingerprint)
      VALUES ('${reg}','${tenant}','${site}','${camera}','${owner}',true,true,
        now()+interval '1 hour','${authority}','${owner}','${"f".repeat(64)}');
    INSERT INTO observer_home_review.qa_owner_session_fixture VALUES
      ('${ownerSession}','${owner}','HomeOwner',true,now()+interval '1 hour');
    INSERT INTO observer_home_review.qa_gateway_session_fixture VALUES
      ('${gateway}','${camera}',true,now()+interval '1 hour');`);
  assert.equal(count("observer_home_review.registration_versions"), 0); checks++;

  for (const role of ["qa_home_chain_executor", "anon", "authenticated", "service_role"]) {
    assert.equal(pg(`SELECT rolcanlogin||':'||rolbypassrls FROM pg_roles WHERE rolname='${role}';`),
      role === "service_role" ? "true:true" : "true:false"); checks++;
    for (const table of ["registration_identities", "registration_versions", "registration_audit",
      "event_acceptances", "event_bindings"]) {
      assert.equal(pg(`SELECT has_table_privilege('${role}',
        'observer_home_review.${table}','INSERT,UPDATE,DELETE');`), "f"); checks++;
    }
    for (const table of ["observer_intelligence_signals", "observer_correlated_events",
      "observer_correlated_event_links"]) {
      assert.equal(pg(`SELECT has_table_privilege('${role}','public.${table}','INSERT,UPDATE,DELETE');`), "f"); checks++;
    }
    for (const signature of [
      "qualify_registration_v1(uuid,uuid,uuid,uuid,bigint)",
      "qa_revoke_registration_v1(uuid,bigint,uuid)",
      "accept_live_home_signal_v1(uuid,jsonb,bigint,uuid)"
    ]) {
      assert.equal(pg(`SELECT has_function_privilege('${role}',
        'observer_home_review.${signature}','EXECUTE');`),
        role === "qa_home_chain_executor" ? "t" : "f"); checks++;
    }
    assert.equal(pg(`SELECT pg_has_role('${role}','qa_home_chain_writer','MEMBER');`), "f"); checks++;
  }
  assert.equal(pg("SELECT rolcanlogin||':'||rolbypassrls FROM pg_roles WHERE rolname='qa_home_chain_writer';"),
    "false:false"); checks++;
  for (const signature of [
    "qualify_registration_v1(uuid,uuid,uuid,uuid,bigint)",
    "qa_revoke_registration_v1(uuid,bigint,uuid)",
    "accept_live_home_signal_v1(uuid,jsonb,bigint,uuid)"
  ]) {
    assert.match(pg(`SELECT r.rolname||':'||p.prosecdef||':'||array_to_string(p.proconfig,',')
      FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner
      WHERE p.oid='observer_home_review.${signature}'::regprocedure;`),
      /^qa_home_chain_writer:true:search_path=(?:""|)$/); checks++;
  }
  assert.equal(pg(`SELECT has_function_privilege('qa_home_chain_executor',
    'observer_home_review.bind_accepted_event_v1(uuid)','EXECUTE');`), "f"); checks++;
  denied("SET ROLE qa_home_chain_writer;", /permission denied/, "qa_home_chain_executor");
  denied("SET ROLE qa_home_chain_executor;", /permission denied/, "anon");
  denied("SET ROLE qa_home_chain_executor;", /permission denied/, "service_role");
  denied(qualify, /permission denied/, "anon");
  denied(qualify, /permission denied/, "authenticated");
  denied(qualify, /permission denied/, "service_role");
  for (const role of ["anon", "authenticated", "service_role"]) {
    denied(revoke, /permission denied/, role);
    denied(accept("aaaa2222-3333-4444-8555-666666666666", pg("SELECT clock_timestamp();")),
      /permission denied/, role);
  }
  denied("SELECT observer_home_review.bind_accepted_event_v1(gen_random_uuid());",
    /permission denied/, "qa_home_chain_executor");
  for (const table of ["observer_home_review.registration_identities",
    "observer_home_review.registration_versions", "observer_home_review.registration_audit",
    "observer_home_review.event_acceptances", "observer_home_review.event_bindings",
    "public.observer_intelligence_signals", "public.observer_correlated_events",
    "public.observer_correlated_event_links"]) {
    denied(`INSERT INTO ${table} DEFAULT VALUES;`, /permission denied/, "qa_home_chain_executor");
    denied(`DELETE FROM ${table} WHERE false;`, /permission denied/, "qa_home_chain_executor");
  }
  denied("UPDATE observer_home_review.registration_identities SET revoked=true WHERE false;",
    /permission denied/, "qa_home_chain_executor");

  pg(`CREATE FUNCTION qa_home_shadow.gen_random_uuid() RETURNS uuid LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'SEARCH_PATH_HIJACK'; END $$;`);
  denied("SET search_path=qa_home_shadow,pg_catalog,public; SELECT gen_random_uuid();",
    /SEARCH_PATH_HIJACK/, "qa_home_chain_executor");
  assert.equal(pg(`SET search_path=qa_home_shadow,pg_catalog,public;
    ${qualify}`, "qa_home_chain_executor"), "1"); checks++;
  assert.equal(count("observer_home_review.registration_versions"), 1); checks++;
  pg(`CREATE FUNCTION public.qa_fail_acl_acceptance_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.action='ACCEPTED' THEN RAISE EXCEPTION 'ACL_ACCEPTANCE_AUDIT_FAILURE'; END IF;
      RETURN NEW; END $$;
    CREATE TRIGGER qa_fail_acl_acceptance_audit BEFORE INSERT ON observer_home_review.registration_audit
    FOR EACH ROW EXECUTE FUNCTION public.qa_fail_acl_acceptance_audit();`);
  denied(accept("aaaa1111-2222-4333-8444-555555555555", pg("SELECT clock_timestamp();")),
    /ACL_ACCEPTANCE_AUDIT_FAILURE/, "qa_home_chain_executor");
  assert.equal(count("public.observer_intelligence_signals"), 0);
  assert.equal(count("public.observer_correlated_events"), 0);
  assert.equal(count("observer_home_review.event_acceptances"), 0);
  assert.equal(count("observer_home_review.event_bindings"), 0); checks += 4;
  pg("DROP TRIGGER qa_fail_acl_acceptance_audit ON observer_home_review.registration_audit; DROP FUNCTION public.qa_fail_acl_acceptance_audit();");
  const occurredAt = pg("SELECT clock_timestamp();");
  const eventId = pg(`SET search_path=qa_home_shadow,pg_catalog,public;
    ${accept("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", occurredAt)}`,
    "qa_home_chain_executor");
  assert.match(eventId, /^[0-9a-f-]{36}$/); checks++;
  assert.equal(count("public.observer_intelligence_signals"), 1);
  assert.equal(count("public.observer_correlated_events"), 1);
  assert.equal(count("observer_home_review.event_bindings"), 1);
  assert.equal(count("observer_home_review.registration_audit"), 3); checks += 4;
  pg(`CREATE FUNCTION public.qa_fail_acl_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.action='REVOKED' THEN RAISE EXCEPTION 'ACL_AUDIT_FAILURE'; END IF;
      RETURN NEW; END $$;
    CREATE TRIGGER qa_fail_acl_audit BEFORE INSERT ON observer_home_review.registration_audit
    FOR EACH ROW EXECUTE FUNCTION public.qa_fail_acl_audit();`);
  denied(revoke, /ACL_AUDIT_FAILURE/, "qa_home_chain_executor");
  assert.equal(pg(`SELECT owner_epoch||':'||revoked FROM observer_home_review.registration_identities
    WHERE registration_id='${reg}';`), "0:false"); checks++;
  pg("DROP TRIGGER qa_fail_acl_audit ON observer_home_review.registration_audit; DROP FUNCTION public.qa_fail_acl_audit();");
  assert.equal(pg(`SET search_path=qa_home_shadow,pg_catalog,public;
    ${revoke}`, "qa_home_chain_executor"), "1"); checks++;
  assert.equal(pg(accept("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", occurredAt),
    "qa_home_chain_executor"), eventId); checks++;
  denied(accept("bbbbbbbb-cccc-4ddd-8eee-ffffffffffff", pg("SELECT clock_timestamp();")),
    /HOME_REGISTRATION_SCOPE_OR_TRANSFER_UNVERIFIED/, "qa_home_chain_executor");
  assert.equal(count("public.observer_intelligence_signals"), 1);
  assert.equal(count("observer_home_review.registration_versions"), 1); checks += 2;
  console.log(`PASS: ${checks} isolated Home function-only ACL assertions; synthetic executor, no live caller.`);
} finally {
  if (container) {
    const stopped = docker(["stop", "--time", "3", container]);
    if (stopped.status !== 0) { process.exitCode = 1; console.error("FAIL: disposable container cleanup"); }
  }
}
