import { readFileSync, readdirSync } from "node:fs";

const directory = "supabase/migrations";
const files = readdirSync(directory).filter((file) => file.endsWith(".sql")).sort();
const filenamePattern = /^(\d{14})_(.+)\.sql$/;
const timestamps = new Map();
const names = new Map();
const failures = [];
const warnings = [];
const allowedDuplicateNames = new Set(["first_real_kindergarten_pilot_deployment"]);
const grandfatheredDestructiveFiles = new Set([
  "20260523001000_production_engines.sql",
  "20260523002000_complete_operational_modules.sql",
  "20260612014300_growth_engine_parent_demand_lead_conversion.sql",
  "20260612014410_website_lead_expansion_kindergarten_parent_demand.sql",
  "20260612016200_database_migration_stabilization_supabase_integrity_audit.sql",
  "20260827000400_remove_digital_observer_demo_bundle.sql"
]);
const destructivePattern = /\b(drop\s+(?:table|schema)|truncate\s+table|alter\s+table[\s\S]{0,180}?drop\s+column|delete\s+from\s+public\.)\b/i;
let destructiveFiles = 0;
let idempotentCreateWarnings = 0;

for (const file of files) {
  const match = file.match(filenamePattern);
  if (!match) {
    failures.push({ code: "INVALID_MIGRATION_FILENAME", file });
    continue;
  }
  const [, timestamp, name] = match;
  timestamps.set(timestamp, [...(timestamps.get(timestamp) || []), file]);
  names.set(name, [...(names.get(name) || []), file]);
  const source = readFileSync(`${directory}/${file}`, "utf8");
  if (destructivePattern.test(source)) {
    destructiveFiles += 1;
    const reviewed = /--\s*ci:\s*destructive-reviewed\b/i.test(source);
    if (!reviewed && !grandfatheredDestructiveFiles.has(file)) {
      failures.push({ code: "UNREVIEWED_DESTRUCTIVE_MIGRATION", file });
    }
  }
  if (/create\s+table\s+public\./i.test(source) && !/create\s+table\s+if\s+not\s+exists\s+public\./i.test(source)) {
    idempotentCreateWarnings += 1;
  }
}

for (const [timestamp, matches] of timestamps) {
  if (matches.length > 1) failures.push({ code: "DUPLICATE_MIGRATION_TIMESTAMP", timestamp, files: matches });
}
for (const [name, matches] of names) {
  if (matches.length > 1) {
    const finding = { code: "DUPLICATE_MIGRATION_NAME", name, files: matches };
    if (allowedDuplicateNames.has(name)) warnings.push(finding);
    else failures.push(finding);
  }
}

const result = {
  status: failures.length ? "FAIL" : "PASS",
  migration_count: files.length,
  first_migration: files[0] || null,
  last_migration: files.at(-1) || null,
  duplicate_timestamp_count: [...timestamps.values()].filter((matches) => matches.length > 1).length,
  allowed_duplicate_name_count: warnings.length,
  destructive_file_count: destructiveFiles,
  unreviewed_new_destructive_count: failures.filter((finding) => finding.code === "UNREVIEWED_DESTRUCTIVE_MIGRATION").length,
  non_idempotent_create_file_count: idempotentCreateWarnings,
  warnings,
  failures
};

console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exit(1);
