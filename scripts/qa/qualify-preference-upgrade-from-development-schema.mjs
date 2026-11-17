#!/usr/bin/env node
// Opt-in schema-only qualification. Source Development DB is read-only;
// all SQL writes target a random, disposable database on an internal network.
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

if (process.env.PUSH44_SCHEMA_UPGRADE !== "YES") {
  console.log("NOT RUN: opt in with PUSH44_SCHEMA_UPGRADE=YES");
  process.exit(0);
}
const socket = "unix:///Volumes/DIGITAL_OBSERVER/Development/gan-batuach/colima/gbi/docker.sock";
const source = "supabase_db_gan-batuach-integration";
const pgImage = "public.ecr.aws/supabase/postgres:17.6.1.167";
const storageImage = "public.ecr.aws/supabase/storage-api:v1.72.1";
const migration = readFileSync("supabase/migrations/20261116224059_push44_atomic_notification_preferences.sql", "utf8");
const container = `push44-schema-${randomBytes(6).toString("hex")}`;
const network = `${container}-net`;
let networkCreated = false;
let containerAttempted = false;
let stage = "source_dump";

function docker(args, input, timeout = 60_000, environment = {}) {
  return execFileSync("docker", ["--host", socket, ...args], {
    input, encoding: "utf8", timeout, maxBuffer: 16 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, ...environment }
  }).trim();
}
function sql(query) {
  return docker(["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1",
    "-U", "supabase_admin", "-d", "postgres"], query, 90_000);
}

