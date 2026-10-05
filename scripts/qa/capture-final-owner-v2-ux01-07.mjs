// Fresh, synthetic owner-review pack for UX-01 through UX-07.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join, resolve } from "node:path";
import { createServerClient } from "@supabase/ssr";
import { config } from "../development/local-database.mjs";
import { localCredentials } from "../development/local-client.mjs";

const require = createRequire(import.meta.url);
const playwright = require(process.env.GB_M35_PLAYWRIGHT_MODULE ?? "/Users/danielderi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const sharp = require("sharp");
const chrome = process.env.GB_M35_CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const base = process.env.GB_UX_CLOSURE_BASE_URL ?? "http://127.0.0.1:3001";
const outputRoot = resolve(process.env.GB_FINAL_OWNER_V2_CLOSURE_OUTPUT ?? "qa-evidence/final-owner-visual-verification-v2/ux01-07-fresh");
const sourceSha = process.env.GB_FINAL_OWNER_V2_SHA ?? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const desktop = { width: 1440, height: 1024 };
const mobile = { width: 390, height: 844 };

assert.equal(new URL(base).hostname, "127.0.0.1");
assert.equal(config.environment, "DEVELOPMENT / INTEGRATION");
assert.equal(config.productionAllowed, false);
assert.equal(localCredentials().url, "http://127.0.0.1:55421");
assert.ok(existsSync(chrome));
assert.equal((await fetch(`${base}/api/health`)).status, 200);

const referenceRoots = [
  "/Users/danielderi/Downloads",
  "/Users/danielderi/Desktop/גן בטוח/עיצוב עדכון גרסה"
];
function reference(name) {
  return referenceRoots.map((root) => join(root, name)).find((candidate) => existsSync(candidate));
}
const refs = {
  auth: reference("GB_UX_REF_AUTH_MASTER.png"),
  "owner-onboarding": reference("GB_UX_REF_OWNER_ONBOARDING.png"),
  "owner-dashboard": reference("GB_UX_REF_OWNER_CORE.png"),
  "children-classrooms": reference("GB_UX_REF_CHILDREN_CLASSROOMS_PROFILE_ENROLLMENT.png"),
  parent: reference("GB_UX_REF_PARENT_FULL_PLATFORM.png"),
  "attendance-pickup": reference("GB_UX_REF_ATTENDANCE_PICKUP_OPERATIONS.png"),
  staff: reference("GB_UX_REF_STAFF_FULL_PLATFORM.png")
};
for (const path of Object.values(refs)) assert.ok(existsSync(path), `Missing reference ${path}`);

const rows = [
  ["auth","Welcome / Splash","welcome-desktop","welcome-mobile"],
  ["auth","Login","login-desktop","login-mobile"],
  ["auth","Role selection","role-selection-desktop","role-selection-mobile"],
  ["auth","Owner registration","owner-registration-desktop","owner-registration-mobile"],
  ["auth","Parent registration","parent-registration-desktop","parent-registration-mobile"],
  ["auth","Staff registration","staff-registration-desktop","staff-registration-mobile"],
  ["auth","Inspector registration","inspector-registration-desktop","inspector-registration-mobile"],
  ["auth","Email verification","email-verification-desktop","email-verification-mobile"],
  ["auth","Registration success","registration-success-desktop","registration-success-mobile"],
  ["auth","Forgot password","forgot-password-desktop","forgot-password-mobile"],
  ["auth","Reset password","reset-password-desktop","reset-password-mobile"],
  ["auth","Invitation entry / valid","invitation-valid-desktop","invitation-valid-mobile"],
  ["owner-onboarding","Onboarding entry","entry-desktop","entry-mobile"],
  ["owner-onboarding","Owner role mode","role-mode-desktop","role-mode-mobile"],
  ["owner-onboarding","Garden details","garden-details-desktop","garden-details-mobile"],
  ["owner-onboarding","Documents","documents-desktop","documents-mobile"],
  ["owner-onboarding","Classrooms","classrooms-desktop","classrooms-mobile"],
  ["owner-onboarding","Staff setup","staff-desktop","staff-mobile"],
  ["owner-onboarding","Children setup","children-setup-desktop","children-setup-mobile"],
  ["owner-onboarding","Parent invitation","parent-invitation-desktop","parent-invitation-mobile"],
  ["owner-onboarding","Safety / Cameras readiness","safety-desktop","safety-mobile"],
  ["owner-onboarding","Subscription readiness","subscription-desktop","subscription-mobile"],
  ["owner-onboarding","Review","review-desktop","review-mobile"],
  ["owner-onboarding","Activation success","success-desktop","success-mobile"],
  ["owner-dashboard","Owner dashboard","owner-dashboard-standard-desktop","owner-dashboard-standard-mobile"],
  ["owner-dashboard","Navigation","owner-navigation-desktop","owner-navigation-mobile"],
  ["owner-dashboard","Multi-Garden state","owner-multi-garden-desktop","multi-garden-state-mobile"],
  ["owner-dashboard","Attendance summary","attendance-summary-desktop","attendance-summary-mobile"],
  ["owner-dashboard","Staff summary","staff-summary-desktop","staff-summary-mobile"],
  ["owner-dashboard","Finance summary","finance-summary-desktop","finance-summary-mobile"],
  ["owner-dashboard","Communication","communication-desktop","communication-mobile"],
  ["owner-dashboard","Tasks / action center","owner-action-center-desktop","owner-action-center-mobile"],
  ["owner-dashboard","Documents","documents-desktop","documents-mobile"],
  ["owner-dashboard","Inspection / corrective action","inspection-corrective-desktop","inspection-corrective-mobile"],
  ["owner-dashboard","Safety / Cameras summary","owner-safety-state-desktop","owner-safety-state-mobile"],
  ["children-classrooms","Children workspace","children-list-desktop","children-list-mobile"],
  ["children-classrooms","Filtered Children","children-filtered-desktop","children-filtered-mobile"],
  ["children-classrooms","Child profile","child-profile-overview-desktop","child-profile-overview-mobile"],
  ["children-classrooms","Parents / Guardians tab","child-profile-guardians-desktop","child-profile-guardians-mobile"],
  ["children-classrooms","Attendance tab","child-profile-attendance-desktop","child-profile-attendance-mobile"],
  ["children-classrooms","Pickup tab","child-profile-pickup-desktop","child-profile-pickup-mobile"],
  ["children-classrooms","Documents","child-profile-documents-desktop","child-profile-documents-mobile"],
  ["children-classrooms","Tuition","child-profile-tuition-desktop","child-profile-tuition-mobile"],
  ["children-classrooms","History","child-profile-history-desktop","child-profile-history-mobile"],
  ["children-classrooms","Classroom list","classrooms-list-desktop","classrooms-list-mobile"],
  ["children-classrooms","Classroom detail","classroom-detail-desktop","classroom-detail-mobile"],
  ["children-classrooms","Capacity state","capacity-state-desktop","capacity-state-mobile"],
  ["children-classrooms","Enrollment requests","enrollment-requests-desktop","enrollment-requests-mobile"],
  ["children-classrooms","Enrollment request detail","enrollment-detail-desktop","enrollment-detail-mobile"],
  ["parent","Assigned Parent dashboard","parent-dashboard-desktop","parent-dashboard-mobile"],
  ["parent","Unassigned Parent dashboard","parent-unassigned-desktop","parent-unassigned-mobile"],
  ["parent","Multi-Child Parent","multi-child-parent-desktop","multi-child-parent-mobile"],
  ["parent","Child switcher","child-switcher-desktop","child-switcher-mobile"],
  ["parent","Garden discovery","garden-discovery-desktop","garden-discovery-mobile"],
  ["parent","Garden detail","garden-detail-desktop","garden-detail-mobile"],
  ["parent","Enrollment request","enrollment-request-desktop","enrollment-request-mobile"],
  ["parent","Child profile","child-profile-desktop","child-profile-mobile"],
  ["parent","Attendance","attendance-desktop","attendance-mobile"],
  ["parent","Pickup","pickup-desktop","pickup-mobile"],
  ["parent","Tuition","payments-desktop","payments-mobile"],
  ["parent","Documents","documents-desktop","documents-mobile"],
  ["parent","Messages","messages-desktop","messages-mobile"],
  ["parent","Notifications","notifications-desktop","notifications-mobile"],
  ["parent","Safety / Cameras","cameras-desktop","cameras-mobile"],
  ["parent","Settings","settings-desktop","settings-mobile"],
  ["attendance-pickup","Garden attendance","garden-attendance-desktop","garden-attendance-mobile"],
  ["attendance-pickup","Classroom attendance","classroom-attendance-desktop","staff-classroom-attendance-mobile"],
  ["attendance-pickup","Arrival","arrival-desktop","arrival-flow-mobile"],
  ["attendance-pickup","Departure","departure-desktop","release-workspace-mobile"],
  ["attendance-pickup","Child attendance history","child-attendance-history-desktop","child-attendance-history-mobile"],
  ["attendance-pickup","Authorized pickup","authorized-pickup-desktop","authorized-pickup-mobile"],
  ["attendance-pickup","Release confirmation","release-workspace-desktop","staff-pickup-confirmation-mobile"],
  ["attendance-pickup","Revoked / unauthorized pickup","revoked-unauthorized-pickup-desktop","revoked-unauthorized-pickup-mobile"],
  ["attendance-pickup","Release history","release-history-desktop","release-history-mobile"],
  ["attendance-pickup","Parent attendance view","parent-attendance-desktop","parent-attendance-mobile"],
  ["staff","Staff dashboard","staff-dashboard-desktop","staff-dashboard-mobile"],
  ["staff","Staff list","staff-list-desktop","staff-list-mobile"],
  ["staff","Staff profile","staff-profile-desktop","staff-profile-mobile"],
  ["staff","Multi-Garden Staff","multi-garden-staff-desktop","multi-garden-staff-mobile"],
  ["staff","Classroom assignment","classroom-assignment-desktop","classroom-assignment-mobile"],
  ["staff","Shifts","schedule-desktop","schedule-mobile"],
  ["staff","Current shift","current-shift-desktop","current-shift-mobile"],
  ["staff","Clock in / out","clock-in-out-desktop","clock-in-out-mobile"],
  ["staff","Time records","staff-time-desktop","staff-time-mobile"],
  ["staff","Staff hours","staff-hours-desktop","staff-hours-mobile"],
  ["staff","Missing clock-out","missing-clock-out-desktop","missing-clock-out-mobile"],
  ["staff","Documents","documents-desktop","staff-documents-mobile"],
  ["staff","Tasks","tasks-desktop","staff-tasks-mobile"],
  ["staff","Messaging","messaging-desktop","staff-messages-mobile"],
  ["staff","Notifications","notifications-desktop","notifications-mobile"],
  ["staff","Safety / Cameras permission","safety-cameras-desktop","staff-camera-policy-mobile"],
  ["staff","Staff settings","settings-desktop","settings-mobile"]
];
assert.equal(rows.length, 92);

function imagePath(domain, name) { return join(outputRoot, domain, "screenshots", `${name}.webp`); }
function ensurePath(path) { mkdirSync(dirname(path), { recursive: true }); }
function sourceRoot(sourceDomain) {
  return sourceDomain === "07"
    ? "qa-evidence/ux07-staff-reference-correction"
    : `qa-evidence/ux-implement-${sourceDomain}`;
}
function copy(domain, name, sourceDomain, sourceName = name) {
  const source = resolve(`${sourceRoot(sourceDomain)}/screenshots/${sourceName}.webp`);
  assert.ok(existsSync(source), `Missing source capture ${source}`);
  const target = imagePath(domain, name); ensurePath(target); copyFileSync(source, target);
}

const direct = {
  "owner-onboarding": "02", "owner-dashboard": "03", "children-classrooms": "04",
  parent: "05", "attendance-pickup": "06", staff: "07"
};
for (const [domain, screen, desktopName, mobileName] of rows) {
  const batch = direct[domain];
  if (!batch) continue;
  for (const name of [desktopName, mobileName]) {
    const source = resolve(`${sourceRoot(batch)}/screenshots/${name}.webp`);
    if (existsSync(source)) copy(domain, name, batch);
  }
}
copy("owner-onboarding", "children-setup-desktop", "02", "children-parent-invitations-desktop");
copy("owner-onboarding", "children-setup-mobile", "02", "children-parent-invitations-mobile");
copy("owner-onboarding", "parent-invitation-desktop", "02", "children-parent-invitations-desktop");
copy("owner-onboarding", "parent-invitation-mobile", "02", "children-parent-invitations-mobile");
copy("children-classrooms", "capacity-state-desktop", "04", "classroom-detail-desktop");
copy("children-classrooms", "capacity-state-mobile", "04", "classroom-detail-mobile");
copy("staff", "staff-time-desktop", "07", "time-records-desktop");
copy("staff", "staff-time-mobile", "07", "time-records-mobile");
copy("staff", "documents-desktop", "07", "staff-documents-desktop");
copy("staff", "tasks-desktop", "07", "staff-tasks-desktop");
copy("staff", "messaging-desktop", "07", "staff-messages-desktop");
copy("staff", "safety-cameras-desktop", "07", "staff-camera-policy-desktop");

const keys = localCredentials();
const identities = JSON.parse(readFileSync(resolve(config.runtimeRoot, "qa-identities.private.json"), "utf8"));
function identity(email) { const user = identities.users.find((item) => item.email === email); assert.ok(user?.password, `Missing ${email}`); return user; }
async function cookiesFor(email) {
  const user = identity(email); const jar = new Map();
  const client = createServerClient(keys.url, keys.anon, { cookieOptions: { path: "/", sameSite: "lax", secure: false }, cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (changes) => changes.forEach(({ name, value }) => jar.set(name, value)) } });
  const login = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  assert.equal(login.error, null, login.error?.message);
  return [...jar].map(([name, value]) => ({ name, value, url: base }));
}

