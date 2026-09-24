// Synthetic GB-M37 dashboard interaction/performance QA; isolated Development only.
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createServerClient } from "@supabase/ssr";
import { config } from "../development/local-database.mjs";
import { localCredentials } from "../development/local-client.mjs";

const require = createRequire(import.meta.url);
const browserModule = [process.env.GB_M37_PLAYWRIGHT_MODULE, "playwright",
  "/Users/danielderi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"]
  .filter(Boolean).find(candidate => { try { require.resolve(candidate); return true; } catch { return false; } });
if (!browserModule) throw Error("Playwright runtime unavailable for GB-M37 dashboard QA");
const { chromium } = require(browserModule);
const chrome = process.env.GB_M37_CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (!existsSync(chrome)) throw Error("Installed local Chrome unavailable");
const base = process.env.GB_M37_BASE_URL ?? "http://127.0.0.1:3000";
assert.match(base, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
assert.equal(config.environment, "DEVELOPMENT / INTEGRATION");
assert.equal(config.productionAllowed, false);
const keys = localCredentials();
const saved = JSON.parse(readFileSync(`${config.runtimeRoot}/qa-identities.private.json`, "utf8"));
assert.equal(saved.environment, config.environment);

async function sessionCookies(actor) {
  const identity = saved.users.find(item => item.email === `${actor}@integration.qa.invalid`);
  assert.ok(identity?.password, `Missing synthetic identity ${actor}`);
  const jar = new Map();
  const client = createServerClient(keys.url, keys.anon, {
    cookieOptions: { path: "/", sameSite: "lax", secure: false },
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: changes => changes.forEach(({ name, value }) => jar.set(name, value)) }
  });
  const login = await client.auth.signInWithPassword({ email: identity.email, password: identity.password });
  assert.equal(login.error, null, `Synthetic login failed: ${actor}`);
  return [...jar].map(([name, value]) => ({ name, value, url: base }));
}

const journeys = [
  ["manager-a", "/dashboard/garden", "desktop"],
  ["owner-teacher", "/dashboard/garden", "desktop"],
  ["parent-multi", "/dashboard/parent", "mobile"],
  ["staff-ab", "/dashboard/staff", "mobile"],
  ["delegated-teacher", "/dashboard/staff", "desktop"],
  ["inspector-a", "/dashboard/inspector", "desktop"],
  ["inspector-unassigned", "/dashboard/inspector", "desktop"],
  ["admin", "/dashboard/admin", "desktop"]
];
const browser = await chromium.launch({ headless: true, executablePath: chrome });
const results = [];
try {
  for (const [actor, path, viewport] of journeys) {
    const context = await browser.newContext({ viewport: viewport === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 900 }, locale: "he-IL" });
    await context.addCookies(await sessionCookies(actor));
    const page = await context.newPage();
    let sameOriginRequests = 0;
    const runtimeErrors = [];
    page.on("request", request => { if (request.url().startsWith(base)) sameOriginRequests += 1; });
    page.on("pageerror", error => runtimeErrors.push(error.name));
    const started = performance.now();
    const response = await page.goto(`${base}${path}`, { waitUntil: "networkidle", timeout: 90_000 });
    const loadMs = Math.round(performance.now() - started);
    assert.equal(response?.status(), 200, `${actor} dashboard status`);
    assert.deepEqual(runtimeErrors, [], `${actor} dashboard runtime errors`);
    const finalPath = new URL(page.url()).pathname;
    if (actor === "parent-multi") {
      const selector = page.locator("#dashboard-child");
      const values = await selector.locator("option").evaluateAll(options => options.map(option => option.value));
      assert.ok(values.length >= 2, "Parent-Multi has multiple authorized Children");
      await selector.selectOption(values[1]);
      await Promise.all([page.waitForNavigation({ waitUntil: "networkidle" }), page.getByRole("button", { name: "החלפת ילד" }).click()]);
      assert.equal(new URL(page.url()).searchParams.get("child"), values[1]);
      assert.equal(await page.locator("#dashboard-child").inputValue(), values[1]);
      assert.match(await page.locator(`a[href="/dashboard/parent/children/${values[1]}"]`).first().getAttribute("href"), new RegExp(`${values[1]}$`));
    }
    if (actor === "staff-ab") {
      const selector = page.locator("#staff-active-garden");
      const values = (await selector.locator("option").evaluateAll(options => options.map(option => option.value))).filter(Boolean);
      assert.ok(values.length >= 2, "Staff A+B has multiple authorized Gardens");
      for (const value of values.slice(0, 2)) {
        await selector.selectOption(value);
        await page.waitForFunction(expected => document.querySelector("#staff-active-garden")?.value === expected, value);
        const active = await page.evaluate(async () => (await fetch("/api/staff/employment-context")).json());
        assert.equal(active.data.active_garden_id, value, "Staff active Garden follows authorized server context");
      }
    }
    if (actor === "inspector-unassigned") {
      assert.match(await page.locator("body").innerText(), /טרם הוקצו לך גנים/);
      assert.doesNotMatch(await page.locator("body").innerText(), /QA Garden A/);
    }
    results.push({ actor, path, finalPath, viewport, status: response?.status(), loadMs, sameOriginRequests, runtimeErrors, pass: true });
    await context.close();
  }
} finally { await browser.close(); }

const latencies = results.map(result => result.loadMs).sort((a, b) => a - b);
const receipt = {
  observedAt: new Date().toISOString(), environment: config.environment, syntheticOnly: true, productionAccess: false,
  performance: { samples: latencies.length, p50Ms: latencies[Math.floor(latencies.length * .5)], p95Ms: latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * .95))], maxMs: latencies.at(-1) },
  results
};
writeFileSync(process.env.GB_M37_QA_RECEIPT ?? "/private/tmp/gb-m37-dashboard-role-e2e.json", JSON.stringify(receipt, null, 2) + "\n", { mode: 0o600 });
console.log(`GB-M37 dashboard role E2E PASS: ${results.length}/${results.length}; p50=${receipt.performance.p50Ms}ms p95=${receipt.performance.p95Ms}ms`);