try {
  const sourceHistory = docker(["exec", source, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1",
    "-U", "postgres", "-d", "postgres", "-c",
    "begin read only; select (select jsonb_array_length(source_mapping) from development_metadata.baselines), (select count(*) from development_metadata.migrations), to_regprocedure('public.save_communication_preferences_atomic(jsonb,jsonb)') is null; commit;"]);
  if (sourceHistory !== "227|47|t") throw new Error(`SOURCE_274_BASELINE_NOT_VERIFIED_${sourceHistory}`);
  // pg_dump --schema-only exports object definitions/ACLs, never row data or roles/passwords.
  const dumpedSchema = docker(["exec", source, "pg_dump", "--schema-only", "--no-owner",
    "--schema=public", "-U", "postgres", "-d", "postgres"], undefined, 120_000);
  if (dumpedSchema.length < 100_000 || /-----BEGIN (?:PRIVATE|OPENSSH)|AGE-SECRET-KEY-|^COPY |^INSERT INTO /m.test(dumpedSchema))
    throw new Error("SCHEMA_DUMP_SAFETY_CHECK_FAILED");
  // The stock disposable image already owns the standard public namespace.
  // Remove only pg_dump's redundant namespace creation, not any object DDL.
  if (dumpedSchema.match(/^CREATE SCHEMA public;$/gm)?.length !== 1)
    throw new Error("UNEXPECTED_PUBLIC_SCHEMA_DUMP");
  const schema = dumpedSchema.replace(/^CREATE SCHEMA public;\n/m, "");
  // These standard Auth helper definitions are part of the existing schema,
  // not data. The bare Postgres image lacks them; import exact source DDL.
  const authHelpers = docker(["exec", source, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1",
    "-U", "postgres", "-d", "postgres", "-c",
    "begin read only; select string_agg(pg_get_functiondef(p.oid), E';\\n\\n' order by p.proname) || ';' from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='auth' and p.proname in ('jwt','role','uid') and p.pronargs=0; commit;"]);
  if (!authHelpers.includes("CREATE OR REPLACE FUNCTION auth.jwt()") ||
      !authHelpers.includes("CREATE OR REPLACE FUNCTION auth.uid()") ||
      !authHelpers.includes("CREATE OR REPLACE FUNCTION auth.role()") ||
      /-----BEGIN (?:PRIVATE|OPENSSH)|AGE-SECRET-KEY-/m.test(authHelpers))
    throw new Error("AUTH_HELPER_SCHEMA_SAFETY_CHECK_FAILED");
  stage = "disposable_startup";
  docker(["image", "inspect", pgImage, "--format", "{{.Id}}"]).trim();
  docker(["image", "inspect", storageImage, "--format", "{{.Id}}"]).trim();
  docker(["network", "create", "--internal", network]);
  networkCreated = true;
  containerAttempted = true;
  docker(["run", "--rm", "-d", "--name", container, "--network", network, "--network-alias", "pg",
    "--memory", "2g", "--cpus", "1", "--pids-limit", "128",
    "--tmpfs", "/var/lib/postgresql/data:rw,nosuid,size=1g",
    "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "-e", "POSTGRES_USER=supabase_admin",
    pgImage, "postgres", "-D", "/var/lib/postgresql/data", "-c", "listen_addresses=*"]);
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      if (sql("select 1;") === "1") {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        if (sql("select 1;") === "1") { ready = true; break; }
      }
    } catch { await new Promise((resolve) => setTimeout(resolve, 500)); }
  }
  if (!ready) throw new Error("DISPOSABLE_POSTGRES_NOT_READY");
  stage = "stock_storage_bootstrap";
  const disposableJwtSecret = randomBytes(32).toString("hex");
  docker(["run", "--rm", "--network", network, "--memory", "512m", "--cpus", "1",
    "--pids-limit", "128", "-e", "DATABASE_URL=postgres://supabase_admin@pg:5432/postgres",
    "-e", "PGRST_JWT_SECRET", "--entrypoint", "node", storageImage,
    "dist/scripts/migrate-call.js"], undefined, 120_000, { PGRST_JWT_SECRET: disposableJwtSecret });
  stage = "auth_helper_schema_restore";
  sql(authHelpers);
  stage = "schema_restore";
  sql(schema);
  stage = "migration_275";
  sql(migration);
  stage = "catalog_verification";
  const result = sql(`select
    to_regprocedure('public.save_communication_preferences_atomic(jsonb,jsonb)') is not null,
    (select prosecdef is false from pg_proc where oid='public.save_communication_preferences_atomic(jsonb,jsonb)'::regprocedure),
    has_function_privilege('authenticated','public.save_communication_preferences_atomic(jsonb,jsonb)','EXECUTE'),
    has_function_privilege('anon','public.save_communication_preferences_atomic(jsonb,jsonb)','EXECUTE'),
    (select relrowsecurity from pg_class where oid='public.communication_preferences'::regclass),
    (select relrowsecurity from pg_class where oid='public.push_category_preferences'::regclass);`);
  if (result !== "t|t|t|f|t|t") throw new Error(`CATALOG_MISMATCH_${result}`);
  stage = "synthetic_atomicity";
  const syntheticId = "00000000-0000-4000-8000-000000000044";
  const setup = `insert into auth.users(id,email,aud,role,raw_user_meta_data,raw_app_meta_data)
    values ('${syntheticId}','p44-schema-upgrade@example.invalid','authenticated','authenticated','{}'::jsonb,'{}'::jsonb);
    insert into public.profiles(id,role,full_name) values ('${syntheticId}','parent','Disposable QA');`;
  const normal = sql(`begin; ${setup}
    set local role authenticated;
    set local request.jwt.claim.sub = '${syntheticId}';
    select receive_email from public.save_communication_preferences_atomic(
      '{"receive_email":false}'::jsonb, '{"message":false}'::jsonb);
    reset role;
    select cp.receive_email,pcp.enabled from public.communication_preferences cp
      join public.push_category_preferences pcp on pcp.profile_id=cp.profile_id
      where cp.profile_id='${syntheticId}' and pcp.category='message'; rollback;`);
  if (normal !== "f\nf|f") throw new Error(`ATOMIC_NORMAL_MISMATCH_${normal}`);
  const failed = sql(`begin; ${setup}
    create function pg_temp.fail_second_write() returns trigger language plpgsql as $$
      begin raise exception 'synthetic second write failure' using errcode='P4146'; end $$;
    create trigger fail_second_write before insert or update on public.push_category_preferences
      for each row execute function pg_temp.fail_second_write();
    set local role authenticated;
    set local request.jwt.claim.sub = '${syntheticId}';
    do $$ begin
      begin
        perform public.save_communication_preferences_atomic(
          '{"receive_email":false}'::jsonb,'{"message":false}'::jsonb);
        raise exception 'expected synthetic failure absent' using errcode='P4147';
      exception when sqlstate 'P4146' then null;
      end;
    end $$;
    reset role;
    select (select count(*) from public.communication_preferences where profile_id='${syntheticId}'),
      (select count(*) from public.push_category_preferences where profile_id='${syntheticId}'); rollback;`);
  if (failed !== "0|0") throw new Error(`ATOMIC_ROLLBACK_MISMATCH_${failed}`);
  console.log("PASS: original 227 baseline + 47 applied = 274, RPC absent; schema-only disposable restore plus exact migration 275, invoker ACL/RLS and synthetic two-write atomicity/rollback; no original/real-row or Data API mutation");
} catch (error) {
  const diagnostic = String(error?.stderr ?? "").split("\n")
    .find((line) => /(?:ERROR|FATAL):/.test(line))?.slice(0, 240);
  console.error(`BLOCKED: schema-only upgrade at ${stage}${diagnostic ? ` (${diagnostic})` : ""}`);
  process.exitCode = 1;
} finally {
  if (containerAttempted) {
    try { docker(["rm", "-f", container]); }
    catch { try { docker(["inspect", container]); throw new Error("DISPOSABLE_CLEANUP_FAILED"); }
      catch (error) { if (error?.message === "DISPOSABLE_CLEANUP_FAILED") throw error; } }
  }
  if (networkCreated) docker(["network", "rm", network]);
}
