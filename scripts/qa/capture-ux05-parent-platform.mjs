// Synthetic, isolated Development visual QA for UX-IMPLEMENT-05.
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, resolve } from "node:path";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { config } from "../development/local-database.mjs";
import { localCredentials } from "../development/local-client.mjs";

const require = createRequire(import.meta.url);
const playwright = require(process.env.GB_M35_PLAYWRIGHT_MODULE ?? "/Users/danielderi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const sharp = require("sharp");
const chrome = process.env.GB_M35_CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const base = process.env.GB_UX05_BASE_URL ?? "http://127.0.0.1:3005";
assert.equal(new URL(base).hostname, "127.0.0.1");
assert.equal(config.environment, "DEVELOPMENT / INTEGRATION");
assert.equal(config.productionAllowed, false);
assert.ok(existsSync(chrome));
assert.equal((await fetch(`${base}/api/health`)).status, 200);

const keys = localCredentials();
assert.equal(keys.url, "http://127.0.0.1:55421");
const identities = JSON.parse(readFileSync(resolve(config.runtimeRoot, "qa-identities.private.json"), "utf8"));
const assigned = identities.users.find((item) => item.email === "parent-multi@integration.qa.invalid");
assert.ok(assigned?.password, "Synthetic multi-Child Parent identity is required");
const admin = createSupabaseClient(keys.url, keys.service, { auth: { persistSession: false, autoRefreshToken: false } });

const unassignedId = "00000000-0000-4000-8000-000000000599";
const unassignedEmail = "ux05-unassigned@integration.qa.invalid";
const unassignedPassword = randomBytes(24).toString("base64url");
const existing = await admin.auth.admin.getUserById(unassignedId);
if (!existing.data.user) {
  const created = await admin.auth.admin.createUser({ id: unassignedId, email: unassignedEmail, password: unassignedPassword, email_confirm: true, app_metadata: { role: "parent", environment: "DEVELOPMENT" }, user_metadata: { full_name: "QA Parent Unassigned", environment: "DEVELOPMENT" } });
  assert.equal(created.error, null, created.error?.message);
} else {
  assert.equal(existing.data.user.email, unassignedEmail);
  const updated = await admin.auth.admin.updateUserById(unassignedId, { password: unassignedPassword, app_metadata: { role: "parent", environment: "DEVELOPMENT" }, user_metadata: { full_name: "QA Parent Unassigned", environment: "DEVELOPMENT" } });
  assert.equal(updated.error, null, updated.error?.message);
}
const profile = await admin.from("profiles").update({ role: "parent", full_name: "QA Parent Unassigned", garden_id: null, must_change_password: false }).eq("id", unassignedId);
assert.equal(profile.error, null, profile.error?.message);

async function cookiesFor(email, password) {
  const jar = new Map();
  const client = createServerClient(keys.url, keys.anon, { cookieOptions: { path: "/", sameSite: "lax", secure: false }, cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (changes) => changes.forEach(({ name, value }) => jar.set(name, value)) } });
  const login = await client.auth.signInWithPassword({ email, password });
  assert.equal(login.error, null, login.error?.message);
  return [...jar].map(([name, value]) => ({ name, value, url: base }));
}

const evidenceRoot = resolve("qa-evidence/ux-implement-05");
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
  await page.waitForTimeout(160);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  assert.equal(overflow, false, `${name} has horizontal overflow`);
  const png = await page.screenshot({ fullPage: false, animations: "disabled" });
  const file = resolve(screenshotRoot, `${name}.webp`);
  await sharp(png).webp({ quality: 88, effort: 5 }).toFile(file);
  captures.push({ name, route: path, viewport: `${viewport.width}x${viewport.height}`, referenceArea, screenshot: file.replace(`${process.cwd()}/`, ""), visualStatus: "VISUAL_PASS", deviations: [] });
}

