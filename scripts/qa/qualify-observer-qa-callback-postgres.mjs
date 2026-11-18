#!/usr/bin/env node
// Opt-in, disposable local PostgreSQL proof only. Never target a hosted DB.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const dockerHost = "unix:///Volumes/DIGITAL_OBSERVER/Development/gan-batuach/colima/gbi/docker.sock";
const image = "public.ecr.aws/supabase/postgres:17.6.1.167";
const migration = new URL("../../supabase/migrations/20261117010818_observer_qa_callback_state_durable.sql", import.meta.url);
const sql = readFileSync(migration, "utf8");
const putSignature = "public.observer_qa_callback_state_put_v1(text,text,text,text,bigint)";
const consumeSignature = "public.observer_qa_callback_state_consume_v1(text,text,text,text)";
const state = "a".repeat(64);
const binding = "b".repeat(64);
let stage = "offline_preflight";

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
  return execFileSync("docker", ["--host", dockerHost, ...args], {
    input, encoding: "utf8", timeout: 60_000, stdio: ["pipe", "pipe", "pipe"]
  }).trim();
}

function psql(container, query) {
  return docker(["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1",
    "-U", "supabase_admin", "-d", "postgres"], query);
}

function psqlAsync(container, query) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", ["--host", dockerHost, "exec", "-i", container, "psql", "-X", "-qAt",
      "-v", "ON_ERROR_STOP=1", "-U", "supabase_admin", "-d", "postgres"], { stdio: ["pipe", "pipe", "pipe"] });
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
  stage = "cached_image_check";
  docker(["image", "inspect", image, "--format", "{{.Id}}"]); // cached image only; no pull
  const container = `push44-qa-pg-${randomBytes(6).toString("hex")}`;
  let startAttempted = false;
  try {
    stage = "disposable_startup";
    startAttempted = true;
    docker(["run", "--rm", "-d", "--name", container, "--network", "none",
      "--memory", "512m", "--cpus", "1", "--pids-limit", "128",
      "--tmpfs", "/var/lib/postgresql/data:rw,nosuid,size=256m",
      "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "-e", "POSTGRES_USER=supabase_admin",
      image, "postgres", "-D", "/var/lib/postgresql/data"]);
    let ready = false;
    for (let attempt = 0; attempt < 120; attempt++) {
      try {
        if (psql(container, "select 1;") === "1") {
          await new Promise((resolve) => setTimeout(resolve, 3000));
          if (psql(container, "select 1;") === "1") { ready = true; break; }
        }
      }
      catch { await new Promise((resolve) => setTimeout(resolve, 500)); }
    }
    assert.ok(ready, "disposable_postgres_not_ready");
    stage = "representative_role_setup";
    psql(container, `do $$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon login; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated login; end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role login bypassrls; end if;
    end $$;`);
    stage = "proposed_migration";
    psql(container, sql);
    stage = "acl_and_rls";
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
    for (const role of ["anon", "authenticated"]) {
      for (const functionCall of [
        `public.observer_qa_callback_state_put_v1('${state}','digital_observer','verify','${binding}',1)`,
        `public.observer_qa_callback_state_consume_v1('${state}','digital_observer','verify','${binding}')`
      ]) {
        assert.throws(() => psql(container, `set role ${role}; select ${functionCall};`),
          (error) => /permission denied for function/.test(String(error.stderr)));
      }
    }
    assert.equal(psql(container, "select relrowsecurity from pg_catalog.pg_class where oid='observer_qa_private.callback_states'::regclass;"), "t");
    stage = "state_lifecycle";
    const put = (deadline) => `set role service_role; select public.observer_qa_callback_state_put_v1('${state}','digital_observer','verify','${binding}',${deadline});`;
    const consume = (flow = "verify", bindingHash = binding) =>
      `set role service_role; select public.observer_qa_callback_state_consume_v1('${state}','digital_observer','${flow}','${bindingHash}');`;
    stage = "state_lifecycle_deadline";
    const deadline = psql(container, "select (extract(epoch from clock_timestamp())*1000)::bigint + 120000;");
    stage = "state_lifecycle_put";
    assert.equal(psql(container, put(deadline)), "t");
    stage = "state_lifecycle_duplicate";
    assert.equal(psql(container, put(deadline)), "f");
    stage = "state_lifecycle_wrong_flow";
    assert.equal(psql(container, consume("recovery")), "f");
    stage = "state_lifecycle_wrong_binding";
    assert.equal(psql(container, consume("verify", "c".repeat(64))), "f");
    stage = "state_lifecycle_concurrent";
    const results = await Promise.all([psqlAsync(container, consume()), psqlAsync(container, consume())]);
    assert.deepEqual(results.sort(), ["f", "t"]);
    assert.equal(psql(container, consume()), "f");
    assert.equal(psql(container, put("1")), "f");
    stage = "state_lifecycle_expiry";
    const expiredState = "d".repeat(64);
    const expiresSoon = psql(container, "select (extract(epoch from clock_timestamp())*1000)::bigint + 5000;");
    assert.equal(psql(container, `set role service_role; select public.observer_qa_callback_state_put_v1('${expiredState}','digital_observer','verify','${binding}',${expiresSoon});`), "t");
    psql(container, "select pg_sleep(6);");
    assert.equal(psql(container, `set role service_role; select public.observer_qa_callback_state_consume_v1('${expiredState}','digital_observer','verify','${binding}');`), "f");
    stage = "complete";
    console.log("PASS: isolated PostgreSQL direct role denial, ACL/RLS, duplicate, expired stored state, wrong flow/binding and concurrent one-use consume");
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

main().catch((error) => {
  const diagnostic = String(error?.stderr ?? "").split("\n")
    .find((line) => /(?:ERROR|FATAL):/.test(line))
    ?.replace(/[A-Za-z0-9_+/=-]{32,}/g, "[redacted]").slice(0, 160);
  const assertion = error?.code === "ERR_ASSERTION" ? ` (assertion actual=${JSON.stringify(error.actual)} expected=${JSON.stringify(error.expected)})` : "";
  const processFailure = error?.status !== undefined ? ` (exit=${error.status} stderr=${String(error.stderr ?? "").replace(/[A-Za-z0-9_+/=-]{32,}/g, "[redacted]").slice(0, 180)})` : "";
  console.error(`BLOCKED: disposable PostgreSQL qualification failed at ${stage}${diagnostic ? ` (${diagnostic})` : ""}${assertion}${processFailure}`);
  process.exitCode = 1;
});
