import { readdirSync } from "node:fs";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const generatedBuildPattern = /^\.next-build-stale-\d+$/;
const generatedBuildDirs = readdirSync(process.cwd(), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && generatedBuildPattern.test(entry.name))
  .map((entry) => entry.name)
  .sort();

const maxDirectoriesPerRun = 4;
const targets = generatedBuildDirs.slice(0, maxDirectoriesPerRun);
const results = await Promise.all(targets.map(async (directory) => {
  try {
    await rm(resolve(process.cwd(), directory), {
      recursive: true,
      force: true,
      maxRetries: 8,
      retryDelay: 250
    });
    return { directory, removed: true, code: null };
  } catch (error) {
    return { directory, removed: false, code: error instanceof Error && "code" in error ? error.code : "UNKNOWN" };
  }
}));
const failures = results.filter((result) => !result.removed);
const removedCount = results.length - failures.length;

console.log(`[build] removed ${removedCount} generated stale build director${removedCount === 1 ? "y" : "ies"}`);
if (failures.length) {
  console.warn(`[build] ${failures.length} stale build directories could not be removed and may require a later retry.`);
}
if (generatedBuildDirs.length > targets.length) {
  console.log(`[build] deferred ${generatedBuildDirs.length - targets.length} older generated directories to future bounded cleanup runs.`);
}
