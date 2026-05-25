import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const excluded = [".env", ".env.*", ".env.local", ".git", ".next", "node_modules", "__MACOSX", ".DS_Store", "coverage", "exports"];
const outputDir = join(process.cwd(), "exports");
if (!existsSync(outputDir)) mkdirSync(outputDir);

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const output = join(outputDir, `gan-batuach-clean-${stamp}.zip`);
const args = ["-r", output, ".", ...excluded.flatMap((pattern) => ["-x", pattern, `${pattern}/**`])];
const result = spawnSync("zip", args, { stdio: "inherit" });

if (result.status !== 0) {
  throw new Error("Clean export failed. Make sure the zip command is available.");
}

console.log(`Clean export created: ${output}`);
console.log(`Excluded: ${excluded.join(", ")}`);
