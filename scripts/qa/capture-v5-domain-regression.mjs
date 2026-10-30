import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { config } from "../development/local-database.mjs";
import { localCredentials } from "../development/local-client.mjs";

const require = createRequire(import.meta.url);
const playwright = require(process.env.GB_M35_PLAYWRIGHT_MODULE ?? "/Users/danielderi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const sharp = require("sharp");
const chrome = process.env.GB_M35_CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const base = process.env.GB_V5_REGRESSION_BASE_URL ?? "http://127.0.0.1:3200";
const evidenceRoot = resolve(process.env.GB_V5_REGRESSION_OUTPUT ?? "qa-evidence/v5-domain-regression");
const screenshotRoot = resolve(evidenceRoot, "screenshots");

assert.equal(new URL(base).hostname, "127.0.0.1");
assert.equal(config.environment, "DEVELOPMENT / INTEGRATION");
assert.equal(config.productionAllowed, false);
assert.ok(existsSync(chrome));
assert.equal((await fetch(`${base}/api/health`)).status, 200);
mkdirSync(screenshotRoot, { recursive: true });

const keys = localCredentials();
assert.equal(keys.url, "http://127.0.0.1:55421");
const identities = JSON.parse(readFileSync(resolve(config.runtimeRoot, "qa-identities.private.json"), "utf8"));
const identity = (email) => {
  const user = identities.users.find((item) => item.email === email);
  assert.ok(user?.password, `Synthetic identity ${email} is required`);
  return user;
};

const admin = createSupabaseClient(keys.url, keys.service, { auth: { persistSession: false, autoRefreshToken: false } });
const unassigned = {
  id: "00000000-0000-4000-8000-000000000598",
  email: "v5-unassigned@integration.qa.invalid",
  password: `V5-${randomBytes(18).toString("base64url")}!`,
};

const existingUnassigned = await admin.auth.admin.getUserById(unassigned.id);
if (existingUnassigned.data.user) {
  const update = await admin.auth.admin.updateUserById(unassigned.id, {
    email: unassigned.email,
    password: unassigned.password,
    email_confirm: true,
    app_metadata: { role: "parent", environment: "DEVELOPMENT" },
    user_metadata: { full_name: "הורה ללא שיוך V5", environment: "DEVELOPMENT" },
  });
  assert.equal(update.error, null, update.error?.message);
} else {
  const create = await admin.auth.admin.createUser({
    id: unassigned.id,
    email: unassigned.email,
    password: unassigned.password,
    email_confirm: true,
    app_metadata: { role: "parent", environment: "DEVELOPMENT" },
    user_metadata: { full_name: "הורה ללא שיוך V5", environment: "DEVELOPMENT" },
  });
  assert.equal(create.error, null, create.error?.message);
}
const unassignedProfile = await admin.from("profiles").upsert({
  id: unassigned.id,
  email: unassigned.email,
  full_name: "הורה ללא שיוך V5",
  role: "parent",
  active: true,
  garden_id: null,
  must_change_password: false,
}, { onConflict: "id" });
assert.equal(unassignedProfile.error, null, unassignedProfile.error?.message);

const targets = [
  { id: "auth-registration", route: "/app/login", role: "Public / invited user", reference: "GB_UX_REF_AUTH_MASTER.png" },
  { id: "owner-onboarding", route: "/onboarding/kindergarten?new=1", email: "owner-ab@integration.qa.invalid", role: "Owner / Manager", reference: "GB_UX_REF_OWNER_ONBOARDING.png" },
  { id: "children-classrooms", route: "/dashboard/garden/children", email: "owner-ab@integration.qa.invalid", role: "Owner / Manager", reference: "GB_UX_REF_CHILDREN_CLASSROOMS_PROFILE_ENROLLMENT.png" },
  { id: "parent-unassigned", route: "/dashboard/parent", user: unassigned, role: "Unassigned Parent", reference: "GB_UX_REF_PARENT_FULL_PLATFORM.png" },
  { id: "attendance-pickup", route: "/dashboard/garden/attendance", email: "owner-a@integration.qa.invalid", role: "Owner / Staff / Parent", reference: "GB_UX_REF_ATTENDANCE_PICKUP_OPERATIONS.png" },
  { id: "staff-full-platform", route: "/dashboard/staff", email: "staff-a@integration.qa.invalid", role: "Staff / Owner", reference: "GB_UX_REF_STAFF_FULL_PLATFORM.png" },
  { id: "candidate-recruitment", route: "/dashboard/staff/job-market", email: "staff-candidate@integration.qa.invalid", role: "Candidate / Owner", reference: "GB_UX_REF_STAFF_CANDIDATE_RECRUITMENT.png" },
  { id: "inspector", route: "/dashboard/inspector", email: "inspector-a@integration.qa.invalid", role: "Inspector / Owner", reference: "GB_UX_REF_INSPECTOR_FULL_PLATFORM.png" },
  { id: "finance", route: "/dashboard/garden/finance", email: "owner-a@integration.qa.invalid", role: "Owner / Parent / Admin", reference: "GB_UX_REF_FINANCE_FULL_PLATFORM.png" },
  { id: "messaging-notifications", route: "/dashboard/garden/messages", email: "owner-a@integration.qa.invalid", role: "Owner / Parent / Staff / Inspector", reference: "GB_UX_REF_FULL_PRODUCT_VISUAL_REGRESSION.png" },
  { id: "documents", route: "/dashboard/garden/documents", email: "owner-a@integration.qa.invalid", role: "Owner / Parent / Staff / Inspector / Admin", reference: "GB_UX_REF_DOCUMENTS_FULL_PLATFORM.png" },
  { id: "tasks-complaints-corrective-actions", route: "/dashboard/garden/tasks", email: "owner-a@integration.qa.invalid", role: "Owner / Staff / Parent / Inspector / Admin", reference: "GB_UX_REF_TASKS_COMPLAINTS_CORRECTIVE_ACTIONS.png" },
  { id: "inspections", route: "/dashboard/inspector", email: "inspector-a@integration.qa.invalid", role: "Inspector / Owner", reference: "GB_UX_REF_INSPECTOR_FULL_PLATFORM.png" },
  { id: "reports-analytics", route: "/dashboard/garden/reports", email: "owner-a@integration.qa.invalid", role: "Owner / Staff / Inspector / Admin", reference: "GB_UX_REF_REPORTS_ANALYTICS_FULL_PLATFORM.png" },
  { id: "safety-cameras", route: "/dashboard/garden/cameras", email: "owner-a@integration.qa.invalid", role: "Owner / Parent / Staff / Inspector", reference: "GB_UX_REF_SAFETY_CAMERAS_FULL_PLATFORM.png" },
  { id: "global-states-rtl-accessibility", route: "/ux19-system-states?view=loading", role: "All roles", reference: "GB_UX_REF_GLOBAL_STATES_RTL_ACCESSIBILITY_RESPONSIVE.png" },
];

const viewports = [
  { label: "desktop", width: 1440, height: 1024 },
  { label: "mobile", width: 390, height: 844 },
];

async function cookiesFor(user) {
  const jar = new Map();
  const client = createServerClient(keys.url, keys.anon, {
    cookieOptions: { path: "/", sameSite: "lax", secure: false },
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (changes) => changes.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const login = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  assert.equal(login.error, null, login.error?.message);
  return [...jar].map(([name, value]) => ({ name, value, url: base }));
}

const captures = [];
const browser = await playwright.chromium.launch({ headless: true, executablePath: chrome });
try {
  for (const target of targets) {
    const user = target.user ?? (target.email ? identity(target.email) : null);
    const context = await browser.newContext({ viewport: viewports[0], locale: "he-IL", reducedMotion: "reduce" });
    if (user) await context.addCookies(await cookiesFor(user));
    for (const viewport of viewports) {
      const page = await context.newPage();
      await page.setViewportSize(viewport);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("response", (response) => {
        if (response.url().startsWith(base) && response.status() >= 500) errors.push(`${response.status()} ${new URL(response.url()).pathname}`);
      });
      const response = await page.goto(`${base}${target.route}`, { waitUntil: "domcontentloaded", timeout: 180_000 });
      assert.equal(response?.status(), 200, `${target.id} ${target.route}`);
      if (user) assert.doesNotMatch(page.url(), /\/app\/login|\/login$/);
      await page.locator("main, .role-app-shell, .app-shell, body").first().waitFor({ state: "visible", timeout: 120_000 });
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForTimeout(850);
      const overflow = await page.evaluate(() => ({ detected: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
      assert.equal(overflow.detected, false, `${target.id} ${viewport.label} overflow: ${JSON.stringify(overflow)}`);
      assert.deepEqual(errors, [], `${target.id} ${viewport.label}: ${errors.join(" | ")}`);
      const body = await page.locator("body").innerText();
      assert.doesNotMatch(body, /Application error|Internal Server Error|Unhandled Runtime Error|SUPABASE_SERVICE_ROLE_KEY|access_token|refresh_token|rtsp:\/\//i);
      const png = await page.screenshot({ fullPage: false, animations: "disabled" });
      const file = resolve(screenshotRoot, `${target.id}-${viewport.label}.webp`);
      await sharp(png).webp({ quality: 93, effort: 5 }).toFile(file);
      captures.push({
        id: target.id,
        route: target.route,
        role: target.role,
        reference: target.reference,
        viewport: `${viewport.width}x${viewport.height}`,
        file: file.replace(`${process.cwd()}/`, ""),
        status: "REFERENCE_MATCH_CANDIDATE",
      });
      await page.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
  await admin.from("profiles").delete().eq("id", unassigned.id);
  await admin.auth.admin.deleteUser(unassigned.id);
}

const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
writeFileSync(resolve(evidenceRoot, "capture-results.json"), `${JSON.stringify({
  environment: config.environment,
  productionAccess: false,
  sourceSha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  capturedAt: new Date().toISOString(),
  viewports,
  captures: captures.map((item) => ({ ...item, sha256: sha256(resolve(item.file)) })),
  status: "PASS",
}, null, 2)}\n`);
console.log(`V5 regression capture PASS: ${captures.length} fresh screenshots`);
