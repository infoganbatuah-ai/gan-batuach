#!/usr/bin/env node
// PostgreSQL behavior of the pinned review-only Home receipt delta.
// Disposable, networkless, mountless, tmpfs-only fixture; never LOCAL_SUPABASE.
import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { adaptHomeEffectReceiptFence } from "./adapt-home-effect-receipt-fence.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const fixture = readFileSync(`${root}review-only/event-risk-atomic-claim-qualification/isolated-schema.sql`, "utf8");
const original = execFileSync("git", ["show", "e14464047b9aab5bb359d7012b50e14de7a0ad36:review-only/event-risk-effect-receipt-transaction/RPC-BODY-NOT-APPLIED.sql"], { encoding: "utf8" });
const proposed = adaptHomeEffectReceiptFence(original).sql;
const image = "public.ecr.aws/supabase/postgres:17.6.1.167";
const events = ["77777777-7777-4777-8777-777777777777", "88888888-8888-4888-8888-888888888888", "99999999-9999-4999-8999-999999999999"];
const incidents = ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"];
const tenant = "11111111-1111-4111-8111-111111111111";
const site = "33333333-3333-4333-8333-333333333333";
const camera = "55555555-5555-4555-8555-555555555555";
const registration = "13131313-1313-4313-8313-131313131313";
const ownerNonce = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const nextNonce = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
let container;
let checks = 0;

