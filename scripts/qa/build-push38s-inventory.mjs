import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

// Read-only Git provenance, then a mechanical inventory of the exact branch delta.
const source = process.argv[2] ?? "codex/push-38q-r2-auth";
const target = process.argv[3] ?? "integration/development";
const output = process.argv[4] ?? "DIGITAL_OBSERVER_PUSH_38S_INTEGRATION_INVENTORY.json";
const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }).trimEnd();
const base = git("merge-base", target, source);
const rows = git("diff", "--name-status", "--no-renames", `${base}...${source}`).split("\n").filter(Boolean)
  .map(line => { const [change, path] = line.split("\t"); return { change, path }; });
const commits = git("log", "--reverse", "--format=COMMIT:%H\t%s", "--name-only", `${base}..${source}`).split("\n");
const provenance = new Map();
let current = null;
for (const line of commits) {
  if (line.startsWith("COMMIT:")) { const [sha, ...subject] = line.slice(7).split("\t"); current = { sha, subject: subject.join("\t") }; }
  else if (line && current) { const items = provenance.get(line) ?? []; items.push(current); provenance.set(line, items); }
}
function domain(path) {
  if (path.startsWith("qa-evidence/") || /PUSH_38.*(REPORT|EVIDENCE|LEDGER|ANALYSIS|READINESS)/.test(path)) return "evidence";
  if (path.startsWith("supabase/migrations/")) return "migrations";
  if (path === "config/digital-observer-ci-gates.json") return "tests";
  if (path === "scripts/build-connector-macos.mjs") return "release signing / trust";
  if (path === "scripts/release/macos-r2-keychain.mjs") return "R2 delivery / HOME_QA authorization";
  if (path === "scripts/run-persistent-home-gateway.mjs" || path.includes("edge-macos-installed-adapter")) return "OTA / update lifecycle";
  if (/gateway-device|identity|enrollment/.test(path)) return "managed-device identity";
  if (/edge-updates\/download|r2-download|private_release_delivery/.test(path)) return "R2 delivery / HOME_QA authorization";
  if (/home-qa|HOME_QA/.test(path)) return "HOME_QA rollout";
  if (/release-trust|release-object|remote-ed25519|sign-edge|kms-custody/.test(path)) return "release signing / trust";
  if (/edge-installed|edge-update|edge-crash|edge-connector-legacy/.test(path)) return "OTA / update lifecycle";
  if (/relay|session-policy|edge-readiness|server\.mjs|software-connector/.test(path)) return "health / runtime";
  if (/reliability|horizontal|scale|capacity|chaos|soak/.test(path)) return "observability / qualification";
  if (path.startsWith("scripts/qa/") || path.includes("CI_TEST_MANIFEST")) return "tests";
  if (path.startsWith("DIGITAL_OBSERVER_") || path === "vercel.json") return "documentation / configuration";
  if (path.startsWith("package")) return "dependencies";
  return "unclassified";
}
const inventory = rows.map(row => {
  const history = provenance.get(row.path) ?? [];
  const sourceBlob = git("rev-parse", `${source}:${row.path}`);
  let targetBlob = null;
  try { targetBlob = git("rev-parse", `${target}:${row.path}`); } catch { /* added file */ }
  const state = sourceBlob === targetBlob ? "ALREADY_EQUIVALENT" : domain(row.path) === "evidence" ? "EVIDENCE_ONLY_REMOTE_PRESERVED" : "PRESERVED_PENDING_INTEGRATION";
  return { ...row, domain: domain(row.path), state, source_blob: sourceBlob, target_blob: targetBlob,
    origin_commit: history[0]?.sha ?? null, origin_subject: history[0]?.subject ?? null,
    latest_commit: history.at(-1)?.sha ?? null, commits: history.map(item => item.sha) };
});
const result = { contract: "push38s-integration-inventory-v1", source, target, merge_base: base,
  source_head: git("rev-parse", source), target_head: git("rev-parse", target),
  total_files: inventory.length, by_state: Object.fromEntries([...new Set(inventory.map(item => item.state))].map(state => [state, inventory.filter(item => item.state === state).length])),
  by_domain: Object.fromEntries([...new Set(inventory.map(item => item.domain))].map(name => [name, inventory.filter(item => item.domain === name).length])), files: inventory };
writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o644 });
console.log(JSON.stringify({ total_files: result.total_files, by_state: result.by_state, by_domain: result.by_domain }));
