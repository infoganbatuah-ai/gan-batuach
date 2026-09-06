import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const gate = process.argv[2];
if (!new Set(["domain", "security"]).has(gate)) {
  console.error("Usage: node scripts/ci/run-gate.mjs <domain|security>");
  process.exit(2);
}

const config = JSON.parse(readFileSync("config/digital-observer-ci-gates.json", "utf8"));
const suites = config[gate];
const results = [];

function boundedTail(value, lines = 60) {
  return String(value || "").split(/\r?\n/).slice(-lines).join("\n");
}

for (const suite of suites) {
  const startedAt = Date.now();
  const result = spawnSync(process.execPath, suite.args, {
    cwd: process.cwd(),
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    env: {
      ...process.env,
      APP_ENV: "demo",
      NEXT_PUBLIC_APP_ENV: "demo",
      PRODUCTION_ACTIVATION_APPROVED: "false",
      LIVE_ACTIVATION_CONFIRM: ""
    }
  });
  const record = {
    gate,
    suite: suite.name,
    command: [process.execPath, ...suite.args].join(" "),
    exit_status: result.status,
    duration_ms: Date.now() - startedAt
  };
  results.push(record);
  if (result.status !== 0) {
    console.error(JSON.stringify({
      status: "FAIL",
      ...record,
      stdout_tail: boundedTail(result.stdout),
      stderr_tail: boundedTail(result.stderr)
    }, null, 2));
    process.exit(result.status || 1);
  }
  console.log(JSON.stringify({ status: "PASS", ...record }));
}

console.log(JSON.stringify({
  status: "PASS",
  gate,
  passed: results.length,
  failed: 0,
  version: config.version
}, null, 2));
