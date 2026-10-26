#!/usr/bin/env node
// A fresh, network-disabled, mount-free PostgreSQL fixture. Never an existing DB.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL(".", import.meta.url));
const source = readFileSync(`${dir}../event-risk-effect-receipt-transaction/RPC-BODY-NOT-APPLIED.sql`, "utf8");
const image = "public.ecr.aws/supabase/postgres:17.6.1.167";
const id = {
  signal: "77777777-7777-4777-8777-777777777777",
  site: "33333333-3333-4333-8333-333333333333",
  tenant: "11111111-1111-4111-8111-111111111111",
  camera: "55555555-5555-4555-8555-555555555555",
  incident: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  risk: "11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  authority: "11111111-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  link: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  nonce: "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
};
let container;
let checks = 0;
function docker(args, input) {
  const r = spawnSync("docker", args, { input, encoding: "utf8", timeout: 25000, maxBuffer: 4000000 });
  if (r.error) throw r.error;
  return r;
}
function query(sql, role = "postgres") {
  const r = docker(["exec", "-i", container, "psql", "-X", "-h", "/tmp", "-U", role,
    "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-q"], sql);
  if (r.status !== 0) throw new Error(`${role}: ${r.stderr.trim()}`);
  return r.stdout.trim();
}
function denied(sql, pattern, role = "do_effect_executor") {
  const r = docker(["exec", "-i", container, "psql", "-X", "-h", "/tmp", "-U", role,
    "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-q"], sql);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, pattern);
  checks++;
}
function check(sql, expected, role = "postgres") {
  assert.equal(query(sql, role), expected);
  checks++;
}
try {
  assert.match(source, /DRAFT_NOT_APPLIED/);
  assert.equal(docker(["context", "show"]).stdout.trim(), "colima-gbi");
  assert.equal(docker(["image", "inspect", image, "--format", "{{.Id}}"]).status, 0);
  const started = docker(["run", "--detach", "--rm", "--network", "none", "--read-only",
    "--memory", "768m", "--cpus", "1", "--pids-limit", "128", "--user", "postgres",
    "--tmpfs", "/tmp:rw,nosuid,nodev,mode=1777", "--entrypoint", "/bin/sh", image,
    "-ec", "initdb -D /tmp/qa-data -A trust --no-instructions >/dev/null && exec postgres -D /tmp/qa-data -c listen_addresses= -c unix_socket_directories=/tmp"]);
  assert.equal(started.status, 0, started.stderr);
  container = started.stdout.trim();
  assert.match(container, /^[a-f0-9]{64}$/);
  let ready = false;
  for (let n = 0; n < 60; n++) {
    if (docker(["exec", container, "pg_isready", "-h", "/tmp", "-U", "postgres"]).status === 0) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready);
  denied(source, /DRAFT_NOT_APPLIED/, "postgres");
  query(`CREATE ROLE anon LOGIN; CREATE ROLE authenticated LOGIN;
    CREATE ROLE service_role LOGIN BYPASSRLS;
    CREATE ROLE do_effect_writer NOLOGIN NOINHERIT;
    CREATE ROLE do_effect_executor LOGIN NOINHERIT;
    CREATE TABLE public.observer_intelligence_signals
      (id uuid PRIMARY KEY,observer_site_id uuid,source_type text,signal_type text,metadata jsonb);
    CREATE TABLE public.observer_sites
      (id uuid PRIMARY KEY,digital_observer_organization_id uuid,active boolean,
       monitoring_enabled boolean,garden_id uuid,site_type text,metadata jsonb);
    CREATE TABLE public.digital_observer_organizations
      (id uuid PRIMARY KEY,active boolean,organization_type text);
    CREATE TABLE public.observer_correlated_event_links
      (id uuid PRIMARY KEY,correlated_event_id uuid,source_type text,source_id uuid,observer_site_id uuid);
    CREATE TABLE public.observer_correlated_events
      (id uuid PRIMARY KEY,observer_site_id uuid,primary_camera_source_id uuid,provenance text);
    CREATE TABLE public.digital_observer_camera_sources (id uuid PRIMARY KEY,observer_site_id uuid);
    CREATE TABLE public.observer_event_risk_claims
      (signal_id uuid,risk_engine_version text,tenant_id uuid,observer_site_id uuid,
       incident_id uuid,status text,owner_nonce uuid,owner_epoch bigint,
       lease_expires_at timestamptz,risk_evaluation_id uuid,
       PRIMARY KEY(signal_id,risk_engine_version));
    CREATE TABLE public.digital_observer_risk_evaluations
      (id uuid PRIMARY KEY,observer_site_id uuid,incident_id uuid,triggering_event_id uuid,
       risk_engine_version text,recommended_decision text);
    CREATE TABLE public.observer_event_risk_plan_authority
      (authority_id uuid PRIMARY KEY,signal_id uuid,risk_engine_version text,tenant_id uuid,
       observer_site_id uuid,incident_id uuid,risk_evaluation_id uuid,camera_source_id uuid,
       producer_contract_version text,ownership_evidence_ref text,recipient_settings_version text,
       recipient_policy_version text,decision_code text,recipient_snapshot_schema_version int,
       recipient_snapshot_captured_at timestamptz,required_evidence_references jsonb,
       media_fault_audit_required boolean,expected_fingerprints jsonb,recipient_snapshot jsonb);
    CREATE TABLE public.observer_event_risk_effect_plans
      (signal_id uuid,risk_engine_version text,tenant_id uuid,observer_site_id uuid,
       camera_source_id uuid,incident_id uuid,risk_evaluation_id uuid,
       recipient_snapshot_digest_algorithm text,recipient_snapshot_digest text,
       expected_effect_keys jsonb,expected_fingerprints jsonb,authority_id uuid,
       ownership_evidence_ref text,recipient_settings_version text,recipient_policy_version text,
       decision_code text,recipient_snapshot_schema_version int,
       recipient_snapshot_captured_at timestamptz,required_evidence_references jsonb,
       media_fault_audit_required boolean,recipient_snapshot jsonb,
       recipient_snapshot_fingerprint text,audit_event_id uuid,
       PRIMARY KEY(signal_id,risk_engine_version));
    CREATE TABLE public.immutable_audit_events
      (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_type text,event_category text,
       actor_role text,target_type text,target_id uuid,incident_id uuid,metadata jsonb,risk_level text);
    ALTER TABLE public.immutable_audit_events ENABLE ROW LEVEL SECURITY;
    CREATE POLICY audit_writer_insert ON public.immutable_audit_events
      FOR INSERT TO do_effect_writer WITH CHECK (true);
    CREATE POLICY audit_writer_read ON public.immutable_audit_events
      FOR SELECT TO do_effect_writer USING (true);
    GRANT SELECT,INSERT,UPDATE,DELETE ON public.immutable_audit_events TO service_role;`);
  const body = source.slice(source.indexOf("CREATE TABLE public.observer_event_risk_effect_receipts ("));
  assert.ok(body.startsWith("CREATE TABLE"));
  let adapted = body.replace("SECURITY INVOKER", "SECURITY DEFINER")
    .replace("IF current_user <> 'service_role' THEN", "IF session_user <> 'do_effect_executor' THEN");
  assert.notEqual(adapted, body);
  assert.match(adapted, /SECURITY DEFINER/);
  assert.match(adapted, /session_user <> 'do_effect_executor'/);
  query(adapted);
  query(`CREATE POLICY receipt_writer_insert ON public.observer_event_risk_effect_receipts
      FOR INSERT TO do_effect_writer WITH CHECK (true);
    CREATE POLICY receipt_writer_read ON public.observer_event_risk_effect_receipts
      FOR SELECT TO do_effect_writer USING (true);
    GRANT SELECT,INSERT ON public.immutable_audit_events,
      public.observer_event_risk_effect_receipts TO do_effect_writer;
    GRANT SELECT ON public.observer_intelligence_signals,public.observer_sites,
      public.digital_observer_organizations,public.observer_correlated_event_links,
      public.observer_correlated_events,public.observer_event_risk_claims,
      public.digital_observer_risk_evaluations,public.observer_event_risk_plan_authority,
      public.observer_event_risk_effect_plans,public.digital_observer_camera_sources
      TO do_effect_writer;
    GRANT UPDATE(id) ON public.observer_intelligence_signals,public.observer_sites,
      public.digital_observer_organizations,public.observer_correlated_event_links,
      public.observer_correlated_events,public.digital_observer_risk_evaluations
      TO do_effect_writer;
    GRANT UPDATE(signal_id) ON public.observer_event_risk_claims TO do_effect_writer;
    ALTER FUNCTION public.record_event_risk_effect_v1(uuid,text,uuid,bigint,text,text,text)
      OWNER TO do_effect_writer;
    REVOKE ALL ON FUNCTION public.record_event_risk_effect_v1(uuid,text,uuid,bigint,text,text,text)
      FROM PUBLIC, anon, authenticated, service_role;
    GRANT EXECUTE ON FUNCTION public.record_event_risk_effect_v1(uuid,text,uuid,bigint,text,text,text)
      TO do_effect_executor;`);
  check("SELECT has_function_privilege('do_effect_executor','public.record_event_risk_effect_v1(uuid,text,uuid,bigint,text,text,text)','EXECUTE')", "t");
  for (const role of ["anon", "authenticated", "service_role"]) {
    check(`SELECT has_function_privilege('${role}','public.record_event_risk_effect_v1(uuid,text,uuid,bigint,text,text,text)','EXECUTE')`, "f");
  }
  for (const table of ["immutable_audit_events", "observer_event_risk_effect_receipts"]) {
    for (const privilege of ["INSERT", "UPDATE"]) {
      check(`SELECT has_table_privilege('do_effect_executor','public.${table}','${privilege}')`, "f");
      denied(privilege === "INSERT"
        ? `INSERT INTO public.${table} DEFAULT VALUES`
        : `UPDATE public.${table} SET ${table === "immutable_audit_events" ? "event_type" : "effect_key"}='FORGED'`,
      /permission denied/);
    }
  }
  check("SELECT pg_has_role('do_effect_executor','do_effect_writer','member')", "f");
  denied("SET ROLE do_effect_writer", /permission denied/);
  check("SELECT has_table_privilege('service_role','public.immutable_audit_events','INSERT')", "t");
  check("SELECT has_table_privilege('service_role','public.observer_event_risk_effect_receipts','INSERT')", "f");
  // Source-defined public and graphql_public are exposed; the dedicated executor
  // is not a PostgREST role. A schema setting alone is not an ACL boundary.
  check("SELECT current_user", "do_effect_executor", "do_effect_executor");
  const fingerprint = query(`SELECT encode(sha256(convert_to(to_jsonb(l)::text,'UTF8')),'hex')
    FROM public.observer_correlated_event_links l WHERE source_id='${id.signal}'`);
  assert.equal(fingerprint, ""); // no synthetic target exists yet
  checks++;
  query(`INSERT INTO public.digital_observer_organizations VALUES ('${id.tenant}',true,'family');
    INSERT INTO public.observer_sites VALUES ('${id.site}','${id.tenant}',true,true,NULL,'home',
      '{"observer_monitoring_consent":"true"}');
    INSERT INTO public.digital_observer_camera_sources VALUES ('${id.camera}','${id.site}');
    INSERT INTO public.observer_intelligence_signals VALUES
      ('${id.signal}','${id.site}','system','ai_camera',
       '{"observation_provenance":"REAL_CAMERA_AI","validated_event":"true","camera_source_id":"${id.camera}"}');
    INSERT INTO public.observer_correlated_events VALUES
      ('${id.incident}','${id.site}','${id.camera}','REAL_CAMERA_AI');
    INSERT INTO public.observer_correlated_event_links VALUES
      ('${id.link}','${id.incident}','observer_intelligence_signal','${id.signal}','${id.site}');
    INSERT INTO public.observer_event_risk_claims VALUES
      ('${id.signal}','do-risk-v1','${id.tenant}','${id.site}','${id.incident}',
       'EFFECTS_PENDING','${id.nonce}',1,clock_timestamp()+interval '10 minutes','${id.risk}');
    INSERT INTO public.digital_observer_risk_evaluations VALUES
      ('${id.risk}','${id.site}','${id.incident}','${id.signal}','do-risk-v1','LOG_ONLY');`);
  const targetDigest = query(`SELECT encode(sha256(convert_to(to_jsonb(l)::text,'UTF8')),'hex')
    FROM public.observer_correlated_event_links l WHERE source_id='${id.signal}'`);
  const content = { schemaVersion: 1, scope: { tenantId: id.tenant, siteId: id.site,
    sourceId: id.camera, eventId: id.signal, incidentId: id.incident, riskDecisionId: id.risk },
    decisionCode: "LOG_ONLY", severity: "GUARDED", settingsVersion: "settings-v1",
    policyVersion: "policy-v1", capturedAt: "2026-10-26T00:00:00Z", recipients: [] };
  const snapshotFingerprint = query(`SELECT encode(sha256(convert_to('${JSON.stringify(content)}'::jsonb::text,'UTF8')),'hex')`);
  const snapshot = `'${JSON.stringify({ ...content, fingerprint: snapshotFingerprint })}'::jsonb`;
  const snapshotDigest = query(`SELECT encode(sha256(convert_to(${snapshot}::text,'UTF8')),'hex')`);
  const expected = JSON.stringify({ EVENT_INCIDENT_LINK: targetDigest });
  const planAudit = query(`INSERT INTO public.immutable_audit_events
    (event_type,target_id,incident_id,metadata) VALUES
    ('observer_event_risk_effect_plan_frozen_v1','${id.signal}','${id.incident}',
      jsonb_build_object('tenant_id','${id.tenant}','site_id','${id.site}',
      'risk_evaluation_id','${id.risk}','authority_id','${id.authority}',
      'snapshot_digest','${snapshotDigest}')) RETURNING id`);
  query(`INSERT INTO public.observer_event_risk_plan_authority VALUES
    ('${id.authority}','${id.signal}','do-risk-v1','${id.tenant}','${id.site}',
      '${id.incident}','${id.risk}','${id.camera}','server-decision-v1',
      'fixture-authority','settings-v1','policy-v1','LOG_ONLY',1,
      '2026-10-26T00:00:00Z','["evidence-1"]'::jsonb,false,'${expected}'::jsonb,${snapshot});
    INSERT INTO public.observer_event_risk_effect_plans VALUES
    ('${id.signal}','do-risk-v1','${id.tenant}','${id.site}','${id.camera}',
      '${id.incident}','${id.risk}','pg-jsonb-text-v1','${snapshotDigest}',
      '["EVENT_INCIDENT_LINK"]'::jsonb,'${expected}'::jsonb,'${id.authority}',
      'fixture-authority','settings-v1','policy-v1','LOG_ONLY',1,
      '2026-10-26T00:00:00Z','["evidence-1"]'::jsonb,false,${snapshot},
      '${snapshotFingerprint}','${planAudit}');`);
  const invoke = `SELECT public.record_event_risk_effect_v1('${id.signal}','do-risk-v1',
    '${id.nonce}',1,'EVENT_INCIDENT_LINK','${targetDigest}',NULL)`;
  for (const role of ["anon", "authenticated", "service_role"]) {
    denied(invoke, /permission denied for function record_event_risk_effect_v1/, role);
  }
  query(`GRANT EXECUTE ON FUNCTION public.record_event_risk_effect_v1(uuid,text,uuid,bigint,text,text,text)
    TO PUBLIC`);
  denied(invoke, /EFFECT_CALLER_DENIED/, "anon");
  query(`REVOKE EXECUTE ON FUNCTION public.record_event_risk_effect_v1(uuid,text,uuid,bigint,text,text,text)
    FROM PUBLIC`);
  check("SELECT has_function_privilege('anon','public.record_event_risk_effect_v1(uuid,text,uuid,bigint,text,text,text)','EXECUTE')", "f");
  const first = JSON.parse(query(invoke, "do_effect_executor"));
  assert.equal(first.kind, "LINK_EFFECT_RECORDED");
  assert.equal(first.reused, false);
  checks++;
  check(`SELECT count(*) FROM public.observer_event_risk_effect_receipts`, "1");
  check(`SELECT count(*) FROM public.immutable_audit_events
    WHERE event_type='observer_event_risk_link_effect_recorded_v1'`, "1");
  assert.equal(JSON.parse(query(invoke, "do_effect_executor")).reused, true);
  checks++;
  denied(invoke, /permission denied for function record_event_risk_effect_v1/, "service_role");
  denied(`WITH a AS (INSERT INTO public.immutable_audit_events DEFAULT VALUES RETURNING id)
    INSERT INTO public.observer_event_risk_effect_receipts DEFAULT VALUES`, /permission denied/);
  denied(`BEGIN;
    INSERT INTO public.immutable_audit_events (event_type) VALUES ('forged');
    INSERT INTO public.observer_event_risk_effect_receipts DEFAULT VALUES;
    COMMIT;`, /permission denied for table observer_event_risk_effect_receipts/, "service_role");
  check("SELECT count(*) FROM public.immutable_audit_events WHERE event_type='forged'", "0");
  denied(`UPDATE public.observer_event_risk_effect_receipts SET effect_key='FORGED'`, /permission denied/);
  denied(`SELECT public.record_event_risk_effect_v1('${id.signal}','do-risk-v1',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',1,'EVENT_INCIDENT_LINK','${targetDigest}',NULL)`, /EFFECT_OWNER_FENCE_REJECTED/);
  query(`REVOKE EXECUTE ON FUNCTION public.record_event_risk_effect_v1(uuid,text,uuid,bigint,text,text,text)
    FROM do_effect_executor`);
  denied(invoke, /permission denied for function record_event_risk_effect_v1/);
  check("SELECT has_function_privilege('do_effect_executor','public.record_event_risk_effect_v1(uuid,text,uuid,bigint,text,text,text)','EXECUTE')", "f");
  console.log(`PASS: ${checks} isolated ACL/function assertions; current service_role Data API path remains BLOCKED.`);
} finally {
  if (container) {
    const stop = docker(["stop", "--time", "3", container]);
    if (stop.status !== 0) { process.exitCode = 1; console.error("FAIL: disposable container cleanup"); }
  }
}
