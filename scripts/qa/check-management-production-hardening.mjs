import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = async (path) => readFile(path, "utf8");

const publicMutations = [
  "app/api/self-service/register/route.ts",
  "app/api/auth/verification/email/resend/route.ts",
  "app/api/public/validate-contact/route.ts"
];
for (const path of publicMutations) {
  const body = await source(path);
  assert.match(body, /assertTrustedMutationOrigin\(request\)/, `${path} must reject cross-origin mutations`);
  assert.match(body, /assertRateLimit\(/, `${path} must use the canonical database-backed rate limiter`);
  assert.match(body, /parseBoundedJson\(/, `${path} must cap request bodies`);
}

for (const path of ["app/api/invitations/resolve/route.ts", "app/api/invitations/claim/route.ts"]) {
  assert.match(await source(path), /assertRateLimit\(/, `${path} must rate-limit invitation token probing`);
}

const internalTools = [
  "app/api/admin/demo-control/route.ts",
  "app/api/admin/communications/test/route.ts",
  "app/api/admin/email-production/test/route.ts",
  "app/api/admin/integrations/test/route.ts",
  "app/api/debug/parent-camera-access/route.ts"
];
for (const path of internalTools) {
  assert.match(await source(path), /assertManagementInternalToolAccess\(\)/, `${path} must fail closed in Production`);
}

for (const path of [
  "app/api/passkeys/authenticate/options/route.ts",
  "app/api/passkeys/authenticate/verify/route.ts",
  "app/api/passkeys/register/options/route.ts",
  "app/api/passkeys/register/verify/route.ts"
]) {
  const body = await source(path);
  assert.match(body, /assertTrustedMutationOrigin\(request\)/, `${path} must reject cross-origin mutations`);
  assert.match(body, /assertRateLimit\(/, `${path} must use the canonical database-backed rate limiter`);
  assert.match(body, /handleSafeRouteError\(error\)/, `${path} must preserve safe security responses`);
}

const passkeys = await source("lib/passkeys.ts");
assert.match(passkeys, /PASSKEY_PRODUCTION_CONTEXT_NOT_CONFIGURED/);
assert.match(passkeys, /PASSKEY_PRODUCTION_ORIGIN_MUST_USE_HTTPS/);

const guard = await source("lib/security/management-production-guards.ts");
assert.match(guard, /APP_ENV === "production"/);
assert.match(guard, /VERCEL_ENV === "production"/);
assert.match(guard, /SafeHttpError\("INTERNAL_TOOL_UNAVAILABLE", 404\)/);

const api = await source("lib/api.ts");
assert.match(api, /handleRouteError[\s\S]*error instanceof SafeHttpError/, "standard route handler must preserve security response statuses");
assert.match(api, /isProduction[\s\S]*errorType[\s\S]*errorCode[\s\S]*return fail\("הפעולה נכשלה בשרת\."/, "Production errors must not expose internal exception text");

console.log(JSON.stringify({
  status: "PASS",
  public_mutations_hardened: publicMutations.length,
  invitation_routes_rate_limited: 2,
  production_blocked_internal_tools: internalTools.length
}, null, 2));
