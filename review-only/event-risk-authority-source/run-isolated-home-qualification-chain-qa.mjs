#!/usr/bin/env node
// One disposable PostgreSQL schema: qualification RPC creates version 1;
// the pinned full canonical Signal writer consumes that version. Never live.
import assert from "node:assert/strict";
import { spawn, spawnSync, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { adaptHomeQualification } from "./adapt-home-qualification-chain.mjs";
import { adaptCanonicalHomeAcceptance } from "./adapt-canonical-home-acceptance-fence.mjs";
import { adaptFrozenIncidentAcceptance } from "./adapt-frozen-incident-acceptance.mjs";

const dir = fileURLToPath(new URL(".", import.meta.url));
const image = "public.ecr.aws/supabase/postgres:17.6.1.167";
const gitText = (sha, path) => execFileSync("git", ["show", `${sha}:${path}`], { encoding: "utf8" });
const fixture = gitText("a6bd2ba5", "review-only/event-time-acceptance-writer/isolated-schema.sql");
const source = gitText("a1089050", "review-only/event-time-ownership-qualification/HOME-REGISTRATION-SOURCE-NOT-APPLIED.sql");
const originalAcceptance = gitText("a6bd2ba5", "review-only/event-time-acceptance-writer/ACCEPT-LIVE-HOME-SIGNAL-NOT-APPLIED.sql");
const originalQualification = readFileSync(`${dir}REGISTRATION-WRITER-ISOLATED-NOT-APPLIED.sql`, "utf8");
const fence = readFileSync(`${dir}CANONICAL-ACCEPTANCE-FENCE-NOT-APPLIED.sql`, "utf8");
const alignment = readFileSync(`${dir}CHAIN-ALIGNMENT-NOT-APPLIED.sql`, "utf8");
const frozen = readFileSync(`${dir}FROZEN-INCIDENT-BINDING-NOT-APPLIED.sql`, "utf8");
const qualification = adaptHomeQualification(originalQualification);
const acceptance = adaptFrozenIncidentAcceptance(adaptCanonicalHomeAcceptance(originalAcceptance).sql);
const owner = "11111111-1111-4111-8111-111111111111";
const tenant = "22222222-2222-4222-8222-222222222222";
const otherTenant = "33333333-3333-4333-8333-333333333333";
const site = "44444444-4444-4444-8444-444444444444";
const otherSite = "55555555-5555-4555-8555-555555555555";
const camera = "66666666-6666-4666-8666-666666666666";
const otherCamera = "77777777-7777-4777-8777-777777777777";
const reg = "88888888-8888-4888-8888-888888888888";
const regB = "99999999-9999-4999-8999-999999999999";
const ownerSession = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const gateway = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const gatewayB = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const gatewayC = "cccccccc-dddd-4ccc-8ccc-cccccccccccc";
const authority = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const authorityB = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const request = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const requestB = "11111111-2222-4333-8444-555555555555";
const fingerprint = "f".repeat(64);
const cameraC = "77777777-aaaa-4777-8777-777777777777";
const regC = "99999999-aaaa-4999-8999-999999999999";
const authorityC = "eeeeeeee-aaaa-4eee-8eee-eeeeeeeeeeee";
const requestC = "11111111-aaaa-4333-8444-555555555555";
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
function strip(s, start) {
  assert.ok(s.indexOf("DO $") >= 0 && s.indexOf(start) > s.indexOf("DO $"));
  const end = s.lastIndexOf("ROLLBACK;");
  return s.slice(s.indexOf(start), end > s.indexOf(start) ? end : undefined);
}
function qualify(r = reg, req = request, auth = authority, expected = 0) {
  return `SELECT observer_home_review.qualify_registration_v1(
    '${r}','${req}','${auth}','${ownerSession}',${expected});`;
}
function observation(eventId, s = site, c = camera, overrides = {}) {
  return { siteId: s, sourceId: eventId, cameraId: c, streamId: "synthetic-stream",
    eventType: "person_entered", severity: "medium", confidence: 0.812345,
    occurredAt: new Date().toISOString(), trackId: "synthetic-track",
    evidenceKind: "line_crossing", recordingRequired: false,
    modelProvenance: null, verificationEvidence: null, ...overrides };
}
function accept(r, value, epoch = 0, session = r === reg ? gateway : gatewayB) {
  const json = JSON.stringify(value).replaceAll("'", "''");
  return `SELECT observer_home_review.accept_live_home_signal_v1(
    '${r}','${json}'::jsonb,${epoch},'${session}');`;
}
function revoke(r, epoch = 0) {
  return `SELECT observer_home_review.qa_revoke_registration_v1('${r}',${epoch},'${ownerSession}');`;
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
  for (const s of [fixture, source, fence, alignment, frozen, originalQualification, originalAcceptance]) {
    assert.match(s, /(?:ISOLATED_FIXTURE_ONLY|NOT_APPLIED|DRAFT_NOT_APPLIED)/);
  }
  assert.match(alignment, /ROLLBACK;\s*$/);
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
  denied(alignment, /DRAFT_NOT_APPLIED/);
  denied(frozen, /DRAFT_NOT_APPLIED/);
  assert.equal(pg("SELECT to_regclass('observer_home_review.registration_versions') IS NULL;"), "t"); checks++;
  pg(`BEGIN; ${strip(fixture, "CREATE ROLE anon LOGIN;")} COMMIT;`);
  pg(`BEGIN; ${strip(source, "CREATE SCHEMA observer_home_review;")} COMMIT;`);
  pg(`BEGIN; ${strip(fence, "ALTER TABLE observer_home_review.registration_identities")} COMMIT;`);
  pg(`BEGIN; ${strip(alignment, "ALTER TABLE observer_home_review.registration_versions")} COMMIT;`);
  pg(`BEGIN; ${qualification.sql} REVOKE ALL ON FUNCTION
    observer_home_review.qualify_registration_v1(uuid,uuid,uuid,uuid,bigint)
    FROM PUBLIC,anon,authenticated,service_role; COMMIT;`);
  pg(`BEGIN; ${strip(frozen, "ALTER TABLE observer_home_review.event_bindings")} COMMIT;`);
  pg(`BEGIN; ${strip(acceptance.sql, "CREATE FUNCTION observer_home_review.accept_live_home_signal_v1(")} COMMIT;`);
  pg(`INSERT INTO observer_home_review.registration_identities
    (registration_id,tenant_id,site_id,source_id,owner_profile_id,owner_epoch,revoked)
    VALUES ('${reg}','${tenant}','${site}','${camera}','${owner}',0,false),
      ('${regB}','${otherTenant}','${otherSite}','${otherCamera}','${owner}',0,false);
    INSERT INTO observer_home_review.qa_current_scope_fixture VALUES
      ('${reg}','${tenant}','${site}','${camera}','${owner}',true),
      ('${regB}','${otherTenant}','${otherSite}','${otherCamera}','${owner}',true);
    INSERT INTO observer_home_review.qa_owner_authority_fixture
      (registration_id,tenant_id,site_id,source_id,owner_profile_id,verified,active,
       expires_at,authority_ref,authorized_actor_id,fingerprint)
      VALUES ('${reg}','${tenant}','${site}','${camera}','${owner}',true,true,
        now()+interval '1 hour','${authority}','${owner}','${fingerprint}'),
        ('${regB}','${otherTenant}','${otherSite}','${otherCamera}','${owner}',true,true,
         now()+interval '1 hour','${authorityB}','${owner}','${fingerprint}');
    INSERT INTO observer_home_review.qa_owner_session_fixture VALUES
      ('${ownerSession}','${owner}','HomeOwner',true,now()+interval '1 hour');
    INSERT INTO observer_home_review.qa_gateway_session_fixture VALUES
      ('${gateway}','${camera}',true,now()+interval '1 hour'),
      ('${gatewayB}','${otherCamera}',true,now()+interval '1 hour');`);
  // The runner NEVER inserts registration_versions directly. Audit must win first.
  assert.equal(count("observer_home_review.registration_versions"), 0); checks++;
  pg(`CREATE FUNCTION public.qa_fail_qualification_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.action='QUALIFIED' THEN RAISE EXCEPTION 'SYNTHETIC_QUALIFICATION_AUDIT_FAILURE'; END IF;
      RETURN NEW; END $$;
    CREATE TRIGGER qa_fail_qualification_audit BEFORE INSERT ON observer_home_review.registration_audit
    FOR EACH ROW EXECUTE FUNCTION public.qa_fail_qualification_audit();`);
  denied(qualify(), /SYNTHETIC_QUALIFICATION_AUDIT_FAILURE/);
  assert.equal(count("observer_home_review.registration_versions"), 0);
  assert.equal(pg(`SELECT current_version IS NULL FROM observer_home_review.registration_identities
    WHERE registration_id='${reg}';`), "t"); checks += 2;
  pg("DROP TRIGGER qa_fail_qualification_audit ON observer_home_review.registration_audit; DROP FUNCTION public.qa_fail_qualification_audit();");
  pg(`UPDATE observer_home_review.registration_identities SET owner_epoch=NULL,revoked=NULL
    WHERE registration_id='${reg}';`);
  denied(qualify(), /REGISTRATION_ABSENT_OR_REVOKED/);
  pg(`UPDATE observer_home_review.registration_identities SET owner_epoch=0,revoked=false
    WHERE registration_id='${reg}';`);
  pg(`UPDATE observer_home_review.qa_current_scope_fixture SET tenant_id='${otherTenant}'
    WHERE registration_id='${reg}';`);
  denied(qualify(), /REGISTRATION_CURRENT_SCOPE_CHANGED/);
  pg(`UPDATE observer_home_review.qa_current_scope_fixture SET tenant_id='${tenant}'
    WHERE registration_id='${reg}';`);
  denied(qualify(reg, request, authorityB), /REGISTRATION_AUTHORITY_UNVERIFIED/);
  denied(qualify(), /permission denied/, "anon");
  denied("INSERT INTO observer_home_review.registration_versions(registration_id,version) VALUES (gen_random_uuid(),1);",
    /permission denied/, "authenticated");
  assert.equal(count("observer_home_review.registration_versions"), 0); checks++;
  // Qualification commits first; first acceptance waits for the same row lock.
  const firstQualification = asyncPg(`BEGIN; ${qualify()} SELECT 'QUALIFIED_READY'; SELECT pg_sleep(2); COMMIT;`);
  await waitMarker(firstQualification, "QUALIFIED_READY");
  // PostgreSQL records qualification at microsecond precision. A JS Date
  // truncates to milliseconds and can appear to precede that committed fact.
  const a = observation("22222222-3333-4444-8555-666666666666", site, camera,
    { occurredAt: pg("SELECT clock_timestamp();") });
  const waitingAcceptance = asyncPg(accept(reg, a));
  const [qualified, accepted] = await Promise.all([firstQualification.done, waitingAcceptance.done]);
  assert.equal(qualified.code, 0, qualified.error);
  assert.equal(accepted.code, 0, accepted.error); checks++;
  assert.equal(pg(`SELECT current_version FROM observer_home_review.registration_identities
    WHERE registration_id='${reg}';`), "1");
  assert.equal(count("observer_home_review.registration_versions"), 1);
  assert.equal(count("public.observer_intelligence_signals"), 1);
  assert.equal(count("public.observer_correlated_events"), 1);
  assert.equal(count("observer_home_review.event_acceptances"), 1);
  assert.equal(count("observer_home_review.event_bindings"), 1);
  assert.equal(count("observer_home_review.registration_audit"), 3); checks += 7;
  const acceptedId = pg("SELECT event_id FROM observer_home_review.event_acceptances;");
  const frozenIncident = pg(`SELECT b.incident_id FROM observer_home_review.event_bindings b
    JOIN public.observer_correlated_event_links l ON l.source_id=b.event_id
      AND l.source_type='observer_intelligence_signal'
    WHERE b.event_id='${acceptedId}' AND b.incident_id=l.correlated_event_id;`);
  assert.match(frozenIncident, /^[0-9a-f-]{36}$/); checks++;
  assert.equal(pg(accept(reg, a)), acceptedId); checks++;
  // The writer, not a manually seeded fixture, supplied the Incident identity.
  // A later correlation rewrite must not silently rebind the immutable receipt.
  pg(`INSERT INTO public.observer_correlated_events
    (observer_site_id,primary_camera_source_id,related_event_ids)
    VALUES ('${site}','${camera}',ARRAY['${acceptedId}'::uuid]);`);
  const changedIncident = pg(`SELECT id FROM public.observer_correlated_events
    WHERE id<>'${frozenIncident}' ORDER BY id LIMIT 1;`);
  pg(`UPDATE public.observer_correlated_event_links SET correlated_event_id='${changedIncident}'
    WHERE source_type='observer_intelligence_signal' AND source_id='${acceptedId}';`);
  denied(accept(reg, a), /HOME_EVENT_BINDING_CONFLICT/);
  assert.equal(pg(`SELECT incident_id FROM observer_home_review.event_bindings WHERE event_id='${acceptedId}';`), frozenIncident); checks++;
  pg(`UPDATE public.observer_correlated_event_links SET correlated_event_id='${frozenIncident}'
    WHERE source_type='observer_intelligence_signal' AND source_id='${acceptedId}';`);
  assert.equal(pg(accept(reg, a)), acceptedId); checks++;
  // Install the actual guarded Risk claim body in this disposable schema.
  // Unlike the standalone Risk fixture, its binding/Incident came from the
  // complete acceptance writer and source-defined correlation trigger.
  const riskFixture = readFileSync(`${dir}../event-risk-atomic-claim-qualification/isolated-schema.sql`, "utf8");
  const riskSource = readFileSync(`${dir}../event-risk-atomic-claim-qualification/RPC-BODIES-SOURCE-NOT-APPLIED.sql`, "utf8");
  assert.match(riskFixture, /ISOLATED_FIXTURE_ONLY/);
  assert.match(riskSource, /DRAFT_NOT_APPLIED/);
  const riskTablesStart = riskFixture.indexOf("CREATE TABLE public.observer_event_risk_claims (");
  const riskTablesEnd = riskFixture.indexOf("-- Shape-compatible Home receipt fixture", riskTablesStart);
  assert.ok(riskTablesStart > 0 && riskTablesEnd > riskTablesStart);
  const riskClaimStart = riskSource.indexOf("CREATE FUNCTION public.claim_event_risk_v1(");
  const riskClaimEnd = riskSource.indexOf("$claim$;", riskClaimStart) + "$claim$;".length;
  assert.ok(riskClaimStart > 0 && riskClaimEnd > riskClaimStart);
  pg(`ALTER TABLE public.digital_observer_organizations ADD COLUMN organization_type text NOT NULL DEFAULT 'family';
    ALTER TABLE public.observer_correlated_events ADD COLUMN provenance text NOT NULL DEFAULT 'REAL_CAMERA_AI';
    ${riskFixture.slice(riskTablesStart, riskTablesEnd)}
    ${riskSource.slice(riskClaimStart, riskClaimEnd)}
    GRANT USAGE ON SCHEMA observer_home_review TO service_role;
    GRANT SELECT ON ALL TABLES IN SCHEMA observer_home_review TO service_role;
    GRANT UPDATE(owner_epoch) ON observer_home_review.registration_identities TO service_role;
    GRANT SELECT,UPDATE ON ALL TABLES IN SCHEMA public TO service_role;
    GRANT INSERT,UPDATE ON public.observer_event_risk_claims TO service_role;
    GRANT INSERT ON public.immutable_audit_events TO service_role;
    GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;
    GRANT EXECUTE ON FUNCTION public.claim_event_risk_v1(uuid,text,uuid,integer) TO service_role;`);
  const riskResult = JSON.parse(pg(`SELECT public.claim_event_risk_v1(
    '${acceptedId}','do-risk-v1','12121212-3434-4567-8abc-121212121212',30);`, "service_role"));
  assert.equal(riskResult.kind, "OWNED");
  assert.equal(pg(`SELECT incident_id FROM public.observer_event_risk_claims
    WHERE signal_id='${acceptedId}';`), frozenIncident); checks += 2;
  pg(`CREATE FUNCTION public.qa_fail_acceptance_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.action='ACCEPTED' THEN RAISE EXCEPTION 'SYNTHETIC_ACCEPTANCE_AUDIT_FAILURE'; END IF;
      RETURN NEW; END $$;
    CREATE TRIGGER qa_fail_acceptance_audit BEFORE INSERT ON observer_home_review.registration_audit
    FOR EACH ROW EXECUTE FUNCTION public.qa_fail_acceptance_audit();`);
  denied(accept(reg, observation("aaaa2222-3333-4444-8555-666666666666")),
    /SYNTHETIC_ACCEPTANCE_AUDIT_FAILURE/);
  assert.equal(count("public.observer_intelligence_signals"), 1);
  assert.equal(count("public.observer_correlated_events"), 2); // second is the isolated conflict probe
  assert.equal(count("observer_home_review.event_acceptances"), 1);
  assert.equal(count("observer_home_review.event_bindings"), 1); checks += 4;
  pg("DROP TRIGGER qa_fail_acceptance_audit ON observer_home_review.registration_audit; DROP FUNCTION public.qa_fail_acceptance_audit();");
  for (const [table, stage] of [
    ["public.observer_correlated_events", "INCIDENT"],
    ["public.observer_correlated_event_links", "LINK"],
    ["observer_home_review.event_bindings", "BINDING"],
    ["observer_home_review.registration_audit", "BOUND_AUDIT"],
  ]) {
    const eventId = pg("SELECT gen_random_uuid();");
    const beforeCounts = ["public.observer_intelligence_signals", "public.observer_correlated_events",
      "public.observer_correlated_event_links", "observer_home_review.event_acceptances",
      "observer_home_review.event_bindings", "observer_home_review.registration_audit"].map(count);
    const failureCondition = stage === "BOUND_AUDIT" ? "NEW.action='BOUND'" : "true";
    pg(`CREATE FUNCTION public.qa_fail_frozen_stage() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF ${failureCondition} THEN
        RAISE EXCEPTION 'SYNTHETIC_${stage}_FAILURE'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER qa_fail_frozen_stage BEFORE INSERT ON ${table}
      FOR EACH ROW EXECUTE FUNCTION public.qa_fail_frozen_stage();`);
    denied(accept(reg, observation(eventId)), new RegExp(`SYNTHETIC_${stage}_FAILURE`));
    const afterCounts = ["public.observer_intelligence_signals", "public.observer_correlated_events",
      "public.observer_correlated_event_links", "observer_home_review.event_acceptances",
      "observer_home_review.event_bindings", "observer_home_review.registration_audit"].map(count);
    assert.deepEqual(afterCounts, beforeCounts, `${stage} left partial rows`); checks++;
    pg(`DROP TRIGGER qa_fail_frozen_stage ON ${table}; DROP FUNCTION public.qa_fail_frozen_stage();`);
  }
  denied(accept(reg, { ...a, streamId: "other" }), /HOME_EVENT_REPLAY_CONFLICT_OR_UNRECEIPTED/);
  denied(accept(reg, observation("33333333-4444-4555-8666-777777777777", otherSite)),
    /HOME_REGISTRATION_SCOPE_OR_TRANSFER_UNVERIFIED/);
  denied(accept(reg, observation("33333333-4444-4555-8666-777777777777", site, otherCamera)),
    /HOME_REGISTRATION_SCOPE_OR_TRANSFER_UNVERIFIED/);
  denied(accept(reg, observation("33333333-4444-4555-8666-777777777777"), 1),
    /HOME_REGISTRATION_SCOPE_OR_TRANSFER_UNVERIFIED/);
  assert.equal(pg(qualify()), "1"); checks++; // same request is idempotent
  denied(qualify(reg, "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", authority, 0),
    /REGISTRATION_VERSION_STALE/);
  // Qualification v2 races revocation; both serialize, and stale new admission
  // remains denied. A new authority_ref is mandatory because version refs are unique.
  const authorityV2 = "44444444-5555-4666-8777-888888888888";
  const requestV2 = "55555555-6666-4777-8888-999999999999";
  pg(`UPDATE observer_home_review.qa_owner_authority_fixture SET authority_ref='${authorityV2}'
    WHERE registration_id='${reg}';`);
  const renewing = asyncPg(`BEGIN; ${qualify(reg,requestV2,authorityV2,1)}
    SELECT 'RENEWED_READY'; SELECT pg_sleep(2); COMMIT;`);
  await waitMarker(renewing, "RENEWED_READY");
  const laterRevoke = asyncPg(revoke(reg));
  const [renewed, revoked] = await Promise.all([renewing.done, laterRevoke.done]);
  assert.equal(renewed.code, 0, renewed.error);
  assert.equal(revoked.code, 0, revoked.error); checks++;
  assert.equal(count("observer_home_review.registration_versions"), 2);
  assert.equal(pg(`SELECT current_version||':'||owner_epoch||':'||revoked
    FROM observer_home_review.registration_identities WHERE registration_id='${reg}';`), "2:1:true"); checks += 2;
  assert.equal(pg(accept(reg, a)), acceptedId); checks++;
  denied(accept(reg, observation("66666666-7777-4888-8999-aaaaaaaaaaaa")),
    /HOME_REGISTRATION_SCOPE_OR_TRANSFER_UNVERIFIED/);
  denied(qualify(reg, "66666666-7777-4888-8999-aaaaaaaaaaaa", authorityV2, 2),
    /REGISTRATION_ABSENT_OR_REVOKED/);
  // Second registration: revocation wins, so qualification renewal and first
  // acceptance after that fence both fail without a Signal or version 2.
  assert.equal(pg(qualify(regB,requestB,authorityB,0)), "1"); checks++;
  const firstRevoke = asyncPg(`BEGIN; ${revoke(regB)} SELECT 'REVOKE_READY'; SELECT pg_sleep(2); COMMIT;`);
  await waitMarker(firstRevoke, "REVOKE_READY");
  const waitingFirst = asyncPg(accept(regB,
    observation("77777777-8888-4999-8aaa-bbbbbbbbbbbb",otherSite,otherCamera)));
  const [revokedFirst, deniedAfter] = await Promise.all([firstRevoke.done, waitingFirst.done]);
  assert.equal(revokedFirst.code, 0, revokedFirst.error);
  assert.notEqual(deniedAfter.code, 0);
  assert.match(deniedAfter.error, /HOME_REGISTRATION_SCOPE_OR_TRANSFER_UNVERIFIED/); checks++;
  denied(qualify(regB, "77777777-8888-4999-8aaa-bbbbbbbbbbbb", authorityB, 1),
    /REGISTRATION_ABSENT_OR_REVOKED/);
  assert.equal(count("public.observer_intelligence_signals"), 1);
  assert.equal(count("observer_home_review.event_acceptances"), 1);
  assert.equal(count("observer_home_review.registration_versions"), 3); checks += 3;
  // Acceptance wins the registration lock first, then revocation waits. The
  // committed Signal, Incident, frozen binding and audit survive the later
  // revocation, while every new admission after that fence is denied.
  pg(`INSERT INTO public.digital_observer_camera_sources
      (id,observer_site_id,status,source_mode) VALUES
      ('${cameraC}','${otherSite}','connected','live');
    INSERT INTO observer_home_review.registration_identities
      (registration_id,tenant_id,site_id,source_id,owner_profile_id,owner_epoch,revoked)
      VALUES ('${regC}','${otherTenant}','${otherSite}','${cameraC}','${owner}',0,false);
    INSERT INTO observer_home_review.qa_current_scope_fixture VALUES
      ('${regC}','${otherTenant}','${otherSite}','${cameraC}','${owner}',true);
    INSERT INTO observer_home_review.qa_owner_authority_fixture
      (registration_id,tenant_id,site_id,source_id,owner_profile_id,verified,active,
       expires_at,authority_ref,authorized_actor_id,fingerprint)
      VALUES ('${regC}','${otherTenant}','${otherSite}','${cameraC}','${owner}',true,true,
        now()+interval '1 hour','${authorityC}','${owner}','${fingerprint}');
    INSERT INTO observer_home_review.qa_gateway_session_fixture VALUES
      ('${gatewayC}','${cameraC}',true,now()+interval '1 hour');`);
  assert.equal(pg(qualify(regC, requestC, authorityC)), "1"); checks++;
  const cEvent = observation("88888888-aaaa-4888-8999-aaaaaaaaaaaa", otherSite, cameraC,
    { occurredAt: pg("SELECT clock_timestamp();") });
  const acceptanceFirst = asyncPg(`BEGIN; ${accept(regC,cEvent,0,gatewayC)}
    SELECT 'ACCEPTED_READY'; SELECT pg_sleep(2); COMMIT;`);
  await waitMarker(acceptanceFirst, "ACCEPTED_READY");
  const revokeSecond = asyncPg(revoke(regC));
  const [acceptedFirst, revokedSecond] = await Promise.all([acceptanceFirst.done, revokeSecond.done]);
  assert.equal(acceptedFirst.code, 0, acceptedFirst.error);
  assert.equal(revokedSecond.code, 0, revokedSecond.error);
  const cAcceptedId = pg(`SELECT event_id FROM observer_home_review.event_acceptances
    WHERE registration_id='${regC}';`);
  assert.equal(pg(`SELECT count(*) FROM observer_home_review.event_bindings b
    JOIN public.observer_correlated_event_links l ON l.source_id=b.event_id
    JOIN public.observer_correlated_events i ON i.id=l.correlated_event_id
    WHERE b.event_id='${cAcceptedId}' AND b.incident_id=i.id;`), "1");
  denied(accept(regC, observation("99999999-aaaa-4999-8999-aaaaaaaaaaaa",otherSite,cameraC),0,gatewayC),
    /HOME_REGISTRATION_SCOPE_OR_TRANSFER_UNVERIFIED/); checks += 3;
  console.log(`PASS: ${checks} isolated qualification-to-canonical-acceptance assertions; no direct version seed or live authority.`);
} finally {
  if (container) {
    const stopped = docker(["stop", "--time", "3", container]);
    if (stopped.status !== 0) { process.exitCode = 1; console.error("FAIL: disposable container cleanup"); }
  }
}
