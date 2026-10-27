#!/usr/bin/env node
// New disposable PostgreSQL only. No existing DB, network, host mount or user rows.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const here = new URL("./", import.meta.url);
const candidate = readFileSync(new URL("CLAIM-REFERENCED-UNIQUES-CANDIDATE-NOT-APPLIED.sql", here), "utf8");
const claim = readFileSync(new URL("CLAIM-ONLY-SCHEMA-NOT-APPLIED.sql", here), "utf8");
const image = "public.ecr.aws/supabase/postgres:17.6.1.167";
const context = "colima-gbi";
const indexStatements = [...candidate.matchAll(/CREATE UNIQUE INDEX CONCURRENTLY\s+\w+\s+ON\s+public\.\w+\s*\([^)]*\);/g)].map(x => x[0]);
const claimStart = claim.indexOf("CREATE TABLE public.observer_event_risk_claims (");
assert.match(candidate, /DRAFT_NOT_APPLIED/);
assert.match(claim, /DRAFT_NOT_APPLIED/);
assert.equal(indexStatements.length, 4);
assert.ok(candidate.indexOf("/* FUTURE CANDIDATE ONLY") < candidate.indexOf(indexStatements[0]));
assert.ok(candidate.lastIndexOf("*/") > candidate.indexOf(indexStatements[3]));
assert.ok(claimStart > claim.indexOf("RAISE EXCEPTION"));
for (const name of ["site_tenant", "signal_site", "incident_site", "result_scope"])
  assert.ok(claim.includes(`observer_event_risk_claim_${name}_fk`));
const claimBody = claim.slice(claimStart);
if (process.argv.includes("--static")) {
  console.log("PASS STATIC: four commented candidate indexes and guarded claim FKs; PostgreSQL NOT RUN");
  process.exit(0);
}

let container, checks = 0;
function docker(args, input) {
  const result = spawnSync("docker", ["--context", context, ...args], {
    input, encoding: "utf8", timeout: 30000, maxBuffer: 2_000_000
  });
  if (result.error) throw result.error;
  return result;
}
function pg(sql) {
  const r = docker(["exec", "-i", container, "psql", "-X", "-h", "/tmp", "-U", "postgres",
    "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-q"], sql);
  if (r.status !== 0) throw new Error(r.stderr.trim());
  return r.stdout.trim();
}
function rejected(sql, error) {
  const r = docker(["exec", "-i", container, "psql", "-X", "-h", "/tmp", "-U", "postgres",
    "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-q"], sql);
  assert.notEqual(r.status, 0, "unexpected SQL success");
  assert.match(r.stderr, error);
  checks++;
}
const u = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const tenantA = u(1), tenantB = u(2), siteA = u(3), siteB = u(4), siteNull = u(5);
const signalA = u(6), signalB = u(7), signalNull = u(8);
const incidentA = u(9), incidentB = u(10), incidentNull = u(11);
const resultA = u(12), resultB = u(13), nonce = u(14);
const version = "qa-engine-v1";
const insertClaim = ({ signal = signalA, tenant = tenantA, site = siteA,
  incident = incidentA, risk = null, state = "CLAIMED", engine = version } = {}) =>
  `INSERT INTO public.observer_event_risk_claims
    (signal_id,risk_engine_version,tenant_id,observer_site_id,incident_id,status,owner_nonce,lease_expires_at,risk_evaluation_id)
    VALUES ('${signal}','${engine}','${tenant}','${site}','${incident}','${state}','${nonce}',now()+interval '1 minute',${risk ? `'${risk}'` : "NULL"});`;

