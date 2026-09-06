import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

export function validateProductionReleaseSnapshot({ cwd = process.cwd(), expectedProject = "gan-batuach" } = {}) {
  const project = JSON.parse(readFileSync(join(cwd, ".vercel/project.json"), "utf8"));
  if (project.projectName !== expectedProject) throw new Error("VERCEL_PROJECT_MISMATCH");
  if (!/^prj_[A-Za-z0-9]+$/.test(project.projectId || "")) throw new Error("VERCEL_PROJECT_ID_UNAVAILABLE");

  const revision = git(cwd, "rev-parse", "HEAD");
  if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error("RELEASE_REVISION_UNAVAILABLE");
  if (git(cwd, "status", "--porcelain", "--untracked-files=all")) throw new Error("RELEASE_SNAPSHOT_NOT_CLEAN");

  const tracked = git(cwd, "ls-files").split("\n").filter(Boolean);
  const forbidden = tracked.filter((file) =>
    (/^\.env(?:\.|$)/.test(file) && !file.endsWith(".example"))
    || file.startsWith("supabase/.temp/")
    || /(?:^|\/)(?:tmp|temp|logs)(?:\/|$)/.test(file)
    || (/\.(?:sqlite|sqlite3|log|mp4|m3u8|ts|jpg|jpeg|png)$/i.test(file) && file.startsWith("qa-evidence/private-"))
  );
  if (forbidden.length) throw new Error(`FORBIDDEN_RELEASE_ARTIFACT:${forbidden.join(",")}`);

  const secretPatterns = [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /\b(?:sk_live_|rk_live_|whsec_|xox[baprs]-|ghp_|github_pat_)[A-Za-z0-9_-]{16,}/,
    /rtsp:\/\/[^/\s:@]+:[^@\s/]+@/i,
    /^\s*(?:export\s+)?(?:SUPABASE_SERVICE_ROLE_KEY|FIELD_ENCRYPTION_KEY(?:_CURRENT)?|VERCEL_TOKEN)\s*=\s*['"]?[A-Za-z0-9._-]{20,}/m
  ];
  const secretFindings = [];
  for (const file of tracked) {
    let size = 0;
    try { size = statSync(join(cwd, file)).size; } catch { continue; }
    if (size > 2_000_000) continue;
    let source = "";
    try { source = readFileSync(join(cwd, file), "utf8"); } catch { continue; }
    if (source.includes("\u0000")) continue;
    const sanitizedFixtureSource = source.replace(/rtsp:\/\/[^\s]+@example\.invalid[^\s]*/gi, "");
    const patterns = file.endsWith(".example") ? secretPatterns.slice(0, 3) : secretPatterns;
    if (patterns.some((pattern) => pattern.test(sanitizedFixtureSource))) secretFindings.push(file);
  }
  if (secretFindings.length) throw new Error(`SECRET_SHAPED_RELEASE_VALUE:${secretFindings.join(",")}`);

  return {
    status: "PASS",
    project: expectedProject,
    revision,
    branch: git(cwd, "branch", "--show-current"),
    clean_worktree: true,
    rollback_revision_recorded: true,
    forbidden_artifact_count: 0,
    secret_shaped_value_count: 0
  };
}
