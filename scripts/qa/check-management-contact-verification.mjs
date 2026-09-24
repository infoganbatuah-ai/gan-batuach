import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";

function source(file) { return readFileSync(file, "utf8"); }
function load(file) {
  const output = ts.transpileModule(source(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const loadedModule = { exports: {} };
  vm.runInNewContext(output, { exports: loadedModule.exports, module: loadedModule, require: id => { throw new Error(`Unmocked dependency: ${id}`); } }, { filename: file });
  return loadedModule.exports;
}

const contact = load("lib/management/contact-verification.ts");

test("Supabase signup preserves an unconfirmed user returned at the top level", async () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const client = createClient("http://127.0.0.1:54321", "synthetic-qa-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (url) => {
        assert.equal(new URL(url).pathname, "/auth/v1/signup");
        return new Response(JSON.stringify({ id, email: "qa@integration.invalid", identities: [{ id }], confirmation_sent_at: "2026-09-20T00:00:00Z" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
    }
  });
  const { data, error } = await client.auth.signUp({ email: "qa@integration.invalid", password: "synthetic-password" });
  assert.equal(error, null);
  assert.equal(data.user?.id, id);
  assert.equal(data.session, null);
});

test("email verification activates enrolled accounts while phone-specific actions still require confirmed phone", () => {
  assert.equal(contact.managementContactVerification({ app_metadata: {} }, {}).complete, true);
  const base = { app_metadata: { contact_verification_required: true } };
  assert.equal(contact.managementContactVerification(base, {}).complete, false);
  assert.equal(contact.managementContactVerification({ ...base, email_confirmed_at: "now" }, {}).complete, true);
  assert.equal(contact.managementContactVerification({ ...base, email_confirmed_at: "now", phone_confirmed_at: "now" }, {}).complete, true);
  assert.deepEqual(Array.from(contact.evaluateAccountVerification({ ...base, email_confirmed_at: "now" }, "verified_phone_action", {}).blockers), ["phone_verification_required"]);
  assert.equal(contact.evaluateAccountVerification({ ...base, email_confirmed_at: "now", phone_confirmed_at: "now" }, "verified_phone_action", {}).allowed, true);
  assert.deepEqual(Array.from(contact.evaluateAccountVerification({ ...base, email_confirmed_at: "now", phone_confirmed_at: "now" }, "high_assurance_action", {}).blockers), ["mfa_or_reauthentication_required"]);
});

test("Israeli mobile normalization accepts supported formats and rejects ambiguous values", () => {
  assert.equal(contact.normalizeIsraeliMobile("050-123-4567"), "+972501234567");
  assert.equal(contact.normalizeIsraeliMobile("+972 50 123 4567"), "+972501234567");
  assert.equal(contact.normalizeIsraeliMobile("9720501234567"), "+972501234567");
  assert.equal(contact.normalizeIsraeliMobile("03-1234567"), null);
  assert.equal(contact.normalizeIsraeliMobile("1234"), null);
});

test("verification status masks contact values", () => {
  assert.equal(contact.maskContact("parent@example.com"), "p***@example.com");
  assert.equal(contact.maskContact("+972501234567"), "+972***67");
});

test("self-service registration uses confirmation signup and enrolls only new accounts", () => {
  const registration = source("app/api/self-service/register/route.ts");
  assert.match(registration, /auth\.signUp\(/);
  assert.match(registration, /emailRedirectTo:/);
  assert.doesNotMatch(registration, /admin\.createUser\(/);
  assert.match(registration, /contact_verification_required: true/);
  assert.match(registration, /next_path: payload\.invitation_token[\s\S]+"\/app\/verify-contact"/);
});

test("email resend is non-enumerating and phone confirmation uses phone-change OTP", () => {
  const email = source("app/api/auth/verification/email/resend/route.ts");
  assert.match(email, /auth\.resend\(/);
  assert.match(email, /type: "signup"/);
  assert.match(email, /return ok\(\{ accepted: true \}\)/);
  assert.doesNotMatch(email, /return fail\([^\n]+error/);
  const phone = source("app/api/auth/verification/phone/confirm/route.ts");
  assert.match(phone, /type: "phone_change"/);
  assert.match(phone, /phone_confirmed_at/);
});

test("password recovery keeps account enumeration closed and consumes the recovery session", () => {
  const request = source("app/forgot-password/actions.ts");
  assert.match(request, /resetPasswordForEmail\(/);
  assert.match(request, /redirect\("\/forgot-password\?sent=1"\)/);
  assert.doesNotMatch(request, /redirect\([^\n]+error\.message/);
  const update = source("components/auth/password-update-form.tsx");
  assert.match(update, /auth\.updateUser\(\{ password \}\)/);
  assert.match(update, /auth\.signOut\(\{ scope: "local" \}\)/);
});

test("activation surfaces fail closed on incomplete contact verification", () => {
  const managementGardenContext = source("lib/management/garden-context.ts");
  assert.match(managementGardenContext, /managementContactVerification/);
  for (const file of [
    "app/api/kindergarten-onboarding/route.ts",
    "app/api/parent/enrollment-requests/route.ts",
    "app/api/garden/staff-applications/[id]/route.ts",
    "app/api/garden/staff/[id]/approve/route.ts",
    "app/api/admin/inspector-applications/[id]/route.ts",
    "lib/domain/enrollment-activation.ts"
  ]) {
    const route = source(file);
    if (file.includes("inspector-applications")) {
      assert.match(route, /decide_inspector_application/, `${file}: missing atomic Inspector approval`);
      assert.match(source("supabase/migrations/20260913020000_management_inspector_approval.sql"), /inspector_contact_unverified/, "Inspector approval RPC must check contact verification");
    } else {
      assert.match(route, /(managementContactVerification|adminManagementContactVerification|getManagementGardenContext)/, `${file}: missing contact verification gate`);
    }
  }
});

test("migration synchronizes Auth truth and does not enroll legacy accounts", () => {
  const migration = source("supabase/migrations/20260908020000_management_contact_verification.sql");
  assert.match(migration, /contact_verification_required boolean not null default false/);
  assert.match(migration, /after update of email_confirmed_at, phone_confirmed_at on auth\.users/);
  assert.match(migration, /revoke all on function public\.sync_management_contact_verification\(\)/);
  assert.doesNotMatch(migration, /set contact_verification_required = true/);
});
