import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateProductionReleaseSnapshot } from "./production-release-snapshot-core.mjs";

function git(cwd, ...args) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: "pipe" }).trim();
}

const directory = mkdtempSync(join(tmpdir(), "observer-release-contract-"));
mkdirSync(join(directory, ".vercel"), { recursive: true });
writeFileSync(join(directory, ".vercel/project.json"), JSON.stringify({ projectName: "gan-batuach", projectId: "prj_contract123" }));
writeFileSync(join(directory, "tracked.txt"), "safe release fixture\n");
git(directory, "init", "-b", "main");
git(directory, "config", "user.email", "ci-contract@example.invalid");
git(directory, "config", "user.name", "CI Contract");
git(directory, "add", ".");
git(directory, "commit", "-m", "fixture");

assert.equal(validateProductionReleaseSnapshot({ cwd: directory }).status, "PASS");

writeFileSync(join(directory, "untracked.txt"), "dirty\n");
assert.throws(() => validateProductionReleaseSnapshot({ cwd: directory }), /RELEASE_SNAPSHOT_NOT_CLEAN/);
git(directory, "clean", "-f");

writeFileSync(join(directory, "secret.txt"), `SUPABASE_SERVICE_ROLE_KEY=${"x".repeat(32)}\n`);
git(directory, "add", "secret.txt");
git(directory, "commit", "-m", "secret fixture");
assert.throws(() => validateProductionReleaseSnapshot({ cwd: directory }), /SECRET_SHAPED_RELEASE_VALUE/);

writeFileSync(join(directory, "secret.txt"), "safe again\n");
writeFileSync(join(directory, ".vercel/project.json"), JSON.stringify({ projectName: "wrong-project", projectId: "prj_contract123" }));
git(directory, "add", ".");
git(directory, "commit", "-m", "wrong project fixture");
assert.throws(() => validateProductionReleaseSnapshot({ cwd: directory }), /VERCEL_PROJECT_MISMATCH/);

console.log(JSON.stringify({
  status: "PASS",
  clean_snapshot: "accepted",
  dirty_snapshot: "rejected",
  secret_snapshot: "rejected",
  wrong_project: "rejected",
  production_mutation: false
}, null, 2));
