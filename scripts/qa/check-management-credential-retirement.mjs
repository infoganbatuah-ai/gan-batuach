import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
const provisioning = read("lib/onboarding/user-provisioning.ts");
const users = read("app/api/admin/users/route.ts");
const approval = read("app/api/admin/kindergarten-approval/route.ts");
const migration = read("supabase/migrations/20260920170000_retire_generated_plaintext_credentials.sql");
const demoSeed = read("scripts/seed-demo-full.mjs");

assert.match(provisioning, /auth\.admin\.inviteUserByEmail\(email/);
assert.doesNotMatch(provisioning, /auth\.admin\.createUser\(|generateTemporaryPassword|temporary_password|generated_credentials"\)\.insert/);
assert.match(users, /auth\.resetPasswordForEmail\(/);
assert.doesNotMatch(users, /updateUserById\([^\n]+password|temporary_password|generated_credentials"\)\.insert/);
assert.doesNotMatch(approval, /temporary_password|generated_credentials"[^\n]*\.select|generated_credentials"[^\n]*\.insert/);
assert.match(migration, /drop column if exists temporary_password/);
assert.match(migration, /for select to authenticated/);
assert.doesNotMatch(demoSeed, /generated_credentials"\)\.insert|temporary_password/);
assert.match(demoSeed, /ALLOW_SYNTHETIC_QA_SEED/);

for (const file of [
  "app/dashboard/admin/users/page.tsx",
  "app/dashboard/garden/parents/page.tsx",
  "components/admin-users-management.tsx",
  "components/people-profile-cards.tsx",
  "components/admin-user-creation-wizards.tsx",
  "components/provisioning-forms.tsx",
  "components/garden-parent-leads-center.tsx",
  "app/api/admin/create-inspector/route.ts",
  "app/api/admin/create-garden-manager/route.ts",
  "app/api/garden/create-staff/route.ts",
  "app/api/garden/leads/[id]/convert/route.ts"
]) assert.doesNotMatch(read(file), /temporary_password/, `${file} still exposes a legacy credential`);

console.log("GB-M35 legacy credential retirement: PASS");
