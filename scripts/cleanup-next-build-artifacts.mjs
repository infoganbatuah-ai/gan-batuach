import { existsSync, readdirSync, rmSync } from "node:fs";

const generatedBuildPattern = /^\.next-build-stale-\d+$/;
const generatedBuildDirs = readdirSync(process.cwd(), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && generatedBuildPattern.test(entry.name))
  .map((entry) => entry.name)
  .sort();

// Vercel needs the freshly generated `.next` directory to create the deployment.
// Other environments remove it before repository-wide secret scanning.
const generatedDirectories = [
  ...(process.env.VERCEL ? [] : [".next"]),
  ...generatedBuildDirs
];

for (const directory of generatedDirectories) {
  if (existsSync(directory)) rmSync(directory, { recursive: true, force: true });
}

console.log(`[build] removed ${generatedDirectories.length} generated build director${generatedDirectories.length === 1 ? "y" : "ies"} before security scanning.`);