function docker(args, input) {
  const result = spawnSync("docker", args, { input, encoding: "utf8", timeout: 30000, maxBuffer: 5_000_000 });
  if (result.error) throw result.error;
  return result;
}
function args(role = "postgres") {
  return ["exec", "-i", container, "psql", "-X", "-h", "/tmp", "-U", role,
    "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-q"];
}
function query(sql, role = "postgres") {
  const result = docker(args(role), sql);
  if (result.status !== 0) throw new Error(result.stderr.trim());
  return result.stdout.trim();
}
function denied(sql, pattern, role = "service_role") {
  const result = docker(args(role), sql);
  assert.notEqual(result.status, 0, `unexpected SQL success: ${pattern}`);
  assert.match(result.stderr, pattern);
  checks++;
}
function bodyAfterGuard(source, anchor) {
  assert.match(source, /(?:ISOLATED_FIXTURE_ONLY|DRAFT_NOT_APPLIED)/);
  assert.ok(source.indexOf(anchor) > source.indexOf("DO $"));
  return source.slice(source.indexOf(anchor));
}
function digest(i) {
  return query(`SELECT encode(sha256(convert_to(to_jsonb(l)::text,'UTF8')),'hex')
    FROM public.observer_correlated_event_links l WHERE source_id='${events[i]}';`);
}
function invoke(i, token = ownerNonce, epoch = 1) {
  return `SELECT public.record_event_risk_effect_v1('${events[i]}','do-risk-v1',
    '${token}',${epoch},'EVENT_INCIDENT_LINK','${digest(i)}',NULL);`;
}
function count(table, where = "true") {
  return Number(query(`SELECT count(*) FROM ${table} WHERE ${where};`));
}
function noNewEffect(i) {
  assert.equal(count("public.observer_event_risk_effect_receipts", `signal_id='${events[i]}'`), 0);
  assert.equal(count("public.immutable_audit_events", `event_type='observer_event_risk_link_effect_recorded_v1' AND metadata->>'signal_id'='${events[i]}'`), 0);
  checks++;
}
function asyncQuery(sql, role = "service_role") {
  const child = spawn("docker", args(role), { stdio: ["pipe", "pipe", "pipe"] });
  let output = "", error = "";
  child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
  child.stdout.on("data", part => { output += part; });
  child.stderr.on("data", part => { error += part; });
  child.stdin.end(sql);
  const done = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error("PSQL_TIMEOUT")); }, 8000);
    child.on("error", reject);
    child.on("close", code => { clearTimeout(timer); resolve({ code, output, error }); });
  });
  return { done, output: () => output };
}
async function waitForMarker(job, marker) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (job.output().includes(marker)) return;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error(`MARKER_TIMEOUT:${marker}`);
}
function preparePlan(i) {
  const risk = `11111111-aaaa-4aaa-8aaa-${String(i + 1).repeat(12)}`;
  const authority = `11111111-bbbb-4bbb-8bbb-${String(i + 1).repeat(12)}`;
  const fingerprint = digest(i);
  const snapshotBody = {
    schemaVersion: 1, scope: { tenantId: tenant, siteId: site, sourceId: camera,
      eventId: events[i], incidentId: incidents[i], riskDecisionId: risk },
    decisionCode: "LOG_ONLY", severity: "GUARDED", settingsVersion: "synthetic-settings-v1",
    policyVersion: "synthetic-policy-v1", capturedAt: "2026-10-27T00:00:00Z", recipients: []
  };
  const literal = value => JSON.stringify(value).replaceAll("'", "''");
  const snapshotFingerprint = query(`SELECT encode(sha256(convert_to('${literal(snapshotBody)}'::jsonb::text,'UTF8')),'hex');`);
  const snapshot = `'${literal({ ...snapshotBody, fingerprint: snapshotFingerprint })}'::jsonb`;
  const snapshotDigest = query(`SELECT encode(sha256(convert_to(${snapshot}::text,'UTF8')),'hex');`);
  const keys = ["EVENT_INCIDENT_LINK", "RISK_DECISION", "INCIDENT_RISK_PROJECTION",
    "VERIFICATION_RESULT", "DECISION_INTENT", "INCIDENT_VERIFICATION_PROJECTION",
    "RECIPIENT_PLAN", "MANDATORY_DECISION_AUDIT", "GUARD_ELIGIBILITY"];
  const expected = Object.fromEntries(keys.map(key => [key, key === "EVENT_INCIDENT_LINK" ? fingerprint : "a".repeat(64)]));
  const planAudit = query(`INSERT INTO public.immutable_audit_events
    (event_type,event_category,actor_role,target_type,target_id,incident_id,metadata,risk_level)
    VALUES ('observer_event_risk_effect_plan_frozen_v1','observer','postgres',
      'observer_intelligence_signal','${events[i]}','${incidents[i]}',
      jsonb_build_object('tenant_id','${tenant}','site_id','${site}',
        'risk_evaluation_id','${risk}','authority_id','${authority}',
        'snapshot_digest','${snapshotDigest}'),'medium') RETURNING id;`);
  query(`INSERT INTO public.observer_event_risk_claims
      (signal_id,risk_engine_version,tenant_id,observer_site_id,incident_id,
       status,owner_nonce,owner_epoch,lease_expires_at,risk_evaluation_id)
    VALUES ('${events[i]}','do-risk-v1','${tenant}','${site}','${incidents[i]}',
      'EFFECTS_PENDING','${ownerNonce}',1,clock_timestamp()+interval '5 minutes','${risk}');
    INSERT INTO public.digital_observer_risk_evaluations VALUES
      ('${risk}','${site}','${incidents[i]}','${events[i]}','do-risk-v1','LOG_ONLY');
    INSERT INTO public.observer_event_risk_plan_authority VALUES
      ('${authority}','${events[i]}','do-risk-v1','${tenant}','${site}',
       '${camera}','${incidents[i]}','${risk}','synthetic-home-owner',
       'server-decision-v1','LOG_ONLY','synthetic-settings-v1','synthetic-policy-v1',
       1,'2026-10-27T00:00:00Z',${snapshot},'["synthetic-evidence"]'::jsonb,
       '${literal(expected)}'::jsonb,false);
    INSERT INTO public.observer_event_risk_effect_plans VALUES
      ('${events[i]}','do-risk-v1','${tenant}','${site}','${camera}',
       '${incidents[i]}','${risk}','synthetic-home-owner',
       'synthetic-settings-v1','synthetic-policy-v1','LOG_ONLY',1,
       '2026-10-27T00:00:00Z',${snapshot},'${snapshotFingerprint}',
       '${snapshotDigest}','pg-jsonb-text-v1','["synthetic-evidence"]'::jsonb,
       false,'${literal(keys)}'::jsonb,'${literal(expected)}'::jsonb,
       '${authority}','${planAudit}');`);
}

