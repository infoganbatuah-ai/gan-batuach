#!/usr/bin/env node
// Disposable, network-disabled PostgreSQL fixture only. Never connects to gbi DB.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const root = fileURLToPath(new URL("../..", import.meta.url));
const image = "public.ecr.aws/supabase/postgres:17.6.1.167";
const s1 = "77777777-7777-4777-8777-777777777777";
const s2 = "88888888-8888-4888-8888-888888888888";
const site = "33333333-3333-4333-8333-333333333333";
const tenant = "11111111-1111-4111-8111-111111111111";
const camera = "55555555-5555-4555-8555-555555555555";
const incident1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const incident2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const nonce = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const risk1 = "11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const risk2 = "22222222-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const a1 = "11111111-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const a2 = "22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
let container;
let checks = 0;
function docker(args, input) {
  const r = spawnSync("docker", args, { input, encoding: "utf8", timeout: 25000, maxBuffer: 4000000 });
  if (r.error) throw r.error;
  return r;
}
function sql(statement, role = "postgres") {
  const r = docker(["exec", "-i", container, "psql", "-X", "-h", "/tmp", "-U", role,
    "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-A", "-t"], statement);
  if (r.status !== 0) throw new Error(r.stderr.trim());
  return r.stdout.trim();
}
function deny(statement, pattern, role = "service_role") {
  const r = docker(["exec", "-i", container, "psql", "-X", "-h", "/tmp", "-U", role,
    "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-A", "-t"], statement);
  assert.notEqual(r.status, 0, `expected denial: ${pattern}`);
  assert.match(r.stderr, pattern);
  checks++;
}
function query(statement) { return sql(statement, "service_role"); }
function asyncQuery(statement) {
  return new Promise((resolve, reject) => {
    const proc = spawn("docker", ["exec", "-i", container, "psql", "-X", "-h", "/tmp",
      "-U", "service_role", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-A", "-t"],
    { stdio: ["pipe", "pipe", "pipe"] });
    let out = ""; let err = "";
    proc.stdout.on("data", chunk => { out += chunk; });
    proc.stderr.on("data", chunk => { err += chunk; });
    proc.on("error", reject);
    proc.on("close", code => code === 0 ? resolve(out.trim()) : reject(new Error(err.trim())));
    proc.stdin.end(statement);
  });
}
function call(signal, authority, owner = nonce, epoch = 1, extra = {}) {
  const plan = JSON.stringify({ authority_id: authority, ...extra }).replaceAll("'", "''");
  return `SELECT public.start_event_risk_effects_v1('${signal}','do-risk-v1','${owner}',${epoch},'${plan}'::jsonb);`;
}
function authorityInsert(signal, risk, incident, authority) {
  const keys = ["EVENT_INCIDENT_LINK", "RISK_DECISION", "WATCH_RULE:watch-1",
    "INCIDENT_RISK_PROJECTION", "VERIFICATION_RESULT", "DECISION_INTENT",
    "INCIDENT_VERIFICATION_PROJECTION", "RECIPIENT_PLAN", "IN_APP_JOURNAL:recipient-1",
    "MANDATORY_DECISION_AUDIT", "GUARD_ELIGIBILITY"];
  const fingerprints = Object.fromEntries(keys.map(key => [key, "a".repeat(64)]));
  const snapshot = {
    schemaVersion: 1,
    scope: { tenantId: tenant, siteId: site, sourceId: camera, eventId: signal,
      incidentId: incident, riskDecisionId: risk },
    decisionCode: "LOG_ONLY", severity: "GUARDED", settingsVersion: "settings-v1",
    policyVersion: "policy-v1", capturedAt: "2026-10-26T00:00:00Z",
    recipients: [{ recipientRef: "recipient-1", channels: [
      { channel: "in_app", enabled: true, severityLevels: [] }] }]
  };
  const escapedSnapshot = JSON.stringify(snapshot).replaceAll("'", "''");
  const escapedFingerprints = JSON.stringify(fingerprints).replaceAll("'", "''");
  sql(`WITH content AS (SELECT '${escapedSnapshot}'::jsonb AS body),
  signed AS (SELECT body || jsonb_build_object('fingerprint',
    encode(sha256(convert_to(body::text,'UTF8')),'hex')) AS value FROM content)
  INSERT INTO public.observer_event_risk_plan_authority (
    authority_id,signal_id,risk_engine_version,tenant_id,observer_site_id,
    camera_source_id,incident_id,risk_evaluation_id,ownership_evidence_ref,
    producer_contract_version,decision_code,recipient_settings_version,
    recipient_policy_version,recipient_snapshot_schema_version,
    recipient_snapshot_captured_at,recipient_snapshot,required_evidence_references,
    watch_rule_ids,expected_fingerprints,media_fault_audit_required)
  SELECT '${authority}','${signal}','do-risk-v1','${tenant}','${site}','${camera}',
    '${incident}','${risk}','fixture-authority','server-decision-v1','LOG_ONLY',
    'settings-v1','policy-v1',1,'2026-10-26T00:00:00Z',value,
    '["evidence-1"]'::jsonb,'["watch-1"]'::jsonb,'${escapedFingerprints}'::jsonb,false
  FROM signed;`);
}
try {
  const draft = readFileSync(`${here}RPC-BODY-NOT-APPLIED.sql`, "utf8");
  const sourceFixture = readFileSync(`${root}review-only/event-risk-atomic-claim-qualification/isolated-schema.sql`, "utf8");
  assert.match(draft, /DRAFT_NOT_APPLIED/);
  assert.doesNotMatch(draft, /^\s*(?:COMMIT|ROLLBACK|GRANT)\b/im);
  const body = draft.slice(draft.indexOf("CREATE TABLE public.observer_event_risk_plan_authority ("));
  const fixture = sourceFixture.slice(sourceFixture.indexOf("CREATE ROLE service_role LOGIN BYPASSRLS;"));
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
  assert.ok(ready, "disposable PostgreSQL not ready");
  deny(draft, /DRAFT_NOT_APPLIED/, "postgres");
  assert.equal(sql("SELECT count(*) FROM pg_proc WHERE proname='start_event_risk_effects_v1';"), "0");
  deny(sourceFixture, /ISOLATED_FIXTURE_ONLY/, "postgres");
  sql(fixture);
  sql(`DROP TABLE public.immutable_audit_events;
    CREATE TABLE public.immutable_audit_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      event_type text NOT NULL,event_category text NOT NULL,actor_role text NOT NULL,
      target_type text NOT NULL,target_id uuid NOT NULL,incident_id uuid NOT NULL,
      metadata jsonb NOT NULL,risk_level text NOT NULL);
    CREATE TABLE public.digital_observer_risk_evaluations (
      id uuid PRIMARY KEY,observer_site_id uuid NOT NULL,incident_id uuid NOT NULL,
      triggering_event_id uuid NOT NULL,risk_engine_version text NOT NULL,
      recommended_decision text NOT NULL,risk_band text NOT NULL);
    CREATE TABLE public.observer_event_risk_persistence_receipts (
      signal_id uuid NOT NULL,risk_engine_version text NOT NULL,
      tenant_id uuid NOT NULL,observer_site_id uuid NOT NULL,incident_id uuid NOT NULL,
      risk_evaluation_id uuid NOT NULL,PRIMARY KEY(signal_id,risk_engine_version));
    INSERT INTO public.observer_event_risk_claims
      (signal_id,risk_engine_version,tenant_id,observer_site_id,incident_id,
       status,owner_nonce,owner_epoch,lease_expires_at,risk_evaluation_id)
    VALUES ('${s1}','do-risk-v1','${tenant}','${site}','${incident1}',
      'RISK_PERSISTED','${nonce}',1,clock_timestamp()+interval '10 minutes','${risk1}'),
      ('${s2}','do-risk-v1','${tenant}','${site}','${incident2}',
      'RISK_PERSISTED','${nonce}',1,clock_timestamp()+interval '10 minutes','${risk2}');
    INSERT INTO public.digital_observer_risk_evaluations VALUES
      ('${risk1}','${site}','${incident1}','${s1}','do-risk-v1','LOG_ONLY','GUARDED'),
      ('${risk2}','${site}','${incident2}','${s2}','do-risk-v1','LOG_ONLY','GUARDED');
    INSERT INTO public.observer_event_risk_persistence_receipts VALUES
      ('${s1}','do-risk-v1','${tenant}','${site}','${incident1}','${risk1}'),
      ('${s2}','do-risk-v1','${tenant}','${site}','${incident2}','${risk2}');
    GRANT SELECT,UPDATE ON public.digital_observer_risk_evaluations TO service_role;
    GRANT SELECT,UPDATE ON public.observer_event_risk_persistence_receipts TO service_role;
    GRANT SELECT,INSERT ON public.immutable_audit_events TO service_role;`);
  sql(body);
  // Explicit synthetic privileges only; production grants remain absent in draft.
  sql(`GRANT SELECT ON public.observer_event_risk_plan_authority TO service_role;
    GRANT SELECT,INSERT ON public.observer_event_risk_effect_plans TO service_role;
    GRANT EXECUTE ON FUNCTION public.start_event_risk_effects_v1(uuid,text,uuid,bigint,jsonb) TO service_role;`);
  // This fixture permission exposes the live SECURITY INVOKER design gap:
  // service_role could directly write a plan. Qualification stays review-only.
  assert.equal(sql("SELECT has_table_privilege('service_role','public.observer_event_risk_effect_plans','INSERT');"), "t");
  checks++;
  authorityInsert(s1, risk1, incident1, a1);
  authorityInsert(s2, risk2, incident2, a2);
  deny(call(s1, a1), /permission denied for function start_event_risk_effects_v1/, "anon");
  deny(`INSERT INTO public.observer_event_risk_plan_authority(authority_id) VALUES(gen_random_uuid());`, /permission denied/);
  deny(call(s1, a1, "dddddddd-dddd-4ddd-8ddd-dddddddddddd"), /PLAN_OWNER_FENCE_REJECTED/);
  deny(call(s1, a1, nonce, 2), /PLAN_OWNER_FENCE_REJECTED/);
  deny(call(s1, a1, nonce, 1, { recipients: ["attacker"] }), /PLAN_INPUT_INVALID/);
  const first = JSON.parse(query(call(s1, a1)));
  assert.equal(first.kind, "EFFECTS_PENDING");
  assert.equal(first.reused, false);
  assert.equal(sql(`SELECT status FROM public.observer_event_risk_claims WHERE signal_id='${s1}';`), "EFFECTS_PENDING");
  assert.equal(sql(`SELECT count(*) FROM public.observer_event_risk_effect_plans WHERE signal_id='${s1}';`), "1");
  assert.equal(sql(`SELECT count(*) FROM public.immutable_audit_events WHERE target_id='${s1}';`), "1");
  checks++;
  const pgText = sql(`SELECT recipient_snapshot::text FROM public.observer_event_risk_effect_plans WHERE signal_id='${s1}';`);
  assert.equal(createHash("sha256").update(pgText).digest("hex"), first.snapshot_digest);
  checks++;
  const again = JSON.parse(query(call(s1, a1)));
  assert.equal(again.reused, true);
  assert.equal(again.snapshot_digest, first.snapshot_digest);
  assert.equal(sql(`SELECT count(*) FROM public.immutable_audit_events WHERE target_id='${s1}';`), "1");
  checks++;
  deny(call(s1, a2), /PLAN_AUTHORITY_UNVERIFIED/);
  sql(`UPDATE public.observer_event_risk_plan_authority SET recipient_settings_version='changed'
    WHERE authority_id='${a1}';`);
  deny(call(s1, a1), /PLAN_AUTHORITY_UNVERIFIED|PLAN_SNAPSHOT_SCOPE_INVALID/);
  sql(`UPDATE public.observer_event_risk_plan_authority SET recipient_settings_version='settings-v1'
    WHERE authority_id='${a1}';`);
  sql(`UPDATE public.observer_event_risk_plan_authority SET recipient_snapshot=jsonb_set(recipient_snapshot,
    '{recipients,0,channels,0,enabled}','false'::jsonb) WHERE authority_id='${a1}';`);
  deny(call(s1, a1), /PLAN_SNAPSHOT_FINGERPRINT_INVALID/);
  sql(`UPDATE public.observer_event_risk_plan_authority SET recipient_snapshot=(
    SELECT recipient_snapshot FROM public.observer_event_risk_effect_plans WHERE signal_id='${s1}')
    WHERE authority_id='${a1}';`);
  sql(`UPDATE public.observer_event_risk_plan_authority SET expected_fingerprints=jsonb_set(
    expected_fingerprints,'{DECISION_INTENT}',to_jsonb(repeat('b',64))) WHERE authority_id='${a1}';`);
  deny(call(s1, a1), /PLAN_SEMANTIC_CONFLICT/);
  sql(`UPDATE public.observer_event_risk_plan_authority SET expected_fingerprints=(
    SELECT expected_fingerprints FROM public.observer_event_risk_effect_plans WHERE signal_id='${s1}')
    WHERE authority_id='${a1}';`);
  sql(`UPDATE public.observer_event_risk_claims SET lease_expires_at=clock_timestamp()-interval '1 second'
    WHERE signal_id='${s1}';`);
  deny(call(s1, a1), /PLAN_OWNER_FENCE_REJECTED/);
  sql(`UPDATE public.observer_event_risk_claims SET owner_epoch=2,
    owner_nonce='dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    lease_expires_at=clock_timestamp()+interval '10 minutes' WHERE signal_id='${s1}';`);
  assert.equal(JSON.parse(query(call(s1, a1, "dddddddd-dddd-4ddd-8ddd-dddddddddddd", 2))).reused, true);
  checks++;
  sql(`UPDATE public.observer_correlated_event_links SET observer_site_id='44444444-4444-4444-8444-444444444444'
    WHERE source_id='${s2}';`);
  deny(call(s2, a2), /PLAN_CANONICAL_SCOPE_INVALID/);
  sql(`UPDATE public.observer_correlated_event_links SET observer_site_id='${site}' WHERE source_id='${s2}';`);
  sql(`UPDATE public.observer_event_risk_persistence_receipts
    SET tenant_id='22222222-2222-4222-8222-222222222222' WHERE signal_id='${s2}';`);
  deny(call(s2, a2), /PLAN_RISK_SCOPE_INVALID/);
  sql(`UPDATE public.observer_event_risk_persistence_receipts
    SET tenant_id='${tenant}' WHERE signal_id='${s2}';`);
  sql(`UPDATE public.digital_observer_risk_evaluations SET observer_site_id='44444444-4444-4444-8444-444444444444'
    WHERE id='${risk2}';`);
  deny(call(s2, a2), /PLAN_RISK_SCOPE_INVALID/);
  sql(`UPDATE public.digital_observer_risk_evaluations SET observer_site_id='${site}' WHERE id='${risk2}';`);
  sql(`CREATE FUNCTION public.qa_abort_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'synthetic audit failure'; END $$;
    CREATE TRIGGER qa_abort_audit BEFORE INSERT ON public.immutable_audit_events
      FOR EACH ROW EXECUTE FUNCTION public.qa_abort_audit();`);
  deny(call(s2, a2), /synthetic audit failure/);
  assert.equal(sql(`SELECT count(*) FROM public.observer_event_risk_effect_plans WHERE signal_id='${s2}';`), "0");
  assert.equal(sql(`SELECT status FROM public.observer_event_risk_claims WHERE signal_id='${s2}';`), "RISK_PERSISTED");
  checks++;
  sql(`DROP TRIGGER qa_abort_audit ON public.immutable_audit_events;
    DROP FUNCTION public.qa_abort_audit();`);
  const [r1, r2] = await Promise.all([asyncQuery(call(s2, a2)), asyncQuery(call(s2, a2))]);
  assert.deepEqual([JSON.parse(r1).reused, JSON.parse(r2).reused].sort(), [false, true]);
  assert.equal(sql(`SELECT count(*) FROM public.observer_event_risk_effect_plans WHERE signal_id='${s2}';`), "1");
  assert.equal(sql(`SELECT count(*) FROM public.immutable_audit_events WHERE target_id='${s2}';`), "1");
  checks++;
  console.log(`PASS: ${checks} isolated PostgreSQL assertions; plan+audit+checkpoint atomic, no existing DB touched.`);
} finally {
  if (container) {
    const stopped = docker(["stop", "--time", "3", container]);
    if (stopped.status !== 0) { process.exitCode = 1; console.error("FAIL: disposable container cleanup"); }
  }
}
