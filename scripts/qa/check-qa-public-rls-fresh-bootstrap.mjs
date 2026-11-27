#!/usr/bin/env node
// Local-only fresh Supabase bootstrap. Never accepts a hosted database URL.
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmdirSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const migrations = join(root, "supabase/migrations");
const files = readdirSync(migrations).filter((name) => /^\d{14}_.+\.sql$/.test(name)).sort();
const dockerHost = process.env.QA_BOOTSTRAP_DOCKER_HOST;
if (files.length !== 276 || new Set(files.map((name) => name.slice(0, 14))).size !== 276) {
  throw new Error(`Expected 276 unique source migrations, found ${files.length}`);
}
if (!dockerHost?.startsWith("unix://") || /gbi|push38t|\/var\/run\/docker\.sock/.test(dockerHost)) {
  throw new Error("Use an explicit dedicated local QA Docker socket, never the default or canonical VM");
}
const port = Number(process.env.QA_BOOTSTRAP_DB_PORT || 60422);
if (!Number.isInteger(port) || port < 1024 || port > 65530) throw new Error("Invalid disposable DB port");

const id = `observer-public-rls-${randomUUID().slice(0, 8)}`;
const workdir = join(root, ".dev-cache/tmp", id);
const supabaseDir = join(workdir, "supabase");
const home = join(workdir, "supabase-home");
mkdirSync(workdir, { recursive: true, mode: 0o700 });
mkdirSync(home, { recursive: true, mode: 0o700 });
const env = { ...process.env, DOCKER_HOST: dockerHost, SUPABASE_HOME: home };
const run = (command, args, input) => spawnSync(command, args, {
  cwd: workdir, env, input, encoding: "utf8", maxBuffer: 16 * 1024 * 1024
});
const init = run("supabase", ["init", "--workdir", workdir, "--yes"]);
if (init.status !== 0) throw new Error("Disposable Supabase init failed");
const configPath = join(supabaseDir, "config.toml");
let config = readFileSync(configPath, "utf8");
config = config.replace(/^project_id = .+$/m, `project_id = "${id}"`)
  .replace(/(\[api\][\s\S]*?\nport = )\d+/, `$1${port - 1}`)
  .replace(/(\[db\][\s\S]*?\nport = )\d+/, `$1${port}`)
  .replace(/(\[db\][\s\S]*?\nshadow_port = )\d+/, `$1${port - 2}`)
  .replace(/(\[db\.migrations\][\s\S]*?\nenabled = )(?:true|false)/, "$1true")
  .replace(/(\[db\.seed\][\s\S]*?\nenabled = )(?:true|false)/, "$1false");
writeFileSync(configPath, config, { mode: 0o600 });
if (existsSync(join(supabaseDir, "migrations"))) rmdirSync(join(supabaseDir, "migrations"));
symlinkSync(migrations, join(supabaseDir, "migrations"));
const manifest = files.map((name) => `${name} ${createHash("sha256").update(readFileSync(join(migrations, name))).digest("hex")}`);
writeFileSync(join(workdir, "source-sha256.txt"), `${manifest.join("\n")}\n`, { mode: 0o600 });

const started = run("supabase", ["db", "start", "--workdir", workdir]);
const transcript = `${started.stdout || ""}\n${started.stderr || ""}`.split("\n")
  .filter((line) => /Applying migration|ERROR:|error applying migration|Finished supabase db start/i.test(line))
  .map((line) => line.replace(/'[^']*'/g, "'[redacted]'")
    .replace(/(postgres(?:ql)?:\/\/)[^\s]+/gi, "$1[redacted]"));
