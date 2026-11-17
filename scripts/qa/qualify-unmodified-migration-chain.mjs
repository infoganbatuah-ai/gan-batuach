#!/usr/bin/env node
// Opt-in, disposable schema-chain diagnosis. Never uses the existing database.
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const socket = "unix:///Volumes/DIGITAL_OBSERVER/Development/gan-batuach/colima/gbi/docker.sock";
const image = "public.ecr.aws/supabase/postgres:17.6.1.167";
const enumBoundaryFile = "20260523003000_owner_role_and_onboarding.sql";
const enumBoundarySha256 = "4fb904f0b22a755f3bcd9b5bd2fc9ba9481503628d8b83e418061e2255f1b965";
const enumBoundaryMarker = "\n\nalter table public.gardens add column";
const typoFile = "20260523012000_qa_action_persistence.sql";
const typoSha256 = "b54cb8b1e145afc90ccd7748815b9f1f3c3c12674374532176fabc68a6b701c7";
const typoSource = "alter typeש public.camera_status add value if not exists 'pending_gateway';";
const typoCorrection = "alter type public.camera_status add value if not exists 'pending_gateway';";
// Rendered from Supabase Auth v2.196.0's official DNS-independent migration:
// https://github.com/supabase/auth/blob/v2.196.0/migrations/20220531120530_add_auth_jwt_function.up.sql
// Only the template Namespace=auth is substituted. Never install on the source DB.
const stockAuthJwtSource = `create or replace function auth.jwt()
returns jsonb
language sql stable
as $$
  select
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;`;
const stockAuthJwtSha256 = "da8cd1a869ff38ccad99a1da949f246e389865191f3412661a58f98565bce028";
const legalSeedFile = "20260612016600_external_legal_privacy_regulatory_review_pack.sql";
const unsafeBackfillFile = "20260827000100_digital_observer_event_media_evidence.sql";
const unsafeBackfillSha256 = "088f367d6c00cbfd5d35d3d7a57147dc6ee2cd179cf485a5e6eddbfed0d46eeb";
const unsafeBackfillStart = "\nupdate public.observer_intelligence_signals s\n";
const unsafeBackfillEnd = "\n\ngrant select (";
const guardActivationFile = "20260902033000_activate_scoped_digital_guard_camera_automation.sql";
const guardActivationSha256 = "8578292d4c399e1c16dcdce6155c10b1391b2c698014d3d1766295a8feb31ffe";
const guardActivationStart = "\ncreate or replace function public.sync_authorized_siren_policy_to_crossing_line()";
const guardActivationEnd = "\n-- Replace the autonomous enqueue RPC";
const channelOneActivationFile = "20260902043000_activate_channel_1_guard_lighting.sql";
const channelOneActivationSha256 = "470a86374089e6c6388c762e1a3e0c122d7234229a019e0db3b4c4ea646d3b29";
const files = readdirSync("supabase/migrations").filter((file) => /^\d{14}_[a-z0-9_]+\.sql$/.test(file)).sort();
if (files.length !== 275) throw new Error(`EXPECTED_275_FILES_FOUND_${files.length}`);
if (process.env.PUSH44_UNMODIFIED_CHAIN !== "YES") {
  console.log("NOT RUN: opt in with PUSH44_UNMODIFIED_CHAIN=YES");
  process.exit(0);
}

function docker(args, input, timeout = 60_000, environment = {}) {
  return execFileSync("docker", ["--host", socket, ...args], {
    input, encoding: "utf8", timeout, stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, ...environment }
  }).trim();
}

docker(["image", "inspect", image, "--format", "{{.Id}}"]); // Cached only; no pull.
docker(["image", "inspect", "public.ecr.aws/supabase/storage-api:v1.72.1", "--format", "{{.Id}}"]).trim();
if (process.env.PUSH44_STOCK_AUTH_SCHEMA === "YES")
  docker(["image", "inspect", "public.ecr.aws/supabase/gotrue:v2.196.0", "--format", "{{.Id}}"]).trim();
