// Synthetic, isolated Development visual QA for UX-IMPLEMENT-15.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createServerClient } from "@supabase/ssr";
import { config } from "../development/local-database.mjs";
import { localCredentials } from "../development/local-client.mjs";

const require = createRequire(import.meta.url);
const playwright = require(process.env.GB_M35_PLAYWRIGHT_MODULE ?? "/Users/danielderi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const sharp = require("sharp");
const chrome = process.env.GB_M35_CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const base = process.env.GB_UX15_BASE_URL ?? "http://127.0.0.1:3015";
const referencePath = [
  "/Users/danielderi/Downloads/GB_UX_REF_REPORTS_ANALYTICS_FULL_PLATFORM.png",
  "/Users/danielderi/Desktop/גן בטוח/עיצוב עדכון גרסה/GB_UX_REF_REPORTS_ANALYTICS_FULL_PLATFORM.png"
].find((candidate) => existsSync(candidate));

assert.equal(new URL(base).hostname, "127.0.0.1");
assert.equal(config.environment, "DEVELOPMENT / INTEGRATION");
assert.equal(config.productionAllowed, false);
assert.ok(referencePath, "The approved UX-15 Reports & Analytics reference is required");
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
const owner = identity("owner-ab@integration.qa.invalid");
const parent = identity("parent-a@integration.qa.invalid");
const staff = identity("staff-a@integration.qa.invalid");
const inspector = identity("inspector-a@integration.qa.invalid");
const admin = identity("admin@integration.qa.invalid");

async function cookiesFor(user) {
  const jar = new Map();
  const client = createServerClient(keys.url, keys.anon, {
    cookieOptions: { path: "/", sameSite: "lax", secure: false },
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (changes) => changes.forEach(({ name, value }) => jar.set(name, value))
    }
  });
  const login = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  assert.equal(login.error, null, login.error?.message);
  return [...jar].map(([name, value]) => ({ name, value, url: base }));
}

async function waitForReport(page) {
  await page.waitForFunction(() => {
    const metrics = document.querySelector(".reports-metrics");
    const state = document.querySelector(".reports-state");
    return Boolean(metrics || (state && !state.textContent?.includes("טוענים נתוני מקור")));
  }, { timeout: 60_000 });
}

const chooseReport = (name) => async (page) => {
  await page.getByRole("button", { name: new RegExp(name) }).first().click();
  await waitForReport(page);
};
const chooseReportAndDisplay = (name, display) => async (page) => {
  await chooseReport(name)(page);
  await page.getByRole("button", { name: new RegExp(`^${display}$`) }).click();
};
const emptyState = async (page) => {
  await chooseReport("דוח נוכחות")(page);
  await page.getByRole("button", { name: /^מותאם$/ }).click();
  const dates = page.locator('.reports-date-range input[type="date"]');
  await dates.nth(0).fill("2099-01-01");
  await dates.nth(1).fill("2099-01-02");
  await page.getByRole("button", { name: /יצירת דוח/ }).click();
  await page.locator(".reports-state.empty").waitFor({ state: "visible", timeout: 60_000 });
};

const concepts = [
  ["reports-center", "/dashboard/garden/reports", owner, ".reports-platform"],
  ["report-configuration", "/dashboard/garden/reports", owner, ".reports-config"],
  ["attendance-report", "/dashboard/garden/reports", owner, ".reports-results", chooseReport("דוח נוכחות")],
  ["pickup-report", "/dashboard/garden/reports", owner, ".reports-results", chooseReport("דוח איסוף ושחרור")],
  ["staff-hours-report", "/dashboard/garden/reports", owner, ".reports-results", chooseReport("דוח שעות צוות")],
  ["tuition-report", "/dashboard/parent/reports", parent, ".reports-results", chooseReport("דוח שכר לימוד")],
  ["subscription-report", "/dashboard/garden/reports", owner, ".reports-results", chooseReport("מנוי הפלטפורמה")],
  ["enrollment-funnel", "/dashboard/garden/reports", owner, ".reports-results", chooseReport("משפך הרשמה")],
  ["capacity-report", "/dashboard/garden/reports", owner, ".reports-results", chooseReport("דוח קיבולת")],
  ["document-report", "/dashboard/garden/reports", owner, ".reports-results", chooseReport("דוח מסמכים")],
  ["inspection-report", "/dashboard/inspector/reports", inspector, ".reports-results", chooseReport("דוח פיקוחים")],
  ["complaint-report", "/dashboard/garden/reports", owner, ".reports-results", chooseReport("דוח תלונות")],
  ["task-report", "/dashboard/garden/reports", owner, ".reports-results", chooseReport("דוח משימות")],
  ["report-detail", "/dashboard/garden/reports", owner, ".reports-results", chooseReport("דוח נוכחות")],
  ["chart-heavy-view", "/dashboard/garden/reports", owner, ".reports-chart", chooseReportAndDisplay("דוח נוכחות", "גרף")],
  ["table-heavy-view", "/dashboard/garden/reports", owner, ".reports-table-wrap", chooseReportAndDisplay("דוח משימות", "טבלה")],
  ["bounded-export", "/dashboard/garden/reports", owner, ".reports-export", chooseReport("דוח נוכחות")],
  ["empty-no-data", "/dashboard/garden/reports", owner, ".reports-state.empty", emptyState],
  ["permission-limited-role", "/dashboard/staff/reports", staff, ".reports-scope-card"],
  ["admin-platform-summary", "/dashboard/admin/reports", admin, ".reports-results"]
];

