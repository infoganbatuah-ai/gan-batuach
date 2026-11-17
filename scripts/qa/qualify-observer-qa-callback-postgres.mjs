#!/usr/bin/env node
// Opt-in, disposable local PostgreSQL proof only. Never target a hosted DB.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const context = "colima-gbi";
const image = "postgres:17.11-alpine";
const migration = new URL("../../supabase/migrations/20261117010818_observer_qa_callback_state_durable.sql", import.meta.url);
const sql = readFileSync(migration, "utf8");
const putSignature = "public.observer_qa_callback_state_put_v1(text,text,text,text,bigint)";
const consumeSignature = "public.observer_qa_callback_state_consume_v1(text,text,text,text)";
const state = "a".repeat(64);
const binding = "b".repeat(64);

function selfCheck() {
  assert.match(sql, /create schema observer_qa_private/);
  assert.match(sql, /alter table observer_qa_private\.callback_states enable row level security/);
  assert.match(sql, /on conflict \(state_hash\) do nothing/);
  assert.match(sql, /consumed_at is null and expires_at > clock_timestamp\(\)/);
  for (const signature of [putSignature, consumeSignature]) {
    assert.ok(sql.includes(`revoke all on function ${signature}`));
    assert.ok(sql.includes(`grant execute on function ${signature} to service_role`));
  }
}

function docker(args, input) {
  return execFileSync("docker", ["--context", context, ...args], {
    input, encoding: "utf8", timeout: 60_000, stdio: ["pipe", "pipe", "pipe"]
  }).trim();
}

function psql(container, query) {
  return docker(["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1",
    "-U", "postgres", "-d", "postgres"], query);
}

function psqlAsync(container, query) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", ["--context", context, "exec", "-i", container, "psql", "-X", "-qAt",
      "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"], { stdio: ["pipe", "pipe", "pipe"] });
    let output = "";
    let error = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { error += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(output.trim()) : reject(new Error(`local_psql_exit_${code}: ${error.slice(0, 180)}`)));
    child.stdin.end(query);
  });
}

async function main() {
  selfCheck();
  if (process.argv.includes("--self-check")) {
    console.log("PASS: offline harness contract self-check; database NOT RUN");
    return;
  }
  if (process.env.PUSH44_LOCAL_PG_QUALIFY !== "YES" || process.argv.length !== 2) {
    console.log("NOT RUN: set PUSH44_LOCAL_PG_QUALIFY=YES for disposable local PostgreSQL qualification");
    return;
  }
  assert.equal(execFileSync("docker", ["context", "show"], { encoding: "utf8" }).trim(), context);
  docker(["image", "inspect", image, "--format", "{{.Id}}"]); // cached image only; no pull
  const container = `push44-qa-pg-${randomBytes(6).toString("hex")}`;
  let startAttempted = false;
  try {
    startAttempted = true;
    docker(["run", "--rm", "-d", "--name", container, "--network", "none",
      "--memory", "512m", "--cpus", "1", "--pids-limit", "128",
      "--tmpfs", "/var/lib/postgresql/data:rw,nosuid,size=256m",
      "-e", "POSTGRES_HOST_AUTH_METHOD=trust", image]);
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt++) {
      try { docker(["exec", container, "pg_isready", "-U", "postgres"]); ready = true; break; }
      catch { await new Promise((resolve) => setTimeout(resolve, 500)); }
    }
    assert.ok(ready, "disposable_postgres_not_ready");
    psql(container, "create role anon login; create role authenticated login; create role service_role login bypassrls;\n");
    psql(container, sql);
    const acl = psql(container, `select
      has_function_privilege('anon', '${putSignature}', 'EXECUTE'),
      has_function_privilege('authenticated', '${putSignature}', 'EXECUTE'),
      has_function_privilege('service_role', '${putSignature}', 'EXECUTE'),
      has_function_privilege('anon', '${consumeSignature}', 'EXECUTE'),
      has_function_privilege('authenticated', '${consumeSignature}', 'EXECUTE'),
      has_function_privilege('service_role', '${consumeSignature}', 'EXECUTE'),
      has_schema_privilege('anon', 'observer_qa_private', 'USAGE'),
      has_table_privilege('authenticated', 'observer_qa_private.callback_states', 'SELECT')
      from pg_catalog.pg_class limit 1;`);
    assert.equal(acl, "f|f|t|f|f|t|f|f");
    assert.equal(psql(container, "select relrowsecurity from pg_catalog.pg_class where oid='observer_qa_private.callback_states'::regclass;"), "t");
    const put = (deadline) => `set role service_role; select public.observer_qa_callback_state_put_v1('${state}','digital_observer','verify','${binding}',${deadline});`;
    const consume = (flow = "verify") => `set role service_role; select public.observer_qa_callback_state_consume_v1('${state}','digital_observer','${flow}','${binding}');`;
    const deadline = psql(container, "select (extract(epoch from clock_timestamp())*1000)::bigint + 120000;");
    assert.equal(psql(container, put(deadline)), "t");
    assert.equal(psql(container, put(deadline)), "f");
    assert.equal(psql(container, consume("recovery")), "f");
    const results = await Promise.all([psqlAsync(container, consume()), psqlAsync(container, consume())]);
    assert.deepEqual(results.sort(), ["f", "t"]);
    assert.equal(psql(container, consume()), "f");
    assert.equal(psql(container, put("1")), "f");
    console.log("PASS: isolated PostgreSQL ACL/RLS, duplicate/expiry/wrong-flow and concurrent one-use consume");
  } finally {
    if (startAttempted) {
      try { docker(["rm", "-f", container]); }
      catch {
        // A failed run may never have created this exact, random container.
        // If it still exists, cleanup has failed and qualification cannot pass.
        try { docker(["inspect", container]); throw new Error("disposable_cleanup_failed"); }
        catch (error) { if (error?.message === "disposable_cleanup_failed") throw error; }
      }
    }
  }
}

main().catch(() => { console.error("BLOCKED: disposable PostgreSQL qualification failed; inspect local runtime without exposing secrets"); process.exitCode = 1; });
