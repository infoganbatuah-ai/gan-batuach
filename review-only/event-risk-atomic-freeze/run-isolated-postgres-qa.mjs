#!/usr/bin/env node
// Fresh synthetic PostgreSQL, network none, no host mounts, no existing DB.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { snapshotDigestsV1 } from "../event-risk-canonical-digest/canonical-v1.mjs";

const dir = fileURLToPath(new URL(".", import.meta.url));
const canonical = readFileSync(`${dir}../event-risk-canonical-digest/CANONICAL-V1-NOT-APPLIED.sql`, "utf8");
const sql = readFileSync(`${dir}ATOMIC-FREEZE-NOT-APPLIED.sql`, "utf8");
const image = "public.ecr.aws/supabase/postgres:17.6.1.167";
const scope = { tenantId: "11111111-1111-4111-8111-111111111111",
  siteId: "33333333-3333-4333-8333-333333333333",
  sourceId: "55555555-5555-4555-8555-555555555555",
  eventId: "77777777-7777-4777-8777-777777777777",
  incidentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  riskDecisionId: "11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
const audit = "88888888-8888-4888-8888-888888888888";
let container;
let checks = 0;
function docker(args, input) {
  const r = spawnSync("docker", args, { input, encoding: "utf8", timeout: 30000, maxBuffer: 5000000 });
  if (r.error) throw r.error;
  return r;
}
function args() { return ["exec", "-i", container, "psql", "-X", "-h", "/tmp", "-U", "postgres",
  "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-q"]; }
function pg(statement) {
  const r = docker(args(), statement);
  if (r.status !== 0) throw new Error(r.stderr.trim());
  return r.stdout.trim();
}
function denied(statement, pattern) {
  const r = docker(args(), statement);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, pattern);
  checks++;
}
function literal(value) {
  return `convert_from(decode('${Buffer.from(JSON.stringify(value), "utf8").toString("hex")}', 'hex'),'UTF8')::jsonb`;
}
function record({ nextScope = scope, nextAudit = audit, settings = "settings-v1", policy = "policy-v1" } = {}) {
  const content = { schemaVersion: 1, scope: { ...nextScope }, decisionCode: "LOG_ONLY",
    severity: "HIGH", settingsVersion: settings, policyVersion: policy,
    capturedAt: "2026-10-27T00:00:00.000Z",
    recipients: [{ recipientRef: "אב😀", channels: [{ channel: "in_app", enabled: true,
      severityLevels: ["HIGH"] }] }] };
  const { fingerprint, digest } = snapshotDigestsV1(content, nextScope.tenantId, nextScope.siteId);
  return { ...nextScope, engineVersion: "do-risk-v1", ownershipEvidenceRef: "synthetic-ownership-receipt",
    settingsAuthorityRef: "synthetic-settings-receipt", digestAlgorithm: "canonical-v1",
    content, fingerprint, digest, auditEventId: nextAudit };
}
function freeze(value) { return `SELECT review_atomic.freeze_canonical_v1(${literal(value)});`; }
function asyncPg(statement) {
  const child = spawn("docker", args(), { stdio: ["pipe", "pipe", "pipe"] });
  let output = ""; let error = "";
  child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
  child.stdout.on("data", chunk => { output += chunk; });
  child.stderr.on("data", chunk => { error += chunk; });
  child.stdin.end(statement);
  const done = new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error("CONCURRENT_PSQL_TIMEOUT")); }, 10000);
    child.on("error", reject);
    child.on("close", code => { clearTimeout(timer); resolve({ code, output, error }); });
  });
  return { child, done, getOutput: () => output };
}
async function waitMarker(running, marker) {
  for (let i = 0; i < 100; i++) {
    if (running.getOutput().includes(marker)) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`MARKER_TIMEOUT: ${marker}`);
}
try {
  assert.match(sql, /DRAFT_NOT_APPLIED/);
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
  denied(sql, /DRAFT_NOT_APPLIED/);
  const canonicalBody = canonical.slice(canonical.indexOf("CREATE SCHEMA review_digest;"));
  const body = sql.slice(sql.indexOf("CREATE SCHEMA review_atomic;"));
  assert.ok(canonicalBody.startsWith("CREATE SCHEMA review_digest;"));
  assert.ok(body.startsWith("CREATE SCHEMA review_atomic;"));
  pg(`BEGIN; ${canonicalBody}\n${body}\nCOMMIT;`);
  const first = record();
  assert.equal(pg(freeze(first)), "INSERTED"); checks++;
  assert.equal(pg(freeze(first)), "REPLAY_IDENTICAL"); checks++;
  assert.equal(pg("SELECT count(*) FROM review_atomic.frozen_decision;"), "1"); checks++;
  assert.equal(pg("SELECT count(*) FROM review_atomic.mandatory_audit;"), "1"); checks++;
  denied(freeze({ ...first, digestAlgorithm: "pg-jsonb-text-v1" }), /FREEZE_ALGORITHM_OR_ENGINE_DENIED/);
  denied(freeze({ ...first, digestAlgorithm: "future-v2" }), /FREEZE_ALGORITHM_OR_ENGINE_DENIED/);
  denied(freeze({ ...first, tenantId: scope.siteId }), /FREEZE_SCOPE_MISMATCH/);
  denied(freeze({ ...first, siteId: scope.tenantId }), /FREEZE_SCOPE_MISMATCH/);
  denied(freeze({ ...first, content: { ...first.content, settingsVersion: "settings-v2" } }), /FREEZE_DIGEST_MISMATCH/);
  denied(freeze({ ...first, digest: "0".repeat(64) }), /FREEZE_DIGEST_MISMATCH/);
  denied(freeze({ ...first, fingerprint: "0".repeat(64) }), /FREEZE_DIGEST_MISMATCH/);
  denied(freeze({ ...first, ownershipEvidenceRef: "forged-receipt" }), /FREEZE_REPLAY_CONFLICT/);
  denied(freeze({ ...first, settingsAuthorityRef: "forged-settings" }), /FREEZE_REPLAY_CONFLICT/);
  denied(freeze({ ...first, auditEventId: "99999999-9999-4999-8999-999999999999" }), /FREEZE_REPLAY_CONFLICT/);
  denied(freeze(record({ settings: "settings-v2" })), /FREEZE_REPLAY_CONFLICT/);
  denied(freeze(record({ nextScope: { ...scope, riskDecisionId: "22222222-2222-4222-8222-222222222222" } })), /FREEZE_REPLAY_CONFLICT/);
  denied("UPDATE review_atomic.frozen_decision SET digest='0' WHERE event_id='77777777-7777-4777-8777-777777777777';", /FROZEN_RECORD_IMMUTABLE/);
  denied("DELETE FROM review_atomic.mandatory_audit;", /FROZEN_RECORD_IMMUTABLE/);
  pg("CREATE ROLE qa_untrusted; GRANT USAGE ON SCHEMA review_atomic TO qa_untrusted;");
  denied(`SET ROLE qa_untrusted; ${freeze(first)}`, /permission denied for function freeze_canonical_v1/);

  // Inject an audit failure after the candidate frozen INSERT. The statement
  // must roll back both writes, leaving the key retryable.
  const auditFail = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  pg(`CREATE FUNCTION review_atomic.fail_selected_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.audit_event_id='${auditFail}'::uuid THEN
      RAISE EXCEPTION 'SYNTHETIC_AUDIT_FAILURE'; END IF; RETURN NEW; END; $$;
    CREATE TRIGGER fixture_audit_failure BEFORE INSERT ON review_atomic.mandatory_audit
      FOR EACH ROW EXECUTE FUNCTION review_atomic.fail_selected_audit();`);
  const secondScope = { ...scope, eventId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    riskDecisionId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" };
  denied(freeze(record({ nextScope: secondScope, nextAudit: auditFail })), /SYNTHETIC_AUDIT_FAILURE/);
  assert.equal(pg(`SELECT count(*) FROM review_atomic.frozen_decision WHERE event_id='${secondScope.eventId}';`), "0"); checks++;
  assert.equal(pg(`SELECT count(*) FROM review_atomic.mandatory_audit WHERE event_id='${secondScope.eventId}';`), "0"); checks++;
  assert.equal(pg(freeze(record({ nextScope: secondScope, nextAudit: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" }))), "INSERTED"); checks++;

  // Two independent PostgreSQL sessions race for a third key. Session one
  // holds its INSERT uncommitted; session two must wait then replay the same row.
  const raceScope = { ...scope, eventId: "12121212-1212-4212-8212-121212121212",
    riskDecisionId: "34343434-3434-4434-8434-343434343434" };
  const race = record({ nextScope: raceScope, nextAudit: "56565656-5656-4656-8656-565656565656" });
  const firstSession = asyncPg(`BEGIN; ${freeze(race)} SELECT 'FIRST_INSERTED'; SELECT pg_sleep(2); COMMIT;`);
  await waitMarker(firstSession, "FIRST_INSERTED");
  const start = Date.now();
  const secondSession = asyncPg(freeze(race));
  const [a, b] = await Promise.all([firstSession.done, secondSession.done]);
  assert.equal(a.code, 0, a.error);
  assert.equal(b.code, 0, b.error);
  assert.match(a.output, /INSERTED/);
  assert.match(b.output, /REPLAY_IDENTICAL/);
  assert.ok(Date.now() - start >= 1000, "second connection must wait on unique key"); checks++;
  assert.equal(pg(`SELECT count(*) FROM review_atomic.frozen_decision WHERE event_id='${raceScope.eventId}';`), "1"); checks++;
  assert.equal(pg(`SELECT count(*) FROM review_atomic.mandatory_audit WHERE event_id='${raceScope.eventId}';`), "1"); checks++;
  const conflictScope = { ...scope, eventId: "78787878-7878-4787-8787-787878787878",
    riskDecisionId: "90909090-9090-4909-8909-909090909090" };
  const conflictAudit = "abababab-abab-4aba-8aba-abababababab";
  const stable = record({ nextScope: conflictScope, nextAudit: conflictAudit });
  const altered = record({ nextScope: conflictScope, nextAudit: conflictAudit, settings: "settings-v2" });
  const winner = asyncPg(`BEGIN; ${freeze(stable)} SELECT 'CONFLICT_FIRST_INSERTED'; SELECT pg_sleep(2); COMMIT;`);
  await waitMarker(winner, "CONFLICT_FIRST_INSERTED");
  const loser = asyncPg(freeze(altered));
  const [winnerResult, loserResult] = await Promise.all([winner.done, loser.done]);
  assert.equal(winnerResult.code, 0, winnerResult.error);
  assert.notEqual(loserResult.code, 0);
  assert.match(loserResult.error, /FREEZE_REPLAY_CONFLICT/); checks++;
  assert.equal(pg(`SELECT count(*) FROM review_atomic.frozen_decision WHERE event_id='${conflictScope.eventId}';`), "1"); checks++;
  assert.equal(pg(`SELECT count(*) FROM review_atomic.mandatory_audit WHERE event_id='${conflictScope.eventId}';`), "1"); checks++;
  console.log(`PASS: ${checks} isolated PostgreSQL atomic-freeze assertions, including two-connection race and audit rollback; live authority/ACL remain BLOCKED.`);
} finally {
  if (container) {
    const stopped = docker(["stop", "--time", "3", container]);
    if (stopped.status !== 0) { process.exitCode = 1; console.error("FAIL: disposable container cleanup"); }
  }
}
