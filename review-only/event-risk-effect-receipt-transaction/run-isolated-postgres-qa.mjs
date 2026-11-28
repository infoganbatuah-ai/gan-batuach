#!/usr/bin/env node
// Only a disposable network-disabled PostgreSQL container; no existing DB.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL(".", import.meta.url));
const root = fileURLToPath(new URL("../..", import.meta.url));
const image = "public.ecr.aws/supabase/postgres:17.6.1.167";
const signal = ["77777777-7777-4777-8777-777777777777", "88888888-8888-4888-8888-888888888888", "99999999-9999-4999-8999-999999999999"];
const risk = ["11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "22222222-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "33333333-aaaa-4aaa-8aaa-aaaaaaaaaaaa"];
const authority = ["11111111-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "33333333-bbbb-4bbb-8bbb-bbbbbbbbbbbb"];
const incident = ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"];
const tenant = "11111111-1111-4111-8111-111111111111";
const site = "33333333-3333-4333-8333-333333333333";
const camera = "55555555-5555-4555-8555-555555555555";
const nonce = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const nextNonce = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
let container;
let checks = 0;
function docker(args, input) {
  const result = spawnSync("docker", args, { input, encoding: "utf8", timeout: 25000, maxBuffer: 4000000 });
  if (result.error) throw result.error;
  return result;
}
function psql(statement, role = "postgres") {
  const result = docker(["exec", "-i", container, "psql", "-X", "-h", "/tmp", "-U", role,
    "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-q"], statement);
  if (result.status !== 0) throw new Error(result.stderr.trim());
  return result.stdout.trim();
}
function denied(statement, pattern, role = "service_role") {
  const result = docker(["exec", "-i", container, "psql", "-X", "-h", "/tmp", "-U", role,
    "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-q"], statement);
  assert.notEqual(result.status, 0, `expected denial: ${pattern}`);
  assert.match(result.stderr, pattern);
  checks++;
}
function app(statement) { return psql(statement, "service_role"); }
function asyncApp(statement) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", ["exec", "-i", container, "psql", "-X", "-h", "/tmp",
      "-U", "service_role", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-q"],
    { stdio: ["pipe", "pipe", "pipe"] });
    let out = ""; let err = "";
    child.stdout.on("data", chunk => { out += chunk; });
    child.stderr.on("data", chunk => { err += chunk; });
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve(out.trim()) : reject(new Error(err.trim())));
    child.stdin.end(statement);
  });
}
function digest(i) {
  return psql(`SELECT encode(sha256(convert_to(to_jsonb(l)::text,'UTF8')),'hex')
    FROM public.observer_correlated_event_links l WHERE source_id='${signal[i]}';`);
}
function invoke(i, fingerprint = digest(i), token = nonce, epoch = 1, key = "EVENT_INCIDENT_LINK", recipientDigest = "NULL") {
  return `SELECT public.record_event_risk_effect_v1('${signal[i]}','do-risk-v1','${token}',${epoch},
    '${key}','${fingerprint}',${recipientDigest});`;
}
function preparePlan(i) {
  const linkDigest = digest(i);
  const content = {
    schemaVersion: 1,
    scope: { tenantId: tenant, siteId: site, sourceId: camera, eventId: signal[i],
      incidentId: incident[i], riskDecisionId: risk[i] },
    decisionCode: "LOG_ONLY", severity: "GUARDED", settingsVersion: "settings-v1",
    policyVersion: "policy-v1", capturedAt: "2026-10-26T00:00:00Z", recipients: []
  };
  const fingerprint = psql(`SELECT encode(sha256(convert_to('${JSON.stringify(content)}'::jsonb::text,'UTF8')),'hex');`);
  const snapshot = `'${JSON.stringify({ ...content, fingerprint })}'::jsonb`;
  const snapshotDigest = psql(`SELECT encode(sha256(convert_to(${snapshot}::text,'UTF8')),'hex');`);
  const effectKeys = ["EVENT_INCIDENT_LINK", "RISK_DECISION", "INCIDENT_RISK_PROJECTION",
    "VERIFICATION_RESULT", "DECISION_INTENT", "INCIDENT_VERIFICATION_PROJECTION",
    "RECIPIENT_PLAN", "MANDATORY_DECISION_AUDIT", "GUARD_ELIGIBILITY"];
  const expected = Object.fromEntries(effectKeys.map(key => [key,
    key === "EVENT_INCIDENT_LINK" ? linkDigest : "a".repeat(64)]));
  const auditId = psql(`INSERT INTO public.immutable_audit_events
    (event_type,event_category,actor_role,target_type,target_id,incident_id,metadata,risk_level)
    VALUES ('observer_event_risk_effect_plan_frozen_v1','observer','postgres',
    'observer_intelligence_signal','${signal[i]}','${incident[i]}',
    jsonb_build_object('tenant_id','${tenant}','site_id','${site}',
      'risk_evaluation_id','${risk[i]}','authority_id','${authority[i]}',
      'snapshot_digest','${snapshotDigest}'),'medium') RETURNING id;`);
  psql(`INSERT INTO public.observer_event_risk_plan_authority (
    authority_id,signal_id,risk_engine_version,tenant_id,observer_site_id,
    camera_source_id,incident_id,risk_evaluation_id,ownership_evidence_ref,
    producer_contract_version,decision_code,recipient_settings_version,
    recipient_policy_version,recipient_snapshot_schema_version,
    recipient_snapshot_captured_at,recipient_snapshot,required_evidence_references,
    expected_fingerprints,media_fault_audit_required)
    VALUES ('${authority[i]}','${signal[i]}','do-risk-v1','${tenant}','${site}',
      '${camera}','${incident[i]}','${risk[i]}','fixture-authority',
      'server-decision-v1','LOG_ONLY','settings-v1','policy-v1',1,
      '2026-10-26T00:00:00Z',${snapshot},'["evidence-1"]'::jsonb,
      '${JSON.stringify(expected)}'::jsonb,false);
    INSERT INTO public.observer_event_risk_effect_plans (
      signal_id,risk_engine_version,tenant_id,observer_site_id,camera_source_id,
      incident_id,risk_evaluation_id,ownership_evidence_ref,
      recipient_settings_version,recipient_policy_version,decision_code,
      recipient_snapshot_schema_version,recipient_snapshot_captured_at,
      recipient_snapshot,recipient_snapshot_fingerprint,
      recipient_snapshot_digest,recipient_snapshot_digest_algorithm,
      required_evidence_references,media_fault_audit_required,
      expected_effect_keys,expected_fingerprints,authority_id,audit_event_id)
    VALUES ('${signal[i]}','do-risk-v1','${tenant}','${site}','${camera}',
      '${incident[i]}','${risk[i]}','fixture-authority','settings-v1','policy-v1',
      'LOG_ONLY',1,'2026-10-26T00:00:00Z',${snapshot},'${fingerprint}',
      '${snapshotDigest}','pg-jsonb-text-v1','["evidence-1"]'::jsonb,false,
      '${JSON.stringify(effectKeys)}'::jsonb,'${JSON.stringify(expected)}'::jsonb,
      '${authority[i]}','${auditId}');`);
  return linkDigest;
}
try {
  const source = readFileSync(`${dir}RPC-BODY-NOT-APPLIED.sql`, "utf8");
  const fixtureSource = readFileSync(`${root}review-only/event-risk-atomic-claim-qualification/isolated-schema.sql`, "utf8");
  assert.match(source, /DRAFT_NOT_APPLIED/);
  assert.doesNotMatch(source, /^\s*(?:COMMIT|ROLLBACK|GRANT)\b/im);
  const body = source.slice(source.indexOf("CREATE TABLE public.observer_event_risk_effect_receipts ("));
  const fixture = fixtureSource.slice(fixtureSource.indexOf("CREATE ROLE service_role LOGIN BYPASSRLS;"));
  assert.ok(body.startsWith("CREATE TABLE") && fixture.startsWith("CREATE ROLE"));
  assert.equal(docker(["context", "show"]).stdout.trim(), "colima-gbi");
  assert.match(docker(["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"]).stdout.trim(), /^unix:\/\//);
  assert.equal(docker(["image", "inspect", image, "--format", "{{.Id}}"]).status, 0, "image not cached");
  const started = docker(["run", "--detach", "--rm", "--network", "none", "--read-only",
    "--memory", "768m", "--cpus", "1", "--pids-limit", "128", "--user", "postgres",
    "--tmpfs", "/tmp:rw,nosuid,nodev,mode=1777", "--entrypoint", "/bin/sh", image,
    "-ec", "initdb -D /tmp/qa-data -A trust --no-instructions >/dev/null && exec postgres -D /tmp/qa-data -c listen_addresses= -c unix_socket_directories=/tmp"]);
  assert.equal(started.status, 0, started.stderr);
  container = started.stdout.trim();
  assert.match(container, /^[0-9a-f]{64}$/);
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (docker(["exec", container, "pg_isready", "-h", "/tmp", "-U", "postgres"]).status === 0) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready);
  denied(source, /DRAFT_NOT_APPLIED/, "postgres");
  assert.equal(psql("SELECT count(*) FROM pg_proc WHERE proname='record_event_risk_effect_v1';"), "0");
  denied(fixtureSource, /ISOLATED_FIXTURE_ONLY/, "postgres");
  psql(fixture);
  psql(`DROP TABLE public.immutable_audit_events;
    CREATE TABLE public.immutable_audit_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      event_type text NOT NULL,event_category text NOT NULL,actor_role text NOT NULL,
      target_type text NOT NULL,target_id uuid NOT NULL,incident_id uuid NOT NULL,
      metadata jsonb NOT NULL,risk_level text NOT NULL);
    ALTER TABLE public.observer_correlated_event_links
      ADD COLUMN id uuid DEFAULT gen_random_uuid() UNIQUE,
      ADD COLUMN metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
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
      observer_site_id uuid NOT NULL,camera_source_id uuid NOT NULL,
      incident_id uuid NOT NULL,risk_evaluation_id uuid NOT NULL,
      ownership_evidence_ref text NOT NULL,recipient_settings_version text NOT NULL,
      recipient_policy_version text NOT NULL,decision_code text NOT NULL,
      recipient_snapshot_schema_version integer NOT NULL,
      recipient_snapshot_captured_at timestamptz NOT NULL,
      recipient_snapshot jsonb NOT NULL,recipient_snapshot_fingerprint text NOT NULL,
      recipient_snapshot_digest_algorithm text NOT NULL,recipient_snapshot_digest text NOT NULL,
      required_evidence_references jsonb NOT NULL,media_fault_audit_required boolean NOT NULL,
      expected_effect_keys jsonb NOT NULL,expected_fingerprints jsonb NOT NULL,authority_id uuid NOT NULL,
      audit_event_id uuid NOT NULL,PRIMARY KEY(signal_id,risk_engine_version));
    INSERT INTO public.observer_event_risk_claims
      (signal_id,risk_engine_version,tenant_id,observer_site_id,incident_id,
       status,owner_nonce,owner_epoch,lease_expires_at,risk_evaluation_id)
    VALUES ('${signal[0]}','do-risk-v1','${tenant}','${site}','${incident[0]}',
      'EFFECTS_PENDING','${nonce}',1,clock_timestamp()+interval '10 minutes','${risk[0]}'),
      ('${signal[1]}','do-risk-v1','${tenant}','${site}','${incident[1]}',
      'EFFECTS_PENDING','${nonce}',1,clock_timestamp()+interval '10 minutes','${risk[1]}'),
      ('${signal[2]}','do-risk-v1','${tenant}','${site}','${incident[2]}',
      'EFFECTS_PENDING','${nonce}',1,clock_timestamp()+interval '10 minutes','${risk[2]}');
    INSERT INTO public.digital_observer_risk_evaluations VALUES
      ('${risk[0]}','${site}','${incident[0]}','${signal[0]}','do-risk-v1','LOG_ONLY'),
      ('${risk[1]}','${site}','${incident[1]}','${signal[1]}','do-risk-v1','LOG_ONLY'),
      ('${risk[2]}','${site}','${incident[2]}','${signal[2]}','do-risk-v1','LOG_ONLY');
    GRANT SELECT,INSERT ON public.immutable_audit_events TO service_role;
    GRANT SELECT,UPDATE ON public.digital_observer_risk_evaluations TO service_role;
    GRANT SELECT ON public.observer_event_risk_plan_authority,
      public.observer_event_risk_effect_plans TO service_role;`);
  const fingerprint = signal.map((_, i) => preparePlan(i));
  psql(body);
  psql(`GRANT SELECT,INSERT ON public.observer_event_risk_effect_receipts TO service_role;
    GRANT EXECUTE ON FUNCTION public.record_event_risk_effect_v1(uuid,text,uuid,bigint,text,text,text)
      TO service_role;`);
  denied(invoke(0), /permission denied for function record_event_risk_effect_v1/, "anon");
  denied(invoke(0, fingerprint[0], nonce, 1, "DECISION_INTENT"), /EFFECT_UNSUPPORTED/);
  denied(invoke(0, fingerprint[0], nextNonce), /EFFECT_OWNER_FENCE_REJECTED/);
  denied(invoke(0, fingerprint[0], nonce, 2), /EFFECT_OWNER_FENCE_REJECTED/);
  denied(invoke(0, "b".repeat(64)), /EFFECT_TARGET_SEMANTIC_CONFLICT/);
  denied(invoke(0, fingerprint[0], nonce, 1, "EVENT_INCIDENT_LINK", `'${"a".repeat(64)}'`), /EFFECT_INPUT_INVALID/);
  assert.equal(psql(`SELECT has_table_privilege('service_role','public.observer_event_risk_effect_receipts','INSERT');`), "t");
  checks++; // Direct-table bypass remains a live blocking fact, not a PASS.
  const thirdLinkId = psql(`SELECT id FROM public.observer_correlated_event_links
    WHERE source_id='${signal[2]}';`);
  const thirdPlanDigest = psql(`SELECT recipient_snapshot_digest
    FROM public.observer_event_risk_effect_plans WHERE signal_id='${signal[2]}';`);
  // Deliberately demonstrate the invoker privilege gap, then roll it back in
  // this disposable fixture. A direct-table writer can forge both rows and
  // cause the RPC's semantic replay to accept them without its first-write path.
  const bypass = app(`BEGIN;
    WITH forged_audit AS (
      INSERT INTO public.immutable_audit_events
      (event_type,event_category,actor_role,target_type,target_id,incident_id,metadata,risk_level)
      VALUES ('observer_event_risk_link_effect_recorded_v1','observer','service_role',
        'observer_correlated_event_link','${thirdLinkId}','${incident[2]}',
        jsonb_build_object('signal_id','${signal[2]}','tenant_id','${tenant}',
          'site_id','${site}','risk_evaluation_id','${risk[2]}',
          'plan_digest','${thirdPlanDigest}','target_digest','${fingerprint[2]}',
          'owner_epoch',1),'medium') RETURNING id
    ) INSERT INTO public.observer_event_risk_effect_receipts
    (signal_id,risk_engine_version,effect_key,tenant_id,observer_site_id,
      risk_evaluation_id,owner_epoch,effect_fingerprint,target_link_id,
      target_row_digest,target_row_digest_algorithm,mandatory_audit_id)
    SELECT '${signal[2]}','do-risk-v1','EVENT_INCIDENT_LINK','${tenant}','${site}',
      '${risk[2]}',1,'${fingerprint[2]}','${thirdLinkId}',
      '${fingerprint[2]}','pg-link-jsonb-v1',id FROM forged_audit;
    ${invoke(2, fingerprint[2])}
    ROLLBACK;`);
  assert.equal(JSON.parse(bypass).reused, true);
  assert.equal(psql(`SELECT count(*) FROM public.observer_event_risk_effect_receipts
    WHERE signal_id='${signal[2]}';`), "0");
  checks++;
  const first = JSON.parse(app(invoke(0)));
  assert.equal(first.kind, "LINK_EFFECT_RECORDED");
  assert.equal(first.reused, false);
  assert.equal(first.target_digest, fingerprint[0]);
  assert.equal(psql(`SELECT count(*) FROM public.observer_event_risk_effect_receipts WHERE signal_id='${signal[0]}';`), "1");
  assert.equal(psql(`SELECT count(*) FROM public.immutable_audit_events
    WHERE event_type='observer_event_risk_link_effect_recorded_v1';`), "1");
  checks++;
  assert.equal(JSON.parse(app(invoke(0))).reused, true);
  assert.equal(psql(`SELECT count(*) FROM public.immutable_audit_events
    WHERE event_type='observer_event_risk_link_effect_recorded_v1';`), "1");
  checks++;
  psql(`UPDATE public.observer_correlated_event_links
    SET metadata='{"tampered":true}'::jsonb WHERE source_id='${signal[0]}';`);
  denied(invoke(0, fingerprint[0]), /EFFECT_TARGET_SEMANTIC_CONFLICT/);
  psql(`UPDATE public.observer_correlated_event_links
    SET metadata='{}'::jsonb WHERE source_id='${signal[0]}';`);
  psql(`UPDATE public.observer_event_risk_effect_receipts SET
    effect_fingerprint=repeat('b',64),target_row_digest=repeat('b',64)
    WHERE signal_id='${signal[0]}';`);
  denied(invoke(0), /EFFECT_RECEIPT_SEMANTIC_CONFLICT/);
  psql(`UPDATE public.observer_event_risk_effect_receipts SET
    effect_fingerprint='${fingerprint[0]}',target_row_digest='${fingerprint[0]}'
    WHERE signal_id='${signal[0]}';`);
  psql(`UPDATE public.observer_event_risk_claims SET lease_expires_at=clock_timestamp()-interval '1 second'
    WHERE signal_id='${signal[0]}';`);
  denied(invoke(0), /EFFECT_OWNER_FENCE_REJECTED/);
  psql(`UPDATE public.observer_event_risk_claims SET owner_epoch=2,owner_nonce='${nextNonce}',
    lease_expires_at=clock_timestamp()+interval '10 minutes' WHERE signal_id='${signal[0]}';`);
  assert.equal(JSON.parse(app(invoke(0, fingerprint[0], nextNonce, 2))).reused, true);
  denied(invoke(0, fingerprint[0], nonce, 1), /EFFECT_OWNER_FENCE_REJECTED/);
  checks++;
  psql(`UPDATE public.observer_correlated_event_links
    SET observer_site_id='44444444-4444-4444-8444-444444444444'
    WHERE source_id='${signal[1]}';`);
  denied(invoke(1, fingerprint[1]), /EFFECT_CANONICAL_SCOPE_INVALID/);
  psql(`UPDATE public.observer_correlated_event_links
    SET observer_site_id='${site}' WHERE source_id='${signal[1]}';`);
  psql(`UPDATE public.observer_event_risk_effect_plans
    SET tenant_id='22222222-2222-4222-8222-222222222222'
    WHERE signal_id='${signal[1]}';`);
  denied(invoke(1, fingerprint[1]), /EFFECT_PLAN_SCOPE_INVALID/);
  psql(`UPDATE public.observer_event_risk_effect_plans
    SET tenant_id='${tenant}' WHERE signal_id='${signal[1]}';`);
  psql(`UPDATE public.observer_event_risk_effect_plans
    SET recipient_settings_version='tampered-settings' WHERE signal_id='${signal[1]}';`);
  denied(invoke(1, fingerprint[1]), /EFFECT_PLAN_AUTHORITY_INVALID/);
  psql(`UPDATE public.observer_event_risk_effect_plans
    SET recipient_settings_version='settings-v1' WHERE signal_id='${signal[1]}';`);
  psql(`UPDATE public.observer_event_risk_effect_plans
    SET recipient_snapshot_fingerprint=repeat('b',64) WHERE signal_id='${signal[1]}';`);
  denied(invoke(1, fingerprint[1]), /EFFECT_PLAN_AUTHORITY_INVALID/);
  psql(`UPDATE public.observer_event_risk_effect_plans
    SET recipient_snapshot_fingerprint=recipient_snapshot->>'fingerprint'
    WHERE signal_id='${signal[1]}';`);
  psql(`CREATE FUNCTION public.qa_abort_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'synthetic audit failure'; END $$;
    CREATE TRIGGER qa_abort_audit BEFORE INSERT ON public.immutable_audit_events
      FOR EACH ROW EXECUTE FUNCTION public.qa_abort_audit();`);
  denied(invoke(1, fingerprint[1]), /synthetic audit failure/);
  assert.equal(psql(`SELECT count(*) FROM public.observer_event_risk_effect_receipts
    WHERE signal_id='${signal[1]}';`), "0");
  checks++;
  psql(`DROP TRIGGER qa_abort_audit ON public.immutable_audit_events;
    DROP FUNCTION public.qa_abort_audit();`);
  const [a, b] = await Promise.all([asyncApp(invoke(1, fingerprint[1])), asyncApp(invoke(1, fingerprint[1]))]);
  assert.deepEqual([JSON.parse(a).reused, JSON.parse(b).reused].sort(), [false, true]);
  assert.equal(psql(`SELECT count(*) FROM public.observer_event_risk_effect_receipts
    WHERE signal_id='${signal[1]}';`), "1");
  checks++;
  // A synthetic direct-table attempt with a nonexistent target is rejected by FK.
  const existingAuditId = psql(`SELECT audit_event_id FROM public.observer_event_risk_effect_plans
    WHERE signal_id='${signal[2]}';`);
  denied(`INSERT INTO public.observer_event_risk_effect_receipts
    (signal_id,risk_engine_version,effect_key,tenant_id,observer_site_id,
      risk_evaluation_id,owner_epoch,effect_fingerprint,target_link_id,
      target_row_digest,target_row_digest_algorithm,mandatory_audit_id)
    VALUES ('${signal[2]}','do-risk-v1','EVENT_INCIDENT_LINK','${tenant}','${site}',
      '${risk[2]}',1,'${fingerprint[2]}','00000000-0000-4000-8000-000000000000',
      '${fingerprint[2]}','pg-link-jsonb-v1','${existingAuditId}');`, /target_link_id_fkey|foreign key/);
  psql(`DELETE FROM public.observer_correlated_event_links WHERE source_id='${signal[2]}';`);
  denied(invoke(2, fingerprint[2]), /EFFECT_CANONICAL_SCOPE_INVALID/);
  assert.equal(psql(`SELECT count(*) FROM public.observer_event_risk_effect_receipts
    WHERE signal_id='${signal[2]}';`), "0");
  checks++;
  console.log(`PASS: ${checks} isolated PostgreSQL checks for canonical link+receipt+mandatory audit; direct-write ACL gap remains BLOCKED.`);
} finally {
  if (container) {
    const stopped = docker(["stop", "--time", "3", container]);
    if (stopped.status !== 0) { process.exitCode = 1; console.error("FAIL: disposable container cleanup"); }
  }
}
