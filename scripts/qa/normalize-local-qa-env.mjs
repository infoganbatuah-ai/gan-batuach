import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const file = resolve(process.cwd(), ".env.qa-demo.local");
if (!existsSync(file)) {
  console.log("No local QA credential file found; nothing changed.");
  process.exit(0);
}

const lines = readFileSync(file, "utf8").split(/\r?\n/);
const lastIndexByKey = new Map();
const keyAtIndex = new Map();
for (const [index, line] of lines.entries()) {
  const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
  if (!match) continue;
  lastIndexByKey.set(match[1], index);
  keyAtIndex.set(index, match[1]);
}

const removedKeys = [];
const normalized = lines.filter((line, index) => {
  const key = keyAtIndex.get(index);
  if (!key || lastIndexByKey.get(key) === index) return true;
  removedKeys.push(key);
  return false;
});

writeFileSync(file, normalized.join("\n"), { mode: 0o600 });
console.log(`Local QA credential file normalized. Duplicate keys removed: ${[...new Set(removedKeys)].join(", ") || "none"}. Values were not printed.`);
