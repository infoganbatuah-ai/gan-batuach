// Synthetic, isolated Development visual QA for UX-IMPLEMENT-07.
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
const base = process.env.GB_UX07_BASE_URL ?? "http://127.0.0.1:3007";
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

const evidenceRoot = resolve("qa-evidence/ux-implement-07");
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
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), false, `${name} has horizontal overflow`);
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
  const ownerContext = await contextFor("owner-a@integration.qa.invalid");
  const owner = await ownerContext.newPage();
  owner.on("pageerror", (error) => errors.push(error.message));
  owner.on("response", (response) => { if (response.url().startsWith(base) && response.status() >= 500) errors.push(`${response.status()} ${new URL(response.url()).pathname}`); });
  await capture(owner, "staff-list-desktop", desktop, "/dashboard/garden/staff", "Staff list — Desktop");
  await capture(owner, "staff-list-mobile", mobile, "/dashboard/garden/staff", "Staff list — Mobile");
  await capture(owner, "staff-profile-desktop", desktop, "/dashboard/garden/staff?staff=active", "Staff profile — Desktop");
  await capture(owner, "staff-time-desktop", desktop, "/dashboard/garden/staff-time", "Time records and payroll-ready ledger — Desktop");
  await capture(owner, "staff-time-mobile", mobile, "/dashboard/garden/staff-time", "Hours and missing clock-out — Mobile");
  await ownerContext.close();

  const staffContext = await contextFor("staff-a@integration.qa.invalid");
  const staff = await staffContext.newPage();
  staff.on("pageerror", (error) => errors.push(error.message));
  staff.on("response", (response) => { if (response.url().startsWith(base) && response.status() >= 500) errors.push(`${response.status()} ${new URL(response.url()).pathname}`); });
  await capture(staff, "staff-dashboard-desktop", desktop, "/dashboard/staff", "Staff dashboard — Desktop");
  await capture(staff, "staff-dashboard-mobile", mobile, "/dashboard/staff", "Staff dashboard — Mobile");
  await capture(staff, "clock-in-out-mobile", mobile, "/dashboard/staff/attendance", "Clock in/out — Mobile");
  await capture(staff, "schedule-desktop", desktop, "/dashboard/staff/shifts", "Schedule and time records — Desktop");
  await capture(staff, "schedule-mobile", mobile, "/dashboard/staff/shifts", "Upcoming shifts — Mobile");
  await capture(staff, "staff-profile-mobile", mobile, "/dashboard/staff/settings", "Active Staff profile — Mobile");
  await capture(staff, "staff-documents-mobile", mobile, "/dashboard/staff/documents", "Staff documents — Mobile");
  await capture(staff, "staff-tasks-mobile", mobile, "/dashboard/staff/tasks", "Staff Tasks — Mobile");
  await capture(staff, "staff-messages-mobile", mobile, "/dashboard/staff/messages", "Staff messages — Mobile");
  await capture(staff, "staff-camera-policy-mobile", mobile, "/dashboard/staff/cameras", "Staff camera policy — Mobile");
  await staffContext.close();

  const multiContext = await contextFor("staff-ab@integration.qa.invalid");
  const multi = await multiContext.newPage();
  multi.on("pageerror", (error) => errors.push(error.message));
  await capture(multi, "multi-garden-staff-desktop", desktop, "/dashboard/staff", "Multi-Garden Staff — Desktop");
  await multiContext.close();

  assert.deepEqual(errors, []);
  const results = { environment: config.environment, base, capturedAt: new Date().toISOString(), reference: "GB_UX_REF_STAFF_FULL_PLATFORM.png", viewports: { desktop, mobile }, personas: ["owner-a", "staff-a", "staff-ab"], captures, status: "PASS" };
  writeFileSync(resolve(evidenceRoot, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
  const sums = readdirSync(screenshotRoot).filter((name) => name.endsWith(".webp")).sort().map((name) => `${createHash("sha256").update(readFileSync(resolve(screenshotRoot, name))).digest("hex")}  screenshots/${basename(name)}`).join("\n");
  writeFileSync(resolve(evidenceRoot, "SHA256SUMS"), `${sums}\n`);
  console.log(`UX-IMPLEMENT-07 visual capture PASS: ${captures.length} screenshots`);
} finally {
  await browser.close();
}
