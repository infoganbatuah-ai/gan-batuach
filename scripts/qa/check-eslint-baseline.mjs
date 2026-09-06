import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const baselinePath = "config/eslint-baseline.json";
const writeBaseline = process.argv.includes("--write-baseline");
const eslintArgs = ["node_modules/eslint/bin/eslint.js", "app", "components", "lib", "services", "--format", "json"];

function collect(rows) {
  const files = {};
  const byRule = {};
  let errors = 0;
  let warnings = 0;
  for (const row of rows) {
    const relativePath = row.filePath.startsWith(`${process.cwd()}/`)
      ? row.filePath.slice(process.cwd().length + 1)
      : row.filePath;
    const counts = {};
    for (const message of row.messages) {
      const severity = message.severity === 2 ? "error" : "warning";
      const key = `${severity}:${message.ruleId || "unclassified"}`;
      counts[key] = (counts[key] || 0) + 1;
      byRule[key] = (byRule[key] || 0) + 1;
      if (message.severity === 2) errors += 1;
      if (message.severity === 1) warnings += 1;
    }
    if (Object.keys(counts).length) files[relativePath] = counts;
  }
  return { errors, warnings, files_with_findings: Object.keys(files).length, by_rule: byRule, files };
}

function runEslint(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024
  });
  let rows;
  try {
    rows = JSON.parse(result.stdout);
  } catch {
    console.error("ESLint did not return parseable JSON.");
    console.error(String(result.stderr || result.stdout).split(/\r?\n/).slice(-40).join("\n"));
    process.exit(result.status || 1);
  }
  return collect(rows);
}

const current = runEslint(eslintArgs);

if (writeBaseline) {
  mkdirSync("config", { recursive: true });
  writeFileSync(baselinePath, `${JSON.stringify({
    version: 1,
    generated_at: new Date().toISOString(),
    scope: ["app", "components", "lib", "services"],
    ...current
  }, null, 2)}\n`);
  console.log(JSON.stringify({ status: "WROTE_BASELINE", path: baselinePath, ...current, files: undefined }, null, 2));
  process.exit(0);
}

if (!existsSync(baselinePath)) {
  console.error(`Missing ${baselinePath}. Generate it only after reviewed lint triage.`);
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const regressions = [];
for (const [file, counts] of Object.entries(current.files)) {
  const allowed = baseline.files[file] || {};
  for (const [rule, count] of Object.entries(counts)) {
    const maximum = allowed[rule] || 0;
    if (count > maximum) regressions.push({ file, rule, count, baseline: maximum });
  }
}

const config = JSON.parse(readFileSync("config/digital-observer-ci-gates.json", "utf8"));
const canonicalArgs = ["node_modules/eslint/bin/eslint.js", ...config.canonicalLintPaths, "--format", "json"];
const canonical = runEslint(canonicalArgs);
if (canonical.errors > 0) {
  regressions.push({ file: "canonical-scope", rule: "error-total", count: canonical.errors, baseline: 0 });
}

if (regressions.length) {
  console.error(JSON.stringify({
    status: "FAIL",
    gate: "lint-baseline",
    summary: current,
    canonical_errors: canonical.errors,
    regressions: regressions.slice(0, 50),
    omitted_regressions: Math.max(0, regressions.length - 50)
  }, (key, value) => key === "files" ? undefined : value, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  status: "PASS",
  gate: "lint-baseline",
  errors: current.errors,
  warnings: current.warnings,
  baseline_errors: baseline.errors,
  baseline_warnings: baseline.warnings,
  canonical_errors: canonical.errors,
  canonical_warnings: canonical.warnings,
  regressions: 0
}, null, 2));
