#!/usr/bin/env node
// Runs only inside a throwaway, network-disabled PostgreSQL container with no host data mount.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const dir = fileURLToPath(new URL(".", import.meta.url));
const image = "public.ecr.aws/supabase/postgres:17.6.1.167";
const signal = "77777777-7777-4777-8777-777777777777";
const secondSignal = "88888888-8888-4888-8888-888888888888";
const badSignal = "99999999-9999-4999-8999-999999999999";
const site = "33333333-3333-4333-8333-333333333333";
const otherSite = "44444444-4444-4444-8444-444444444444";
const tenant = "11111111-1111-4111-8111-111111111111";
const otherTenant = "22222222-2222-4222-8222-222222222222";
const nonce = [
  "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  "ffffffff-ffff-4fff-8fff-ffffffffffff",
];
let container;
let cases = 0;

function docker(args, input = undefined) {
  const result = spawnSync("docker", args, {
    input, encoding: "utf8", timeout: 20_000, maxBuffer: 2_000_000,
  });
  if (result.error) throw result.error;
  return result;
}

function sql(statement, role = "postgres") {
  const result = docker([
    "exec", "-i", container, "psql", "-X", "-h", "/tmp", "-U", role,
    "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-A", "-t",
  ], statement);
  if (result.status !== 0) throw new Error(result.stderr.trim() || `psql exit ${result.status}`);
  return result.stdout.trim();
}

function sqlError(statement, expected, role = "postgres") {
  const result = docker([
    "exec", "-i", container, "psql", "-X", "-h", "/tmp", "-U", role,
    "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-A", "-t",
  ], statement);
  assert.notEqual(result.status, 0, `expected denial: ${expected}`);
  assert.match(result.stderr, expected);
  cases++;
}