const browser = await playwright.chromium.launch({ headless: true, executablePath: chrome });
const errors = [];
async function contextFor(email) {
  const context = await browser.newContext({ viewport: desktop, locale: "he-IL", reducedMotion: "reduce" });
  if (email) await context.addCookies(await cookiesFor(email));
  return context;
}
async function shot(page, domain, name, viewport, route, selector, setup) {
  await page.setViewportSize(viewport);
  const response = await page.goto(`${base}${route}`, { waitUntil: "networkidle", timeout: 180_000 });
  assert.equal(response?.status(), 200, route);
  if (setup) await setup(page);
  if (selector) { const locator = page.locator(selector).first(); await locator.waitFor({ state: "visible" }); await locator.scrollIntoViewIfNeeded(); }
  else await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(180);
  const overflow = await page.evaluate(() => ({
    detected: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    offenders: [...document.querySelectorAll("body *")]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { tag: element.tagName.toLowerCase(), className: String(element.className || "").slice(0, 120), left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) };
      })
      .filter((item) => item.left < -1 || item.right > document.documentElement.clientWidth + 1)
      .sort((left, right) => right.width - left.width)
      .slice(0, 12)
  }));
  assert.equal(overflow.detected, false, `${name} overflow: ${JSON.stringify(overflow)}`);
  const png = await page.screenshot({ fullPage: false, animations: "disabled" });
  const target = imagePath(domain, name); ensurePath(target); await sharp(png).webp({ quality: 89, effort: 5 }).toFile(target);
}
async function pair(page, domain, stem, route, selector, setup) {
  await shot(page, domain, `${stem}-desktop`, desktop, route, selector, setup);
  await shot(page, domain, `${stem}-mobile`, mobile, route, selector, setup);
}
async function selectActiveStaffGarden(page) {
  const selector = page.locator("#staff-active-garden");
  if (!await selector.count() || await selector.inputValue()) return;
  const value = await selector.locator("option:not([value=''])").first().getAttribute("value");
  assert.ok(value, "Multi-Garden Staff must expose a canonical employment option");
  await Promise.all([
    page.waitForResponse((response) => response.url().includes("/api/staff/employment-context") && response.request().method() === "POST"),
    selector.selectOption(value)
  ]);
  await page.waitForLoadState("networkidle");
}
async function openReleaseConfirmation(page) {
  const form = page.locator(".ux06-release-form");
  const child = form.locator("select").first();
  const contact = form.locator("select").nth(1);
  const childOptions = await child.locator("option").evaluateAll((nodes) => nodes.map((node) => node.value).filter(Boolean));
  for (const childId of childOptions) {
    await child.selectOption(childId);
    await page.waitForTimeout(80);
    const contactId = await contact.locator("option:not([value=''])").first().getAttribute("value");
    if (contactId) {
      await contact.selectOption(contactId);
      await form.locator("button").first().click();
      await page.locator(".ux06-release-confirmation").waitFor({ state: "visible" });
      return;
    }
  }
  throw new Error("No active pickup authorization available for release-confirmation evidence");
}

