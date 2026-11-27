#!/usr/bin/env node
// No existing database, port, network, or host mount. Synthetic fixture only.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL(".", import.meta.url));
const root = fileURLToPath(new URL("../..", import.meta.url));
const image = "public.ecr.aws/supabase/postgres:17.6.1.167";
const signal = "77777777-7777-4777-8777-777777777777";
const second = "88888888-8888-4888-8888-888888888888";
const third = "99999999-9999-4999-8999-999999999999";
const tenant = "11111111-1111-4111-8111-111111111111";
const site = "33333333-3333-4333-8333-333333333333";
const otherSite = "44444444-4444-4444-8444-444444444444";
const incident = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const tokenA = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const tokenB = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const tokenC = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const tokenD = "ffffffff-ffff-4fff-8fff-ffffffffffff";
let container;
let cases = 0;

function docker(args, input) {
  const r = spawnSync("docker", args, { input, encoding: "utf8", timeout: 20000, maxBuffer: 3000000 });
  if (r.error) throw r.error;
  return r;
}
function run(statement, role = "postgres") {
  const r = docker(["exec", "-i", container, "psql", "-X", "-h", "/tmp", "-U", role,
    "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-A", "-t"], statement);
  if (r.status !== 0) throw new Error(r.stderr.trim());
  return r.stdout.trim();
}
function denied(statement, expected, role = "service_role") {
  const r = docker(["exec", "-i", container, "psql", "-X", "-h", "/tmp", "-U", role,
    "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-A", "-t"], statement);
  assert.notEqual(r.status, 0, `expected ${expected}`);
  assert.match(r.stderr, expected);
  cases++;
}
function asyncRun(statement) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", ["exec", "-i", container, "psql", "-X", "-h", "/tmp",
      "-U", "service_role", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-A", "-t"],
      { stdio: ["pipe", "pipe", "pipe"] });
    let out = ""; let err = "";
    child.stdout.on("data", chunk => { out += chunk; });
    child.stderr.on("data", chunk => { err += chunk; });
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve(out.trim()) : reject(new Error(err.trim())));
    child.stdin.end(statement);
  });
}
const payload = {
  risk_score: 42, peak_risk_score: 42, risk_band: "GUARDED",
  evaluation_confidence: 0.8, contributing_factors: [], mitigating_factors: [],
  matched_rules: [], baseline_context: {}, explanation: {},
  recommended_decision: "LOG_ONLY", action_intents: ["LOG_ONLY"],
  risk_engine_version: "do-risk-v1", factor_version: "factor-v1",
  decision_version: "decision-v1", input_fingerprint: "a".repeat(64),
  evaluated_at: "2026-10-26T00:00:00Z", expected_incident_generation: 0,
  expected_previous_evaluation_id: null,
};
function persist(id, token, epoch = 1, data = payload) {
  const literal = JSON.stringify(data).replaceAll("'", "''");
  return `SELECT public.persist_event_risk_v1('${id}','do-risk-v1','${token}',${epoch},'${literal}'::jsonb);`;
}
function claim(id, token) {
  return `SELECT public.claim_event_risk_v1('${id}','do-risk-v1','${token}',120);`;
}
function q(statement) { return run(statement, "service_role"); }

