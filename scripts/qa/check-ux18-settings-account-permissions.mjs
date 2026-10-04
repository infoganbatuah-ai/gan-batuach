import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");
const [ui, css, layout, profileApi, profileForm, preferencesApi, preferencesUi, security, garden, parent, staff, inspector, admin] = await Promise.all([
  read("components/settings-platform-ui.tsx"),
  read("app/styles/ux-implement-18.css"),
  read("app/layout.tsx"),
  read("app/api/profile/settings/route.ts"),
  read("components/profile-settings-form.tsx"),
  read("app/api/profile/communication-preferences/route.ts"),
  read("components/parent-notification-preferences.tsx"),
  read("app/dashboard/security-settings/page.tsx"),
  read("app/dashboard/garden/settings/page.tsx"),
  read("app/dashboard/parent/settings/page.tsx"),
  read("app/dashboard/staff/settings/page.tsx"),
  read("app/dashboard/inspector/settings/page.tsx"),
  read("app/dashboard/admin/settings/page.tsx")
]);

test("Settings keeps one role-aware canonical information architecture", () => {
  for (const label of ["פרופיל אישי", "אבטחה", "התראות", "הרשאות מצלמה", "אינטגרציות", "פרטיות"]) assert.match(ui, new RegExp(label));
  assert.match(ui, /roles: \["admin", "manager", "owner"\]/);
  assert.match(ui, /roles: \["manager", "owner"\]/);
  assert.doesNotMatch(ui, /createRole|new RBAC|settings_permissions/);
});

test("Every Settings entry remains server authorized", () => {
  assert.match(garden, /requireRole\(\["manager", "owner"\]\)/);
  assert.match(parent, /requireRole\(\["parent"\]\)/);
  assert.match(staff, /requireRole\(\["staff"\]\)/);
  assert.match(inspector, /requireRole\(\["inspector"\]\)/);
  assert.match(admin, /requireRole\(\["admin"\]\)/);
  assert.match(security, /requireUser\(\)/);
});

test("Garden mutation uses the verified active Garden context", () => {
  assert.match(profileApi, /getManagementGardenContext/);
  assert.match(profileApi, /managementContext\.gardenId/);
  const gardenBlock = profileApi.match(/if \(payload\.garden && managementContext\?\.allowed\)[\s\S]*?updatedGarden = data;/)?.[0] ?? "";
  assert.doesNotMatch(gardenBlock, /profile\.garden_id/);
  assert.doesNotMatch(gardenBlock, /profileClient|createAdminClient/);
  assert.match(gardenBlock, /supabase\.from\("gardens"/);
});

test("Verified Email activates normal accounts while phone remains optional", () => {
  for (const source of [garden, parent, staff, inspector, admin, security]) assert.match(source, /managementContactVerification/);
  assert.match(ui, /החשבון כשיר להפעלה רגילה/);
  assert.match(ui, /אימות טלפון אינו חובה/);
  assert.match(profileForm, /readOnly/);
});

test("Security shows only canonical MFA, Passkey, devices and sessions", () => {
  for (const table of ["mfa_enrollment_status", "passkey_credentials", "trusted_devices", "security_sessions", "security_events"]) assert.match(security, new RegExp(table));
  assert.match(security, /PasskeyEnrollmentPrompt/);
  assert.match(security, /לא נשמרים נתונים ביומטריים|אינו שומר נתונים ביומטריים/);
  assert.doesNotMatch(security, /access_token|refresh_token|service_role|api_key/);
});

test("Notification, quiet-hour, language and timezone settings reuse the canonical API", () => {
  for (const field of ["preferred_language", "quiet_hours_start", "quiet_hours_end", "quiet_hours_timezone"]) {
    assert.match(preferencesApi, new RegExp(field));
    assert.match(preferencesUi, new RegExp(field));
  }
  assert.match(preferencesUi, /managementDeliveryCapability|capability/);
  assert.match(preferencesUi, /אין ספק פעיל/);
});

test("Role boundaries and finance/camera separation remain explicit", () => {
  assert.match(garden, /בעלים־כגננת והאצלה נשמרים בנפרד/);
  assert.match(garden, /מנוי הגן נשאר נפרד מתשלומי הורים/);
  assert.match(parent, /אינו מנהל הגדרות גן/);
  assert.match(staff, /אין גישה כלל־גנית כברירת מחדל/);
  assert.match(inspector, /אין הנחת גישת Live/);
  assert.match(admin, /אינו מקבל דפדוף חופשי בתוכן פרטי/);
});

test("Desktop and Mobile Settings compositions are RTL and accessible", () => {
  for (const selector of ["ux18-settings-layout", "ux18-settings-navigation", "ux18-settings-section", "ux18-verification-grid", "ux18-security-grid"]) assert.match(css, new RegExp(`\\.${selector}`));
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /grid-template-columns:1fr/);
  assert.match(css, /focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(layout, /dir="rtl"/);
  assert.match(layout, /ux-implement-18\.css/);
  assert.match(ui, /aria-label="קטגוריות הגדרות"/);
  assert.match(profileForm, /aria-live="polite"/);
});

test("UX-18 adds no migration and does not touch Digital Observer core", () => {
  const base = process.env.GB_UX18_BASE_REF ?? "70d9a5aff9894086b2bc5c6ae4e0cc5815903b25";
  const changed = execFileSync("git", ["diff", "--name-only", base, "--"], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
  assert.deepEqual(changed.filter((path) => path.startsWith("supabase/migrations/")), []);
  const forbidden = changed.filter((path) => path.startsWith("lib/domain/digital-observer/") || path.startsWith("app/digital-observer/") || path.startsWith("components/digital-observer/") || path.startsWith("app/api/digital-observer/"));
  assert.deepEqual(forbidden, []);
});
