import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
const base = process.env.GB_V5_PRIMARY_BASE_URL ?? "http://127.0.0.1:3200";
const evidenceRoot = resolve(process.env.GB_V5_PRIMARY_OUTPUT ?? "qa-evidence/v5-primary-screen-correction");
const screenshotRoot = resolve(evidenceRoot, "screenshots");
const referenceGeometryPath = resolve("GAN_BATUACH_V6_PRIMARY_REFERENCE_GEOMETRY.json");
const sourceSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
if (process.env.GB_V5_EXPECTED_SHA) assert.equal(sourceSha, process.env.GB_V5_EXPECTED_SHA, "Capture source is not the expected Development head");

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

const targets = [
  { id: "owner-dashboard", route: "/dashboard/garden", user: identity("owner-ab@integration.qa.invalid"), ready: ".manager-reference-dashboard", selectors: { sidebar: ".gb-app-shell-sidebar", header: ".role-app-header", hero: ".manager-command-hero", kpi: ".manager-today-strip", primary: ".manager-reference-first-viewport", quickActions: ".manager-reference-quick", lower: ".manager-command-grid-primary" } },
  { id: "parent-assigned", route: "/dashboard/parent", user: identity("parent-a@integration.qa.invalid"), ready: ".parent-dashboard-home", selectors: { sidebar: ".gb-app-shell-sidebar", header: ".role-app-header", hero: ".parent-hero", selector: ".parent-child-card-selector", primary: ".parent-primary-reference-grid", quickActions: ".parent-primary-reference-actions", lower: ".parent-two-columns" } },
  { id: "parent-multi-child", route: "/dashboard/parent", user: identity("parent-multi@integration.qa.invalid"), ready: ".parent-dashboard-home", selectors: { sidebar: ".gb-app-shell-sidebar", header: ".role-app-header", hero: ".parent-hero", selector: ".parent-child-card-selector", primary: ".parent-primary-reference-grid", quickActions: ".parent-primary-reference-actions", lower: ".parent-two-columns" } },
  { id: "platform-admin", route: "/dashboard/admin", user: identity("admin@integration.qa.invalid"), ready: ".admin-runtime-shell", selectors: { sidebar: ".gb-app-shell-sidebar", header: ".role-app-header", hero: ".admin-literal-heading", kpi: ".admin-literal-kpis", primary: ".admin-literal-upper-grid", lower: ".admin-literal-lower-grid" } },
  { id: "settings", route: "/dashboard/garden/settings", user: identity("owner-a@integration.qa.invalid"), ready: ".ux18-settings-layout", selectors: { sidebar: ".gb-app-shell-sidebar", header: ".role-app-header", title: ".ux18-settings-header", navigation: ".ux18-settings-layout > aside", profile: ".ux18-reference-profile-column", security: ".ux18-reference-security-column", garden: ".ux18-reference-garden-column" } },
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

function normalizeRect(rect, viewport) {
  if (!rect) return null;
  return {
    x: Number((rect.x / viewport.width).toFixed(4)),
    y: Number((rect.y / viewport.height).toFixed(4)),
    w: Number((rect.width / viewport.width).toFixed(4)),
    h: Number((rect.height / viewport.height).toFixed(4)),
  };
}

const browser = await playwright.chromium.launch({ headless: true, executablePath: chrome });
const desktop = { label: "desktop", width: 1440, height: 1024 };
const mobile = { label: "mobile", width: 390, height: 844 };
const captures = [];
const actualGeometry = {};

try {
  for (const target of targets) {
    const context = await browser.newContext({ viewport: desktop, locale: "he-IL", reducedMotion: "reduce" });
    await context.addCookies(await cookiesFor(target.user));
    for (const viewport of [desktop, mobile]) {
      const page = await context.newPage();
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("response", (response) => { if (response.url().startsWith(base) && response.status() >= 500) errors.push(`${response.status()} ${new URL(response.url()).pathname}`); });
      const response = await page.goto(`${base}${target.route}`, { waitUntil: "domcontentloaded", timeout: 180_000 });
      assert.equal(response?.status(), 200, target.route);
      assert.doesNotMatch(page.url(), /\/login|\/onboarding|\/apply/);
      await page.locator(target.ready).first().waitFor({ state: "visible", timeout: 120_000 });
      if (target.id === "parent-assigned") {
        assert.ok(Number(await page.locator(".parent-child-card-selector").getAttribute("data-child-count")) >= 1, "Assigned Parent has no authorized child");
        assert.match(await page.locator(".parent-dashboard-home > .parent-child-card").textContent() ?? "", /משויך לגן/, "Assigned Parent persona has no active Garden enrollment");
      }
      if (target.id === "parent-multi-child") {
        assert.ok(Number(await page.locator(".parent-child-card-selector").getAttribute("data-child-count")) >= 2, "Multi-Child Parent persona has fewer than two authorized children");
        assert.equal(await page.locator(".parent-child-context-card.is-active").count(), 1, "Multi-Child Parent has no single selected child");
      }
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForTimeout(700);
      const overflow = await page.evaluate(() => ({ detected: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
      assert.equal(overflow.detected, false, `${target.id} ${viewport.label} overflow: ${JSON.stringify(overflow)}`);
      assert.deepEqual(errors, [], `${target.id} ${viewport.label}: ${errors.join(" | ")}`);
      const body = await page.locator("body").innerText();
      assert.doesNotMatch(body, /Application error|Internal Server Error|Unhandled Runtime Error|SUPABASE_SERVICE_ROLE_KEY|access_token|refresh_token|rtsp:\/\//i);
      const png = await page.screenshot({ fullPage: false, animations: "disabled" });
      const file = resolve(screenshotRoot, `${target.id}-${viewport.label}.webp`);
      await sharp(png).webp({ quality: 93, effort: 5 }).toFile(file);
      captures.push({ id: target.id, route: target.route, role: target.user.email.split("@")[0], viewport: `${viewport.width}x${viewport.height}`, file: file.replace(`${process.cwd()}/`, ""), captureState: "CAPTURED_PENDING_VISUAL_REVIEW" });
      if (viewport.label === "desktop") {
        actualGeometry[target.id] = {};
        for (const [key, selector] of Object.entries(target.selectors)) {
          const locator = page.locator(selector).first();
          actualGeometry[target.id][key] = await locator.count() ? normalizeRect(await locator.boundingBox(), viewport) : null;
        }
      }
      if (target.id === "parent-multi-child") {
        const previousName = await page.locator(".parent-primary-attendance-identity strong").textContent();
        const otherChild = page.locator(".parent-child-context-card:not(.is-active)").first();
        const otherHref = await otherChild.getAttribute("href");
        assert.ok(otherHref?.includes("child="), "Multi-Child selector has no child-scoped destination");
        await otherChild.click();
        await page.waitForURL((url) => url.pathname === "/dashboard/parent" && url.searchParams.has("child"));
        await page.waitForFunction((previous) => document.querySelector(".parent-primary-attendance-identity strong")?.textContent !== previous, previousName);
        assert.equal(await page.locator(".parent-child-context-card.is-active").getAttribute("href"), otherHref, "Selected Child card did not follow the chosen context");
        const nextName = await page.locator(".parent-primary-attendance-identity strong").textContent();
        assert.notEqual(nextName, previousName, "Switching Child did not update the selected Child content");
      }
      await page.close();
    }
    await context.close();
  }
} finally {
  await browser.close();
}

const geometry = JSON.parse(readFileSync(referenceGeometryPath, "utf8"));
for (const [id, measured] of Object.entries(actualGeometry)) {
  const key = id === "settings" ? "settings-account-permissions" : id;
  assert.ok(geometry.screens[key], `Missing reference geometry for ${id}`);
  geometry.screens[key].actualDesktop = measured;
}
geometry.measuredAt = new Date().toISOString();
geometry.actualBuild = sourceSha;
writeFileSync(resolve(evidenceRoot, "primary-geometry.json"), `${JSON.stringify(geometry, null, 2)}\n`);

const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
writeFileSync(resolve(evidenceRoot, "capture-results.json"), `${JSON.stringify({
  environment: config.environment,
  productionAccess: false,
  sourceSha,
  capturedAt: new Date().toISOString(),
  viewports: { desktop, mobile },
  captures: captures.map((item) => ({ ...item, sha256: sha256(resolve(item.file)) })),
  status: "CAPTURED_PENDING_VISUAL_REVIEW",
}, null, 2)}\n`);
console.log(`V5 primary-screen capture complete: ${captures.length} fresh screenshots; visual review pending`);
