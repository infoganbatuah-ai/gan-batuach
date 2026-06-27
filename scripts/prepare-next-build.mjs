import { existsSync, renameSync } from "node:fs";

const source = ".next";

if (existsSync(source)) {
  const target = `.next-build-stale-${Date.now()}`;
  renameSync(source, target);
  console.log(`[build] moved stale ${source} to ${target}`);
}
