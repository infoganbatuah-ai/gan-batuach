#!/usr/bin/env node
// Opt-in, disposable schema-chain diagnosis. Never uses the existing database.
import { createHash, randomBytes } from "node:crypto";
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
const container = `push44-chain-${randomBytes(6).toString("hex")}`;
const network = `${container}-net`;
let attempted = false;
let networkCreated = false;
let passed = 0;
let testOnlyTypoNormalization = false;
let testOnlyStockAuthJwt = false;
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
      if (file === typoFile && process.env.PUSH44_FILE13_TYPO_NORMALIZE === "YES") {
        // Historical source and baseline hash stay immutable. This is only a
        // disposable test fixture; it is not a clean-chain/deployable repair.
        if (createHash("sha256").update(source).digest("hex") !== typoSha256 ||
            source.split(typoSource).length !== 2) throw new Error("FILE13_SOURCE_DRIFT");
        testSource = source.replace(typoSource, typoCorrection);
        testOnlyTypoNormalization = true;
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
        exactEnumCommitBoundary: process.env.PUSH44_ENUM_BOUNDARY === "YES",
        error: diagnostic || (/^[A-Z_]+$/.test(error.message ?? "") ? error.message : `psql_exit_${error.status ?? "unknown"}`) }));
      process.exitCode = 1;
      break;
    }
  }
  if (passed === files.length) console.log(JSON.stringify({ status: "PASS", files: passed, testOnlyTypoNormalization, testOnlyStockAuthJwt }));
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
