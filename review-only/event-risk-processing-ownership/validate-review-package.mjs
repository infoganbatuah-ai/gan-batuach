import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const directory = new URL("./", import.meta.url);
const location = fileURLToPath(directory);
assert(!location.includes("/supabase/migrations/"), "review package must remain outside migration discovery");

const draft = readFileSync(new URL("DRAFT-NOT-APPLIED.sql", directory), "utf8");
const preflight = readFileSync(new URL("SITE-PREFLIGHT-READ-ONLY.sql", directory), "utf8");
const contract = readFileSync(new URL("RPC-CONTRACT.md", directory), "utf8");
const route = readFileSync(new URL("../../app/api/video-gateway/cloud-events/route.ts", directory), "utf8");

const executable = text => text.split("\n").filter(line => !line.trimStart().startsWith("--")).join("\n");
const draftExecutable = executable(draft);
const preflightExecutable = executable(preflight);
assert.match(draftExecutable, /^\s*BEGIN;\s*DO \$draft_guard\$/);
assert.match(draftExecutable, /RAISE EXCEPTION 'DRAFT_NOT_APPLIED/);
assert.doesNotMatch(draftExecutable, /^\s*(?:COMMIT|ROLLBACK)\s*;/im);
assert.doesNotMatch(draftExecutable, /\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b/i);
assert.doesNotMatch(preflightExecutable, /\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|GRANT|REVOKE|TRUNCATE)\b/i);
assert.match(contract, /complete_event_risk_v1[\s\S]*BLOCKED DESIGN GATE/);
assert.doesNotMatch(route, /claim_event_risk_v1|persist_event_risk_v1|complete_event_risk_v1/);

console.log("Review-package containment checks passed: migration guard, read-only preflight, no runtime claim activation.");
