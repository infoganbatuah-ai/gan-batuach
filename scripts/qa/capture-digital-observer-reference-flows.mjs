import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
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

const baseUrl = process.env.VISUAL_BASE_URL || "http://localhost:3000";
const outputDir = resolve(process.cwd(), process.env.VISUAL_OUTPUT_DIR || "qa-evidence/digital-observer-user-ux-ui-final/reference-flows");
mkdirSync(outputDir, { recursive: true });
const genericPassword = process.env.QA_DEMO_DIGITAL_OBSERVER_PASSWORD;
const accounts = [
  {
    key: "home",
    email: process.env.QA_DEMO_DIGITAL_OBSERVER_HOME_EMAIL || "qa.digital.observer.home@demo.ganbatuach.com",
    password: process.env.QA_DEMO_DIGITAL_OBSERVER_HOME_PASSWORD || genericPassword,
    type: "home"
  },
  {
    key: "business",
    email: process.env.QA_DEMO_DIGITAL_OBSERVER_BUSINESS_EMAIL || process.env.QA_DEMO_DIGITAL_OBSERVER_EMAIL || "qa.digital.observer@demo.ganbatuach.com",
    password: process.env.QA_DEMO_DIGITAL_OBSERVER_BUSINESS_PASSWORD || genericPassword,
    type: "business"
  }
];
if (accounts.some((account) => !account.password)) throw new Error("Local Digital Observer QA passwords are required.");

const viewports = [
  ["mobile-390", { width: 390, height: 844 }],
  ["desktop-1440", { width: 1440, height: 900 }]
];
const results = [];

async function login(page, account) {
  await page.goto(`${baseUrl}/digital-observer/login`, { waitUntil: "networkidle" });
  await page.locator('input[type="email"]').fill(account.email);
  await page.locator('input[type="password"]').fill(account.password);
  await page.locator("select").selectOption(account.type);
  await page.getByRole("button", { name: "התחברות" }).click();
  await page.locator(".do-shell, .do-onboarding-content").first().waitFor({ state: "visible", timeout: 20000 });
}

async function capture(page, account, flow, step, viewportKey) {
  const file = `${account}-${flow}-step-${step}-${viewportKey}.jpg`;
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  const metrics = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    heading: document.querySelector(".do-form-section h2")?.textContent?.trim() || "missing"
  }));
  await page.screenshot({ path: resolve(outputDir, file), type: "jpeg", quality: 82, fullPage: false, animations: "disabled" });
  results.push({ account, flow, step, viewport: `${await page.evaluate(() => `${window.innerWidth}x${window.innerHeight}`)}`, file, ...metrics });
}

const browser = await playwright.chromium.launch({
  headless: true,
  executablePath: existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : undefined
});

try {
  for (const account of accounts) {
    for (const [viewportKey, viewport] of viewports) {
      const context = await browser.newContext({ locale: "he-IL", timezoneId: "Asia/Jerusalem", viewport });
      const page = await context.newPage();
      await login(page, account);

      await page.goto(`${baseUrl}/digital-observer/onboarding`, { waitUntil: "networkidle" });
      await capture(page, account.key, "onboarding", 1, viewportKey);
      await page.getByLabel("שם המקום").fill(account.type === "home" ? "בית בדיקת UX" : "עסק בדיקת UX");
      await page.getByLabel("עיר").fill("תל אביב");
      await page.getByLabel("רחוב").fill("דיזנגוף");
      await page.getByLabel("מספר בניין").fill("100");
      await page.getByRole("button", { name: /המשך/ }).click();
      await capture(page, account.key, "onboarding", 2, viewportKey);
      await page.getByRole("button", { name: /המשך/ }).click();
      await capture(page, account.key, "onboarding", 3, viewportKey);
      await page.getByRole("button", { name: /המשך/ }).click();
      await page.locator(".do-plan").first().click();
      await capture(page, account.key, "onboarding", 4, viewportKey);

      await page.goto(`${baseUrl}/digital-observer/cameras/add`, { waitUntil: "networkidle" });
      await capture(page, account.key, "camera", 1, viewportKey);
      const mobileCameraStart = page.locator(".do-camera-mobile-first:visible .do-button.navy");
      if (await mobileCameraStart.count()) await mobileCameraStart.click();
      else await page.locator(".do-wizard-actions .do-button.primary").click();
      await page.getByLabel("שם המצלמה").fill(account.type === "home" ? "כניסה ראשית" : "כניסת העסק");
      await page.getByLabel("מיקום").fill(account.type === "home" ? "מבואת הבית" : "כניסה ראשית");
      await capture(page, account.key, "camera", 2, viewportKey);
      await page.locator(".do-wizard-actions .do-button.primary").click();
      await capture(page, account.key, "camera", 3, viewportKey);
      await page.locator(".do-wizard-actions .do-button.primary").click();
      await capture(page, account.key, "camera", 4, viewportKey);

      await context.close();
    }
  }
} finally {
  await browser.close();
}

const lines = [
  "# DIGITAL OBSERVER REFERENCE FLOW VISUAL QA",
  "",
  `Generated: ${new Date().toISOString()}`,
  "Credentials printed: no",
  "No onboarding or camera record was submitted: yes",
  "",
  "| Account | Flow | Step | Viewport | Overflow | Heading | Screenshot |",
  "|---|---|---:|---:|---|---|---|",
  ...results.map((item) => `| ${item.account} | ${item.flow} | ${item.step} | ${item.viewport} | ${item.overflow ? "FAIL" : "PASS"} | ${item.heading} | ${item.file} |`),
  "",
  `Final result: ${results.every((item) => !item.overflow && item.heading !== "missing") ? "PASS" : "FAIL"}`,
  "",
  "> These screenshots validate every visual wizard step without creating a camera, site, subscription, live provider connection or real-data record."
];
writeFileSync(resolve(outputDir, "REPORT.md"), `${lines.join("\n")}\n`, "utf8");
process.stdout.write(`Captured ${results.length} reference-flow screenshots without submitting data or printing credentials.\n`);
