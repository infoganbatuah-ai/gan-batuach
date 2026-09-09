import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ignore = readFileSync(".vercelignore", "utf8");
const cloudRoutes = [
  "app/api/digital-observer/admin/edge-releases/route.ts",
  "app/api/video-gateway/edge-updates/route.ts"
];

assert.match(ignore, /^services\/video-gateway\/\*$/m, "local Gateway runtime must remain excluded");
assert.match(ignore, /^!services\/video-gateway\/edge-update-contract\.mjs$/m, "pure cloud update verifier must be included");
assert.doesNotMatch(ignore, /^services\/video-gateway$/m, "parent exclusion prevents a safe child re-include");

for (const route of cloudRoutes) {
  const source = readFileSync(route, "utf8");
  assert.match(source, /services\/video-gateway\/edge-update-contract\.mjs/);
}

for (const forbidden of ["server.mjs", "journal-loop.mjs", "edge-secret-store-sync.mjs", "software-connector-cloud.mjs"]) {
  assert.doesNotMatch(ignore, new RegExp(`!services/video-gateway/${forbidden.replace(".", "\\.")}`));
}

console.log(JSON.stringify({ status: "PASS", vercel_package: {
  included: ["services/video-gateway/edge-update-contract.mjs"],
  excluded_runtime: "services/video-gateway/*",
  cloud_routes_checked: cloudRoutes.length,
  secrets_included: false
} }));