try {
  assert.equal(docker(["context", "show"]).stdout.trim(), "colima-gbi");
  assert.match(docker(["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"]).stdout.trim(),
    /^unix:\/\/\/Volumes\/DIGITAL_OBSERVER\/Development\/gan-batuach\/colima\/gbi\/docker\.sock$/);
  assert.equal(docker(["image", "inspect", image, "--format", "{{.Id}}"]).status, 0);
  const started = docker(["run", "--detach", "--rm", "--network", "none", "--read-only",
    "--memory", "768m", "--cpus", "1", "--pids-limit", "128", "--user", "postgres",
    "--tmpfs", "/tmp:rw,nosuid,nodev,mode=1777,size=256m", "--entrypoint", "/bin/sh", image,
    "-ec", "initdb -D /tmp/qa-data -A trust --no-instructions >/dev/null && exec postgres -D /tmp/qa-data -c listen_addresses= -c unix_socket_directories=/tmp"]);
  assert.equal(started.status, 0, started.stderr);
  container = started.stdout.trim();
  assert.match(container, /^[0-9a-f]{64}$/);
  const isolation = JSON.parse(docker(["inspect", container, "--format", "{{json .}}"] ).stdout);
  assert.equal(isolation.HostConfig.NetworkMode, "none");
  assert.deepEqual(isolation.Mounts, []);
  assert.equal(isolation.HostConfig.ReadonlyRootfs, true);
  for (let attempt = 0; attempt < 60; attempt++) {
    if (docker(["exec", container, "pg_isready", "-h", "/tmp", "-U", "postgres"]).status === 0) break;
    await new Promise(resolve => setTimeout(resolve, 100));
    if (attempt === 59) throw new Error("ISOLATED_POSTGRES_NOT_READY");
  }
  denied(fixture, /ISOLATED_FIXTURE_ONLY/, "postgres");
  denied(proposed, /DRAFT_NOT_APPLIED/, "postgres");
  query(bodyAfterGuard(fixture, "CREATE ROLE service_role LOGIN BYPASSRLS;"));
  query(`DROP TABLE public.immutable_audit_events;
    CREATE TABLE public.immutable_audit_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_type text NOT NULL,
      event_category text NOT NULL,actor_role text NOT NULL,target_type text NOT NULL,
      target_id uuid NOT NULL,incident_id uuid NOT NULL,metadata jsonb NOT NULL,
      risk_level text NOT NULL);
    ALTER TABLE public.observer_correlated_event_links
      ADD COLUMN id uuid DEFAULT gen_random_uuid() UNIQUE,
      ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
    ALTER TABLE public.observer_correlated_events ADD COLUMN related_event_ids uuid[];
    UPDATE public.observer_correlated_events e SET related_event_ids=(
      SELECT array_agg(l.source_id) FROM public.observer_correlated_event_links l
      WHERE l.correlated_event_id=e.id);
    CREATE TABLE public.digital_observer_risk_evaluations (
      id uuid PRIMARY KEY,observer_site_id uuid NOT NULL,incident_id uuid NOT NULL,
      triggering_event_id uuid NOT NULL,risk_engine_version text NOT NULL,
      recommended_decision text NOT NULL);
    CREATE TABLE public.observer_event_risk_plan_authority (
      authority_id uuid PRIMARY KEY,signal_id uuid NOT NULL,risk_engine_version text NOT NULL,
      tenant_id uuid NOT NULL,observer_site_id uuid NOT NULL,camera_source_id uuid NOT NULL,
      incident_id uuid NOT NULL,risk_evaluation_id uuid NOT NULL,
      ownership_evidence_ref text NOT NULL,producer_contract_version text NOT NULL,
      decision_code text NOT NULL,recipient_settings_version text NOT NULL,
      recipient_policy_version text NOT NULL,recipient_snapshot_schema_version integer NOT NULL,
      recipient_snapshot_captured_at timestamptz NOT NULL,recipient_snapshot jsonb NOT NULL,
      required_evidence_references jsonb NOT NULL,expected_fingerprints jsonb NOT NULL,
      media_fault_audit_required boolean NOT NULL);
    CREATE TABLE public.observer_event_risk_effect_plans (
      signal_id uuid NOT NULL,risk_engine_version text NOT NULL,tenant_id uuid NOT NULL,
      observer_site_id uuid NOT NULL,camera_source_id uuid NOT NULL,incident_id uuid NOT NULL,
      risk_evaluation_id uuid NOT NULL,ownership_evidence_ref text NOT NULL,
      recipient_settings_version text NOT NULL,recipient_policy_version text NOT NULL,
      decision_code text NOT NULL,recipient_snapshot_schema_version integer NOT NULL,
      recipient_snapshot_captured_at timestamptz NOT NULL,recipient_snapshot jsonb NOT NULL,
      recipient_snapshot_fingerprint text NOT NULL,recipient_snapshot_digest text NOT NULL,
      recipient_snapshot_digest_algorithm text NOT NULL,required_evidence_references jsonb NOT NULL,
      media_fault_audit_required boolean NOT NULL,expected_effect_keys jsonb NOT NULL,
      expected_fingerprints jsonb NOT NULL,authority_id uuid NOT NULL,audit_event_id uuid NOT NULL,
      PRIMARY KEY(signal_id,risk_engine_version));
    GRANT SELECT,INSERT ON public.immutable_audit_events TO service_role;
    GRANT SELECT,UPDATE ON public.digital_observer_risk_evaluations TO service_role;
    GRANT SELECT ON public.observer_event_risk_plan_authority,
      public.observer_event_risk_effect_plans TO service_role;`);
  events.forEach((_, i) => preparePlan(i));
  query(bodyAfterGuard(proposed, "CREATE TABLE public.observer_event_risk_effect_receipts ("));
  query(`GRANT SELECT,INSERT ON public.observer_event_risk_effect_receipts TO service_role;
    GRANT EXECUTE ON FUNCTION public.record_event_risk_effect_v1(uuid,text,uuid,bigint,text,text,text)
      TO service_role;`);
  denied(invoke(0), /permission denied for function record_event_risk_effect_v1/, "anon");

  // Every mutation here is rolled back by the failing synthetic psql session.
  const missing = [
    [`DELETE FROM observer_home_review.event_acceptances WHERE event_id='${events[2]}'`, /EFFECT_HOME_ACCEPTANCE_MISSING/],
    [`DELETE FROM observer_home_review.registration_versions WHERE registration_id='${registration}'`, /EFFECT_HOME_VERSION_CONFLICT/],
    [`DELETE FROM observer_home_review.event_bindings WHERE event_id='${events[2]}'`, /EFFECT_HOME_BINDING_CONFLICT/],
    [`DELETE FROM observer_home_review.registration_audit WHERE action='ACCEPTED' AND event_id='${events[2]}'`, /EFFECT_HOME_ACCEPTANCE_AUDIT_INVALID/],
    [`DELETE FROM observer_home_review.registration_audit WHERE action='BOUND' AND event_id='${events[2]}'`, /EFFECT_HOME_BINDING_AUDIT_INVALID/],
    [`DELETE FROM public.observer_intelligence_signals WHERE id='${events[2]}'`, /EFFECT_CANONICAL_SCOPE_INVALID/],
    [`DELETE FROM public.observer_correlated_events WHERE id='${incidents[2]}'`, /EFFECT_CANONICAL_SCOPE_INVALID/],
    [`DELETE FROM public.observer_event_risk_claims WHERE signal_id='${events[2]}'`, /EFFECT_OWNER_FENCE_REJECTED/],
    [`DELETE FROM public.digital_observer_risk_evaluations WHERE triggering_event_id='${events[2]}'`, /EFFECT_PLAN_SCOPE_INVALID/],
    [`DELETE FROM public.observer_event_risk_effect_plans WHERE signal_id='${events[2]}'`, /EFFECT_PLAN_SCOPE_INVALID/],
    [`UPDATE observer_home_review.event_acceptances SET tenant_id='22222222-2222-4222-8222-222222222222' WHERE event_id='${events[2]}'`, /EFFECT_HOME_VERSION_CONFLICT/],
    [`UPDATE observer_home_review.event_acceptances SET site_id='44444444-4444-4444-8444-444444444444' WHERE event_id='${events[2]}'`, /EFFECT_HOME_VERSION_CONFLICT/],
    [`UPDATE observer_home_review.event_bindings SET incident_id='${incidents[0]}' WHERE event_id='${events[2]}'`, /EFFECT_CANONICAL_SCOPE_INVALID/],
    [`UPDATE public.observer_intelligence_signals SET metadata=metadata || '{"tampered":true}'::jsonb WHERE id='${events[2]}'`, /EFFECT_HOME_SIGNAL_CONFLICT/]
  ];
  for (const [mutation, expected] of missing) {
    // DBA mutates only the disposable fixture; the function still runs as
    // service_role. Connection close rolls back the failed transaction.
    denied(`BEGIN; ${mutation}; SET ROLE service_role; ${invoke(2)}`, expected, "postgres");
    noNewEffect(2);
  }
  query(`CREATE FUNCTION public.qa_abort_receipt() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'synthetic receipt failure'; END $$;
    CREATE TRIGGER qa_abort_receipt BEFORE INSERT ON public.observer_event_risk_effect_receipts
      FOR EACH ROW EXECUTE FUNCTION public.qa_abort_receipt();`);
  denied(invoke(2), /synthetic receipt failure/);
  noNewEffect(2); // Mandatory audit INSERT must roll back with the failed receipt.
  query(`DROP TRIGGER qa_abort_receipt ON public.observer_event_risk_effect_receipts;
    DROP FUNCTION public.qa_abort_receipt();`);

  // Receipt writer wins the identity lock. A concurrent revoker must wait.
  const writer = asyncQuery(`BEGIN; SET LOCAL statement_timeout='5s'; ${invoke(0)}
    SELECT 'WRITER_LOCK_HELD'; SELECT pg_sleep(1.5); COMMIT;`);
  await waitForMarker(writer, "WRITER_LOCK_HELD");
  const revoker = asyncQuery(`SET statement_timeout='5s'; SELECT 'REVOKER_STARTED';
    UPDATE observer_home_review.registration_identities
      SET revoked=true,owner_epoch=owner_epoch+1
      WHERE registration_id='${registration}'; SELECT 'REVOKED';`, "postgres");
  let revocationFinished = false;
  void revoker.done.then(() => { revocationFinished = true; });
  await waitForMarker(revoker, "REVOKER_STARTED");
  await new Promise(resolve => setTimeout(resolve, 150));
  assert.equal(revocationFinished, false, "revocation crossed the identity lock"); checks++;
  const written = await writer.done;
  const revoked = await revoker.done;
  assert.equal(written.code, 0, written.error);
  assert.equal(revoked.code, 0, revoked.error);
  assert.match(written.output, /"reused": false/);
  assert.match(revoked.output, /REVOKED/);
  assert.equal(query(`SELECT revoked::text||':'||owner_epoch FROM observer_home_review.registration_identities
    WHERE registration_id='${registration}';`), "true:1");
  assert.equal(count("public.observer_event_risk_effect_receipts", `signal_id='${events[0]}'`), 1);
  assert.equal(count("public.immutable_audit_events", `event_type='observer_event_risk_link_effect_recorded_v1' AND metadata->>'signal_id'='${events[0]}'`), 1);
  checks++;

  // Revocation wins first for another accepted event: no new audit or receipt.
  denied(invoke(1), /EFFECT_HOME_AUTHORITY_REVOKED_OR_CHANGED/);
  noNewEffect(1);
  // Previously committed receipt remains readable after claim reacquisition.
  query(`UPDATE public.observer_event_risk_claims SET owner_epoch=2,owner_nonce='${nextNonce}',
    lease_expires_at=clock_timestamp()+interval '5 minutes' WHERE signal_id='${events[0]}';`);
  assert.equal(JSON.parse(query(invoke(0, nextNonce, 2), "service_role")).reused, true);
  assert.equal(count("public.observer_event_risk_effect_receipts", `signal_id='${events[0]}'`), 1);
  assert.equal(count("public.immutable_audit_events", `event_type='observer_event_risk_link_effect_recorded_v1' AND metadata->>'signal_id'='${events[0]}'`), 1);
  checks++;
  console.log(`PASS: ${checks} isolated PostgreSQL checks for Home receipt fence`);
} finally {
  if (container) {
    const stopped = docker(["stop", "--time", "3", container]);
    if (stopped.status !== 0) { process.exitCode = 1; console.error("FAIL: disposable container cleanup"); }
  }
}
