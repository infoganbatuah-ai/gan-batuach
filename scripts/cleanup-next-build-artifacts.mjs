import { readdirSync } from "node:fs";

const generatedBuildPattern = /^\.next-build-stale-\d+$/;
const generatedBuildDirs = readdirSync(process.cwd(), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && generatedBuildPattern.test(entry.name))
  .map((entry) => entry.name)
  .sort();

console.log(`[build] ${generatedBuildDirs.length} generated stale build director${generatedBuildDirs.length === 1 ? "y is" : "ies are"} deferred so cleanup cannot stall the verified build.`);
