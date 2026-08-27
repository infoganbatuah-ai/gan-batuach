import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
for (const envFile of [".env.qa-demo.local", ".env.local", ".env"]) {
  const envPath = resolve(process.cwd(), envFile);
  if (!existsSync(envPath)) continue;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

const candidates = [
  "playwright",
  "/Users/danielderi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  "/Users/danielderi/Library/Caches/com.openai.codex/org.sparkle-project.Sparkle/Installation/T08Ed3DUZ/PDjNIEySX/Codex.app/Contents/Resources/cua_node/lib/node_modules/playwright"
];
let playwright;
for (const candidate of candidates) {
  try { playwright = require(candidate); break; } catch { /* Try the next installed runtime. */ }
}
if (!playwright) throw new Error("Playwright runtime is unavailable.");

const baseUrl = process.env.QA_BASE_URL || "http://localhost:3000";
const outputDir = resolve(process.cwd(), process.env.QA_OUTPUT_DIR || "qa-evidence/digital-observer-functional-reality");
mkdirSync(outputDir, { recursive: true });
const genericPassword = process.env.QA_DEMO_DIGITAL_OBSERVER_PASSWORD;
const accounts = [
  { key: "home", type: "home", email: process.env.QA_DEMO_DIGITAL_OBSERVER_HOME_EMAIL || "qa.digital.observer.home@demo.ganbatuach.com", password: process.env.QA_DEMO_DIGITAL_OBSERVER_HOME_PASSWORD || genericPassword },
  { key: "business", type: "business", email: process.env.QA_DEMO_DIGITAL_OBSERVER_BUSINESS_EMAIL || process.env.QA_DEMO_DIGITAL_OBSERVER_EMAIL || "qa.digital.observer@demo.ganbatuach.com", password: process.env.QA_DEMO_DIGITAL_OBSERVER_BUSINESS_PASSWORD || genericPassword }
];
if (accounts.some((account) => !account.password)) throw new Error("Local Digital Observer QA passwords are required.");

const routes = [
  ["dashboard", "/digital-observer/dashboard", ".do-dashboard-home, .do-dashboard-business"],
  ["cameras", "/digital-observer/cameras", ".do-camera-browser"],
  ["alerts", "/digital-observer/alerts", ".do-alert-center"],
  ["observer", "/digital-observer/rules", ".do-conversation-panel"],
  ["people", "/digital-observer/people", ".do-people-screen"],
  ["recordings", "/digital-observer/recordings", ".do-recordings-panel"],
  ["sites", "/digital-observer/sites", ".do-site-grid, .do-empty"],
  ["billing", "/digital-observer/billing", ".do-billing-plans, .do-plan-grid, .do-empty"],
  ["settings", "/digital-observer/settings", ".do-settings-links"]
];
const viewports = [["mobile", { width: 390, height: 844 }], ["desktop", { width: 1440, height: 900 }]];
const results = [];

async function login(page, account) {
  await page.goto(`${baseUrl}/digital-observer/login`, { waitUntil: "networkidle" });
  await page.locator("form.do-auth-card[data-hydrated='true']").waitFor({ state: "visible", timeout: 30000 });
  await page.locator('input[type="email"]').fill(account.email);
  await page.locator('input[type="password"]').fill(account.password);
  const accountTypeSelect = page.locator('select[name="accountType"]');
  if (await accountTypeSelect.count()) await accountTypeSelect.selectOption(account.type);
  await page.getByRole("button", { name: "התחברות" }).click();
  await page.locator(".do-shell, .do-onboarding-content").first().waitFor({ state: "visible", timeout: 20000 });
}

async function inspectRoute(page, account, routeKey, route, selector, viewportKey) {
  const consoleErrors = [];
  const onConsole = (message) => { if (message.type() === "error") consoleErrors.push(message.text().slice(0, 180)); };
  page.on("console", onConsole);
  await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
  await page.locator(selector).first().waitFor({ state: "visible", timeout: 15000 });
  const state = await page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const deadLinks = Array.from(document.querySelectorAll("a")).filter((link) => {
      const href = link.getAttribute("href");
      return !href || href === "#" || href.startsWith("javascript:");
    }).map((link) => link.textContent?.trim() || "unlabelled");
    const unexplainedDisabled = Array.from(document.querySelectorAll("button:disabled")).filter((button) => {
      const label = button.textContent?.trim() || button.getAttribute("aria-label") || button.getAttribute("title");
      return !label;
    }).map(() => "unlabelled disabled button");
    return {
      path: window.location.pathname,
      overflow: document.documentElement.scrollWidth > viewportWidth + 1,
      deadLinks,
      unexplainedDisabled,
      shell: document.querySelector(".do-shell")?.getAttribute("data-observer-mode") || "missing"
    };
  });
  let interaction = "route_rendered";
  if (routeKey === "cameras" && await page.locator(".do-camera-live-tile").count()) {
    await page.locator(".do-camera-live-tile").first().click();
    await page.locator(".do-camera-detail-grid").waitFor({ state: "visible", timeout: 12000 });
    interaction = "camera_detail_opened";
  } else if (routeKey === "alerts" && await page.locator(".do-alert-row").count()) {
    await page.locator(".do-alert-row").first().click();
    await page.locator(".do-event-detail-screen").waitFor({ state: "visible", timeout: 12000 });
    interaction = "event_detail_opened";
  } else if (routeKey === "sites" && await page.locator(".do-site-card .do-link").count()) {
    await page.locator(".do-site-card .do-link").first().click();
    await page.locator(".do-dashboard-home, .do-dashboard-business").waitFor({ state: "visible", timeout: 12000 });
    interaction = "site_dashboard_opened";
  } else if (routeKey === "dashboard" && viewportKey === "mobile" && await page.locator(".do-mobile-menu summary").count()) {
    await page.locator(".do-mobile-menu summary").click();
    await page.locator(".do-mobile-menu-sheet").waitFor({ state: "visible", timeout: 5000 });
    interaction = "mobile_menu_opened";
  }
  page.off("console", onConsole);
  results.push({ account, route, viewport: viewportKey, ...state, interaction, consoleErrors });
}