function sqlAsync(statement, role = "service_role") {
  return new Promise((resolve, reject) => {
    const process = spawn("docker", [
      "exec", "-i", container, "psql", "-X", "-h", "/tmp", "-U", role,
      "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-A", "-t",
    ], { stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    process.stdout.on("data", chunk => { out += chunk; });
    process.stderr.on("data", chunk => { err += chunk; });
    process.on("error", reject);
    process.on("close", code => code === 0 ? resolve(out.trim()) : reject(new Error(err.trim())));
    process.stdin.end(statement);
  });
}

function claim(eventId, token, fn = "claim_event_risk_v1") {
  return `SELECT public.${fn}('${eventId}','do-risk-v1','${token}',30);`;
}

try {
  const source = readFileSync(`${dir}RPC-BODIES-SOURCE-NOT-APPLIED.sql`, "utf8");
  assert.match(source, /DRAFT_NOT_APPLIED/);
  const firstBody = source.indexOf("CREATE FUNCTION public.claim_event_risk_v1(");
  assert.ok(firstBody > 0, "guarded source body missing");
  const body = source.slice(firstBody);
  assert.match(body, /CREATE FUNCTION public.recover_expired_event_risk_v1/);

  const launched = docker([
    "run", "--detach", "--rm", "--network", "none", "--read-only",
    "--user", "postgres", "--tmpfs", "/tmp:rw,nosuid,nodev,mode=1777",
    "--entrypoint", "/bin/sh", image, "-ec",
    "initdb -D /tmp/qa-data -A trust --no-instructions >/dev/null && exec postgres -D /tmp/qa-data -c listen_addresses= -c unix_socket_directories=/tmp",
  ]);
  assert.equal(launched.status, 0, launched.stderr);
  container = launched.stdout.trim();
  assert.match(container, /^[0-9a-f]{64}$/);
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    const result = docker(["exec", container, "pg_isready", "-h", "/tmp", "-U", "postgres"]);
    if (result.status === 0) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, "isolated PostgreSQL did not become ready");
  sql(readFileSync(`${dir}isolated-schema.sql`, "utf8"));
  sql(body);

  const raced = await Promise.all([
    sqlAsync(claim(signal, nonce[0])), sqlAsync(claim(signal, nonce[1])),
  ]);
  const results = raced.map(value => JSON.parse(value));
  assert.deepEqual(results.map(result => result.kind).sort(), ["BUSY", "OWNED"]);
  assert.equal(sql(`SELECT count(*) FROM public.observer_event_risk_claims WHERE signal_id='${signal}';`), "1");
  assert.equal(sql(`SELECT count(*) FROM public.immutable_audit_events WHERE target_id='${signal}';`), "1");
  cases++;

  const winningNonce = results[0].kind === "OWNED" ? nonce[0] : nonce[1];
  const losingNonce = results[0].kind === "OWNED" ? nonce[1] : nonce[0];
  sqlError(`SELECT public.renew_event_risk_lease_v1('${signal}','do-risk-v1','${losingNonce}',1,30);`, /RISK_OWNER_FENCED_OR_SCOPE_LOST/, "service_role");
  sqlError(claim(signal, nonce[2]), /permission denied for function claim_event_risk_v1/, "anon");
  const renewed = JSON.parse(sql(`SELECT public.renew_event_risk_lease_v1('${signal}','do-risk-v1','${winningNonce}',1,30);`, "service_role"));
  assert.equal(renewed.kind, "RENEWED");
  cases++;

  sql(`UPDATE public.observer_event_risk_claims SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE signal_id='${signal}';`);
  const recovered = await Promise.all([
    sqlAsync(claim(signal, nonce[2], "recover_expired_event_risk_v1")),
    sqlAsync(claim(signal, nonce[3], "recover_expired_event_risk_v1")),
  ]);
  const takeovers = recovered.map(value => JSON.parse(value));
  assert.deepEqual(takeovers.map(result => result.kind).sort(), ["BUSY", "OWNED"]);
  assert.equal(takeovers.find(result => result.kind === "OWNED").owner_epoch, 2);
  assert.equal(sql(`SELECT count(*) FROM public.immutable_audit_events WHERE target_id='${signal}';`), "2");
  sqlError(`SELECT public.renew_event_risk_lease_v1('${signal}','do-risk-v1','${winningNonce}',1,30);`, /RISK_OWNER_FENCED_OR_SCOPE_LOST/, "service_role");
  cases++;

  const evaluationId = "abababab-abab-4aba-8aba-abababababab";
  sql(`UPDATE public.observer_event_risk_claims SET status='RISK_PERSISTED', risk_evaluation_id='${evaluationId}', lease_expires_at=clock_timestamp()-interval '1 second' WHERE signal_id='${signal}';`);
  const resume = JSON.parse(sql(claim(signal, winningNonce, "recover_expired_event_risk_v1"), "service_role"));
  assert.equal(resume.kind, "RESUME_EFFECTS");
  assert.equal(resume.owner_epoch, 3);
  assert.equal(resume.evaluation_id, evaluationId);
  cases++;

  sql(`UPDATE public.observer_correlated_event_links SET observer_site_id='${otherSite}' WHERE source_id='${badSignal}';`);
  sqlError(claim(badSignal, nonce[0]), /RISK_LINK_SCOPE_INVALID/, "service_role");
  assert.equal(sql(`SELECT count(*) FROM public.observer_event_risk_claims WHERE signal_id='${badSignal}';`), "0");
  cases++;

  sql(`UPDATE public.observer_sites SET digital_observer_organization_id=NULL WHERE id='${site}';`);
  sqlError(claim(secondSignal, nonce[0]), /RISK_TENANT_MAPPING_UNVERIFIED/, "service_role");
  sql(`UPDATE public.observer_sites SET digital_observer_organization_id='${tenant}' WHERE id='${site}';`);
  cases++;

  sql(`CREATE FUNCTION public.qa_abort_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit failure'; END $$; CREATE TRIGGER qa_abort_audit BEFORE INSERT ON public.immutable_audit_events FOR EACH ROW EXECUTE FUNCTION public.qa_abort_audit();`);
  sqlError(claim(secondSignal, nonce[0]), /synthetic audit failure/, "service_role");
  assert.equal(sql(`SELECT count(*) FROM public.observer_event_risk_claims WHERE signal_id='${secondSignal}';`), "0");
  sql("DROP TRIGGER qa_abort_audit ON public.immutable_audit_events; DROP FUNCTION public.qa_abort_audit();");
  cases++;

  assert.equal(JSON.parse(sql(claim(secondSignal, nonce[0]), "service_role")).kind, "OWNED");
  sql(`UPDATE public.observer_sites SET digital_observer_organization_id='${otherTenant}' WHERE id='${site}'; UPDATE public.observer_event_risk_claims SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE signal_id='${secondSignal}';`);
  sqlError(claim(secondSignal, nonce[1], "recover_expired_event_risk_v1"), /RISK_CLAIM_SCOPE_CONFLICT/, "service_role");
  assert.equal(sql(`SELECT owner_epoch FROM public.observer_event_risk_claims WHERE signal_id='${secondSignal}';`), "1");
  cases++;

  assert.equal(sql(`SELECT count(*) FROM public.immutable_audit_events WHERE metadata::text LIKE '%${winningNonce}%';`), "0");
  cases++;
  console.log(`PASS: ${cases} isolated PostgreSQL checks; source claim/renew/recover bodies only; active route unchanged.`);
} finally {
  if (container) {
    const stopped = docker(["stop", "--time", "3", container]);
    if (stopped.status !== 0) console.error("WARNING: isolated container cleanup requires attention");
  }
}
