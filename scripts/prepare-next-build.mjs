import { existsSync, renameSync, rmSync } from "node:fs";

const source = ".next";

if (existsSync(source)) {
  try {
    rmSync(source, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
    console.log(`[build] removed stale ${source}`);
  } catch {
    const target = `.next-build-stale-${Date.now()}`;
    renameSync(source, target);
    console.warn(`[build] could not remove ${source}; moved it to ${target} for bounded cleanup`);
  }
}
