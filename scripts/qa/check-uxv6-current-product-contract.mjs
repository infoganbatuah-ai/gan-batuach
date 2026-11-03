import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

function ordered(source, labels) {
  let offset = 0;
  for (const label of labels) {
    const at = source.indexOf(label, offset);
    assert.notEqual(at, -1, `Missing or reordered primary-screen region: ${label}`);
    offset = at + label.length;
  }
}

test("Owner primary route keeps its visual working areas together", () => {
  const page = read("components/manager-overview-dashboard.tsx");
  ordered(page, [
    'className="manager-command-hero"',
    'className="manager-today-strip"',
    'className="manager-reference-first-viewport"',
    'className="manager-reference-quick',
    'className="manager-command-grid manager-command-grid-primary"',
    'className="manager-command-grid manager-finance-communication-grid"',
  ]);
  assert.match(page, /מצלמות הגן/);
  assert.doesNotMatch(page, /מצלמות בשידור חי/);
});

test("Admin primary route retains its control center in one guarded screen", () => {
  const page = read("app/dashboard/admin/page.tsx");
  assert.match(page, /requireRole\(\["admin"\]\)/);
  ordered(page, [
    'className="admin-literal-dashboard"',
    'className="admin-literal-kpis"',
    'className="admin-literal-upper-grid',
    'className="admin-literal-line-chart"',
    'className="admin-literal-grouped-bars"',
    'className="admin-literal-health"',
    'className="admin-literal-activity"',
    'className="admin-literal-lower-grid"',
  ]);
  for (const heading of ["גנים חדשים להמשך טיפול", "תלונות פתוחות", "מנויים ותשלומים"]) {
    assert.ok(page.includes(heading), `Admin primary route is missing ${heading}`);
  }
});

test("Settings primary route contains all three workspace columns and guarded editing", () => {
  const page = read("app/dashboard/garden/settings/page.tsx");
  ordered(page, [
    "<SettingsPlatformLayout",
    'className="ux18-reference-column ux18-reference-profile-column"',
    "<SettingsPrimaryProfileForm",
    'className="ux18-reference-column ux18-reference-security-column"',
    'className="ux18-reference-column ux18-reference-garden-column"',
  ]);
  assert.match(page, /resolveManagementGardenContext/);
  assert.match(page, /\.eq\("garden_id", gardenId\)/);
  assert.match(page, /<ProfileSettingsForm[^>]*requireProfilePhoto requireGardenLogo/);
  const form = read("components/settings-primary-profile-form.tsx");
  assert.match(form, /fetch\("\/api\/profile\/settings"/);
  assert.match(form, /if \(!photo\)/);
  assert.match(form, /role=\{messageKind === "error" \? "alert" : "status"\}/);
  assert.doesNotMatch(form, /body: JSON\.stringify\(\{[^}]*email:/s);
});

test("Parent primary route shows an authorized visual selector and selected-Child areas", () => {
  const page = read("app/dashboard/parent/page.tsx");
  assert.match(page, /requireRole\(\["parent"\]\)/);
  assert.match(page, /getParentFamilyContext\(supabase as any, profile\)/);
  assert.match(page, /selectAuthorizedChild\(childContexts, requestedChildId\)/);
  ordered(page, [
    'className="parent-child-selector parent-child-card-selector"',
    'className="parent-child-selector-track"',
    "<ParentChildContextCard",
    "<ParentChildCard",
    'className="parent-primary-reference-grid"',
    'className="parent-primary-reference-actions"',
  ]);
  assert.match(page, /parent-dashboard-multi-child/);
  assert.match(page, /\.eq\("child_id", selectedChildId\)/);
  assert.match(page, /לא מוצג שידור חי לא מאומת/);
});

test("Desktop primary geometry has route-scoped composition with separate mobile rules", () => {
  const css = read("app/styles/ux-v6-true-reference-correction.css");
  assert.match(css, /@media \(min-width: 1025px\)/);
  assert.match(css, /@media \(max-width: 650px\)/);
  for (const selector of [
    ".manager-reference-dashboard",
    ".parent-dashboard-home.parent-dashboard-multi-child",
    ".admin-literal-dashboard",
    ".ux18-settings-layout",
  ]) assert.ok(css.includes(selector), `Missing scoped geometry for ${selector}`);
});