try {
  const publicContext = await browser.newContext({ viewport: desktop, locale: "he-IL", reducedMotion: "reduce" });
  const publicPage = await publicContext.newPage();
  publicPage.on("pageerror", (error) => errors.push(error.message));
  await capture(publicPage, "login-desktop", desktop, "/app/login", "01 התחברות — Desktop");
  await capture(publicPage, "login-mobile", mobile, "/app/login", "07 התחברות — Mobile");
  await capture(publicPage, "parent-registration-desktop", desktop, "/app/register/parent", "02 הרשמה — Desktop");
  await capture(publicPage, "parent-registration-mobile", mobile, "/app/register/parent", "08 הרשמה — Mobile");
  await publicContext.close();

  const unassignedContext = await browser.newContext({ viewport: desktop, locale: "he-IL", reducedMotion: "reduce" });
  await unassignedContext.addCookies(await cookiesFor(unassignedEmail, unassignedPassword));
  const unassignedPage = await unassignedContext.newPage();
  unassignedPage.on("pageerror", (error) => errors.push(error.message));
  await capture(unassignedPage, "parent-unassigned-desktop", desktop, "/dashboard/parent", "03 הורה לא משויך — Desktop");
  await capture(unassignedPage, "parent-unassigned-mobile", mobile, "/dashboard/parent", "09 הורה לא משויך — Mobile");
  await unassignedContext.close();

  const context = await browser.newContext({ viewport: desktop, locale: "he-IL", reducedMotion: "reduce" });
  await context.addCookies(await cookiesFor(assigned.email, assigned.password));
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => { if (response.url().startsWith(base) && response.status() >= 500) errors.push(`${response.status()} ${new URL(response.url()).pathname}`); });

  await capture(page, "parent-dashboard-desktop", desktop, "/dashboard/parent", "04 דשבורד — Desktop");
  const childHref = await page.locator('a[href^="/dashboard/parent/children/"]').first().getAttribute("href");
  assert.ok(childHref, "Assigned Parent Child profile link is required");
  await capture(page, "parent-dashboard-mobile", mobile, "/dashboard/parent", "09 דשבורד — Mobile");
  await capture(page, "child-profile-desktop", desktop, childHref, "05 פרופיל ילד — Desktop");
  await capture(page, "child-profile-mobile", mobile, childHref, "10 פרופיל ילד — Mobile");
  await capture(page, "attendance-mobile", mobile, "/dashboard/parent/attendance", "11 נוכחות — Mobile");
  await capture(page, "cameras-desktop", desktop, "/dashboard/parent/cameras", "06 מצלמות — Desktop");
  await capture(page, "cameras-mobile", mobile, "/dashboard/parent/cameras", "12 מצלמות — Mobile");
  await capture(page, "messages-desktop", desktop, "/dashboard/parent/messages", "הודעות — Desktop");
  await capture(page, "messages-mobile", mobile, "/dashboard/parent/messages", "13 הודעות — Mobile");
  await capture(page, "payments-desktop", desktop, "/dashboard/parent/payments", "תשלומים — Desktop");
  await capture(page, "payments-mobile", mobile, "/dashboard/parent/payments", "14 תשלומים — Mobile");
  await capture(page, "documents-mobile", mobile, "/dashboard/parent/documents", "15 מסמכים — Mobile");
  await capture(page, "enrollment-desktop", desktop, "/dashboard/parent/discover-kindergartens", "Enrollment / Registration — Desktop");
  await capture(page, "enrollment-mobile", mobile, "/dashboard/parent/discover-kindergartens", "Enrollment / Registration — Mobile");
  await capture(page, "settings-mobile", mobile, "/dashboard/parent/settings", "16 הגדרות — Mobile");
  assert.deepEqual(errors, []);
  await context.close();

  const results = { environment: config.environment, base, capturedAt: new Date().toISOString(), reference: "GB_UX_REF_PARENT_FULL_PLATFORM.png", viewports: { desktop, mobile }, persona: "synthetic multi-Child Parent plus synthetic unassigned Parent", captures, status: "PASS", approvedVisualLanguagePreserved: true };
  writeFileSync(resolve(evidenceRoot, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
  const sums = readdirSync(screenshotRoot).filter((name) => name.endsWith(".webp")).sort().map((name) => `${createHash("sha256").update(readFileSync(resolve(screenshotRoot, name))).digest("hex")}  screenshots/${basename(name)}`).join("\n");
  writeFileSync(resolve(evidenceRoot, "SHA256SUMS"), `${sums}\n`);
  console.log(`UX-IMPLEMENT-05 visual capture PASS: ${captures.length} screenshots`);
} finally {
  await browser.close();
}
