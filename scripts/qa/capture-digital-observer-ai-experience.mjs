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

const playwrightCandidates = [
  "playwright",
  "/Users/danielderi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  "/Users/danielderi/Library/Caches/com.openai.codex/org.sparkle-project.Sparkle/Installation/T08Ed3DUZ/PDjNIEySX/Codex.app/Contents/Resources/cua_node/lib/node_modules/playwright"
];
let playwright;
for (const candidate of playwrightCandidates) {
  try { playwright = require(candidate); break; } catch { /* Try the bundled runtime. */ }
}
if (!playwright) throw new Error("Playwright runtime is unavailable.");

const baseUrl = process.env.VISUAL_BASE_URL || "http://127.0.0.1:3000";
const outputDir = resolve(process.cwd(), "qa-evidence/digital-observer-ai-experience-1");
mkdirSync(outputDir, { recursive: true });

const genericPassword = process.env.QA_DEMO_DIGITAL_OBSERVER_PASSWORD;
const accounts = [
  {
    key: "home",
    email: process.env.QA_DEMO_DIGITAL_OBSERVER_HOME_EMAIL || "qa.digital.observer.home@demo.ganbatuach.com",
    password: process.env.QA_DEMO_DIGITAL_OBSERVER_HOME_PASSWORD || genericPassword,
    accountType: "home"
  },
  {
    key: "business",
    email: process.env.QA_DEMO_DIGITAL_OBSERVER_BUSINESS_EMAIL || process.env.QA_DEMO_DIGITAL_OBSERVER_EMAIL || "qa.digital.observer@demo.ganbatuach.com",
    password: process.env.QA_DEMO_DIGITAL_OBSERVER_BUSINESS_PASSWORD || genericPassword,
    accountType: "business"
  }
];
if (accounts.some((account) => !account.password)) throw new Error("Local Digital Observer QA passwords are required.");

const routes = [
  ["dashboard", "/digital-observer/dashboard"],
  ["observer", "/digital-observer/rules"],
  ["people", "/digital-observer/people"],
  ["camera-add", "/digital-observer/cameras/add"],
  ["onboarding", "/digital-observer/onboarding?type=business"]
];
const viewports = [
  ["mobile", { width: 390, height: 844 }],
  ["tablet", { width: 820, height: 1180 }],
  ["desktop", { width: 1440, height: 900 }]
];
const results = [];

async function login(page, account) {
  await page.goto(`${baseUrl}/digital-observer/login`, { waitUntil: "networkidle" });
  await page.locator(".branded-splash").waitFor({ state: "detached", timeout: 5000 }).catch(async () => {
    await page.locator(".branded-splash").evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  });
  await page.locator('input[type="email"]').fill(account.email);
  await page.locator('input[type="password"]').fill(account.password);
  await page.locator("select").selectOption(account.accountType);
  await page.getByRole("button", { name: "התחברות" }).click();
  const authenticatedView = page.locator(".do-shell, .do-onboarding-content").first();
  await authenticatedView.waitFor({ state: "visible", timeout: 20000 }).catch(async () => {
    const publicError = await page.locator(".do-auth-error, [role='alert']").allTextContents();
    const errorCode = new URL(page.url()).searchParams.get("error") || "unknown";
    throw new Error(`Demo ${account.key} login failed (${errorCode}): ${publicError.join(" ").trim() || "no public error text"}`);
  });
}

const browser = await playwright.chromium.launch({
  headless: true,
  executablePath: existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : undefined
});

try {
  for (const account of accounts) {
    const context = await browser.newContext({ locale: "he-IL", timezoneId: "Asia/Jerusalem" });
    const page = await context.newPage();
    await login(page, account);

    for (const [routeKey, route] of routes) {
      for (const [viewportKey, viewport] of viewports) {
        await page.setViewportSize(viewport);
        await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
        await page.emulateMedia({ reducedMotion: "reduce" });
        const metrics = await page.evaluate(() => {
          const viewportWidth = window.innerWidth;
          const overflowNodes = Array.from(document.querySelectorAll("body *"))
            .map((node) => ({ node, rect: node.getBoundingClientRect() }))
            .filter(({ rect }) => rect.width > 0 && (rect.left < -1 || rect.right > viewportWidth + 1))
            .slice(0, 8)
            .map(({ node, rect }) => ({
              selector: `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ""}${Array.from(node.classList).slice(0, 3).map((name) => `.${name}`).join("")}`,
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              width: Math.round(rect.width)
            }));
          return {
            viewportWidth,
            scrollWidth: document.documentElement.scrollWidth,
            horizontalOverflow: document.documentElement.scrollWidth > viewportWidth + 1,
            overflowNodes,
            visibleMain: Boolean(document.querySelector("main")),
            visibleBottomNav: getComputedStyle(document.querySelector(".do-bottom-nav") || document.body).display !== "none"
          };
        });
        const file = `${account.key}-${routeKey}-${viewportKey}.png`;
        await page.screenshot({ path: resolve(outputDir, file), fullPage: false, animations: "disabled" });
        results.push({ account: account.key, route, viewport: `${viewport.width}x${viewport.height}`, file, ...metrics });
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}

const lines = [
  "# DIGITAL OBSERVER AI EXPERIENCE VISUAL QA",
  "",
  `Generated: ${new Date().toISOString()}`,
  "Credentials printed: no",
  "Data scope: synthetic demo accounts",
  "",
  "| Account | Route | Viewport | Overflow | Main | Mobile nav | Screenshot |",
  "|---|---|---:|---|---|---|---|",
  ...results.map((item) => `| ${item.account} | ${item.route} | ${item.viewport} | ${item.horizontalOverflow ? "FAIL" : "PASS"} | ${item.visibleMain ? "PASS" : "FAIL"} | ${item.viewport.startsWith("390") ? (item.visibleBottomNav ? "PASS" : "FAIL") : "N/A"} | ${item.file} |`),
  "",
  ...results.filter((item) => item.horizontalOverflow).flatMap((item) => [
    `Overflow detail: ${item.account} ${item.route} ${item.viewport} viewport=${item.viewportWidth}px document=${item.scrollWidth}px`,
    ...item.overflowNodes.map((node) => `- ${node.selector}: left=${node.left}, right=${node.right}, width=${node.width}`)
  ]),
  "",
  `Final result: ${results.every((item) => !item.horizontalOverflow && item.visibleMain && (!item.viewport.startsWith("390") || item.visibleBottomNav)) ? "PASS" : "FAIL"}`,
  "",
  "> Screenshots prove layout rendering for synthetic authenticated home and business accounts. They do not prove live camera, biometric, billing, notification, or emergency-provider operation."
];
writeFileSync(resolve(outputDir, "REPORT.md"), `${lines.join("\n")}\n`, "utf8");
process.stdout.write(`Captured ${results.length} screenshots without printing credentials.\n`);
