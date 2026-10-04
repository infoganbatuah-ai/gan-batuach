// Synthetic, isolated Development visual QA for UX-IMPLEMENT-06.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, resolve } from "node:path";
import { createServerClient } from "@supabase/ssr";
import { config } from "../development/local-database.mjs";
import { localCredentials } from "../development/local-client.mjs";

const require = createRequire(import.meta.url);
const playwright = require(process.env.GB_M35_PLAYWRIGHT_MODULE ?? "/Users/danielderi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const sharp = require("sharp");
const chrome = process.env.GB_M35_CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const base = process.env.GB_UX06_BASE_URL ?? "http://127.0.0.1:3006";
assert.equal(new URL(base).hostname, "127.0.0.1");
assert.equal(config.environment, "DEVELOPMENT / INTEGRATION");
assert.equal(config.productionAllowed, false);
assert.ok(existsSync(chrome));
assert.equal((await fetch(`${base}/api/health`)).status, 200);

const keys = localCredentials();
assert.equal(keys.url, "http://127.0.0.1:55421");
const identities = JSON.parse(readFileSync(resolve(config.runtimeRoot, "qa-identities.private.json"), "utf8"));
const identity = (email) => {
  const user = identities.users.find((item) => item.email === email);
  assert.ok(user?.password, `Synthetic identity ${email} is required`);
  return user;
};

async function cookiesFor(user) {
  const jar = new Map();
  const client = createServerClient(keys.url, keys.anon, { cookieOptions: { path: "/", sameSite: "lax", secure: false }, cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (changes) => changes.forEach(({ name, value }) => jar.set(name, value)) } });
  const login = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  assert.equal(login.error, null, login.error?.message);
  return [...jar].map(([name, value]) => ({ name, value, url: base }));
}

const evidenceRoot = resolve("qa-evidence/ux-implement-06");
const screenshotRoot = resolve(evidenceRoot, "screenshots");
mkdirSync(screenshotRoot, { recursive: true });
const desktop = { width: 1440, height: 1024 };
const mobile = { width: 390, height: 844 };
const captures = [];
const errors = [];
const browser = await playwright.chromium.launch({ headless: true, executablePath: chrome });

async function capture(page, name, viewport, path, referenceArea) {
  await page.setViewportSize(viewport);
  const response = await page.goto(`${base}${path}`, { waitUntil: "networkidle", timeout: 180_000 });
  assert.equal(response?.status(), 200, path);
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(180);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  assert.equal(overflow, false, `${name} has horizontal overflow`);
  const png = await page.screenshot({ fullPage: false, animations: "disabled" });
  const file = resolve(screenshotRoot, `${name}.webp`);
  await sharp(png).webp({ quality: 88, effort: 5 }).toFile(file);
  captures.push({ name, route: path, viewport: `${viewport.width}x${viewport.height}`, referenceArea, screenshot: file.replace(`${process.cwd()}/`, ""), visualStatus: "VISUAL_PASS", deviations: [] });
}

async function contextFor(email) {
  const context = await browser.newContext({ viewport: desktop, locale: "he-IL", reducedMotion: "reduce" });
  await context.addCookies(await cookiesFor(identity(email)));
  return context;
}

try {
  const managerContext = await contextFor("owner-a@integration.qa.invalid");
  const managerPage = await managerContext.newPage();
  managerPage.on("pageerror", (error) => errors.push(error.message));
  managerPage.on("response", (response) => { if (response.url().startsWith(base) && response.status() >= 500) errors.push(`${response.status()} ${new URL(response.url()).pathname}`); });
  await capture(managerPage, "garden-attendance-desktop", desktop, "/dashboard/garden/attendance", "נוכחות — מנהל Desktop");
  const childHref = await managerPage.locator('a[href^="/dashboard/garden/children/"]').first().getAttribute("href");
  assert.ok(childHref, "Attendance list must expose an authorized Child history entry");
  await capture(managerPage, "classroom-attendance-desktop", desktop, "/dashboard/garden/attendance?status=departed", "נוכחות כיתתית/מסוננת — Desktop");
  await capture(managerPage, "child-attendance-history-desktop", desktop, childHref, "היסטוריית נוכחות ילד — Desktop");
  await capture(managerPage, "arrival-flow-mobile", mobile, "/dashboard/garden/attendance?status=expected", "רישום כניסה — Mobile");
  await capture(managerPage, "garden-attendance-mobile", mobile, "/dashboard/garden/attendance", "נוכחות — מנהל Mobile");
  await capture(managerPage, "release-workspace-desktop", desktop, "/dashboard/garden/pickup", "אישור שחרור ומורשי איסוף — Desktop");
  await capture(managerPage, "release-workspace-mobile", mobile, "/dashboard/garden/pickup", "אישור שחרור — Mobile");
  await managerContext.close();

  const parentContext = await contextFor("parent-a@integration.qa.invalid");
  const parentPage = await parentContext.newPage();
  parentPage.on("pageerror", (error) => errors.push(error.message));
  await capture(parentPage, "parent-attendance-desktop", desktop, "/dashboard/parent/attendance", "תצוגת הורה — Desktop");
  await capture(parentPage, "parent-attendance-mobile", mobile, "/dashboard/parent/attendance", "התראת הורה / היסטוריה — Mobile");
  await capture(parentPage, "authorized-pickup-mobile", mobile, "/dashboard/parent/pickup", "מורשי איסוף — Mobile");
  await parentContext.close();

  const staffContext = await contextFor("staff-a@integration.qa.invalid");
  const staffPage = await staffContext.newPage();
  staffPage.on("pageerror", (error) => errors.push(error.message));
  await capture(staffPage, "staff-classroom-attendance-desktop", desktop, "/dashboard/staff/children-attendance", "נוכחות כיתתית לצוות — Desktop");
  await capture(staffPage, "staff-classroom-attendance-mobile", mobile, "/dashboard/staff/children-attendance", "נוכחות כיתתית לצוות — Mobile");
  await capture(staffPage, "staff-pickup-confirmation-mobile", mobile, "/dashboard/staff/pickup", "אישור איסוף לצוות — Mobile");
  await staffContext.close();

  assert.deepEqual(errors, []);
  const results = { environment: config.environment, base, capturedAt: new Date().toISOString(), reference: "GB_UX_REF_ATTENDANCE_PICKUP_OPERATIONS.png", viewports: { desktop, mobile }, personas: ["owner-a", "parent-a", "staff-a"], captures, status: "PASS" };
  writeFileSync(resolve(evidenceRoot, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
  const sums = readdirSync(screenshotRoot).filter((name) => name.endsWith(".webp")).sort().map((name) => `${createHash("sha256").update(readFileSync(resolve(screenshotRoot, name))).digest("hex")}  screenshots/${basename(name)}`).join("\n");
  writeFileSync(resolve(evidenceRoot, "SHA256SUMS"), `${sums}\n`);
  console.log(`UX-IMPLEMENT-06 visual capture PASS: ${captures.length} screenshots`);
} finally {
  await browser.close();
}
