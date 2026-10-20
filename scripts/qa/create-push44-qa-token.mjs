import { randomBytes } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "push44-owner-qa-"));
const tokenFile = join(directory, "owner-token");
writeFileSync(tokenFile, randomBytes(32).toString("hex"), { mode: 0o600, flag: "wx" });
console.log(`Temporary PUSH44 QA token stored outside Git at ${tokenFile}; value intentionally omitted`);
