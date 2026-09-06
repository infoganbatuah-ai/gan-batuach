import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const criticalRoutes = [
  "app/api/digital-observer/incidents/route.ts",
  "app/api/digital-observer/incidents/feedback/route.ts",
  "app/api/digital-observer/investigation/route.ts",
  "app/api/digital-observer/watch-rules/route.ts",
  "app/api/digital-observer/events/review/route.ts",
  "app/api/digital-observer/event-clips/[id]/media/route.ts"
];

const api = readFileSync("lib/api.ts", "utf8");
const safeBoundary = api.slice(api.indexOf("export function handleSafeRouteError"));
assert.match(safeBoundary, /return fail\("הפעולה נכשלה בשרת\."\s*,\s*500\)/);
assert.doesNotMatch(safeBoundary, /error\.message|\+\s*message|stack/);

for (const route of criticalRoutes) {
  const source = readFileSync(route, "utf8");
  assert.match(source, /handleSafeRouteError/);
  assert.doesNotMatch(source, /\bhandleRouteError\b/);
}

console.log(JSON.stringify({
  status: "PASS",
  canonical_routes: criticalRoutes.length,
  raw_error_message_exposed: false,
  raw_stack_exposed: false
}, null, 2));
