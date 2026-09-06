import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const migrationsDir = resolve(process.cwd(), "supabase/migrations");
const reportPath = resolve(process.cwd(), "qa-evidence/gan-batuach-completion-audit-1/storage-policy-static-check.json");

const migrationFiles = readdirSync(migrationsDir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

const expectedHardening = "20260820000100_camera_snapshot_storage_privacy_hardening.sql";
const hardeningPath = resolve(migrationsDir, expectedHardening);
const hardeningSql = existsSync(hardeningPath) ? readFileSync(hardeningPath, "utf8") : "";
const laterSql = migrationFiles
  .filter((name) => name > expectedHardening)
  .map((name) => readFileSync(resolve(migrationsDir, name), "utf8"))
  .join("\n");

const assertions = [
  {
    name: "camera_snapshot_hardening_migration_exists",
    passed: existsSync(hardeningPath)
  },
  {
    name: "broad_authenticated_read_policy_is_dropped",
    passed: /drop policy if exists\s+"camera snapshots storage authenticated read"\s+on storage\.objects/i.test(hardeningSql)
  },
  {
    name: "broad_authenticated_insert_policy_is_dropped",
    passed: /drop policy if exists\s+"camera snapshots storage service insert"\s+on storage\.objects/i.test(hardeningSql)
  },
  {
    name: "camera_snapshot_bucket_is_forced_private",
    passed: /update storage\.buckets[\s\S]*set public\s*=\s*false[\s\S]*camera-snapshots/i.test(hardeningSql)
  },
  {
    name: "storage_audit_uses_valid_fixed_status",
    passed: /current_status\s*=\s*'fixed'/i.test(hardeningSql) && !/current_status\s*=\s*'ready'/i.test(hardeningSql)
  },
  {
    name: "no_later_migration_reopens_camera_snapshot_browser_access",
    passed: !/create policy[\s\S]{0,200}camera snapshots[\s\S]{0,300}auth\.uid\(\) is not null/i.test(laterSql)
  }
];

const failed = assertions.filter((assertion) => !assertion.passed);
const report = {
  generatedAt: new Date().toISOString(),
  method: "Static migration-order safety check. Remote Supabase policy verification is still required after applying the migration.",
  migration: expectedHardening,
  assertions: assertions.map(({ name, passed }) => ({ name, status: passed ? "PASS" : "FAIL" })),
  result: failed.length ? "FAIL" : "STATIC_PASS_REMOTE_APPLY_REQUIRED"
};

mkdirSync(dirname(reportPath), { recursive: true });
if (process.env.QA_EVIDENCE_WRITE === "1") {
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
console.log(`Storage policy safety: ${assertions.length - failed.length} PASS, ${failed.length} FAIL.`);
console.log("Remote Supabase verification remains required after migration apply; no secret values were inspected or printed.");
if (failed.length) process.exitCode = 1;
