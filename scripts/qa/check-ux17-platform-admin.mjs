import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");
const [shell, legacyShell, adminUi, css, layout, dashboard, gardens, gardenDetail, users, inspectorApprovals, subscriptions, complaints, providers, health, audit, reports, settings] = await Promise.all([
  read("components/role-app-shell.tsx"),
  read("components/dashboard-shell.tsx"),
  read("components/platform-admin-ui.tsx"),
  read("app/styles/ux-implement-17.css"),
  read("app/layout.tsx"),
  read("app/dashboard/admin/page.tsx"),
  read("app/dashboard/admin/kindergartens/page.tsx"),
  read("app/dashboard/admin/gardens/[id]/page.tsx"),
  read("app/dashboard/admin/users/page.tsx"),
  read("app/dashboard/admin/inspector-applications/page.tsx"),
  read("app/dashboard/admin/subscriptions/page.tsx"),
  read("app/dashboard/admin/complaints/page.tsx"),
  read("app/dashboard/admin/provider-production/page.tsx"),
  read("app/dashboard/admin/system-health/page.tsx"),
  read("app/dashboard/admin/audit-logs/page.tsx"),
  read("app/dashboard/admin/reports/page.tsx"),
  read("app/dashboard/admin/settings/page.tsx")
]);

const canonicalRoutes = [
  "/dashboard/admin",
  "/dashboard/admin/kindergartens",
  "/dashboard/admin/users",
  "/dashboard/admin/inspectors",
  "/dashboard/admin/kindergarten-applications",
  "/dashboard/admin/subscriptions",
  "/dashboard/admin/complaints",
  "/dashboard/admin/provider-production",
  "/dashboard/admin/system-health",
  "/dashboard/admin/audit-logs",
  "/dashboard/admin/reports",
  "/dashboard/admin/settings"
];

test("Admin exposes exactly the canonical 12-area information architecture", () => {
  const areaBlock = adminUi.match(/canonicalAdminAreas:[\s\S]*?\n\];/)?.[0] ?? "";
  assert.equal((areaBlock.match(/href: "\/dashboard\/admin/g) ?? []).length, 12);
  for (const route of canonicalRoutes) {
    assert.match(areaBlock, new RegExp(route.replaceAll("/", "\\/")));
    assert.match(shell, new RegExp(route.replaceAll("/", "\\/")));
  }
  const legacyAdminBlock = legacyShell.match(/const navByRole[\s\S]*?network_manager:/)?.[0] ?? "";
  assert.equal((legacyAdminBlock.match(/href: "\/dashboard\/admin/g) ?? []).length, 12);
  assert.doesNotMatch(legacyAdminBlock, /commercial-launch|observer-calibration|mobile-submission|scale-100/);
});

test("P0 Admin surfaces keep server-side authorization", () => {
  for (const source of [dashboard, gardens, gardenDetail, users, inspectorApprovals, subscriptions, complaints, providers, health, audit, reports, settings]) {
    assert.match(source, /requireRole\(\["admin"\]\)/);
  }
});

test("Garden and health views use aggregate operational data without broad private records", () => {
  assert.doesNotMatch(gardenDetail, /full_name, status, parent_completed|parents\)\.select\("id, full_name|medical_notes|allergies|emergency_phone|photo_urls|message_body/);
  assert.match(gardenDetail, /ספירה מצרפית בלבד/);
  assert.match(gardenDetail, /אינו פותח רשומות פרטיות/);
  assert.doesNotMatch(health, /from\("children"|medical_notes|allergies|emergency_phone|full_name/);
  assert.match(health, /אין הצגת מצב ירוק/);
});

test("Audit output redacts raw payload and direct network identifiers", () => {
  assert.match(audit, /metadataKeys/);
  assert.doesNotMatch(audit, /JSON\.stringify\(value/);
  assert.doesNotMatch(audit, /IP \{log\.(?:ip_address|ip)/);
  assert.match(audit, /ללא metadata בטוח להצגה/);
});

test("Inspector approval and assignment remain separate", () => {
  assert.match(inspectorApprovals, /אישור מועמדות אינו שיוך לגן/);
  assert.match(inspectorApprovals, /approved_pending_assignment/);
});

test("Platform subscription and provider states remain truthful", () => {
  assert.match(subscriptions, /מנוי גן → גן בטוח בלבד/);
  assert.match(subscriptions, /לא מוצגים כאן יתרות של ילדים/);
  assert.match(providers, /provider_not_verified/);
  assert.match(providers, /mock|sandbox/i);
  assert.match(providers, /נדרשת השלמת הגדרה מאובטחת בצד השרת/);
  assert.doesNotMatch(providers, /`Missing:|signing_secret_env|endpoint_path|card\.checklist\?\.notes|alert\.message|fallback_action/);
  assert.match(health, /Mock, Shadow ו־Sandbox אינם Production/);
});

test("Reports reuse the canonical reports center", () => {
  assert.match(reports, /<ReportsCenter role="admin"/);
  assert.doesNotMatch(reports, /new ReportingEngine|AdminReportingEngine/);
});

test("Desktop and Mobile compositions are RTL, accessible and responsive", () => {
  for (const selector of ["platform-admin-intro", "platform-admin-area-grid", "platform-admin-garden-card", "platform-admin-service-grid", "platform-admin-timeline"]) assert.match(css, new RegExp(`\\.${selector}`));
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /grid-template-columns: 1fr/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /focus-visible/);
  assert.match(layout, /dir="rtl"/);
  assert.match(layout, /ux-implement-17\.css/);
  assert.match(gardens, /role="search"/);
  assert.match(adminUi, /aria-label="12 אזורי הניהול הקנוניים"/);
});

test("Digital Observer core remains untouched by UX-17", () => {
  const base = process.env.GB_UX17_BASE_REF ?? "37f5313389f0814c186c1774f588685d004e2b82";
  const changed = execFileSync("git", ["diff", "--name-only", base, "--"], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
  const forbidden = changed.filter((path) => path.startsWith("lib/domain/digital-observer/") || path.startsWith("app/digital-observer/") || path.startsWith("components/digital-observer/") || path.startsWith("app/api/digital-observer/"));
  assert.deepEqual(forbidden, []);
});