const container = `push44-chain-${randomBytes(6).toString("hex")}`;
const network = `${container}-net`;
let attempted = false;
let networkCreated = false;
let passed = 0;
let testOnlyTypoNormalization = false;
let testOnlyStockAuthJwt = false;
let legalSeedPendingProof = false;
let testOnlyStockAuthSchema = false;
let testOnlyUnsafeBackfillSkipped = false;
let testOnlyGuardActivationSkipped = false;
let testOnlyChannelOneActivationSkipped = false;
let file170FailClosedProof = false;
try {
  docker(["network", "create", "--internal", network]);
  networkCreated = true;
  attempted = true;
  docker(["run", "--rm", "-d", "--name", container, "--network", network, "--network-alias", "pg",
    "--memory", "2g", "--cpus", "1", "--pids-limit", "128",
    "--tmpfs", "/var/lib/postgresql/data:rw,nosuid,size=1g",
    "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "-e", "POSTGRES_USER=supabase_admin",
    image, "postgres", "-D", "/var/lib/postgresql/data", "-c", "listen_addresses=*"]);
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      if (docker(["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1",
        "-U", "supabase_admin", "-d", "postgres"], "select 1;") === "1") {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        if (docker(["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1",
          "-U", "supabase_admin", "-d", "postgres"], "select 1;") === "1") { ready = true; break; }
      }
    } catch { await new Promise((resolve) => setTimeout(resolve, 500)); }
  }
  if (!ready) throw new Error("DISPOSABLE_POSTGRES_NOT_READY");

  // Use the cached, version-matched Storage API's own migration runner.
  // The internal Docker network is unique to this test and has no host ports.
  const disposableJwtSecret = randomBytes(32).toString("hex");
  docker(["run", "--rm", "--network", network, "--memory", "512m", "--cpus", "1",
    "--pids-limit", "128", "-e", "DATABASE_URL=postgres://supabase_admin@pg:5432/postgres",
    "-e", "PGRST_JWT_SECRET",
    "--entrypoint", "node", "public.ecr.aws/supabase/storage-api:v1.72.1",
    "dist/scripts/migrate-call.js"], undefined, 120_000, { PGRST_JWT_SECRET: disposableJwtSecret });

  if (process.env.PUSH44_STOCK_AUTH_SCHEMA === "YES") {
    if (process.env.PUSH44_STOCK_AUTH_JWT === "YES")
      throw new Error("STOCK_AUTH_FIXTURES_MUTUALLY_EXCLUSIVE");
    // The cached, version-matched GoTrue image owns its Auth schema migrations.
    // Run only `migrate` against this random tmpfs database; no Auth API starts.
    docker(["run", "--rm", "--network", network, "--memory", "512m", "--cpus", "1",
      "--pids-limit", "128", "-e", "GOTRUE_DB_DRIVER=postgres",
      "-e", "GOTRUE_DB_DATABASE_URL=postgres://supabase_admin@pg:5432/postgres",
      "-e", "API_EXTERNAL_URL=http://127.0.0.1:9999",
      "-e", "GOTRUE_SITE_URL=http://127.0.0.1:3000",
      "-e", "GOTRUE_JWT_SECRET", "--entrypoint", "/usr/local/bin/auth",
      "public.ecr.aws/supabase/gotrue:v2.196.0", "migrate"], undefined, 120_000,
    { GOTRUE_JWT_SECRET: disposableJwtSecret });
    const authReady = docker(["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1",
      "-U", "supabase_admin", "-d", "postgres"],
      "select to_regprocedure('auth.jwt()') is not null, exists(select 1 from information_schema.columns where table_schema='auth' and table_name='users' and column_name='email_confirmed_at');");
    if (authReady !== "t|t") throw new Error(`STOCK_AUTH_SCHEMA_INCOMPLETE_${authReady}`);
    testOnlyStockAuthSchema = true;
  }

  if (process.env.PUSH44_STOCK_AUTH_JWT === "YES") {
    if (createHash("sha256").update(stockAuthJwtSource).digest("hex") !== stockAuthJwtSha256)
      throw new Error("STOCK_AUTH_JWT_SOURCE_DRIFT");
    const absent = docker(["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1",
      "-U", "supabase_admin", "-d", "postgres"], "select to_regprocedure('auth.jwt()') is null;");
    if (absent !== "t") throw new Error("STOCK_AUTH_JWT_ALREADY_PRESENT");
    docker(["exec", "-i", container, "psql", "-X", "-q", "-1", "-v", "ON_ERROR_STOP=1",
      "-U", "supabase_admin", "-d", "postgres"], stockAuthJwtSource);
    testOnlyStockAuthJwt = true;
  }

  const deadline = Date.now() + 10 * 60_000;
  for (const [index, file] of files.entries()) {
    if (Date.now() > deadline) throw new Error(`TIME_BOUND_AFTER_${passed}_FILES`);
    const source = readFileSync(join("supabase/migrations", file), "utf8");
    let testSource = source;
    try {
      let syntheticSignalId = null;
      if (file === unsafeBackfillFile && process.env.PUSH44_FILE170_FAIL_CLOSED_PROOF === "YES") {
        if (process.env.PUSH44_FILE170_SKIP_UNSAFE_BACKFILL === "YES")
          throw new Error("FILE170_PROOF_CANNOT_SKIP_SOURCE");
        const syntheticSiteId = randomUUID();
        const syntheticCameraId = randomUUID();
        syntheticSignalId = randomUUID();
        // A connected synthetic camera on the same site must not become an
        // unverified system event's source. No media object or live route exists.
        docker(["exec", "-i", container, "psql", "-X", "-q", "-1", "-v", "ON_ERROR_STOP=1",
          "-U", "supabase_admin", "-d", "postgres"],
          `insert into public.observer_sites(id,name,site_type,monitoring_enabled) values ('${syntheticSiteId}','Disposable fail-closed site','home',false);
           insert into public.digital_observer_camera_sources(id,observer_site_id,display_name,source_mode,status,health_status)
             values ('${syntheticCameraId}','${syntheticSiteId}','Disposable camera','readiness','connected','healthy');
           insert into public.observer_intelligence_signals(id,signal_type,source_type,observer_site_id,metadata)
             values ('${syntheticSignalId}','pattern','system','${syntheticSiteId}',
               '{"event_type":"home_learning_started","test_only":"file170_fail_closed"}'::jsonb);`);
      }
      if (file === typoFile && process.env.PUSH44_FILE13_TYPO_NORMALIZE === "YES") {
        // Historical source and baseline hash stay immutable. This is only a
        // disposable test fixture; it is not a clean-chain/deployable repair.
        if (createHash("sha256").update(source).digest("hex") !== typoSha256 ||
            source.split(typoSource).length !== 2) throw new Error("FILE13_SOURCE_DRIFT");
        testSource = source.replace(typoSource, typoCorrection);
        testOnlyTypoNormalization = true;
      }
      if (file === unsafeBackfillFile && process.env.PUSH44_FILE170_SKIP_UNSAFE_BACKFILL === "YES") {
        // The historical UPDATE would attach the first active camera to system
        // events without a verified source identity. Never execute that backfill.
        if (createHash("sha256").update(source).digest("hex") !== unsafeBackfillSha256 ||
            source.split(unsafeBackfillStart).length !== 2 ||
            source.split(unsafeBackfillEnd).length !== 2) throw new Error("FILE170_SOURCE_DRIFT");
        const start = source.indexOf(unsafeBackfillStart);
        const end = source.indexOf(unsafeBackfillEnd, start);
        const excluded = source.slice(start, end);
        if (!excluded.includes("cs.observer_site_id = s.observer_site_id") ||
            !excluded.trimEnd().endsWith("and not (coalesce(s.metadata, '{}'::jsonb) ? 'camera_source_id');"))
          throw new Error("FILE170_UNSAFE_BACKFILL_SHAPE_DRIFT");
        testSource = source.slice(0, start) + "\n-- TEST ONLY: unsafe first-active-camera backfill excluded; not deployable." + source.slice(end);
        testOnlyUnsafeBackfillSkipped = true;
      }
      if (file === guardActivationFile && process.env.PUSH44_FILE178_SKIP_ACTIVATION === "YES") {
        // Exclude the Home-specific trigger, source edits, policy inserts and
        // authorization audit. Keep generic validators and RPC definition only
        // in the disposable DB; never seed cameras or call the RPC.
        if (createHash("sha256").update(source).digest("hex") !== guardActivationSha256 ||
            source.split(guardActivationStart).length !== 2 ||
            source.split(guardActivationEnd).length !== 2) throw new Error("FILE178_SOURCE_DRIFT");
        const start = source.indexOf(guardActivationStart);
        const end = source.indexOf(guardActivationEnd, start);
        const excluded = source.slice(start, end);
        if (!excluded.includes("raise exception 'Authorized camera scope is incomplete or unhealthy'") ||
            !excluded.includes("insert into public.digital_observer_camera_automation_policies") ||
            !excluded.includes("digital_guard_physical_automation_authorized_v1") ||
            !excluded.includes("create trigger sync_authorized_siren_policy_to_crossing_line"))
          throw new Error("FILE178_ACTIVATION_SHAPE_DRIFT");
        testSource = source.slice(0, start) + "\n-- TEST ONLY: Home Guard activation excluded; not deployable.\n" + source.slice(end);
        testOnlyGuardActivationSkipped = true;
      }
      if (file === channelOneActivationFile && process.env.PUSH44_FILE181_SKIP_ACTIVATION === "YES") {
        // This entire historical migration enables Home channel-1 lighting.
        // It has no general schema DDL; do not fabricate monitoring consent.
        if (createHash("sha256").update(source).digest("hex") !== channelOneActivationSha256 ||
            !source.includes("raise exception 'Observer site monitoring consent is unavailable'") ||
            !source.includes("set enabled = true") ||
            !source.includes("digital_guard_channel_1_lighting_activated_v1") ||
            /\b(?:create|alter|drop)\s+(?:table|function|trigger|policy|index|view|type)\b/i.test(source) ||
            !source.trimEnd().endsWith("commit;")) throw new Error("FILE181_ACTIVATION_SHAPE_DRIFT");
        testSource = "begin; -- TEST ONLY: Home channel-1 activation skipped; not deployable.\ncommit;";
        testOnlyChannelOneActivationSkipped = true;
      }
      if (file === enumBoundaryFile && process.env.PUSH44_ENUM_BOUNDARY === "YES") {
        // PostgreSQL 17 cannot use a newly added enum value until commit.
        // Keep the historical file byte-for-byte; commit only its guarded
        // enum-addition statement, then apply its unchanged remainder atomically.
        if (createHash("sha256").update(source).digest("hex") !== enumBoundarySha256 ||
            source.split(enumBoundaryMarker).length !== 2) throw new Error("ENUM_BOUNDARY_SOURCE_DRIFT");
        const splitAt = source.indexOf(enumBoundaryMarker);
        const enumAddition = source.slice(0, splitAt);
        const remainder = source.slice(splitAt);
        if (!/end \$\$;\s*$/.test(enumAddition) || enumAddition + remainder !== source)
          throw new Error("ENUM_BOUNDARY_SHAPE_INVALID");
        docker(["exec", "-i", container, "psql", "-X", "-q", "-1", "-v", "ON_ERROR_STOP=1",
          "-U", "supabase_admin", "-d", "postgres"], enumAddition, 90_000);
        const enumVisible = docker(["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1",
          "-U", "supabase_admin", "-d", "postgres"],
          "select exists(select 1 from pg_enum where enumtypid='public.app_role'::regtype and enumlabel='owner');");
        if (enumVisible !== "t") throw new Error("ENUM_BOUNDARY_NOT_COMMITTED");
        docker(["exec", "-i", container, "psql", "-X", "-q", "-1", "-v", "ON_ERROR_STOP=1",
          "-U", "supabase_admin", "-d", "postgres"], remainder, 90_000);
        const qualified = docker(["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1",
          "-U", "supabase_admin", "-d", "postgres"],
          "select to_regprocedure('public.can_access_garden(uuid)') is not null, exists(select 1 from pg_policies where schemaname='public' and tablename='gardens' and policyname='managers owners update own garden');");
        if (qualified !== "t|t") throw new Error("ENUM_BOUNDARY_REMAINDER_INCOMPLETE");
      } else {
        docker(["exec", "-i", container, "psql", "-X", "-q", "-1", "-v", "ON_ERROR_STOP=1",
          "-U", "supabase_admin", "-d", "postgres"], testSource, 90_000);
      }
      if (syntheticSignalId) {
        const proof = docker(["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1",
          "-U", "supabase_admin", "-d", "postgres"],
          `select not (metadata ? 'camera_source_id') and not (metadata ? 'evidence_repair'),
             not exists(select 1 from public.digital_observer_event_clips where signal_id='${syntheticSignalId}'),
             (select public is false from storage.buckets where id='digital-observer-event-media'),
             not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects'
               and (coalesce(qual,'') || coalesce(with_check,'')) like '%digital-observer-event-media%')
           from public.observer_intelligence_signals where id='${syntheticSignalId}';`);
        if (proof !== "t|t|t|t") throw new Error(`FILE170_FAIL_CLOSED_PROOF_FAILED_${proof}`);
        file170FailClosedProof = true;
      }
      if (file === legalSeedFile && process.env.PUSH44_FILE132_PENDING_PROOF === "YES") {
        const proof = docker(["exec", "-i", container, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1",
          "-U", "supabase_admin", "-d", "postgres"],
          `select privacy_review_status='needs_review', dpa_status='requested',
             security_review_status='needs_review', contract_status='under_review'
           from public.subprocessor_register where provider_key='vercel';
           select pg_get_constraintdef(oid) like '%requested%' and pg_get_constraintdef(oid) like '%signed%'
           from pg_constraint where conname='subprocessor_dpa_status_check'
             and conrelid='public.subprocessor_register'::regclass;`);
        if (proof !== "t|t|t|t\nt") throw new Error(`FILE132_PENDING_PROOF_FAILED_${proof}`);
        legalSeedPendingProof = true;
      }
      passed++;
    } catch (error) {
      const diagnostic = String(error.stderr ?? "").split("\n")
        .filter((line) => /^(?:ERROR|DETAIL|HINT|CONTEXT):/i.test(line.trim()))
        .slice(0, 4).join(" | ").slice(0, 800);
      console.log(JSON.stringify({ status: "FIRST_FAILURE", number: index + 1, file, priorPassed: passed,
        transaction: file === enumBoundaryFile && process.env.PUSH44_ENUM_BOUNDARY === "YES"
          ? "two_transactions_for_exact_enum_commit"
          : file === typoFile && testOnlyTypoNormalization ? "one_test_only_normalized_file" : "one_unmodified_file",
        testOnlyTypoNormalization,
        testOnlyStockAuthJwt,
        testOnlyStockAuthSchema,
        legalSeedPendingProof,
        testOnlyUnsafeBackfillSkipped,
        testOnlyGuardActivationSkipped,
        testOnlyChannelOneActivationSkipped,
        file170FailClosedProof,
        deployable: false,
        exactEnumCommitBoundary: process.env.PUSH44_ENUM_BOUNDARY === "YES",
        error: diagnostic || (/^[A-Z_]+$/.test(error.message ?? "") ? error.message : `psql_exit_${error.status ?? "unknown"}`) }));
      process.exitCode = 1;
      break;
    }
  }
  if (passed === files.length) console.log(JSON.stringify({ status: "TEST_FIXTURE_PASS_NOT_DEPLOYABLE", files: passed, testOnlyTypoNormalization, testOnlyStockAuthJwt, testOnlyStockAuthSchema, legalSeedPendingProof, testOnlyUnsafeBackfillSkipped, testOnlyGuardActivationSkipped, testOnlyChannelOneActivationSkipped, file170FailClosedProof, deployable: false }));
} finally {
  if (attempted) {
    try { docker(["rm", "-f", container]); }
    catch {
      try { docker(["inspect", container]); throw new Error("DISPOSABLE_CLEANUP_FAILED"); }
      catch (error) { if (error?.message === "DISPOSABLE_CLEANUP_FAILED") throw error; }
    }
  }
  if (networkCreated) {
    try { docker(["network", "rm", network]); }
    catch { throw new Error("DISPOSABLE_NETWORK_CLEANUP_FAILED"); }
  }
}
