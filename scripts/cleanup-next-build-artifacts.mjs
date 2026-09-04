import { existsSync, readdirSync, rmSync } from "node:fs";

const generatedBuildPattern = /^\.next-build-stale-\d+$/;
const generatedBuildDirs = readdirSync(process.cwd(), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && generatedBuildPattern.test(entry.name))
  .map((entry) => entry.name)
  .sort();

// Keep the successful build for next start and deployment in every environment.
// Security scanning must exclude generated artifacts, not destroy the runnable app.
const generatedDirectories = generatedBuildDirs;

for (const directory of generatedDirectories) {
  if (existsSync(directory)) rmSync(directory, { recursive: true, force: true });
}

console.log(`[build] removed ${generatedDirectories.length} generated build director${generatedDirectories.length === 1 ? "y" : "ies"} before security scanning.`);
