import { existsSync, readdirSync, rmSync } from "node:fs";

const generatedBuildPattern = /^\.next-build-stale-\d+$/;
const generatedBuildDirs = readdirSync(process.cwd(), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && generatedBuildPattern.test(entry.name))
  .map((entry) => entry.name)
  .sort();

for (const directory of [".next", ...generatedBuildDirs]) {
  if (existsSync(directory)) rmSync(directory, { recursive: true, force: true });
}

console.log(`[build] removed ${generatedBuildDirs.length + 1} generated build director${generatedBuildDirs.length === 0 ? "y" : "ies"} before security scanning.`);
