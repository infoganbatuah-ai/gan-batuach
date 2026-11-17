#!/usr/bin/env node
// Opt-in schema-only qualification. Source Development DB is read-only;
// all SQL writes target a random, disposable database on an internal network.
import { createHash, createHmac, randomBytes } from "node:crypto";
import { execFile, execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

if (process.env.PUSH44_SCHEMA_UPGRADE !== "YES") {
  console.log("NOT RUN: opt in with PUSH44_SCHEMA_UPGRADE=YES");
  process.exit(0);
}
const socket = "unix:///Volumes/DIGITAL_OBSERVER/Development/gan-batuach/colima/gbi/docker.sock";
const source = "supabase_db_gan-batuach-integration";
const pgImage = "public.ecr.aws/supabase/postgres:17.6.1.167";
const storageImage = "public.ecr.aws/supabase/storage-api:v1.72.1";
const restImage = "public.ecr.aws/supabase/postgrest:v16.2";
const migration = readFileSync("supabase/migrations/20261116224059_push44_atomic_notification_preferences.sql", "utf8");
const container = `push44-schema-${randomBytes(6).toString("hex")}`;
const network = `${container}-net`;
const restContainer = `${container}-rest`;
let networkCreated = false;
let containerAttempted = false;
let restAttempted = false;
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
async function sqlAsync(query) {
  const { stdout } = await execFileAsync("docker", ["--host", socket, "exec", "-i", container,
    "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-U", "supabase_admin", "-d", "postgres", "-c", query],
  { encoding: "utf8", timeout: 20_000, maxBuffer: 1024 * 1024,
    env: process.env });
  return stdout.trim();
}
function schemaFingerprint() {
  const schema = docker(["exec", container, "pg_dump", "--schema-only", "--no-owner",
    "--schema=public", "-U", "supabase_admin", "-d", "postgres"], undefined, 120_000);
  return createHash("sha256").update(schema).digest("hex");
}
function jwt(secret, claims) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "HS256", typ: "JWT" })}.${encode(claims)}`;
  return `${unsigned}.${createHmac("sha256", secret).update(unsigned).digest("base64url")}`;
}
function apiRequest(method, body, token = "") {
  const client = `const http=require('node:http');
    const body=process.env.QA_BODY||'';
    const req=http.request({host:'rest',port:3000,path:'/rpc/save_communication_preferences_atomic',
      method:process.env.QA_METHOD,headers:{'content-type':'application/json',
      ...(process.env.QA_TOKEN?{authorization:'Bearer '+process.env.QA_TOKEN}:{}),
      'content-length':Buffer.byteLength(body)}},res=>{let data='';
      res.on('data',chunk=>data+=chunk);res.on('end',()=>{
        console.log(JSON.stringify({status:res.statusCode,body:data.slice(0,4096)}));});});
    req.on('error',()=>process.exit(7));req.end(body);`;
  const output = docker(["run", "--rm", "--network", network, "--memory", "128m",
    "--pids-limit", "64", "-e", "QA_BODY", "-e", "QA_METHOD", "-e", "QA_TOKEN",
    "--entrypoint", "node", storageImage, "-e", client], undefined, 20_000,
  { QA_BODY: JSON.stringify(body), QA_METHOD: method, QA_TOKEN: token });
  return JSON.parse(output);
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
  const beforeFingerprint = schemaFingerprint();
  stage = "migration_275";
  sql(migration);
  const afterFingerprint = schemaFingerprint();
  if (beforeFingerprint === afterFingerprint) throw new Error("MIGRATION_SCHEMA_FINGERPRINT_UNCHANGED");
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
  stage = "synthetic_idempotency_and_isolation";
  const otherId = "00000000-0000-4000-8000-000000000045";
  const repeat = sql(`begin; ${setup}
    insert into auth.users(id,email,aud,role,raw_user_meta_data,raw_app_meta_data)
      values ('${otherId}','p44-other@example.invalid','authenticated','authenticated','{}'::jsonb,'{}'::jsonb);
    insert into public.profiles(id,role,full_name) values ('${otherId}','parent','Other Disposable QA');
    set local role authenticated;
    set local request.jwt.claim.sub = '${syntheticId}';
    select receive_email from public.save_communication_preferences_atomic(
      '{"receive_email":false}'::jsonb, '{"message":false}'::jsonb);
    select receive_email from public.save_communication_preferences_atomic(
      '{"receive_email":false}'::jsonb, '{"message":false}'::jsonb);
    reset role;
    select (select count(*) from public.communication_preferences where profile_id='${syntheticId}'),
      (select count(*) from public.push_category_preferences where profile_id='${syntheticId}' and category='message'),
      (select count(*) from public.communication_preferences where profile_id='${otherId}'),
      (select count(*) from public.push_category_preferences where profile_id='${otherId}'); rollback;`);
  if (repeat !== "f\nf\n1|1|0|0") throw new Error(`IDEMPOTENCY_OR_ISOLATION_MISMATCH_${repeat}`);
  stage = "synthetic_concurrent_writers";
  sql(setup);
  const concurrentWrite = (enabled, hold) => `begin;
    set local statement_timeout = '10s';
    set local lock_timeout = '8s';
    set local role authenticated;
    set local request.jwt.claim.sub = '${syntheticId}';
    select receive_email from public.save_communication_preferences_atomic(
      '{"receive_email":${enabled}}'::jsonb, '{"message":${enabled}}'::jsonb);
    ${hold ? "select pg_sleep(1);" : ""}
    commit;`;
  const concurrent = await Promise.all([
    sqlAsync(concurrentWrite("false", true)),
    sqlAsync(concurrentWrite("true", false)),
  ]);
  if (!concurrent.every((value) => value === "f" || value === "t" || value === "f\n" || value === "t\n"))
    throw new Error(`CONCURRENT_RETURN_MISMATCH_${concurrent.join("_")}`);
  const final = sql(`select cp.receive_email, pcp.enabled,
      (select count(*) from public.communication_preferences where profile_id='${syntheticId}'),
      (select count(*) from public.push_category_preferences where profile_id='${syntheticId}' and category='message')
    from public.communication_preferences cp join public.push_category_preferences pcp
      on pcp.profile_id=cp.profile_id and pcp.category='message'
    where cp.profile_id='${syntheticId}';`);
  if (final !== "f|f|1|1" && final !== "t|t|1|1")
    throw new Error(`CONCURRENT_PARTIAL_OR_DUPLICATE_${final}`);
  stage = "local_data_api";
  docker(["image", "inspect", restImage, "--format", "{{.Id}}"]).trim();
  const apiSecret = randomBytes(32).toString("hex");
  restAttempted = true;
  docker(["run", "--rm", "-d", "--name", restContainer, "--network", network,
    "--network-alias", "rest", "--memory", "256m", "--cpus", "1", "--pids-limit", "128",
    "-e", "PGRST_DB_URI", "-e", "PGRST_DB_SCHEMAS=public", "-e", "PGRST_DB_ANON_ROLE=anon",
    "-e", "PGRST_JWT_SECRET", "-e", "PGRST_SERVER_PORT=3000", restImage], undefined, 20_000,
  { PGRST_DB_URI: "postgres://supabase_admin@pg:5432/postgres", PGRST_JWT_SECRET: apiSecret });
  const token = jwt(apiSecret, { role: "authenticated", sub: syntheticId,
    aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 300 });
  let apiReady = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try { const response = apiRequest("POST", { p_patch: {}, p_categories: null });
      if (response.status) { apiReady = true; break; }
    } catch { await new Promise((resolve) => setTimeout(resolve, 250)); }
  }
  if (!apiReady) throw new Error("LOCAL_DATA_API_NOT_READY");
  const anon = apiRequest("POST", { p_patch: { receive_email: false } });
  if (anon.status < 400 || anon.status >= 500) throw new Error(`ANON_RPC_NOT_DENIED_${anon.status}`);
  const valid = apiRequest("POST", { p_patch: { receive_email: false },
    p_categories: { message: false } }, token);
  if (valid.status !== 200 || JSON.parse(valid.body)?.receive_email !== false)
    throw new Error(`AUTHENTICATED_RPC_FAILED_${valid.status}`);
  const forged = apiRequest("POST", { p_patch: { receive_email: true },
    p_categories: { message: true }, profile_id: otherId }, token);
  if (forged.status < 400 || forged.status >= 500 ||
      JSON.parse(forged.body)?.code !== "PGRST202")
    throw new Error(`FORGED_PROFILE_ID_ACCEPTED_${forged.status}`);
  sql(`create function public.qa_fail_second_write() returns trigger language plpgsql as $$
    begin raise exception 'synthetic second write failure' using errcode='P4146'; end $$;
    create trigger qa_fail_second_write before insert or update on public.push_category_preferences
      for each row execute function public.qa_fail_second_write();`);
  const failedApi = apiRequest("POST", { p_patch: { receive_email: true },
    p_categories: { message: true } }, token);
  if (failedApi.status < 400 || JSON.parse(failedApi.body)?.code !== "P4146")
    throw new Error("DATA_API_SECOND_WRITE_FAILURE_NOT_PROPAGATED");
  const apiState = sql(`select cp.receive_email,pcp.enabled from public.communication_preferences cp
    join public.push_category_preferences pcp on pcp.profile_id=cp.profile_id
    where cp.profile_id='${syntheticId}' and pcp.category='message';`);
  if (apiState !== "f|f") throw new Error(`DATA_API_PARTIAL_WRITE_${apiState}`);
  console.log(`PASS: source 227+47=274; disposable 274→275; public schema fingerprints ${beforeFingerprint} → ${afterFingerprint}; invoker ACL/RLS, rollback, idempotency, other-user isolation, concurrent writers (${final}); official cached PostgREST authenticated RPC 200, anon ${anon.status}, forged profile_id ${forged.status}, failed second write ${failedApi.status} leaves f|f; source untouched. LIMITATION: synthetic rows only, no real Auth/profile restore or arbitrary crash-durability proof.`);
} catch (error) {
  const diagnostic = String(error?.stderr ?? "").split("\n")
    .find((line) => /(?:ERROR|FATAL):/.test(line))?.slice(0, 240);
  console.error(`BLOCKED: schema-only upgrade at ${stage}${diagnostic ? ` (${diagnostic})` : ""}`);
  process.exitCode = 1;
} finally {
  if (restAttempted) docker(["rm", "-f", restContainer]);
  if (containerAttempted) {
    try { docker(["rm", "-f", container]); }
    catch { try { docker(["inspect", container]); throw new Error("DISPOSABLE_CLEANUP_FAILED"); }
      catch (error) { if (error?.message === "DISPOSABLE_CLEANUP_FAILED") throw error; } }
  }
  if (networkCreated) docker(["network", "rm", network]);
}