writeFileSync(join(workdir, "bootstrap.log"), `${transcript.join("\n")}\n`, { mode: 0o600 });
if (started.status !== 0) {
  console.error(`NO-GO: source-only fresh bootstrap failed; local log: ${workdir}/bootstrap.log`);
  process.exitCode = 1;
} else {
  const container = `supabase_db_${id}`;
  const sql = `select count(*) from supabase_migrations.schema_migrations;
select count(*) from public.observer_sites where id='cc1673b8-3eb0-4785-a12c-1fb88f425a41';
select count(*) from public.digital_observer_camera_automation_policies where enabled is true;
select count(*) from pg_class where oid in ('public.communication_preferences'::regclass,'public.push_category_preferences'::regclass) and relrowsecurity;
select has_function_privilege('authenticated','public.save_communication_preferences_atomic(jsonb,jsonb)','EXECUTE'),has_function_privilege('anon','public.save_communication_preferences_atomic(jsonb,jsonb)','EXECUTE');
select count(*) from pg_class where relnamespace='public'::regnamespace and relname in ('inspection_overrides','inspection_signatures','gps_verification_logs','daily_operational_tasks','daily_task_completions') and relrowsecurity;
select count(*) from pg_class where relnamespace='public'::regnamespace and relname in ('privacy_requests','observer_packages') and 'security_invoker=true'=any(reloptions);
select count(*) from pg_policies where schemaname='public' and tablename='inspection_signatures' and 'public'=any(roles);`;
  const check = run("docker", ["exec", "-u", "postgres", container, "psql", "-At", "-d", "postgres", "-c", sql]);
  const lines = check.stdout?.trim().split("\n") || [];
  const pass = check.status === 0 && JSON.stringify(lines) === JSON.stringify(["276", "0", "0", "2", "t|f", "5", "2", "0"]);
  let restore = false;
  let backupHash = "not-run";
  if (pass) {
    const dump = spawnSync("docker", ["exec", "-u", "postgres", container,
      "pg_dump", "-U", "supabase_admin", "-Fc", "--no-owner", "-n", "public", "-n", "auth",
      "-n", "storage", "-n", "supabase_migrations", "-d", "postgres"],
    { cwd: workdir, env, maxBuffer: 32 * 1024 * 1024 });
    if (dump.status === 0 && dump.stdout?.length) {
      backupHash = createHash("sha256").update(dump.stdout).digest("hex");
      writeFileSync(join(workdir, "scoped-backup.dump"), dump.stdout, { mode: 0o600 });
      const create = run("docker", ["exec", "-u", "postgres", container,
        "createdb", "-U", "supabase_admin", "-T", "template0", "qa_restore"]);
      const empty = create.status === 0 && run("docker", ["exec", "-u", "postgres", container,
        "psql", "-U", "supabase_admin", "-q", "-d", "qa_restore", "-c", "drop schema public cascade"]).status === 0;
      if (empty) {
        const restored = spawnSync("docker", ["exec", "-i", "-u", "postgres", container,
          "pg_restore", "-U", "supabase_admin", "--no-owner", "-d", "qa_restore"],
        { cwd: workdir, env, input: dump.stdout, maxBuffer: 16 * 1024 * 1024 });
        const verify = restored.status === 0 && run("docker", ["exec", "-u", "postgres", container,
          "psql", "-U", "supabase_admin", "-At", "-d", "qa_restore", "-c",
          "select count(*) from supabase_migrations.schema_migrations; select to_regprocedure('public.save_communication_preferences_atomic(jsonb,jsonb)') is not null; select count(*) from pg_class where oid in ('public.communication_preferences'::regclass,'public.push_category_preferences'::regclass) and relrowsecurity; select has_function_privilege('authenticated','public.save_communication_preferences_atomic(jsonb,jsonb)','EXECUTE'),has_function_privilege('anon','public.save_communication_preferences_atomic(jsonb,jsonb)','EXECUTE'); select count(*) from pg_class where relnamespace='public'::regnamespace and relname in ('inspection_overrides','inspection_signatures','gps_verification_logs','daily_operational_tasks','daily_task_completions') and relrowsecurity; select count(*) from pg_class where relnamespace='public'::regnamespace and relname in ('privacy_requests','observer_packages') and 'security_invoker=true'=any(reloptions);"]);
        restore = Boolean(verify && verify.status === 0 && verify.stdout?.trim() === "276\nt\n2\nt|f\n5\n2");
      }
    }
  }
  const qualified = pass && restore;
  writeFileSync(join(workdir, "qualification.txt"), `source_files=276\nregistry=${lines[0] || "unknown"}\nhome_site=${lines[1] || "unknown"}\nautomation_enabled=${lines[2] || "unknown"}\nrls_tables=${lines[3] || "unknown"}\nexec_roles=${lines[4] || "unknown"}\nqa_rls_tables=${lines[5] || "unknown"}\nqa_invoker_views=${lines[6] || "unknown"}\nbroad_signature_policies=${lines[7] || "unknown"}\nscoped_backup_sha256=${backupHash}\nisolated_restore=${restore ? "PASS" : "FAIL"}\nresult=${qualified ? "PASS" : "FAIL"}\n`, { mode: 0o600 });
  console.log(`${qualified ? "PASS" : "FAIL"}: 276-file source-only bootstrap and scoped restore; receipt ${workdir}/qualification.txt`);
  if (!qualified) process.exitCode = 1;
}
const stopped = run("supabase", ["stop", "--project-id", id, "--no-backup", "--workdir", workdir]);
if (stopped.status !== 0) {
  console.error(`Disposable project cleanup needs attention: ${id}`);
  process.exitCode = 1;
}