try {
  // No pull: require the exact already-local image. The daemon can also hold
  // unrelated Development containers; this runner never inspects or mutates them.
  const imageCheck = docker(["image", "inspect", image, "--format", "{{.Id}}"]);
  assert.equal(imageCheck.status, 0, "approved local PostgreSQL image unavailable");
  const started = docker(["run", "--detach", "--rm", "--network", "none", "--read-only",
    "--memory", "768m", "--cpus", "1", "--pids-limit", "128", "--user", "postgres",
    "--tmpfs", "/tmp:rw,nosuid,nodev,mode=1777,size=512m", "--entrypoint", "/bin/sh", image,
    "-ec", "initdb -D /tmp/qa-claim-data -A trust --no-instructions >/dev/null && exec postgres -D /tmp/qa-claim-data -c listen_addresses= -c unix_socket_directories=/tmp"]);
  assert.equal(started.status, 0, started.stderr);
  container = started.stdout.trim();
  assert.match(container, /^[0-9a-f]{64}$/);
  const isolation = JSON.parse(docker(["inspect", container, "--format", "{{json .}}"] ).stdout);
  assert.equal(isolation.HostConfig.NetworkMode, "none");
  assert.deepEqual(isolation.Mounts, []);
  assert.equal(isolation.HostConfig.ReadonlyRootfs, true);
  assert.equal(isolation.Config.Image, image); checks++;
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (docker(["exec", container, "pg_isready", "-h", "/tmp", "-U", "postgres"]).status === 0) {
      ready = true; break;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, "isolated PostgreSQL did not start");

  // The two review files must abort unchanged before any DDL.
  rejected(candidate, /DRAFT_NOT_APPLIED/);
  rejected(claim, /DRAFT_NOT_APPLIED/);
  assert.equal(pg("SELECT to_regclass('public.observer_event_risk_claims') IS NULL;"), "t"); checks++;
  pg(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
    CREATE TABLE public.observer_sites (id uuid PRIMARY KEY, digital_observer_organization_id uuid);
    CREATE TABLE public.observer_intelligence_signals (id uuid PRIMARY KEY, observer_site_id uuid);
    CREATE TABLE public.observer_correlated_events (id uuid PRIMARY KEY, observer_site_id uuid);
    CREATE TABLE public.digital_observer_risk_evaluations
      (id uuid PRIMARY KEY, observer_site_id uuid NOT NULL, triggering_event_id uuid NOT NULL,
       risk_engine_version text NOT NULL);`);
  rejected(claimBody, /no unique constraint matching given keys/);
  assert.equal(pg("SELECT to_regclass('public.observer_event_risk_claims') IS NULL;"), "t"); checks++;
  for (const statement of indexStatements) pg(statement); // each outside a transaction
  pg(claimBody);
  assert.equal(pg("SELECT count(*) FROM pg_constraint WHERE conrelid='public.observer_event_risk_claims'::regclass AND contype='f';"), "8"); checks++;
  assert.equal(pg("SELECT relrowsecurity FROM pg_class WHERE oid='public.observer_event_risk_claims'::regclass;"), "t"); checks++;
  for (const role of ["anon", "authenticated", "service_role"]) {
    assert.equal(pg(`SELECT has_table_privilege('${role}','public.observer_event_risk_claims','SELECT,INSERT,UPDATE,DELETE');`), "f"); checks++;
    rejected(`SET ROLE ${role}; SELECT count(*) FROM public.observer_event_risk_claims;`, /permission denied/);
    rejected(`SET ROLE ${role}; ${insertClaim()}`, /permission denied/);
  }
  pg(`INSERT INTO public.observer_sites VALUES ('${siteA}','${tenantA}'),('${siteB}','${tenantB}'),('${siteNull}',NULL);`);
  pg(`INSERT INTO public.observer_intelligence_signals VALUES ('${signalA}','${siteA}'),('${signalB}','${siteB}'),('${signalNull}',NULL);
    INSERT INTO public.observer_correlated_events VALUES ('${incidentA}','${siteA}'),('${incidentB}','${siteB}'),('${incidentNull}',NULL);
    INSERT INTO public.digital_observer_risk_evaluations VALUES
      ('${resultA}','${siteA}','${signalA}','${version}'),
      ('${resultB}','${siteB}','${signalB}','${version}');`);
  pg(`BEGIN; ${insertClaim()} ROLLBACK;`);
  assert.equal(pg("SELECT count(*) FROM public.observer_event_risk_claims;"), "0"); checks++;
  pg(insertClaim()); checks++;
  assert.equal(pg("SELECT count(*) FROM public.observer_event_risk_claims;"), "1"); checks++;
  rejected(insertClaim(), /duplicate key value/); // one canonical signal+version
  rejected(insertClaim({ signal: signalB, site: siteA }), /foreign key constraint/);
  rejected(insertClaim({ signal: signalNull }), /foreign key constraint/);
  rejected(insertClaim({ signal: signalNull, site: siteNull, incident: incidentNull }), /foreign key constraint/);
  rejected(insertClaim({ signal: u(40) }), /foreign key constraint/);
  rejected(insertClaim({ signal: signalB, site: siteB, tenant: tenantA, incident: incidentB }), /foreign key constraint/);
  rejected(`UPDATE public.observer_event_risk_claims SET tenant_id='${tenantB}' WHERE signal_id='${signalA}';`, /foreign key constraint/);
  rejected(`UPDATE public.observer_event_risk_claims SET observer_site_id='${siteB}' WHERE signal_id='${signalA}';`, /foreign key constraint/);
  rejected(`UPDATE public.observer_event_risk_claims SET incident_id='${incidentB}' WHERE signal_id='${signalA}';`, /foreign key constraint/);
  rejected(`UPDATE public.observer_event_risk_claims SET incident_id='${incidentNull}' WHERE signal_id='${signalA}';`, /foreign key constraint/);
  rejected(`UPDATE public.observer_event_risk_claims SET risk_evaluation_id='${resultB}',status='RISK_PERSISTED' WHERE signal_id='${signalA}';`, /foreign key constraint/);
  rejected(`UPDATE public.observer_event_risk_claims SET risk_evaluation_id='${u(41)}',status='RISK_PERSISTED' WHERE signal_id='${signalA}';`, /foreign key constraint/);
  rejected(insertClaim({ engine: "qa-engine-v2", risk: resultA, state: "RISK_PERSISTED" }), /foreign key constraint/);
  rejected(`UPDATE public.observer_event_risk_claims SET tenant_id=NULL WHERE signal_id='${signalA}';`, /null value/);
  pg(`UPDATE public.observer_event_risk_claims SET risk_evaluation_id='${resultA}',status='RISK_PERSISTED' WHERE signal_id='${signalA}';`); checks++;
  rejected("DROP INDEX public.observer_sites_id_org_draft_uidx;", /cannot drop index|depend on index/); // no CASCADE

  // Synthetic failed concurrent build: invalid artifact must be identified
  // exactly and removed only here; the four valid FK-supporting keys remain.
  pg("CREATE TABLE public.qa_duplicate_only (k integer); INSERT INTO public.qa_duplicate_only VALUES (1),(1);");
  rejected("CREATE UNIQUE INDEX CONCURRENTLY qa_duplicate_invalid_idx ON public.qa_duplicate_only(k);", /could not create unique index/);
  assert.equal(pg("SELECT indisvalid FROM pg_index WHERE indexrelid='public.qa_duplicate_invalid_idx'::regclass;"), "f"); checks++;
  pg("DROP INDEX CONCURRENTLY public.qa_duplicate_invalid_idx;");
  assert.equal(pg("SELECT to_regclass('public.qa_duplicate_invalid_idx') IS NULL;"), "t"); checks++;
  console.log(`PASS: ${checks} isolated claim-key PostgreSQL assertions; Development/Production untouched`);
} finally {
  if (container) {
    const removed = docker(["rm", "-f", container]);
    if (removed.status !== 0 && !/No such container/i.test(removed.stderr))
      throw new Error(`isolated container cleanup failed: ${removed.stderr.trim()}`);
  }
}
