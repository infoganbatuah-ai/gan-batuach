import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const excluded = [".env", ".env.*", ".env.local", ".git", ".next", "node_modules", "__MACOSX", ".DS_Store", "coverage", "exports"];
const outputDir = join(process.cwd(), "exports");
if (!existsSync(outputDir)) mkdirSync(outputDir);

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const output = join(outputDir, `gan-batuach-clean-${stamp}.zip`);
const filesResult = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" });

if (filesResult.status !== 0) {
  throw new Error("Clean export requires a git worktree so ignored files are excluded safely.");
}

const files = filesResult.stdout
  .split("\n")
  .map((file) => file.trim())
  .filter(Boolean)
  .filter((file) => !excluded.some((pattern) => file === pattern || file.startsWith(`${pattern}/`) || (pattern.endsWith(".*") && file.startsWith(pattern.slice(0, -1)))));

const result = spawnSync("zip", ["-q", output, "-@"], { input: files.join("\n"), encoding: "utf8", stdio: ["pipe", "inherit", "inherit"] });

if (result.status !== 0) {
  throw new Error("Clean export failed. Make sure the zip command is available.");
}

console.log(`Clean export created: ${output}`);
console.log(`Excluded: ${excluded.join(", ")}`);
console.log(`Files included: ${files.length}`);
