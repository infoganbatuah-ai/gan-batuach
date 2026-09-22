import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const canonicalOrigin = "https://ganbatuach.com";
const retiredAlias = ["gan-batuach", "vercel", "app"].join(".");
const roots = ["app", "components", "lib", "services", "scripts"];
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".yml", ".yaml"]);

function filesUnder(root) {
  const files = [];
  for (const entry of readdirSync(root)) {
    const item = path.join(root, entry);
    if (statSync(item).isDirectory()) files.push(...filesUnder(item));
    else if (sourceExtensions.has(path.extname(item))) files.push(item);
  }
  return files;
}

const authFlow = readFileSync("lib/domain/auth-flow.ts", "utf8");
assert.match(authFlow, /CANONICAL_APP_ORIGIN = "https:\/\/ganbatuach\.com"/);
assert.match(authFlow, /process\.env\.NODE_ENV === "production"/);
assert.doesNotMatch(authFlow, /VERCEL_(?:PROJECT_PRODUCTION_)?URL/);

const proxy = readFileSync("proxy.ts", "utf8");
assert.ok(proxy.includes(canonicalOrigin));
assert.match(proxy, /host\.endsWith\("\.vercel\.app"\)/);
assert.match(proxy, /NextResponse\.redirect\(destination, 308\)/);
assert.ok(proxy.indexOf("canonicalPublicRedirect(request)") < proxy.indexOf("updateSession(request)"));

const staleRuntimeFiles = roots
  .flatMap(filesUnder)
  .filter((file) => file !== "scripts/qa/check-canonical-public-origin.mjs")
  .filter((file) => readFileSync(file, "utf8").includes(retiredAlias));
assert.deepEqual(staleRuntimeFiles, [], `retired deployment alias remains in runtime/tooling: ${staleRuntimeFiles.join(", ")}`);

for (const file of [
  "app/forgot-password/actions.ts",
  "app/digital-observer/auth-actions.ts",
  "app/api/auth/verification/email/resend/route.ts",
  "app/api/self-service/register/route.ts",
  "app/api/admin/users/route.ts",
  "app/api/admin/kindergarten-approval/route.ts",
  "lib/onboarding/user-provisioning.ts"
]) {
  assert.match(readFileSync(file, "utf8"), /authCallbackUrl\(/, `${file} must use the canonical authentication callback builder`);
}

console.log("Canonical public origin QA PASS: authentication, page paths, gateway defaults and deployment aliases converge on ganbatuach.com.");
