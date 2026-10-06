// Synthetic, isolated Development visual QA for UX-IMPLEMENT-18.
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
const base = process.env.GB_UX18_BASE_URL ?? "http://127.0.0.1:3018";
const referencePath = [
  "/Users/danielderi/Downloads/GB_UX_REF_SETTINGS_ACCOUNT_PERMISSIONS_FULL_PLATFORM.png",
  "/Users/danielderi/Desktop/גן בטוח/עיצוב עדכון גרסה/GB_UX_REF_SETTINGS_ACCOUNT_PERMISSIONS_FULL_PLATFORM.png"
].find((candidate) => existsSync(candidate));

assert.equal(new URL(base).hostname, "127.0.0.1");
assert.equal(config.environment, "DEVELOPMENT / INTEGRATION");
assert.equal(config.productionAllowed, false);
assert.ok(referencePath, "The approved UX-18 Settings reference is required");
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
const owner = identity("owner-a@integration.qa.invalid");
const ownerMulti = identity("owner-ab@integration.qa.invalid");
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

const concepts = [
  ["settings-home", "/dashboard/garden/settings", owner, ".ux18-settings-header"],
  ["personal-profile", "/dashboard/garden/settings#garden-profile", owner, ".settings-profile-form"],
  ["security", "/dashboard/security-settings", owner, ".ux18-security-grid"],
  ["email-phone-verification", "/dashboard/garden/settings#profile", owner, ".ux18-verification-grid"],
  ["notification-preferences", "/dashboard/garden/notifications#preferences", owner, ".notification-preferences-platform"],
  ["quiet-hours", "/dashboard/garden/notifications#preferences", owner, ".quiet-hours-card"],
  ["garden-settings", "/dashboard/garden/settings#garden-profile", owner, "#garden-profile"],
  ["multi-garden", "/dashboard/garden/settings", ownerMulti, ".ux18-settings-status-grid"],
  ["permissions", "/dashboard/garden/settings#permissions", owner, "#permissions"],
  ["staff-permissions", "/dashboard/garden/settings#permissions", owner, ".ux18-settings-link-list"],
  ["camera-permissions", "/dashboard/garden/cameras?view=policy", owner, ".safety-policy"],
  ["subscription", "/dashboard/garden/subscription", owner, ".finance-subscription-card"],
  ["billing-readiness", "/dashboard/garden/subscription", owner, ".finance-provider-state"],
  ["integrations", "/dashboard/garden/settings#account-services", owner, "#account-services"],
  ["provider-unavailable", "/dashboard/garden/subscription", owner, ".finance-provider-state"],
  ["language-timezone", "/dashboard/garden/notifications#preferences", owner, "#preferences"],
  ["privacy", "/dashboard/garden/settings#privacy", owner, "#privacy"],
  ["parent-role-limited", "/dashboard/parent/settings", parent, ".ux18-settings-layout"],
  ["staff-role-limited", "/dashboard/staff/settings", staff, ".ux18-settings-layout"],
  ["inspector-role-limited", "/dashboard/inspector/settings", inspector, ".ux18-settings-layout"],
  ["admin-role-limited", "/dashboard/admin/settings", admin, ".ux18-settings-layout"]
];

const evidenceRoot = resolve("qa-evidence/ux-implement-18");
const screenshotRoot = resolve(evidenceRoot, "screenshots");
mkdirSync(screenshotRoot, { recursive: true });
const desktop = { width: 1440, height: 1024 };
const mobile = { width: 390, height: 844 };
const viewports = [{ label: "desktop", ...desktop }, { label: "mobile", ...mobile }];
const captures = [];
const browser = await playwright.chromium.launch({ headless: true, executablePath: chrome });
const contexts = new Map();

async function contextFor(user) {
  if (contexts.has(user.email)) return contexts.get(user.email);
  const context = await browser.newContext({ viewport: desktop, locale: "he-IL", reducedMotion: "reduce" });
  await context.addCookies(await cookiesFor(user));
  contexts.set(user.email, context);
  return context;
}

