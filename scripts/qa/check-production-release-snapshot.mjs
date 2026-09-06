import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

const expectedProject = "gan-batuach";
const project = JSON.parse(readFileSync(".vercel/project.json", "utf8"));
assert.equal(project.projectName, expectedProject, "Vercel project binding mismatch");
assert.match(project.projectId ?? "", /^prj_[A-Za-z0-9]+$/, "Vercel project ID is unavailable");

const revision = git("rev-parse", "HEAD");
assert.match(revision, /^[a-f0-9]{40}$/, "Release revision is unavailable");
const status = git("status", "--porcelain", "--untracked-files=all");
assert.equal(status, "", "Production release requires a clean, committed and rollback-capable Git snapshot");

const tracked = git("ls-files").split("\n").filter(Boolean);
const forbidden = tracked.filter((file) =>
  (/^\.env(?:\.|$)/.test(file) && !file.endsWith(".example"))
  || file.startsWith("supabase/.temp/")
  || /(?:^|\/)(?:tmp|temp|logs)(?:\/|$)/.test(file)
  || /\.(?:sqlite|sqlite3|log|mp4|m3u8|ts|jpg|jpeg|png)$/i.test(file) && file.startsWith("qa-evidence/private-")
);
assert.deepEqual(forbidden, [], `Release snapshot tracks forbidden local/runtime artifacts: ${forbidden.join(", ")}`);

const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:sk_live_|rk_live_|whsec_|xox[baprs]-|ghp_|github_pat_)[A-Za-z0-9_-]{16,}/,
  /rtsp:\/\/[^/\s:@]+:[^@\s/]+@/i,
  /^\s*(?:export\s+)?(?:SUPABASE_SERVICE_ROLE_KEY|FIELD_ENCRYPTION_KEY(?:_CURRENT)?|VERCEL_TOKEN)\s*=\s*['"]?[A-Za-z0-9._-]{20,}/m
];
const secretFindings = [];
for (const file of tracked) {
  let size = 0;
  try { size = statSync(file).size; } catch { continue; }
  if (size > 2_000_000) continue;
  let source = "";
  try { source = readFileSync(file, "utf8"); } catch { continue; }
  if (source.includes("\u0000")) continue;
  const sanitizedFixtureSource = source.replace(/rtsp:\/\/[^\s]+@example\.invalid[^\s]*/gi, "");
  const patterns = file.endsWith(".example") ? secretPatterns.slice(0, 3) : secretPatterns;
  if (patterns.some((pattern) => pattern.test(sanitizedFixtureSource))) secretFindings.push(file);
}
assert.deepEqual(secretFindings, [], `Release snapshot contains a secret-shaped value in: ${secretFindings.join(", ")}`);

console.log(JSON.stringify({
  status: "PASS",
  project: expectedProject,
  project_id: project.projectId,
  revision,
  branch: git("branch", "--show-current"),
  clean_worktree: true,
  rollback_revision_recorded: true,
  forbidden_artifact_count: 0,
  secret_shaped_value_count: 0
}, null, 2));