const browser = await playwright.chromium.launch({
  headless: true,
  executablePath: existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome") ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : undefined
});

try {
  for (const account of accounts) {
    for (const [viewportKey, viewport] of viewports) {
      const context = await browser.newContext({ locale: "he-IL", timezoneId: "Asia/Jerusalem", viewport });
      const page = await context.newPage();
      await login(page, account);
      for (const [routeKey, route, selector] of routes) await inspectRoute(page, account.key, routeKey, route, selector, viewportKey);
      await context.close();
    }
  }
} finally {
  await browser.close();
}

const failures = results.filter((item) => item.path.startsWith("/digital-observer/login") || item.overflow || item.deadLinks.length || item.unexplainedDisabled.length || item.consoleErrors.length);
const lines = [
  "# Digital Observer functional reality QA",
  "",
  `Generated: ${new Date().toISOString()}`,
  "Credentials printed: no",
  "Live providers, billing, camera streams and AI invoked: no",
  "Destructive actions submitted: no",
  "",
  "| Account | Route | Viewport | Shell | Overflow | Dead links | Console errors | Interaction | Result |",
  "|---|---|---|---|---|---:|---:|---|---|",
  ...results.map((item) => `| ${item.account} | ${item.route} | ${item.viewport} | ${item.shell} | ${item.overflow ? "FAIL" : "PASS"} | ${item.deadLinks.length} | ${item.consoleErrors.length} | ${item.interaction} | ${failures.includes(item) ? "FAIL" : "PASS"} |`),
  "",
  `Final result: ${failures.length ? "FAIL" : "PASS"}`,
  `Rows checked: ${results.length}`,
  `Failures: ${failures.length}`,
  "",
  "> Enabled actions that would create, delete, review, charge, connect or activate external services were not submitted. Their handlers and readiness copy are checked separately in source review."
];
writeFileSync(resolve(outputDir, "REPORT.md"), `${lines.join("\n")}\n`, "utf8");
writeFileSync(resolve(outputDir, "report.json"), `${JSON.stringify({ generatedAt: new Date().toISOString(), failures, results }, null, 2)}\n`, "utf8");
process.stdout.write(`Functional reality QA checked ${results.length} authenticated route states. Failures: ${failures.length}. Credentials were not printed.\n`);
if (failures.length) process.exitCode = 1;