try {
  const writer = readFileSync(`${dir}RPC-BODY-NOT-APPLIED.sql`, "utf8");
  const claimSource = readFileSync(`${root}review-only/event-risk-atomic-claim-qualification/RPC-BODIES-SOURCE-NOT-APPLIED.sql`, "utf8");
  const fixture = readFileSync(`${root}review-only/event-risk-atomic-claim-qualification/isolated-schema.sql`, "utf8");
  const migration = readFileSync(`${root}supabase/migrations/20260906010000_digital_observer_risk_decision_engine.sql`, "utf8");
  assert.match(writer, /DRAFT_NOT_APPLIED/);
  assert.doesNotMatch(writer, /^\s*(?:COMMIT|ROLLBACK)\s*;/im);
  const writerBody = writer.slice(writer.indexOf("CREATE TABLE public.observer_event_risk_persistence_receipts ("));
  const claimBody = claimSource.slice(claimSource.indexOf("CREATE FUNCTION public.claim_event_risk_v1("));
  const fixtureBody = fixture.slice(fixture.indexOf("CREATE ROLE service_role LOGIN BYPASSRLS;"));
  assert.ok(writerBody.startsWith("CREATE TABLE") && claimBody.startsWith("CREATE FUNCTION")
    && fixtureBody.startsWith("CREATE ROLE"));
  const riskTable = migration.match(/create table if not exists public\.digital_observer_risk_evaluations \([\s\S]*?\n\);/i)?.[0];
  assert.ok(riskTable, "canonical Risk source table missing");
  assert.equal(docker(["context", "show"]).stdout.trim(), "colima-gbi");
  const endpoint = docker(["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"]).stdout.trim();
  assert.match(endpoint, /^unix:\/\//);
  const cached = docker(["image", "inspect", image, "--format", "{{.Id}}"]).status;
  assert.equal(cached, 0, "test image must already be cached");
  const started = docker(["run", "--detach", "--rm", "--network", "none", "--read-only",
    "--memory", "768m", "--cpus", "1", "--pids-limit", "128", "--user", "postgres",
    "--tmpfs", "/tmp:rw,nosuid,nodev,mode=1777", "--entrypoint", "/bin/sh", image,
    "-ec", "initdb -D /tmp/qa-data -A trust --no-instructions >/dev/null && exec postgres -D /tmp/qa-data -c listen_addresses= -c unix_socket_directories=/tmp"]);
  assert.equal(started.status, 0, started.stderr);
  container = started.stdout.trim();
  assert.match(container, /^[0-9a-f]{64}$/);
  let ready = false;
  for (let i = 0; i < 50; i++) {
    if (docker(["exec", container, "pg_isready", "-h", "/tmp", "-U", "postgres"]).status === 0) {
      ready = true; break;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready);
  denied(writer, /DRAFT_NOT_APPLIED/, "postgres");
  assert.equal(run("SELECT count(*) FROM pg_proc WHERE proname='persist_event_risk_v1';"), "0");
  denied(fixture, /ISOLATED_FIXTURE_ONLY/, "postgres");
  run(fixtureBody);
  // The prior claim fixture's audit id is bigint, whereas the canonical audit
  // source defines uuid. Recreate only inside this disposable synthetic DB.
  run("DROP TABLE public.immutable_audit_events; CREATE TABLE public.immutable_audit_events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_type text NOT NULL, event_category text NOT NULL, actor_role text NOT NULL, target_type text NOT NULL, target_id uuid NOT NULL, incident_id uuid NOT NULL, metadata jsonb NOT NULL, risk_level text NOT NULL);");
  run("GRANT SELECT, INSERT ON public.immutable_audit_events TO service_role;");
  run("ALTER TABLE public.observer_correlated_events ADD COLUMN risk_projection_generation bigint NOT NULL DEFAULT 0, ADD COLUMN latest_risk_evaluation_id uuid;");
  run(riskTable);
  run("CREATE UNIQUE INDEX digital_observer_risk_event_version_uidx ON public.digital_observer_risk_evaluations(incident_id,triggering_event_id,risk_engine_version);");
  run("GRANT SELECT, INSERT, UPDATE ON public.digital_observer_risk_evaluations TO service_role;");
  run(claimBody);
  run(writerBody);
  run("GRANT SELECT, INSERT ON public.observer_event_risk_persistence_receipts TO service_role; GRANT EXECUTE ON FUNCTION public.persist_event_risk_v1(uuid,text,uuid,bigint,jsonb) TO service_role;");
  denied(persist(signal, tokenA), /permission denied for function persist_event_risk_v1/, "anon");
  assert.equal(JSON.parse(q(claim(signal, tokenA))).kind, "OWNED");
  const rowId = q(persist(signal, tokenA));
  assert.match(rowId, /^[0-9a-f-]{36}$/);
  assert.equal(run(`SELECT status || ':' || risk_evaluation_id FROM public.observer_event_risk_claims WHERE signal_id='${signal}';`), `RISK_PERSISTED:${rowId}`);
  assert.equal(run(`SELECT count(*) FROM public.digital_observer_risk_evaluations WHERE id='${rowId}';`), "1");
  assert.equal(run(`SELECT count(*) FROM public.immutable_audit_events WHERE event_type='observer_event_risk_persisted_v1' AND target_id='${signal}';`), "1");
  assert.equal(run(`SELECT count(*) FROM public.observer_event_risk_persistence_receipts WHERE signal_id='${signal}' AND risk_evaluation_id='${rowId}';`), "1");
  cases++;
  assert.equal(q(persist(signal, tokenA)), rowId);
  assert.equal(run(`SELECT count(*) FROM public.immutable_audit_events WHERE event_type='observer_event_risk_persisted_v1' AND target_id='${signal}';`), "1");
  cases++;
  denied(persist(signal, tokenA, 1, { ...payload, risk_score: 43 }), /RISK_SEMANTIC_CONFLICT/);
  denied(persist(signal, tokenB), /RISK_OWNER_FENCE_REJECTED/);
  denied(persist(signal, tokenA, 2), /RISK_OWNER_FENCE_REJECTED/);
  denied(persist(signal, tokenA, 1, { ...payload, expected_incident_generation: 1 }), /RISK_RECEIPT_CONFLICT/);
  denied(persist(signal, tokenA, 1, { ...payload, expected_previous_evaluation_id: rowId }), /RISK_RECEIPT_CONFLICT/);
  denied(persist(signal, tokenA, 1, { ...payload, observer_site_id: otherSite }), /RISK_PERSIST_INPUT_INVALID/);
  assert.equal(JSON.parse(q(claim(second, tokenB))).kind, "OWNED");
  denied(persist(second, tokenB, 1, { ...payload, input_fingerprint: "b".repeat(64), expected_incident_generation: 1 }), /RISK_INCIDENT_GENERATION_STALE/);
  run(`UPDATE public.observer_correlated_event_links SET observer_site_id='${otherSite}' WHERE source_id='${second}';`);
  denied(persist(second, tokenB, 1, { ...payload, input_fingerprint: "b".repeat(64) }), /RISK_CANONICAL_SCOPE_INVALID/);
  run(`UPDATE public.observer_correlated_event_links SET observer_site_id='${site}' WHERE source_id='${second}';`);
  run(`UPDATE public.observer_sites SET digital_observer_organization_id='22222222-2222-4222-8222-222222222222' WHERE id='${site}';`);
  denied(persist(second, tokenB, 1, { ...payload, input_fingerprint: "b".repeat(64) }), /RISK_CANONICAL_SCOPE_INVALID/);
  run(`UPDATE public.observer_sites SET digital_observer_organization_id='${tenant}' WHERE id='${site}';`);
  run("CREATE FUNCTION public.qa_abort_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit failure'; END $$; CREATE TRIGGER qa_abort_audit BEFORE INSERT ON public.immutable_audit_events FOR EACH ROW EXECUTE FUNCTION public.qa_abort_audit();");
  denied(persist(second, tokenB, 1, { ...payload, input_fingerprint: "b".repeat(64) }), /synthetic audit failure/);
  assert.equal(run(`SELECT count(*) FROM public.digital_observer_risk_evaluations WHERE triggering_event_id='${second}';`), "0");
  assert.equal(run(`SELECT status FROM public.observer_event_risk_claims WHERE signal_id='${second}';`), "CLAIMED");
  assert.equal(run(`SELECT count(*) FROM public.observer_event_risk_persistence_receipts WHERE signal_id='${second}';`), "0");
  cases++;
  run("DROP TRIGGER qa_abort_audit ON public.immutable_audit_events; DROP FUNCTION public.qa_abort_audit();");
  const [a, b] = await Promise.all([asyncRun(persist(second, tokenB, 1, { ...payload, input_fingerprint: "b".repeat(64) })), asyncRun(persist(second, tokenB, 1, { ...payload, input_fingerprint: "b".repeat(64) }))]);
  assert.equal(a, b);
  assert.equal(run(`SELECT count(*) FROM public.digital_observer_risk_evaluations WHERE triggering_event_id='${second}';`), "1");
  cases++;
  run(`UPDATE public.observer_event_risk_claims SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE signal_id='${signal}';`);
  denied(persist(signal, tokenA), /RISK_OWNER_FENCE_REJECTED/);
  const takeover = JSON.parse(q(claim(signal, tokenB)));
  assert.equal(takeover.kind, "RESUME_EFFECTS");
  assert.equal(takeover.owner_epoch, 2);
  assert.equal(q(persist(signal, tokenB, 2)), rowId);
  denied(persist(signal, tokenA), /RISK_OWNER_FENCE_REJECTED/);
  const contenders = await Promise.all([
    asyncRun(claim(third, tokenC)), asyncRun(claim(third, tokenD)),
  ]);
  const parsed = contenders.map(value => JSON.parse(value));
  assert.deepEqual(parsed.map(result => result.kind).sort(), ["BUSY", "OWNED"]);
  const winner = parsed[0].kind === "OWNED" ? tokenC : tokenD;
  const loser = winner === tokenC ? tokenD : tokenC;
  denied(persist(third, loser, 1, { ...payload, input_fingerprint: "c".repeat(64) }), /RISK_OWNER_FENCE_REJECTED/);
  assert.match(q(persist(third, winner, 1, { ...payload, input_fingerprint: "c".repeat(64) })), /^[0-9a-f-]{36}$/);
  assert.equal(run(`SELECT count(*) FROM public.digital_observer_risk_evaluations WHERE triggering_event_id='${third}';`), "1");
  cases++;
  console.log(`PASS: ${cases} isolated PostgreSQL assertions; fenced Risk+audit+receipt transaction; no existing database touched.`);
} finally {
  if (container) {
    const stopped = docker(["stop", "--time", "3", container]);
    if (stopped.status !== 0) { process.exitCode = 1; console.error("FAIL: disposable container cleanup"); }
  }
}
