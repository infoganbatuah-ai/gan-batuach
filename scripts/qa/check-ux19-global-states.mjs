import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");
const permissionPages = [
  "app/dashboard/garden/staff/page.tsx",
  "app/dashboard/garden/finance/page.tsx",
  "app/dashboard/garden/subscription/page.tsx",
  "app/dashboard/garden/staff-time/page.tsx",
  "app/dashboard/garden/tuition-ledger/page.tsx"
];
const [system, errorState, dialog, status, views, designSystem, premium, loading, notFound, showcase, showcasePage, css, layout, ...permissionSources] = await Promise.all([
  read("components/global-state-system.tsx"),
  read("components/global-error-state.tsx"),
  read("components/accessible-confirm-dialog.tsx"),
  read("lib/ui/canonical-status.ts"),
  read("lib/ui/ux19-views.ts"),
  read("components/gan-batuach-design-system.tsx"),
  read("components/premium-dashboard.tsx"),
  read("app/loading.tsx"),
  read("app/not-found.tsx"),
  read("components/global-state-showcase.tsx"),
  read("app/ux19-system-states/page.tsx"),
  read("app/styles/ux-implement-19.css"),
  read("app/layout.tsx"),
  ...permissionPages.map(read)
]);

test("one canonical component family covers every global state without changing domain meaning", () => {
  for (const kind of ["loading", "empty", "error", "permission", "unavailable", "offline", "degraded", "success"]) assert.match(system, new RegExp(`\\b${kind}\\b`));
  for (const exported of ["GlobalStatePanel", "GlobalLoadingState", "GlobalEmptyState", "PermissionDeniedState", "ProviderState", "GlobalSuccessState", "CanonicalStatus"]) assert.match(system, new RegExp(`export function ${exported}`));
  assert.match(loading, /GlobalLoadingState/);
  assert.match(notFound, /GlobalEmptyState/);
  assert.match(designSystem, /GlobalStatePanel/);
  assert.match(premium, /GlobalStatePanel/);
});

test("expected failures use safe localized copy and preserve localized retry", () => {
  assert.match(errorState, /GlobalStatePanel/);
  assert.match(errorState, /ניסיון נוסף/);
  assert.doesNotMatch(errorState, /Supabase|Postgres|SQL|stack|relation|provider JSON|service.role/i);
  assert.match(system, /שאר|מידע|שירות|הרשאה/);
});

test("permission denial renders before protected domain queries", () => {
  permissionSources.forEach((source, index) => {
    assert.match(source, /if \(!access\.allowed\) return <PermissionDeniedState/);
    const denied = source.indexOf("if (!access.allowed)");
    const databaseRead = source.indexOf("createClient()", denied);
    assert.ok(databaseRead === -1 || denied < databaseRead, `${permissionPages[index]} must deny before data reads`);
  });
});

test("canonical status language includes the cross-product vocabulary", () => {
  for (const key of ["active", "pending", "verified", "unverified", "action_required", "blocked", "rejected", "expired", "completed", "overdue", "unavailable", "degraded", "offline", "stale", "retrying"]) assert.match(status, new RegExp(`${key}:`));
  assert.match(designSystem, /canonicalStatusLabel/);
  assert.match(premium, /canonicalStatusTone/);
  assert.match(system, /role="status"/);
});

test("forms have associated labels, descriptions and non-color-only validation", () => {
  assert.match(designSystem, /htmlFor=\{controlId\}/);
  assert.match(designSystem, /aria-invalid=\{Boolean\(error\)\}/);
  assert.match(designSystem, /aria-describedby=\{describedBy\}/);
  assert.match(designSystem, /role="alert"/);
  assert.match(css, /\.gb-form-field>em::before/);
});

test("destructive confirmation has focus entry, containment, escape and return focus", () => {
  for (const requirement of [/role="alertdialog"/, /aria-modal="true"/, /cancelRef\.current\?\.focus/, /event\.key === "Escape"/, /event\.key !== "Tab"/, /previous\?\.focus/]) assert.match(dialog, requirement);
  assert.match(dialog, /ux19-destructive-button/);
  assert.match(dialog, /consequence/);
});

test("responsive, RTL and accessibility closure is present in the last stylesheet", () => {
  assert.match(layout, /ux-implement-19\.css/);
  assert.ok(layout.lastIndexOf("ux-implement-19.css") > layout.lastIndexOf("ux-implement-18.css"));
  for (const requirement of [/:focus-visible/, /min-height:44px/, /@media\(max-width:820px\)/, /@media\(max-width:1100px\)/, /prefers-reduced-motion:reduce/, /prefers-contrast:more/, /unicode-bidi:isolate/, /overflow-x:clip/, /max-width:calc\(100vw - 24px\)/]) assert.match(css, requirement);
  assert.match(layout, /dir="rtl"/);
});

test("Development-only showcase covers every required Desktop and Mobile evidence concept", () => {
  const concepts = ["loading", "empty", "error", "permission-denied", "unavailable", "offline-degraded", "success", "destructive-confirmation", "validation", "status-variants", "calendar-date", "select-dropdown", "toggles", "search-filter", "settings", "modal-drawer", "mixed-direction", "accessibility"];
  for (const concept of concepts) assert.match(views, new RegExp(`"${concept}"`));
  assert.match(showcasePage, /process\.env\.NODE_ENV === "production"/);
  assert.match(showcasePage, /notFound\(\)/);
  assert.match(css, /ux19-showcase-mobile-nav/);
});

test("provider truth stays distinct and does not imply unavailable capability", () => {
  for (const value of ["unavailable", "not_configured", "setup_required", "production_verification_required", "offline", "degraded"]) assert.match(system, new RegExp(value));
  assert.match(system, /לא תוצג כפעילה לפני אימות/);
  assert.doesNotMatch(system, /LIVE|WhatsApp פעיל|SMS פעיל|Apple Pay|PayBox/);
});

test("UX-19 adds no migration and leaves Digital Observer core unchanged", () => {
  const base = process.env.GB_UX19_BASE_REF ?? "b527b8cbaea7e4c06619af60e4c530114f5519ba";
  const changed = execFileSync("git", ["diff", "--name-only", base, "--"], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
  assert.deepEqual(changed.filter((path) => path.startsWith("supabase/migrations/")), []);
  const forbidden = changed.filter((path) => path.startsWith("lib/domain/digital-observer/") || path.startsWith("app/digital-observer/") || path.startsWith("components/digital-observer/") || path.startsWith("app/api/digital-observer/"));
  assert.deepEqual(forbidden, []);
});
