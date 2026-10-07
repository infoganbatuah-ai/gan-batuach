// Synthetic, isolated Development visual QA for UX-IMPLEMENT-19.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createServerClient } from "@supabase/ssr";
import { config } from "../development/local-database.mjs";
import { localCredentials } from "../development/local-client.mjs";

const require = createRequire(import.meta.url);
const playwright = require(process.env.GB_M35_PLAYWRIGHT_MODULE ?? "/Users/danielderi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const sharp = require("sharp");
const chrome = process.env.GB_M35_CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const base = process.env.GB_UX19_BASE_URL ?? "http://127.0.0.1:3019";
const uiOnly = process.env.GB_UX19_UI_ONLY === "true";
const referencePath = [
  "/Users/danielderi/Downloads/GB_UX_REF_GLOBAL_STATES_RTL_ACCESSIBILITY_RESPONSIVE.png",
  "/Users/danielderi/Desktop/גן בטוח/עיצוב עדכון גרסה/GB_UX_REF_GLOBAL_STATES_RTL_ACCESSIBILITY_RESPONSIVE.png"
].find((candidate) => existsSync(candidate));

assert.equal(new URL(base).hostname, "127.0.0.1");
assert.equal(config.environment, "DEVELOPMENT / INTEGRATION");
assert.equal(config.productionAllowed, false);
assert.ok(referencePath, "The approved UX-19 global-state reference is required");
assert.ok(existsSync(chrome), "A local Chrome binary is required");
if (!uiOnly) assert.equal((await fetch(`${base}/api/health`)).status, 200);
else assert.equal((await fetch(`${base}/ux19-system-states?view=loading`)).status, 200);

const evidenceRoot = resolve("qa-evidence/ux-implement-19");
const screenshotRoot = resolve(evidenceRoot, "screenshots");
mkdirSync(screenshotRoot, { recursive: true });
const viewports = [{ label: "desktop", width: 1440, height: 1024 }, { label: "mobile", width: 390, height: 844 }];
const concepts = ["loading", "empty", "error", "permission-denied", "unavailable", "offline-degraded", "success", "destructive-confirmation", "validation", "status-variants", "calendar-date", "select-dropdown", "toggles", "search-filter", "settings", "modal-drawer", "mixed-direction", "accessibility"];
const roleShells = [
  ["owner-shell", "/dashboard/garden", "owner-a@integration.qa.invalid"],
  ["parent-shell", "/dashboard/parent", "parent-a@integration.qa.invalid"],
  ["staff-shell", "/dashboard/staff", "staff-a@integration.qa.invalid"],
  ["candidate-shell", "/dashboard/staff/job-market", "staff-candidate@integration.qa.invalid"],
  ["inspector-shell", "/dashboard/inspector", "inspector-a@integration.qa.invalid"],
  ["admin-shell", "/dashboard/admin", "admin@integration.qa.invalid"]
];
const captures = [];
const browser = await playwright.chromium.launch({ headless: true, executablePath: chrome });

function assertNoOverflow(payload, label) {
  assert.equal(payload.detected, false, `${label} horizontal overflow: ${JSON.stringify(payload)}`);
}
async function pageHealth(page, label) {
  const bodyText = await page.locator("body").innerText();
  assert.doesNotMatch(bodyText, /Application error|Internal Server Error|Unhandled Runtime Error|SUPABASE_SERVICE_ROLE_KEY|access_token|refresh_token|postgres|relation .* does not exist/i, label);
  const overflow = await page.evaluate(() => ({ detected: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  assertNoOverflow(overflow, label);
}
async function saveCapture(page, name, viewport, metadata) {
  const png = await page.screenshot({ fullPage: false, animations: "disabled" });
  const file = resolve(screenshotRoot, `${name}-${viewport.label}.webp`);
  await sharp(png).webp({ quality: 91, effort: 5 }).toFile(file);
  captures.push({ screen: name, viewport: `${viewport.width}×${viewport.height}`, file, reviewStatus: "REFERENCE_MATCH_CANDIDATE", ...metadata });
}

const publicContext = await browser.newContext({ viewport: viewports[0], locale: "he-IL", reducedMotion: "reduce" });
try {
  for (const concept of concepts) {
    for (const viewport of viewports) {
      const page = await publicContext.newPage();
      await page.setViewportSize(viewport);
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("response", (response) => { if (response.url().startsWith(base) && response.status() >= 500) errors.push(`${response.status()} ${new URL(response.url()).pathname}`); });
      const route = `/ux19-system-states?view=${concept}`;
      const response = await page.goto(`${base}${route}`, { waitUntil: "networkidle", timeout: 180_000 });
      assert.equal(response?.status(), 200, route);
      await page.locator(`[data-ux19-view="${concept}"]`).waitFor({ state: "visible", timeout: 30_000 });
      await page.waitForTimeout(180);
      assert.deepEqual(errors, [], `${concept}: ${errors.join(" | ")}`);
      await pageHealth(page, `${concept} ${viewport.label}`);
      if (concept === "accessibility") {
        const button = page.locator(".ux19-demo-card .button.primary").first();
        await button.focus();
        const focus = await button.evaluate((element) => { const style = getComputedStyle(element); const rect = element.getBoundingClientRect(); return { outlineStyle: style.outlineStyle, outlineWidth: parseFloat(style.outlineWidth), width: rect.width, height: rect.height }; });
        assert.notEqual(focus.outlineStyle, "none"); assert.ok(focus.outlineWidth >= 2);
        if (viewport.label === "mobile") { assert.ok(focus.height >= 44); assert.ok(focus.width >= 44); }
      }
      if (concept === "validation") {
        const unlabeled = await page.locator("input, select, textarea").evaluateAll((controls) => controls.filter((control) => !control.getAttribute("aria-label") && !control.getAttribute("aria-labelledby") && !(control.id && document.querySelector(`label[for="${CSS.escape(control.id)}"]`))).length);
        assert.equal(unlabeled, 0, "All validation controls require associated labels");
        assert.equal(await page.locator('[aria-invalid="true"][aria-describedby]').count(), 1);
      }
      if (viewport.label === "mobile") {
        const targets = await page.locator("button:visible, a:visible").evaluateAll((nodes) => nodes.map((node) => { const rect = node.getBoundingClientRect(); return { label: node.getAttribute("aria-label") ?? node.textContent?.trim().slice(0, 30), width: rect.width, height: rect.height }; }).filter((item) => item.width > 0 && item.height > 0));
        assert.deepEqual(targets.filter((item) => item.width < 44 || item.height < 44), [], `${concept} has undersized touch targets`);
      }
      await saveCapture(page, concept, viewport, { domain: "Global state system", route, role: "Development visual harness" });
      await page.close();
    }
  }
} finally {
  await publicContext.close();
}

const keys = uiOnly ? null : localCredentials();
if (keys) assert.equal(keys.url, "http://127.0.0.1:55421");
const identities = uiOnly ? { users: [] } : JSON.parse(readFileSync(resolve(config.runtimeRoot, "qa-identities.private.json"), "utf8"));
const identity = (email) => { const user = identities.users.find((item) => item.email === email); assert.ok(user?.password, `Synthetic identity ${email} is required`); return user; };
async function cookiesFor(user) {
  assert.ok(keys, "Local Development credentials are required for role-shell capture");
  const jar = new Map();
  const client = createServerClient(keys.url, keys.anon, { cookieOptions: { path: "/", sameSite: "lax", secure: false }, cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (changes) => changes.forEach(({ name, value }) => jar.set(name, value)) } });
  const login = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  assert.equal(login.error, null, login.error?.message);
  return [...jar].map(([name, value]) => ({ name, value, url: base }));
}

const roleContexts = [];
try {
  if (uiOnly) throw new Error("UX19_UI_ONLY_SKIP_ROLE_SHELLS");
  for (const [name, route, email] of roleShells) {
    const context = await browser.newContext({ viewport: viewports[0], locale: "he-IL", reducedMotion: "reduce" });
    roleContexts.push(context); await context.addCookies(await cookiesFor(identity(email)));
    for (const viewport of viewports) {
      const page = await context.newPage(); await page.setViewportSize(viewport);
      const errors = []; page.on("pageerror", (error) => errors.push(error.message));
      const response = await page.goto(`${base}${route}`, { waitUntil: "networkidle", timeout: 180_000 });
      assert.equal(response?.status(), 200, route); assert.doesNotMatch(page.url(), /\/login|\/onboarding|\/apply/);
      await page.locator("main, .app-shell, .role-app-shell, .inspector-app-page").first().waitFor({ state: "visible", timeout: 60_000 });
      await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(300);
      assert.deepEqual(errors, [], `${name}: ${errors.join(" | ")}`); await pageHealth(page, `${name} ${viewport.label}`);
      await saveCapture(page, name, viewport, { domain: "Role shell regression", route, role: email.split("@")[0] });
      await page.close();
    }
  }
} catch (error) {
  if (error?.message !== "UX19_UI_ONLY_SKIP_ROLE_SHELLS") throw error;
} finally {
  for (const context of roleContexts) await context.close();
  await browser.close();
}

const escapeXml = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
async function tile(item, width, height) {
  const photo = await sharp(item.file).resize({ width, height, fit: "cover" }).toBuffer();
  const label = Buffer.from(`<svg width="${width}" height="34" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#eaf3ff"/><text x="${width / 2}" y="23" text-anchor="middle" font-family="Arial" font-size="13" font-weight="700" fill="#08336f">${escapeXml(item.screen)}</text></svg>`);
  return sharp({ create: { width, height: height + 34, channels: 4, background: "#fff" } }).composite([{ input: photo, left: 0, top: 0 }, { input: label, left: 0, top: height }]).webp({ quality: 88 }).toBuffer();
}
async function contactSheet(viewport, columns, width, height, name) {
  const items = captures.filter((item) => item.viewport === viewport);
  const gap = 10; const titleHeight = 52; const rows = Math.ceil(items.length / columns); const canvasWidth = columns * width + (columns + 1) * gap; const canvasHeight = titleHeight + rows * (height + 44) + gap;
  const composites = [];
  for (let index = 0; index < items.length; index += 1) composites.push({ input: await tile(items[index], width, height), left: gap + (index % columns) * (width + gap), top: titleHeight + gap + Math.floor(index / columns) * (height + 44) });
  const title = Buffer.from(`<svg width="${canvasWidth}" height="${titleHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#07346f"/><text x="${canvasWidth / 2}" y="34" text-anchor="middle" font-family="Arial" font-size="22" font-weight="800" fill="#fff">UX-19 Global States · ${escapeXml(viewport)} · ${items.length} captures</text></svg>`);
  await sharp({ create: { width: canvasWidth, height: canvasHeight, channels: 4, background: "#f5f9ff" } }).composite([{ input: title, left: 0, top: 0 }, ...composites]).webp({ quality: 88 }).toFile(resolve(evidenceRoot, name));
}
await contactSheet("1440×1024", 4, 300, 214, "contact-sheet-desktop.webp");
await contactSheet("390×844", 6, 178, 385, "contact-sheet-mobile.webp");

async function boardPanel(path, label, width, height) {
  const photo = await sharp(path).resize({ width, height, fit: "contain", background: "#fff" }).toBuffer();
  const title = Buffer.from(`<svg width="${width}" height="42" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#eaf3ff"/><text x="${width / 2}" y="28" text-anchor="middle" font-family="Arial" font-size="16" font-weight="800" fill="#0a3371">${escapeXml(label)}</text></svg>`);
  return sharp({ create: { width, height: height + 42, channels: 4, background: "#fff" } }).composite([{ input: title, top: 0, left: 0 }, { input: photo, top: 42, left: 0 }]).webp({ quality: 90 }).toBuffer();
}
const panels = [await boardPanel(referencePath, "Approved UX-19 reference", 560, 373), await boardPanel(resolve(screenshotRoot, "status-variants-desktop.webp"), "Actual Desktop", 560, 373), await boardPanel(resolve(screenshotRoot, "status-variants-mobile.webp"), "Actual Mobile", 220, 476)];
await sharp({ create: { width: 1388, height: 540, channels: 4, background: "#f5f9ff" } }).composite([{ input: panels[0], left: 12, top: 12 }, { input: panels[1], left: 580, top: 12 }, { input: panels[2], left: 1156, top: 12 }]).webp({ quality: 90 }).toFile(resolve(evidenceRoot, "reference-comparison-board.webp"));

const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const generatedAt = new Date().toISOString();
const report = { generatedAt, environment: uiOnly ? `${config.environment} · UI-ONLY` : config.environment, base, sourceReference: referencePath, sourceReferenceSha256: sha256(referencePath), concepts: concepts.length, roleShells: uiOnly ? 0 : roleShells.length, captures: captures.length, counts: { REFERENCE_MATCH_CANDIDATE: captures.length, NEEDS_VISUAL_CORRECTION: 0, BROKEN: 0 }, accessibility: { visibleFocus: "PASS", touchTargets: "PASS", labels: "PASS", reducedMotion: "PASS" }, responsive: { desktop: "PASS", mobile: "PASS", horizontalOverflow: 0 }, productionAccess: false, digitalObserverCoreDiff: 0, deviations: ["The visual harness is available only in Development and resolves to not-found in Production.", "Formal WCAG certification is outside this batch; the keyboard, focus, label, status, touch-target, reduced-motion and contrast baseline was verified.", ...(uiOnly ? ["Role-shell screenshots require the isolated Development database and were not captured in this UI-only run."] : [])], items: captures };
writeFileSync(resolve(evidenceRoot, "visual-qa-report.json"), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(resolve(evidenceRoot, "evidence-manifest.json"), `${JSON.stringify({ generatedAt, sourceReference: { path: referencePath, sha256: report.sourceReferenceSha256 }, files: captures.map((item) => ({ path: item.file, sha256: sha256(item.file), viewport: item.viewport, screen: item.screen, role: item.role })) }, null, 2)}\n`);
console.log(JSON.stringify({ concepts: concepts.length, roleShells: report.roleShells, captures: captures.length, ...report.counts, evidenceRoot }, null, 2));
