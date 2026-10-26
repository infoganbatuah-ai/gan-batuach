#!/usr/bin/env node
// Runs a6bd2ba5's pinned complete writer body plus exact reviewed adaptations.
import assert from "node:assert/strict";
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { adaptCanonicalHomeAcceptance } from "./adapt-canonical-home-acceptance-fence.mjs";

const dir = fileURLToPath(new URL(".", import.meta.url));
const image = "public.ecr.aws/supabase/postgres:17.6.1.167";
const paths = {
  fixture: "review-only/event-time-acceptance-writer/isolated-schema.sql",
  source: "review-only/event-time-ownership-qualification/HOME-REGISTRATION-SOURCE-NOT-APPLIED.sql",
  writer: "review-only/event-time-acceptance-writer/ACCEPT-LIVE-HOME-SIGNAL-NOT-APPLIED.sql"
};
function gitText(sha, path) { return execFileSync("git", ["show", `${sha}:${path}`], { encoding: "utf8" }); }
const fixture = gitText("a6bd2ba5", paths.fixture);
const source = gitText("a1089050", paths.source);
const originalWriter = gitText("a6bd2ba5", paths.writer);
const fence = readFileSync(`${dir}CANONICAL-ACCEPTANCE-FENCE-NOT-APPLIED.sql`, "utf8");
const adapted = adaptCanonicalHomeAcceptance(originalWriter);
const owner = "11111111-1111-4111-8111-111111111111";
const tenant = "22222222-2222-4222-8222-222222222222";
const otherTenant = "33333333-3333-4333-8333-333333333333";
const site = "44444444-4444-4444-8444-444444444444";
const otherSite = "55555555-5555-4555-8555-555555555555";
const camera = "66666666-6666-4666-8666-666666666666";
const otherCamera = "77777777-7777-4777-8777-777777777777";
const registration = "88888888-8888-4888-8888-888888888888";
const otherRegistration = "99999999-9999-4999-8999-999999999999";
const ownerSession = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const gatewaySession = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const otherGatewaySession = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const eventA = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const eventB = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
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
function denied(statement, pattern, user = "postgres") {
  const r = docker(psqlArgs(user), statement);
  assert.notEqual(r.status, 0, `unexpected SQL success: ${statement.slice(0, 80)}`);
  assert.match(r.stderr, pattern); checks++;
}
function strip(statement, start, guard) {
  assert.match(statement, guard);
  assert.ok(statement.indexOf(start) > statement.indexOf("DO $"));
  const end = statement.lastIndexOf("ROLLBACK;");
  return statement.slice(statement.indexOf(start), end > statement.indexOf(start) ? end : undefined);
}
function observation(eventId, s = site, c = camera, overrides = {}) {
  return {
    siteId: s, sourceId: eventId, cameraId: c, streamId: "synthetic-stream",
    eventType: "person_entered", severity: "medium", confidence: 0.812345,
    occurredAt: new Date().toISOString(), trackId: "synthetic-track",
    evidenceKind: "line_crossing", recordingRequired: false,
    modelProvenance: null, verificationEvidence: null, ...overrides
  };
}
function accept(r, value, epoch = 0, g = r === registration ? gatewaySession : otherGatewaySession) {
  const json = JSON.stringify(value).replaceAll("'", "''");
  return `SELECT observer_home_review.accept_live_home_signal_v1(
    '${r}','${json}'::jsonb,${epoch},'${g}');`;
}
function revoke(r, epoch = 0, session = ownerSession) {
  return `SELECT observer_home_review.qa_revoke_registration_v1('${r}',${epoch},'${session}');`;
}
function count(table) { return Number(pg(`SELECT count(*) FROM ${table};`)); }
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
  assert.equal(createHash("sha256").update(source).digest("hex"),
    "b0e313f5d76e7faf6c2d104da3873205df6974a0a3faf9d2980a280aa89cc2e5");
  assert.equal(adapted.editCount, 11);
  assert.match(fence, /DRAFT_NOT_APPLIED/);
  assert.match(fence, /ROLLBACK;\s*$/);
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
  denied(fixture, /ISOLATED_FIXTURE_ONLY/);
  denied(source, /NOT_APPLIED: Home registration authority/);
  denied(fence, /DRAFT_NOT_APPLIED/);
  denied(adapted.sql, /NOT_APPLIED: caller authority/);
  assert.equal(pg("SELECT to_regclass('observer_home_review.event_acceptances') IS NULL;"), "t"); checks++;
  pg(`BEGIN; ${strip(fixture, "CREATE ROLE anon LOGIN;", /ISOLATED_FIXTURE_ONLY/)} COMMIT;`);
  pg(`BEGIN; ${strip(source, "CREATE SCHEMA observer_home_review;", /NOT_APPLIED: Home registration authority/)} COMMIT;`);
  pg(`BEGIN; ${strip(fence, "ALTER TABLE observer_home_review.registration_identities", /DRAFT_NOT_APPLIED/)} COMMIT;`);
  pg(`BEGIN; ${strip(adapted.sql, "CREATE FUNCTION observer_home_review.accept_live_home_signal_v1(",
    /NOT_APPLIED: caller authority/)} COMMIT;`);
  pg(`INSERT INTO observer_home_review.registration_identities
    (registration_id,tenant_id,site_id,source_id,owner_profile_id,owner_epoch,revoked)
    VALUES ('${registration}','${tenant}','${site}','${camera}','${owner}',0,false),
      ('${otherRegistration}','${otherTenant}','${otherSite}','${otherCamera}','${owner}',0,false);
    INSERT INTO observer_home_review.registration_versions
    (registration_id,version,tenant_id,site_id,source_id,owner_profile_id,
     registering_actor_id,authorized_actor_id,authority_ref,qualification_audit_ref,qualified_at)
    VALUES ('${registration}',1,'${tenant}','${site}','${camera}','${owner}','${owner}','${owner}',
      '11111111-2222-4333-8444-555555555555','22222222-3333-4444-8555-666666666666',
      clock_timestamp()-interval '10 seconds'),
      ('${otherRegistration}',1,'${otherTenant}','${otherSite}','${otherCamera}','${owner}',
       '${owner}','${owner}','33333333-4444-4555-8666-777777777777',
       '44444444-5555-4666-8777-888888888888',clock_timestamp()-interval '10 seconds');
    UPDATE observer_home_review.registration_identities SET current_version=1;
    INSERT INTO observer_home_review.qa_owner_authority_fixture VALUES
      ('${registration}','${tenant}','${site}','${camera}','${owner}',true,true,now()+interval '1 hour'),
      ('${otherRegistration}','${otherTenant}','${otherSite}','${otherCamera}','${owner}',true,true,now()+interval '1 hour');
    INSERT INTO observer_home_review.qa_owner_session_fixture VALUES
      ('${ownerSession}','${owner}','HomeOwner',true,now()+interval '1 hour');
    INSERT INTO observer_home_review.qa_gateway_session_fixture VALUES
      ('${gatewaySession}','${camera}',true,now()+interval '1 hour'),
      ('${otherGatewaySession}','${otherCamera}',true,now()+interval '1 hour');`);
  denied(accept(registration, observation(eventA), 1), /HOME_REGISTRATION_SCOPE_OR_TRANSFER_UNVERIFIED/);
  denied(accept(registration, observation(eventA), 0, otherGatewaySession), /HOME_GATEWAY_SESSION_UNVERIFIED/);
  denied(accept(registration, observation(eventA, otherSite)), /HOME_REGISTRATION_SCOPE_OR_TRANSFER_UNVERIFIED/);
  denied(accept(registration, observation(eventA, site, otherCamera)), /HOME_REGISTRATION_SCOPE_OR_TRANSFER_UNVERIFIED/);
  pg(`UPDATE observer_home_review.registration_identities SET owner_epoch=NULL,revoked=NULL
    WHERE registration_id='${otherRegistration}';`);
  denied(accept(otherRegistration, observation(eventB, otherSite, otherCamera)),
    /HOME_REGISTRATION_SCOPE_OR_TRANSFER_UNVERIFIED/);
  denied(revoke(otherRegistration), /HOME_REVOKE_STALE_OR_ABSENT/);
  pg(`UPDATE observer_home_review.registration_identities SET owner_epoch=0,revoked=false
    WHERE registration_id='${otherRegistration}';`);
  pg(`INSERT INTO observer_home_review.registration_versions
    (registration_id,version,tenant_id,site_id,source_id,owner_profile_id,
     registering_actor_id,authorized_actor_id,authority_ref,qualification_audit_ref)
    VALUES ('${otherRegistration}',2,'${otherTenant}','${otherSite}','${otherCamera}',
      '${owner}','${owner}','${owner}','55555555-6666-4777-8888-999999999999',
      '66666666-7777-4888-8999-aaaaaaaaaaaa');
    UPDATE observer_home_review.registration_identities SET current_version=2
      WHERE registration_id='${otherRegistration}';`);
  denied(accept(otherRegistration, observation(eventB, otherSite, otherCamera)),
    /HOME_REGISTRATION_SCOPE_OR_TRANSFER_UNVERIFIED/);
  pg(`UPDATE observer_home_review.registration_identities SET current_version=1
    WHERE registration_id='${otherRegistration}';`);
  pg(`UPDATE public.observer_sites SET digital_observer_organization_id='${otherTenant}'
    WHERE id='${site}';`);
  denied(accept(registration, observation(eventA)), /HOME_CURRENT_SOURCE_SCOPE_UNVERIFIED/);
  pg(`UPDATE public.observer_sites SET digital_observer_organization_id='${tenant}',
    owner_profile_id='55555555-6666-4777-8888-999999999999' WHERE id='${site}';`);
  denied(accept(registration, observation(eventA)), /HOME_CURRENT_SOURCE_SCOPE_UNVERIFIED/);
  pg(`UPDATE public.observer_sites SET owner_profile_id='${owner}' WHERE id='${site}';`);
  denied(accept(registration, observation(eventA), 0), /permission denied/, "anon");
  denied(accept(registration, observation(eventA), 0), /permission denied/, "authenticated");
  denied("SELECT count(*) FROM observer_home_review.event_acceptances;", /permission denied/, "service_role");
  denied("INSERT INTO observer_home_review.event_acceptances(event_id) VALUES (gen_random_uuid());",
    /permission denied/, "anon");
  pg(`UPDATE observer_home_review.qa_gateway_session_fixture
    SET expires_at=now()-interval '1 minute' WHERE session_ref='${gatewaySession}';`);
  denied(accept(registration, observation(eventA)), /HOME_GATEWAY_SESSION_UNVERIFIED/);
  pg(`UPDATE observer_home_review.qa_gateway_session_fixture
    SET expires_at=now()+interval '1 hour' WHERE session_ref='${gatewaySession}';`);
  pg(`UPDATE observer_home_review.qa_owner_session_fixture SET active=false
    WHERE session_ref='${ownerSession}';`);
  denied(revoke(otherRegistration), /HOME_REVOKE_OWNER_SESSION_UNVERIFIED/);
  pg(`UPDATE observer_home_review.qa_owner_session_fixture SET active=true
    WHERE session_ref='${ownerSession}';`);
  const a = observation(eventA);
  pg(`CREATE FUNCTION public.qa_fail_accept_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.action='ACCEPTED' THEN RAISE EXCEPTION 'SYNTHETIC_ACCEPT_AUDIT_FAILURE'; END IF;
      RETURN NEW; END $$;
    CREATE TRIGGER qa_fail_accept_audit BEFORE INSERT ON observer_home_review.registration_audit
    FOR EACH ROW EXECUTE FUNCTION public.qa_fail_accept_audit();`);
  denied(accept(registration, a), /SYNTHETIC_ACCEPT_AUDIT_FAILURE/);
  assert.equal(count("public.observer_intelligence_signals"), 0);
  assert.equal(count("public.observer_correlated_events"), 0);
  assert.equal(count("observer_home_review.event_acceptances"), 0); checks += 3;
  pg("DROP TRIGGER qa_fail_accept_audit ON observer_home_review.registration_audit; DROP FUNCTION public.qa_fail_accept_audit();");
  pg(`CREATE FUNCTION public.qa_fail_incident() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'SYNTHETIC_INCIDENT_TRIGGER_FAILURE'; END $$;
    CREATE TRIGGER qa_fail_incident BEFORE INSERT ON public.observer_correlated_events
    FOR EACH ROW EXECUTE FUNCTION public.qa_fail_incident();`);
  denied(accept(registration, a), /SYNTHETIC_INCIDENT_TRIGGER_FAILURE/);
  assert.equal(count("public.observer_intelligence_signals"), 0);
  assert.equal(count("observer_home_review.event_acceptances"), 0); checks += 2;
  pg("DROP TRIGGER qa_fail_incident ON public.observer_correlated_events; DROP FUNCTION public.qa_fail_incident();");
  pg(`CREATE FUNCTION public.qa_fail_revoke_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.action='REVOKED' THEN RAISE EXCEPTION 'SYNTHETIC_REVOKE_AUDIT_FAILURE'; END IF;
      RETURN NEW; END $$;
    CREATE TRIGGER qa_fail_revoke_audit BEFORE INSERT ON observer_home_review.registration_audit
    FOR EACH ROW EXECUTE FUNCTION public.qa_fail_revoke_audit();`);
  denied(revoke(otherRegistration), /SYNTHETIC_REVOKE_AUDIT_FAILURE/);
  assert.equal(pg(`SELECT owner_epoch||':'||revoked FROM observer_home_review.registration_identities
    WHERE registration_id='${otherRegistration}';`), "0:false"); checks++;
  pg("DROP TRIGGER qa_fail_revoke_audit ON observer_home_review.registration_audit; DROP FUNCTION public.qa_fail_revoke_audit();");
  // Order A: actual Signal writer wins the registration lock; revocation waits.
  const firstAccept = asyncPg(`BEGIN; ${accept(registration, a)}
    SELECT 'ACCEPT_READY'; SELECT pg_sleep(2); COMMIT;`);
  await waitMarker(firstAccept, "ACCEPT_READY");
  const laterRevoke = asyncPg(revoke(registration));
  const [accepted, revoked] = await Promise.all([firstAccept.done, laterRevoke.done]);
  assert.equal(accepted.code, 0, accepted.error);
  assert.equal(revoked.code, 0, revoked.error);
  assert.match(revoked.output, /1/); checks++;
  assert.equal(count("public.observer_intelligence_signals"), 1);
  assert.equal(count("public.observer_correlated_events"), 1);
  assert.equal(count("observer_home_review.event_acceptances"), 1);
  assert.equal(count("observer_home_review.event_bindings"), 1);
  assert.equal(count("observer_home_review.registration_audit"), 3); checks += 5;
  const acceptedId = pg(`SELECT event_id FROM observer_home_review.event_acceptances;`);
  assert.equal(pg(`SELECT owner_epoch FROM observer_home_review.event_acceptances;`), "0"); checks++;
  denied("UPDATE observer_home_review.event_acceptances SET owner_epoch=1;",
    /HOME_REGISTRATION_HISTORY_IMMUTABLE/);
  assert.equal(pg(accept(registration, a)), acceptedId); checks++;
  assert.equal(count("public.observer_intelligence_signals"), 1);
  assert.equal(count("observer_home_review.registration_audit"), 3); checks += 2;
  denied(accept(registration, { ...a, streamId: "conflict" }), /HOME_EVENT_REPLAY_CONFLICT_OR_UNRECEIPTED/);
  denied(accept(registration, a, 1), /HOME_EVENT_REPLAY_CONFLICT_OR_UNRECEIPTED/);
  denied(accept(registration, observation("55555555-6666-4777-8888-999999999999")),
    /HOME_REGISTRATION_SCOPE_OR_TRANSFER_UNVERIFIED/);
  denied(revoke(registration), /HOME_REVOKE_STALE_OR_ABSENT/);
  // Order B: revocation wins before the second registration's first Signal.
  const b = observation(eventB, otherSite, otherCamera);
  const firstRevoke = asyncPg(`BEGIN; ${revoke(otherRegistration)}
    SELECT 'REVOKE_READY'; SELECT pg_sleep(2); COMMIT;`);
  await waitMarker(firstRevoke, "REVOKE_READY");
  const laterAccept = asyncPg(accept(otherRegistration, b, 0));
  const [revokedFirst, deniedAfter] = await Promise.all([firstRevoke.done, laterAccept.done]);
  assert.equal(revokedFirst.code, 0, revokedFirst.error);
  assert.notEqual(deniedAfter.code, 0);
  assert.match(deniedAfter.error, /HOME_REGISTRATION_SCOPE_OR_TRANSFER_UNVERIFIED/); checks++;
  assert.equal(count("public.observer_intelligence_signals"), 1);
  assert.equal(count("observer_home_review.event_acceptances"), 1); checks += 2;
  pg(`UPDATE observer_home_review.qa_gateway_session_fixture SET active=false
    WHERE session_ref='${gatewaySession}';`);
  denied(accept(registration, a), /HOME_GATEWAY_SESSION_UNVERIFIED/);
  pg(`UPDATE observer_home_review.qa_gateway_session_fixture SET active=true
    WHERE session_ref='${gatewaySession}';`);
  pg(`UPDATE public.observer_sites SET owner_profile_id='55555555-6666-4777-8888-999999999999'
    WHERE id='${site}';`);
  assert.equal(pg(accept(registration, a)), acceptedId); checks++;
  denied(accept(registration, observation("66666666-7777-4888-8999-aaaaaaaaaaaa")),
    /HOME_REGISTRATION_SCOPE_OR_TRANSFER_UNVERIFIED/);
  assert.equal(count("observer_home_review.registration_audit"), 4); checks++;
  console.log(`PASS: ${checks} isolated canonical-writer fence assertions; no live Home authority or route.`);
} finally {
  if (container) {
    const stopped = docker(["stop", "--time", "3", container]);
    if (stopped.status !== 0) { process.exitCode = 1; console.error("FAIL: disposable container cleanup"); }
  }
}