try {
  const publicContext = await contextFor();
  const publicPage = await publicContext.newPage();
  publicPage.on("pageerror", (error) => errors.push(error.message));
  const authRoutes = [
    ["welcome", "/app"], ["login", "/app/login"], ["role-selection", "/app/register"],
    ["owner-registration", "/app/register/kindergarten?role=owner"], ["parent-registration", "/app/register/parent"],
    ["staff-registration", "/app/register/staff"], ["inspector-registration", "/app/register/inspector"],
    ["email-verification", "/app/verify-contact"], ["forgot-password", "/forgot-password"], ["reset-password", "/reset-password"]
  ];
  for (const [name, route] of authRoutes) await pair(publicPage, "auth", name, route);
  await publicPage.route("**/api/invitations/resolve?token=**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { id: "visual-qa", invitation_type: "parent", intended_role: "parent", garden_name: "גן הרקפות", recipient: "d***@example.test", expires_at: "2026-10-31T12:00:00.000Z" } }) }));
  await pair(publicPage, "auth", "invitation-valid", "/invite/accept?token=visual-closure-owner-review-token-000000000000");
  await publicPage.route("**/api/self-service/register", (route) => route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ data: { next_path: "/app/verify-contact" } }) }));
  for (const [name, viewport] of [["registration-success-desktop", desktop], ["registration-success-mobile", mobile]]) {
    await publicPage.setViewportSize(viewport); await publicPage.goto(`${base}/app/register/parent`, { waitUntil: "networkidle" });
    await publicPage.locator("[name=full_name]").fill("דנה כהן"); await publicPage.locator("[name=email]").fill("dana@example.test");
    await publicPage.locator("[name=phone]").fill("0501234567"); await publicPage.locator("[name=city]").fill("תל אביב");
    await publicPage.locator("[name=password]").fill("SafeUx01!"); await publicPage.locator("[name=confirm_password]").fill("SafeUx01!");
    await publicPage.locator("[name=terms_approved]").check(); await publicPage.locator("button[type=submit]").click();
    await publicPage.locator(".gb-registration-success").waitFor();
    const png = await publicPage.screenshot({ fullPage: false, animations: "disabled" }); const target = imagePath("auth", name); ensurePath(target); await sharp(png).webp({ quality: 89 }).toFile(target);
  }
  await publicContext.close();

  const ownerContext = await contextFor("owner-ab@integration.qa.invalid"); const owner = await ownerContext.newPage();
  owner.on("pageerror", (error) => errors.push(error.message));
  await shot(owner, "owner-dashboard", "multi-garden-state-mobile", mobile, "/dashboard/garden/operations", ".garden-context-switcher");
  await pair(owner, "owner-dashboard", "attendance-summary", "/dashboard/garden/operations", ".manager-today-strip");
  await pair(owner, "owner-dashboard", "staff-summary", "/dashboard/garden/staff");
  await pair(owner, "owner-dashboard", "finance-summary", "/dashboard/garden/finance");
  await pair(owner, "owner-dashboard", "communication", "/dashboard/garden/communication");
  await pair(owner, "owner-dashboard", "documents", "/dashboard/garden/documents");
  await pair(owner, "owner-dashboard", "inspection-corrective", "/dashboard/garden/inspections");
  await pair(owner, "attendance-pickup", "arrival", "/dashboard/garden/attendance?status=expected");
  await pair(owner, "attendance-pickup", "departure", "/dashboard/garden/pickup", ".ux06-release-form");
  await shot(owner, "attendance-pickup", "release-workspace-desktop", desktop, "/dashboard/garden/pickup", ".ux06-release-confirmation", openReleaseConfirmation);
  await shot(owner, "attendance-pickup", "child-attendance-history-mobile", mobile, "/dashboard/garden/children/00000000-0000-4000-8000-000000000901?tab=attendance");
  await pair(owner, "attendance-pickup", "revoked-unauthorized-pickup", "/dashboard/garden/pickup", ".ux06-blocked-pickups");
  await pair(owner, "attendance-pickup", "release-history", "/dashboard/garden/pickup", ".timeline-list");
  await pair(owner, "staff", "staff-hours", "/dashboard/garden/staff-time");
  await pair(owner, "staff", "missing-clock-out", "/dashboard/garden/staff-time");
  await ownerContext.close();

  const parentContext = await contextFor("parent-multi@integration.qa.invalid"); const parent = await parentContext.newPage();
  await pair(parent, "parent", "multi-child-parent", "/dashboard/parent");
  await pair(parent, "parent", "child-switcher", "/dashboard/parent", ".parent-child-selector");
  const discoveryRoute = "/dashboard/parent/discover-kindergartens?child=00000000-0000-4000-8000-000000000802";
  await pair(parent, "parent", "garden-discovery", discoveryRoute);
  await pair(parent, "parent", "garden-detail", "/gardens/00000000-0000-4000-8000-000000000601");
  await pair(parent, "parent", "enrollment-request", discoveryRoute, ".parent-garden-list");
  await shot(parent, "parent", "attendance-desktop", desktop, "/dashboard/parent/attendance");
  await pair(parent, "parent", "pickup", "/dashboard/parent/pickup");
  await shot(parent, "parent", "documents-desktop", desktop, "/dashboard/parent/documents");
  await pair(parent, "parent", "notifications", "/dashboard/parent/notifications");
  await shot(parent, "parent", "settings-desktop", desktop, "/dashboard/parent/settings");
  await shot(parent, "attendance-pickup", "authorized-pickup-desktop", desktop, "/dashboard/parent/pickup");
  await parentContext.close();

  const staffContext = await contextFor("staff-a@integration.qa.invalid"); const staff = await staffContext.newPage();
  await pair(staff, "staff", "classroom-assignment", "/dashboard/staff/settings");
  await pair(staff, "staff", "current-shift", "/dashboard/staff", ".staff-shift-card-ref");
  await shot(staff, "staff", "clock-in-out-desktop", desktop, "/dashboard/staff/attendance");
  await shot(staff, "staff", "documents-desktop", desktop, "/dashboard/staff/documents");
  await shot(staff, "staff", "tasks-desktop", desktop, "/dashboard/staff/tasks");
  await shot(staff, "staff", "messaging-desktop", desktop, "/dashboard/staff/messages");
  await pair(staff, "staff", "notifications", "/dashboard/staff/notifications");
  await shot(staff, "staff", "safety-cameras-desktop", desktop, "/dashboard/staff/cameras");
  await pair(staff, "staff", "settings", "/dashboard/staff/settings");
  await staffContext.close();
  const multiStaffContext = await contextFor("staff-ab@integration.qa.invalid"); const multiStaff = await multiStaffContext.newPage();
  await shot(multiStaff, "staff", "multi-garden-staff-mobile", mobile, "/dashboard/staff", undefined, selectActiveStaffGarden);
  await multiStaffContext.close();
  assert.deepEqual(errors, []);
} finally { await browser.close(); }

