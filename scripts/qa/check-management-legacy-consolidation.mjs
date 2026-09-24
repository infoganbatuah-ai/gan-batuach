import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (file) => readFileSync(file, "utf8");

const redirects = [
  ["app/dashboard/garden/inspection-status/page.tsx", "/dashboard/garden/inspections"],
  ["app/dashboard/garden/pickup-face/page.tsx", "/dashboard/garden/pickup"],
  ["app/dashboard/parent/trust/page.tsx", "/dashboard/parent/trust-center"]
];

test("legacy bookmarks redirect to fixed canonical routes without forwarding identifiers", () => {
  for (const [file, destination] of redirects) {
    const source = read(file);
    assert.match(source, /permanentRedirect/);
    assert.ok(source.includes(`permanentRedirect(\"${destination}\")`));
    assert.doesNotMatch(source, /searchParams|params|gardenId|childId|staffId/);
  }
});

test("canonical navigation does not link to retired user-facing routes", () => {
  const navigation = [
    read("components/dashboard-shell.tsx"),
    read("components/teacher-app-ui.tsx"),
    read("components/parent-app-ui.tsx"),
    read("components/staff-app-ui.tsx"),
    read("components/inspector-app-ui.tsx"),
    read("components/admin-app-ui.tsx")
  ].join("\n");
  for (const route of [
    "/dashboard/garden/inspection-status",
    "/dashboard/garden/pickup-face",
    "/dashboard/parent/trust"
  ]) assert.ok(!navigation.includes(`href: \"${route}\"`) && !navigation.includes(`href=\"${route}\"`), route);
});

test("the disconnected legacy dashboard UI is removed while the CI compatibility endpoint stays guarded", () => {
  assert.equal(existsSync("components/dashboard-command-center.tsx"), false);
  const compatibility = read("app/api/dashboard/interaction-summary/route.ts");
  assert.match(compatibility, /getOperationalRoleContext/);
});

test("canonical pickup and attendance APIs preserve server-side authorization", () => {
  const pickup = read("app/api/garden/pickup-events/route.ts");
  const attendance = read("app/api/garden/attendance-action/route.ts");
  assert.match(pickup, /requireOperationalRole|getOperationalRoleContext/);
  assert.match(pickup, /authorization|authorized|pickup/i);
  assert.match(attendance, /requireOperationalRole|getOperationalRoleContext/);
  assert.doesNotMatch(`${pickup}\n${attendance}`, /face[_ -]?match.*(?:release|depart)/i);
});

test("canonical relationship helpers remain the authorization boundary", () => {
  const operationalRole = read("lib/management/operational-role.ts");
  const parentFamily = read("lib/domain/parent-family.ts");
  assert.match(operationalRole, /can_staff_access_garden|staff_kindergarten_employments/);
  assert.match(operationalRole, /current_inspector_approved|inspector/);
  assert.match(parentFamily, /parent_child_relationships|guardian/i);
});

test("active account verification does not require phone for normal use", () => {
  const policy = read("lib/management/contact-verification.ts");
  assert.match(policy, /email_verified/i);
  assert.match(policy, /verified_phone|phone_verified/i);
  assert.doesNotMatch(policy, /email_verified\s*&&\s*(?:verified_phone|phone_verified)/i);
});

test("legacy credential responses are absent from active Management routes", () => {
  const files = [
    "app/api/admin/create-garden-manager/route.ts",
    "app/api/admin/create-inspector/route.ts",
    "app/api/garden/create-parent/route.ts",
    "app/api/garden/create-staff/route.ts",
    "app/api/garden/parent-invitations/route.ts",
    "app/api/garden/staff-invitations/route.ts"
  ];
  for (const file of files) {
    const source = read(file);
    assert.doesNotMatch(source, /temporary_password|plain(?:text)?_password/i, file);
    assert.doesNotMatch(source, /generated_credentials[^\n]*\.(?:insert|update|upsert)/i, file);
    assert.doesNotMatch(source, /password\s*:\s*(?:password|generated|temporary)/i, file);
  }
  const provisioning = read("lib/onboarding/user-provisioning.ts");
  assert.match(provisioning, /inviteUserByEmail/);
  assert.doesNotMatch(provisioning, /auth\.admin\.createUser|temporary_password|plain(?:text)?_password/i);
});

test("legacy payment webhooks cannot bypass canonical verified-provider handling", () => {
  for (const file of [
    "app/api/webhooks/payment/route.ts",
    "app/api/webhooks/payments/route.ts",
    "app/api/webhooks/invoice/route.ts",
    "app/api/webhooks/invoices/route.ts"
  ]) {
    const source = read(file);
    assert.match(source, /handleProviderWebhook|export \{ POST \}/, file);
    assert.doesNotMatch(source, /\.update\([^)]*(?:paid|active)/is, file);
  }
  const handler = read("lib/domain/provider-webhooks.ts");
  assert.match(handler, /verifyLegacyHmacSignature/);
  assert.match(handler, /side_effects_applied:\s*false/);
  assert.doesNotMatch(handler, /from\([^)]*(?:tuition|subscription)[^)]*\)\.update/is);
});