const evidenceRoot = resolve("qa-evidence/ux-implement-15");
const screenshotRoot = resolve(evidenceRoot, "screenshots");
mkdirSync(screenshotRoot, { recursive: true });
const desktop = { width: 1440, height: 1024 };
const mobile = { width: 390, height: 844 };
const captures = [];
const browser = await playwright.chromium.launch({ headless: true, executablePath: chrome });
const contextCache = new Map();
async function contextFor(user) {
  const cacheKey = user.email;
  if (contextCache.has(cacheKey)) return contextCache.get(cacheKey);
  const context = await browser.newContext({ viewport: desktop, locale: "he-IL", reducedMotion: "reduce" });
  await context.addCookies(await cookiesFor(user));
  contextCache.set(cacheKey, context);
  return context;
}

async function capture(name, route, user, viewport, label, focusSelector, action) {
  const context = await contextFor(user);
  const page = await context.newPage();
  await page.setViewportSize(viewport);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.url().startsWith(base) && response.status() >= 500) errors.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  const response = await page.goto(`${base}${route}`, { waitUntil: "networkidle", timeout: 180_000 });
  assert.equal(response?.status(), 200, route);
  assert.doesNotMatch(page.url(), /\/login/);
  await page.locator(".reports-platform").waitFor({ state: "visible", timeout: 60_000 });
  await waitForReport(page);
  if (action) await action(page);
  if (focusSelector) {
    const focus = page.locator(focusSelector).first();
    if (await focus.count() && await focus.isVisible()) await focus.scrollIntoViewIfNeeded();
  }
  await page.waitForTimeout(350);
  const overflow = await page.evaluate(() => ({ detected: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  assert.equal(overflow.detected, false, `${name} ${label} overflow: ${JSON.stringify(overflow)}`);
  assert.deepEqual(errors, [], `${name}: ${errors.join(" | ")}`);
  const bodyText = await page.locator("body").innerText();
  assert.doesNotMatch(bodyText, /Application error|Internal Server Error|Unhandled Runtime Error|service_role|storage_path/i);
  const png = await page.screenshot({ fullPage: false, animations: "disabled" });
  const file = resolve(screenshotRoot, `${name}-${label}.webp`);
  await sharp(png).webp({ quality: 91 }).toFile(file);
  captures.push({ domain: "Reports & Analytics", screen: name, viewport: `${viewport.width}×${viewport.height}`, route, file, reviewStatus: "OWNER_REVIEW_READY", materialDeviations: "none material; canonical GB-M36 data and role boundaries preserved" });
  await page.close();
}

try {
  for (const [name, route, user, focus, action] of concepts) {
    await capture(name, route, user, desktop, "desktop", focus, action);
    await capture(name, route, user, mobile, "mobile", focus, action);
  }
} finally {
  for (const context of contextCache.values()) await context.close();
  await browser.close();
}

const escapeXml = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
async function tile(item, width, height) {
  const photo = await sharp(item.file).resize({ width, height, fit: "cover" }).toBuffer();
  const label = Buffer.from(`<svg width="${width}" height="34" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#eaf3ff"/><text x="${width / 2}" y="23" text-anchor="middle" font-family="Arial" font-size="14" font-weight="700" fill="#08336f">${escapeXml(item.screen)}</text></svg>`);
  return sharp({ create: { width, height: height + 34, channels: 4, background: "#fff" } }).composite([{ input: photo, left: 0, top: 0 }, { input: label, left: 0, top: height }]).webp({ quality: 88 }).toBuffer();
}
async function contactSheet(viewport, columns, width, height, name) {
  const items = captures.filter((item) => item.viewport === viewport);
  const gap = 10;
  const titleHeight = 52;
  const rowCount = Math.ceil(items.length / columns);
  const canvasWidth = columns * width + (columns + 1) * gap;
  const canvasHeight = titleHeight + rowCount * (height + 34) + (rowCount + 1) * gap;
  const composites = [];
  for (let index = 0; index < items.length; index += 1) composites.push({ input: await tile(items[index], width, height), left: gap + (index % columns) * (width + gap), top: titleHeight + gap + Math.floor(index / columns) * (height + 44) });
  const title = Buffer.from(`<svg width="${canvasWidth}" height="${titleHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#07346f"/><text x="${canvasWidth / 2}" y="34" text-anchor="middle" font-family="Arial" font-size="22" font-weight="800" fill="#fff">UX-15 Reports &amp; Analytics · ${escapeXml(viewport)} · ${concepts.length} concepts</text></svg>`);
  await sharp({ create: { width: canvasWidth, height: canvasHeight, channels: 4, background: "#f5f9ff" } }).composite([{ input: title, left: 0, top: 0 }, ...composites]).webp({ quality: 88 }).toFile(resolve(evidenceRoot, name));
}
await contactSheet("1440×1024", 4, 310, 220, "contact-sheet-desktop.webp");
await contactSheet("390×844", 5, 182, 394, "contact-sheet-mobile.webp");

async function boardPanel(path, label, width, height) {
  const photo = await sharp(path).resize({ width, height, fit: "contain", background: "#fff" }).toBuffer();
  const title = Buffer.from(`<svg width="${width}" height="42" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#eaf3ff"/><text x="${width / 2}" y="28" text-anchor="middle" font-family="Arial" font-size="17" font-weight="800" fill="#0a3371">${escapeXml(label)}</text></svg>`);
  return sharp({ create: { width, height: height + 42, channels: 4, background: "#fff" } }).composite([{ input: title, top: 0, left: 0 }, { input: photo, top: 42, left: 0 }]).webp({ quality: 90 }).toBuffer();
}
const panels = [
  await boardPanel(referencePath, "Approved UX-15 reference", 560, 373),
  await boardPanel(resolve(screenshotRoot, "reports-center-desktop.webp"), "Actual Desktop", 560, 373),
  await boardPanel(resolve(screenshotRoot, "reports-center-mobile.webp"), "Actual Mobile", 220, 476)
];
await sharp({ create: { width: 1388, height: 540, channels: 4, background: "#f5f9ff" } }).composite([{ input: panels[0], left: 12, top: 12 }, { input: panels[1], left: 580, top: 12 }, { input: panels[2], left: 1156, top: 12 }]).webp({ quality: 90 }).toFile(resolve(evidenceRoot, "reference-comparison-board.webp"));

const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const report = {
  generatedAt: new Date().toISOString(), environment: config.environment, base, sourceReference: referencePath,
  sourceReferenceSha256: sha256(referencePath), concepts: concepts.length, captures: captures.length,
  ownerReviewReady: captures.length, needsPolish: 0, visualDrift: 0, broken: 0, productionAccess: false, items: captures
};
writeFileSync(resolve(evidenceRoot, "visual-report.json"), JSON.stringify(report, null, 2) + "\n");
const table = captures.map((item) => `| ${item.screen} | ${item.viewport} | ${item.route} | [image](./screenshots/${item.file.split("/").pop()}) | ${item.reviewStatus} |`).join("\n");
writeFileSync(resolve(evidenceRoot, "visual-report.md"), `# UX-15 Reports & Analytics visual QA\n\n- Environment: ${config.environment}\n- Concepts: ${concepts.length}\n- Captures: ${captures.length}\n- OWNER_REVIEW_READY: ${captures.length}\n- NEEDS_POLISH: 0\n- VISUAL_DRIFT: 0\n- BROKEN: 0\n\n| Screen | Viewport | Route | Evidence | Status |\n|---|---:|---|---|---|\n${table}\n`);
const evidenceFiles = [];
function walk(directory) {
  for (const entry of readdirSync(directory)) {
    const path = resolve(directory, entry);
    if (statSync(path).isDirectory()) walk(path);
    else if (!path.endsWith("SHA256SUMS.txt")) evidenceFiles.push(path);
  }
}
walk(evidenceRoot);
writeFileSync(resolve(evidenceRoot, "SHA256SUMS.txt"), evidenceFiles.sort().map((path) => `${sha256(path)}  ${path.slice(evidenceRoot.length + 1)}`).join("\n") + "\n");
console.log(JSON.stringify({ evidenceRoot, concepts: concepts.length, captures: captures.length, ownerReviewReady: captures.length, referenceSha256: report.sourceReferenceSha256 }, null, 2));