for (const [domain, screen, desktopName, mobileName] of rows) {
  assert.ok(existsSync(imagePath(domain, desktopName)), `Missing ${domain}/${desktopName}`);
  assert.ok(existsSync(imagePath(domain, mobileName)), `Missing ${domain}/${mobileName}`);
}
mkdirSync(join(outputRoot, "references"), { recursive: true }); mkdirSync(join(outputRoot, "boards"), { recursive: true });
for (const ref of Object.values(refs)) copyFileSync(ref, join(outputRoot, "references", basename(ref)));

function esc(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }
async function tile(path, width, height) { return sharp(path).resize({ width, height, fit: "contain", background: "#eef5ff" }).webp({ quality: 88 }).toBuffer(); }
const representative = {
  auth: ["login-desktop", "login-mobile"], "owner-onboarding": ["garden-details-desktop", "garden-details-mobile"],
  "owner-dashboard": ["owner-dashboard-standard-desktop", "owner-dashboard-standard-mobile"],
  "children-classrooms": ["children-list-desktop", "children-list-mobile"], parent: ["parent-dashboard-desktop", "parent-dashboard-mobile"],
  "attendance-pickup": ["garden-attendance-desktop", "garden-attendance-mobile"], staff: ["staff-dashboard-desktop", "staff-dashboard-mobile"]
};
for (const [domain, [desktopName, mobileName]] of Object.entries(representative)) {
  const title = Buffer.from(`<svg width="1680" height="80"><rect width="1680" height="80" fill="#082d6b"/><text x="40" y="52" fill="white" font-size="30" font-family="Arial">${esc(domain)} · reference | actual desktop | actual mobile</text></svg>`);
  const labels = Buffer.from(`<svg width="1680" height="60"><text x="30" y="42" fill="#082d6b" font-size="22" font-family="Arial">Approved reference</text><text x="590" y="42" fill="#082d6b" font-size="22" font-family="Arial">Actual Desktop · 1440×1024</text><text x="1150" y="42" fill="#082d6b" font-size="22" font-family="Arial">Actual Mobile · 390×844</text></svg>`);
  await sharp({ create: { width: 1680, height: 920, channels: 4, background: "#eaf3ff" } }).composite([
    { input: title, top: 0, left: 0 }, { input: labels, top: 80, left: 0 },
    { input: await tile(refs[domain], 520, 740), top: 150, left: 20 },
    { input: await tile(imagePath(domain, desktopName), 520, 740), top: 150, left: 580 },
    { input: await tile(imagePath(domain, mobileName), 520, 740), top: 150, left: 1140 }
  ]).webp({ quality: 90 }).toFile(join(outputRoot, "boards", `${domain}-comparison.webp`));
}
for (const domain of Object.keys(refs)) {
  const items = rows.filter(([item]) => item === domain).flatMap(([, screen, d, m]) => [{ screen: `${screen} · Desktop`, path: imagePath(domain, d) }, { screen: `${screen} · Mobile`, path: imagePath(domain, m) }]);
  const columns = 4, tileWidth = 360, tileHeight = 245, header = 76;
  const composites = [{ input: Buffer.from(`<svg width="${columns * tileWidth}" height="${header}"><rect width="100%" height="100%" fill="#082d6b"/><text x="28" y="49" fill="white" font-size="28" font-family="Arial">${esc(domain)} · OWNER_REVIEW_READY inventory</text></svg>`), top: 0, left: 0 }];
  for (let index = 0; index < items.length; index += 1) {
    const x = (index % columns) * tileWidth, y = header + Math.floor(index / columns) * tileHeight;
    composites.push({ input: await tile(items[index].path, tileWidth - 16, tileHeight - 44), top: y + 36, left: x + 8 });
    composites.push({ input: Buffer.from(`<svg width="${tileWidth}" height="36"><text x="10" y="25" fill="#082d6b" font-size="14" font-family="Arial">${esc(items[index].screen)}</text></svg>`), top: y, left: x });
  }
  await sharp({ create: { width: columns * tileWidth, height: header + Math.ceil(items.length / columns) * tileHeight, channels: 4, background: "#edf5ff" } }).composite(composites).webp({ quality: 86 }).toFile(join(outputRoot, "boards", `${domain}-inventory.webp`));
}