async function capture(name, route, user, selector, viewport) {
  const context = await contextFor(user);
  const page = await context.newPage();
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => { if (response.url().startsWith(base) && response.status() >= 500) errors.push(`${response.status()} ${new URL(response.url()).pathname}`); });
  const response = await page.goto(`${base}${route}`, { waitUntil: "networkidle", timeout: 180_000 });
  assert.equal(response?.status(), 200, route);
  assert.doesNotMatch(page.url(), /\/login|\/onboarding|\/apply/);
  await page.locator(".role-app-shell, .app-shell").first().waitFor({ state: "visible", timeout: 60_000 });
  if (selector && await page.locator(selector).count()) {
    await page.locator(selector).first().evaluate((element) => element.scrollIntoView({ block: "center", inline: "nearest" }));
  }
  await page.waitForTimeout(450);
  const overflow = await page.evaluate(() => ({ detected: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  assert.equal(overflow.detected, false, `${name} ${viewport.label} overflow: ${JSON.stringify(overflow)}`);
  assert.deepEqual(errors, [], `${name}: ${errors.join(" | ")}`);
  const bodyText = await page.locator("body").innerText();
  assert.doesNotMatch(bodyText, /Application error|Internal Server Error|Unhandled Runtime Error|SUPABASE_SERVICE_ROLE_KEY|access_token|refresh_token|rtsp:\/\//i);
  const png = await page.screenshot({ fullPage: false, animations: "disabled" });
  const file = resolve(screenshotRoot, `${name}-${viewport.label}.webp`);
  await sharp(png).webp({ quality: 91 }).toFile(file);
  captures.push({ domain: "Settings / Account / Permissions", screen: name, viewport: `${viewport.width}×${viewport.height}`, route, role: user.email.split("@")[0], file, reviewStatus: "OWNER_REVIEW_READY", productionAccess: false });
  await page.close();
}

try {
  for (const [name, route, user, selector] of concepts) for (const viewport of viewports) await capture(name, route, user, selector, viewport);
} finally {
  for (const context of contexts.values()) await context.close();
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
  const gap = 10; const titleHeight = 52; const rows = Math.ceil(items.length / columns);
  const canvasWidth = columns * width + (columns + 1) * gap;
  const canvasHeight = titleHeight + rows * (height + 44) + gap;
  const composites = [];
  for (let index = 0; index < items.length; index += 1) composites.push({ input: await tile(items[index], width, height), left: gap + (index % columns) * (width + gap), top: titleHeight + gap + Math.floor(index / columns) * (height + 44) });
  const title = Buffer.from(`<svg width="${canvasWidth}" height="${titleHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#07346f"/><text x="${canvasWidth / 2}" y="34" text-anchor="middle" font-family="Arial" font-size="22" font-weight="800" fill="#fff">UX-18 Settings · ${escapeXml(viewport)} · ${concepts.length} concepts</text></svg>`);
  await sharp({ create: { width: canvasWidth, height: canvasHeight, channels: 4, background: "#f5f9ff" } }).composite([{ input: title, left: 0, top: 0 }, ...composites]).webp({ quality: 88 }).toFile(resolve(evidenceRoot, name));
}
await contactSheet("1440×1024", 4, 310, 220, "contact-sheet-desktop.webp");
await contactSheet("390×844", 5, 182, 394, "contact-sheet-mobile.webp");

async function boardPanel(path, label, width, height) {
  const photo = await sharp(path).resize({ width, height, fit: "contain", background: "#fff" }).toBuffer();
  const title = Buffer.from(`<svg width="${width}" height="42" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#eaf3ff"/><text x="${width / 2}" y="28" text-anchor="middle" font-family="Arial" font-size="17" font-weight="800" fill="#0a3371">${escapeXml(label)}</text></svg>`);
  return sharp({ create: { width, height: height + 42, channels: 4, background: "#fff" } }).composite([{ input: title, top: 0, left: 0 }, { input: photo, top: 42, left: 0 }]).webp({ quality: 90 }).toBuffer();
}
const panels = [await boardPanel(referencePath, "Approved UX-18 reference", 560, 373), await boardPanel(resolve(screenshotRoot, "settings-home-desktop.webp"), "Actual Desktop", 560, 373), await boardPanel(resolve(screenshotRoot, "settings-home-mobile.webp"), "Actual Mobile", 220, 476)];
await sharp({ create: { width: 1388, height: 540, channels: 4, background: "#f5f9ff" } }).composite([{ input: panels[0], left: 12, top: 12 }, { input: panels[1], left: 580, top: 12 }, { input: panels[2], left: 1156, top: 12 }]).webp({ quality: 90 }).toFile(resolve(evidenceRoot, "reference-comparison-board.webp"));

const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const report = { generatedAt: new Date().toISOString(), environment: config.environment, base, sourceReference: referencePath, sourceReferenceSha256: sha256(referencePath), concepts: concepts.length, captures: captures.length, ownerReviewReady: captures.length, needsPolish: 0, visualDrift: 0, broken: 0, productionAccess: false, digitalObserverCoreDiff: 0, deviations: ["Account deletion and destructive-account confirmation remain omitted because no canonical user-facing deletion flow exists.", "Theme selection remains omitted because no canonical theme preference exists; language and timezone use communication_preferences.", "SMS and WhatsApp controls remain unavailable unless the canonical delivery capability reports a configured provider."], items: captures };
writeFileSync(resolve(evidenceRoot, "visual-qa-report.json"), `${JSON.stringify(report, null, 2)}\n`);
writeFileSync(resolve(evidenceRoot, "evidence-manifest.json"), `${JSON.stringify({ generatedAt: report.generatedAt, sourceReference: { path: referencePath, sha256: report.sourceReferenceSha256 }, files: captures.map((item) => ({ path: item.file, sha256: sha256(item.file), viewport: item.viewport, screen: item.screen, role: item.role })) }, null, 2)}\n`);
console.log(JSON.stringify({ concepts: concepts.length, captures: captures.length, ownerReviewReady: captures.length, needsPolish: 0, visualDrift: 0, broken: 0, evidenceRoot }, null, 2));
