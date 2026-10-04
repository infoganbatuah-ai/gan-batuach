// Synthetic, isolated Development visual QA for UX-IMPLEMENT-03.
import assert from "node:assert/strict";
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
const base = process.env.GB_UX03_BASE_URL ?? "http://127.0.0.1:3002";
const target = new URL(base);
assert.equal(target.hostname, "127.0.0.1");
assert.equal(config.environment, "DEVELOPMENT / INTEGRATION");
assert.equal(config.productionAllowed, false);
assert.equal(localCredentials().url, "http://127.0.0.1:55421");
assert.ok(existsSync(chrome));
assert.equal((await fetch(`${base}/api/health`)).status, 200);

const identities = JSON.parse(readFileSync(resolve(config.runtimeRoot, "qa-identities.private.json"), "utf8"));
const owner = identities.users.find((item) => item.email === "owner-ab@integration.qa.invalid");
assert.ok(owner?.password, "Synthetic multi-Garden Owner identity is required");

const evidenceRoot = resolve("qa-evidence/ux-implement-03");
const screenshotRoot = resolve(evidenceRoot, "screenshots");
mkdirSync(screenshotRoot, { recursive: true });
const desktop = { width: 1440, height: 1024 };
const mobile = { width: 390, height: 844 };
const captures = [];
const consoleErrors = [];
const serverErrors = [];
const navigationMs = [];

async function sessionCookies() {
  const keys = localCredentials();
  const jar = new Map();
  const client = createServerClient(keys.url, keys.anon, {
    cookieOptions: { path: "/", sameSite: "lax", secure: false },
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (changes) => changes.forEach(({ name, value }) => jar.set(name, value))
    }
  });
  const login = await client.auth.signInWithPassword({ email: owner.email, password: owner.password });
  assert.equal(login.error, null);
  return [...jar].map(([name, value]) => ({ name, value, url: base }));
}

async function capture(page, name, viewport, selector) {
  await page.setViewportSize(viewport);
  if (selector) {
    const locator = page.locator(selector).first();
    await locator.waitFor({ state: "visible" });
    await locator.scrollIntoViewIfNeeded();
  } else {
    await page.evaluate(() => scrollTo(0, 0));
  }
  await page.waitForTimeout(220);
  const png = await page.screenshot({ fullPage: false, animations: "disabled" });
  const file = resolve(screenshotRoot, `${name}.webp`);
  await sharp(png).webp({ quality: 86, effort: 5 }).toFile(file);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  assert.equal(overflow, false, `${name} has horizontal overflow`);
  captures.push({ name, viewport: `${viewport.width}x${viewport.height}`, selector: selector ?? "page-top", path: file.replace(`${process.cwd()}/`, "") });
}

async function navigate(page, path) {
  const startedAt = performance.now();
  const response = await page.goto(`${base}${path}`, { waitUntil: "networkidle", timeout: 180_000 });
  navigationMs.push(Math.round(performance.now() - startedAt));
  return response;
}

const browser = await playwright.chromium.launch({ headless: true, executablePath: chrome });
try {
  const context = await browser.newContext({ viewport: desktop, locale: "he-IL", reducedMotion: "reduce" });
  await context.addCookies(await sessionCookies());
  const page = await context.newPage();
  page.setDefaultTimeout(180_000);
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("response", (response) => { if (response.url().startsWith(base) && response.status() >= 500) serverErrors.push({ path: new URL(response.url()).pathname, status: response.status() }); });

  const response = await navigate(page, "/dashboard/garden/operations");
  assert.equal(response?.status(), 200);
  await page.getByRole("heading", { name: "מה קורה היום בגן?" }).waitFor();
  await capture(page, "owner-dashboard-standard-desktop", desktop);
  await capture(page, "owner-navigation-desktop", desktop, ".owner-command-sidebar");

  const gardenSelect = page.locator('.garden-context-switcher select');
  const gardenIds = await gardenSelect.locator("option").evaluateAll((options) => options.map((option) => option.value).filter(Boolean));
  assert.ok(gardenIds.length >= 2, "Owner A+B must expose at least two authorized Gardens");
  const currentGarden = await gardenSelect.inputValue();
  const nextGarden = gardenIds.find((id) => id !== currentGarden) ?? gardenIds[0];
  const contextResponse = page.waitForResponse((item) => new URL(item.url()).pathname === "/api/management/gardens" && item.request().method() === "POST");
  await gardenSelect.selectOption(nextGarden);
  assert.equal((await contextResponse).status(), 200);
  await page.waitForFunction((expected) => document.querySelector('.garden-context-switcher select')?.value === expected, nextGarden);
  await page.getByRole("heading", { name: "מה קורה היום בגן?" }).waitFor();
  const active = await page.evaluate(async () => (await fetch("/api/management/gardens")).json());
  assert.equal(active.data.active_garden_id, nextGarden);
  await capture(page, "owner-multi-garden-desktop", desktop);
  await capture(page, "owner-action-center-desktop", desktop, ".manager-attention-grid");
  await capture(page, "owner-safety-state-desktop", desktop, ".manager-safety-card");

  await page.setViewportSize(mobile);
  await navigate(page, "/dashboard/garden/operations");
  await page.getByRole("heading", { name: "מה קורה היום בגן?" }).waitFor();
  await capture(page, "owner-dashboard-standard-mobile", mobile);
  await capture(page, "owner-action-center-mobile", mobile, ".manager-attention-grid");
  await capture(page, "owner-safety-state-mobile", mobile, ".manager-safety-card");
  await capture(page, "owner-navigation-mobile", mobile, ".role-app-bottom-nav");

  for (let run = 0; run < 3; run += 1) {
    await navigate(page, "/dashboard/garden/operations");
    await page.getByRole("heading", { name: "מה קורה היום בגן?" }).waitFor();
  }

  const orderedNavigationMs = [...navigationMs].sort((left, right) => left - right);
  const p50 = orderedNavigationMs[Math.floor((orderedNavigationMs.length - 1) * 0.5)];
  const p95 = orderedNavigationMs[Math.ceil(orderedNavigationMs.length * 0.95) - 1];

  assert.deepEqual(serverErrors, []);
  assert.deepEqual(consoleErrors, []);
  writeFileSync(resolve(evidenceRoot, "results.json"), `${JSON.stringify({
    environment: config.environment,
    base,
    capturedAt: new Date().toISOString(),
    viewports: { desktop, mobile },
    persona: "synthetic multi-Garden Owner",
    gardenContext: { authorizedOptions: gardenIds.length, switched: true },
    performance: { samples: navigationMs, p50, p95, environment: "local Development; not a Production SLA" },
    captures,
    serverErrors,
    consoleErrors,
    status: "PASS"
  }, null, 2)}\n`);
  console.log(`UX-IMPLEMENT-03 visual capture PASS: ${captures.length} screenshots`);
} finally {
  await browser.close();
}