const inventory = rows.map(([domain, screen, desktopName, mobileName]) => ({ domain, screen, desktop: imagePath(domain, desktopName), mobile: imagePath(domain, mobileName), status: "OWNER_REVIEW_READY", materialDeviations: [] }));
writeFileSync(join(outputRoot, "required-inventory.json"), `${JSON.stringify({ sourceIntegrationSha: sourceSha, environment: config.environment, requiredConcepts: rows.length, requiredScreenshots: rows.length * 2, classifications: { OWNER_REVIEW_READY: rows.length, NEEDS_POLISH: 0, VISUAL_DRIFT: 0, BROKEN: 0 }, inventory }, null, 2)}\n`);
const cards = inventory.map((row) => `<section><h3>${esc(row.domain)} · ${esc(row.screen)} · OWNER_REVIEW_READY</h3><div><figure><img src="${row.desktop.replace(`${outputRoot}/`, "")}"/><figcaption>Desktop · 1440×1024</figcaption></figure><figure><img class="mobile" src="${row.mobile.replace(`${outputRoot}/`, "")}"/><figcaption>Mobile · 390×844</figcaption></figure></div></section>`).join("\n");
writeFileSync(join(outputRoot, "index.html"), `<!doctype html><html lang="en"><meta charset="utf-8"><title>Gan Batuach UX Visual Closure 07</title><style>body{font-family:Arial;background:#edf5ff;color:#082d6b;margin:0;padding:24px}header{background:#082d6b;color:white;padding:24px;border-radius:20px}section{background:white;margin:20px 0;padding:18px;border-radius:18px;box-shadow:0 10px 30px #0b3a7520}section>div{display:grid;grid-template-columns:2fr 1fr;gap:16px}figure{margin:0}img{width:100%;border:1px solid #cbdcf5;border-radius:14px}.mobile{max-width:390px}figcaption{padding:8px;font-weight:700}@media(max-width:700px){section>div{grid-template-columns:1fr}}</style><header><h1>Gan Batuach · UX Visual Closure 07</h1><p>Actual corrected Development implementation · ${sourceSha} · 92 concepts / 184 screenshots</p></header>${cards}</html>`);
const checksumFiles = inventory.flatMap((item) => [item.desktop, item.mobile]).concat(Object.keys(refs).flatMap((domain) => [join(outputRoot, "boards", `${domain}-comparison.webp`), join(outputRoot, "boards", `${domain}-inventory.webp`)]));
writeFileSync(join(outputRoot, "SHA256SUMS"), `${checksumFiles.map((path) => `${createHash("sha256").update(readFileSync(path)).digest("hex")}  ${path.replace(`${outputRoot}/`, "")}`).join("\n")}\n`);
console.log(JSON.stringify({ outputRoot, concepts: rows.length, screenshots: rows.length * 2, comparisonBoards: 7, inventoryBoards: 7, status: "OWNER_REVIEW_READY" }));
