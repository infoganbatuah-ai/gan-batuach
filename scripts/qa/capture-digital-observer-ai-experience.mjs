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
const outputDir = resolve(process.cwd(), process.env.VISUAL_OUTPUT_DIR || "qa-evidence/digital-observer-ai-experience-1");
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
  ["cameras", "/digital-observer/cameras"],
  ["people", "/digital-observer/people"],
  ["permissions", "/digital-observer/people?tab=permissions"],
  ["camera-add", "/digital-observer/cameras/add"],
  ["alerts", "/digital-observer/alerts"],
  ["alerts-timeline", "/digital-observer/alerts?view=timeline"],
  ["recordings", "/digital-observer/recordings"],
  ["sites", "/digital-observer/sites"],
  ["billing", "/digital-observer/billing"],
  ["billing-payment", "/digital-observer/billing?view=payment"],
  ["settings", "/digital-observer/settings"],
  ["onboarding", "/digital-observer/onboarding"]
];
const publicRoutes = [
  ["login", "/digital-observer/login"],
  ["register", "/digital-observer/register"],
  ["account-type", "/digital-observer/start"],
  ["pricing", "/digital-observer/pricing"]
];
const viewports = [
  ["mobile-390", { width: 390, height: 844 }],
  ["mobile-430", { width: 430, height: 932 }],
  ["tablet-768", { width: 768, height: 1024 }],
  ["tablet-1024", { width: 1024, height: 768 }],
  ["reference-1024", { width: 1024, height: 630 }],
  ["reference-auth", { width: 840, height: 2248 }],
  ["desktop-1366", { width: 1366, height: 768 }],
  ["desktop-1440", { width: 1440, height: 900 }]
];
const requestedRouteKeys = new Set(String(process.env.VISUAL_ROUTE_KEYS || "").split(",").map((value) => value.trim()).filter(Boolean));
const requestedViewportKeys = new Set(String(process.env.VISUAL_VIEWPORT_KEYS || "").split(",").map((value) => value.trim()).filter(Boolean));
const requestedAccountKeys = new Set(String(process.env.VISUAL_ACCOUNT_KEYS || "").split(",").map((value) => value.trim()).filter(Boolean));
const activeRoutes = requestedRouteKeys.size ? routes.filter(([key]) => requestedRouteKeys.has(key)) : routes;
const activePublicRoutes = requestedRouteKeys.size ? publicRoutes.filter(([key]) => requestedRouteKeys.has(key)) : publicRoutes;
const activeViewports = requestedViewportKeys.size ? viewports.filter(([key]) => requestedViewportKeys.has(key)) : viewports;
const activeAccounts = requestedAccountKeys.size ? accounts.filter((account) => requestedAccountKeys.has(account.key)) : accounts;
const results = [];

async function resetVisualPosition(page) {
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
}

async function login(page, account) {
  await page.goto(`${baseUrl}/digital-observer/login`, { waitUntil: "networkidle" });
  await page.locator(".branded-splash").waitFor({ state: "detached", timeout: 5000 }).catch(async () => {
    await page.locator(".branded-splash").evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
  });
  await page.locator("form.do-auth-card[data-hydrated='true']").waitFor({ state: "visible", timeout: 30000 });
  await page.locator('input[type="email"]').fill(account.email);
  await page.locator('input[type="password"]').fill(account.password);
  const accountTypeSelect = page.locator('select[name="observer_account_type"]');
  if (await accountTypeSelect.count()) await accountTypeSelect.selectOption(account.accountType);
  await page.getByRole("button", { name: "התחברות" }).click();
  const authenticatedView = page.locator(".do-shell, .do-onboarding-content").first();
  await authenticatedView.waitFor({ state: "visible", timeout: 60000 }).catch(async () => {
    const publicError = await page.locator(".do-auth-error, [role='alert']").allTextContents();
    const errorCode = new URL(page.url()).searchParams.get("error") || "unknown";
    const failureFile = `login-failure-${account.key}.jpg`;
    await page.screenshot({
      path: resolve(outputDir, failureFile),
      type: "jpeg",
      quality: 80,
      fullPage: false,
      animations: "disabled"
    });
    const visibleText = (await page.locator("body").innerText()).replace(/\s+/g, " ").trim().slice(0, 500);
    throw new Error(
      `Demo ${account.key} login failed (${errorCode}) at ${new URL(page.url()).pathname}: ${publicError.join(" ").trim() || visibleText || "no public error text"}. Evidence: ${failureFile}`
    );
  });
}

const browser = await playwright.chromium.launch({
  headless: true,
  executablePath: existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : undefined
});

try {
  const publicContext = await browser.newContext({ locale: "he-IL", timezoneId: "Asia/Jerusalem" });
  const publicPage = await publicContext.newPage();
  publicPage.setDefaultNavigationTimeout(90000);
  publicPage.setDefaultTimeout(60000);
  for (const [routeKey, route] of activePublicRoutes) {
    for (const [viewportKey, viewport] of activeViewports) {
      await publicPage.setViewportSize(viewport);
      await publicPage.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
      await publicPage.emulateMedia({ reducedMotion: "reduce" });
      await publicPage.locator(".branded-splash").waitFor({ state: "detached", timeout: 5000 }).catch(async () => {
        await publicPage.locator(".branded-splash").evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
      });
      const metrics = await publicPage.evaluate(() => ({
        viewportWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        overflowNodes: [],
        visibleMain: Boolean(document.querySelector("main")),
        visibleBottomNav: false,
        visibleDesktopSidebar: false,
        mobileMenuAvailable: false,
        shellMode: "public",
        visibleCoreActions: true
      }));
      const file = `public-${routeKey}-${viewportKey}.jpg`;
      await publicPage.screenshot({ path: resolve(outputDir, file), type: "jpeg", quality: 80, fullPage: false, animations: "disabled" });
      results.push({ account: "public", route, viewport: `${viewport.width}x${viewport.height}`, file, ...metrics });
    }
  }
  await publicContext.close();

  for (const account of activeAccounts) {
    const context = await browser.newContext({ locale: "he-IL", timezoneId: "Asia/Jerusalem" });
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(90000);
    page.setDefaultTimeout(60000);
    await login(page, account);

    for (const [routeKey, route] of activeRoutes) {
      for (const [viewportKey, viewport] of activeViewports) {
        await page.setViewportSize(viewport);
        await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
        await page.emulateMedia({ reducedMotion: "reduce" });
        await page.locator(".branded-splash").waitFor({ state: "detached", timeout: 5000 }).catch(async () => {
          await page.locator(".branded-splash").evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
        });
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
            visibleBottomNav: getComputedStyle(document.querySelector(".do-bottom-nav") || document.body).display !== "none",
            visibleDesktopSidebar: getComputedStyle(document.querySelector(".do-sidebar") || document.body).display !== "none",
            mobileMenuAvailable: Boolean(document.querySelector(".do-mobile-menu summary")) && getComputedStyle(document.querySelector(".do-mobile-menu") || document.body).display !== "none",
            visibleFlowShell: Boolean(document.querySelector(".do-flow-shell .do-flow-back")) && getComputedStyle(document.querySelector(".do-flow-shell .do-flow-back") || document.body).display !== "none",
            shellMode: document.querySelector(".do-shell")?.getAttribute("data-observer-mode") || (document.querySelector(".do-onboarding-content") ? "onboarding" : "missing"),
            visibleCoreActions: [
              "/digital-observer/cameras",
              "/digital-observer/rules",
              "/digital-observer/billing"
            ].every((href) => Array.from(document.querySelectorAll(".do-sidebar a, .do-mobile-menu-sheet a, main a")).some((link) => link.getAttribute("href")?.startsWith(href)))
          };
        });
        const file = `${account.key}-${routeKey}-${viewportKey}.jpg`;
        await resetVisualPosition(page);
        await page.screenshot({ path: resolve(outputDir, file), type: "jpeg", quality: 80, fullPage: false, animations: "disabled" });
        results.push({ account: account.key, route, viewport: `${viewport.width}x${viewport.height}`, file, ...metrics });
        if (routeKey === "camera-add") {
          if (viewport.width <= 820) {
            await page.locator(".do-camera-mobile-first .do-button.navy").click();
          } else {
            await page.locator(".do-primary-pairing-grid button").first().click();
            await page.locator(".do-wizard-actions .do-button.primary").click();
          }
          await page.locator(".do-camera-test-step").waitFor({ state: "visible", timeout: 10000 });
          await page.getByLabel("שם המצלמה").fill("כניסה ראשית");
          await page.getByLabel("מיקום").fill("כניסה");
          const connectionFile = `${account.key}-camera-step-2-${viewportKey}.jpg`;
          await resetVisualPosition(page);
          await page.screenshot({ path: resolve(outputDir, connectionFile), type: "jpeg", quality: 80, fullPage: false, animations: "disabled" });
          results.push({ account: account.key, route: `${route}#connection`, viewport: `${viewport.width}x${viewport.height}`, file: connectionFile, ...metrics });

          await page.locator(".do-wizard-actions .do-button.primary").click();
          await page.locator(".do-camera-target-step").waitFor({ state: "visible", timeout: 10000 });
          const monitoringFile = `${account.key}-camera-step-3-${viewportKey}.jpg`;
          await resetVisualPosition(page);
          await page.screenshot({ path: resolve(outputDir, monitoringFile), type: "jpeg", quality: 80, fullPage: false, animations: "disabled" });
          results.push({ account: account.key, route: `${route}#monitoring`, viewport: `${viewport.width}x${viewport.height}`, file: monitoringFile, ...metrics });

          await page.locator(".do-wizard-actions .do-button.primary").click();
          await page.locator(".do-camera-summary-detail").waitFor({ state: "visible", timeout: 10000 });
          const summaryFile = `${account.key}-camera-step-4-${viewportKey}.jpg`;
          await resetVisualPosition(page);
          await page.screenshot({ path: resolve(outputDir, summaryFile), type: "jpeg", quality: 80, fullPage: false, animations: "disabled" });
          results.push({ account: account.key, route: `${route}#summary`, viewport: `${viewport.width}x${viewport.height}`, file: summaryFile, ...metrics });
        }
        if (routeKey === "alerts" && await page.locator(".do-alert-row").count()) {
          const detailHref = await page.locator(".do-alert-row").first().getAttribute("href");
          if (!detailHref) throw new Error(`Alert detail link is missing for ${account.key}.`);
          const captureHref = viewport.width <= 430 ? `${detailHref}${detailHref.includes("?") ? "&" : "?"}preview=notification` : detailHref;
          await page.goto(`${baseUrl}${captureHref}`, { waitUntil: "networkidle" });
          await page.locator(viewport.width <= 430 ? ".do-notification-preview-stage" : ".do-event-detail-screen").waitFor({ state: "visible", timeout: 12000 });
          const detailFile = `${account.key}-alert-detail-${viewportKey}.jpg`;
          await resetVisualPosition(page);
          await page.screenshot({ path: resolve(outputDir, detailFile), type: "jpeg", quality: 80, fullPage: false, animations: "disabled" });
          results.push({ account: account.key, route: `${route}?event=selected`, viewport: `${viewport.width}x${viewport.height}`, file: detailFile, ...metrics });
        }
        if (routeKey === "cameras" && await page.locator(".do-camera-live-tile").count()) {
          const detailHref = await page.locator(".do-camera-live-tile").first().getAttribute("href");
          if (!detailHref) throw new Error(`Camera detail link is missing for ${account.key}.`);
          await page.goto(`${baseUrl}${detailHref}`, { waitUntil: "networkidle" });
          await page.locator(".do-camera-detail-grid").waitFor({ state: "visible", timeout: 12000 });
          const detailFile = `${account.key}-camera-detail-${viewportKey}.jpg`;
          await resetVisualPosition(page);
          await page.screenshot({ path: resolve(outputDir, detailFile), type: "jpeg", quality: 80, fullPage: false, animations: "disabled" });
          results.push({ account: account.key, route: `${route}?camera=selected`, viewport: `${viewport.width}x${viewport.height}`, file: detailFile, ...metrics });
        }
        if (routeKey === "dashboard" && viewport.width === 390) {
          await page.locator(".do-mobile-menu summary").click();
          const menuFile = `${account.key}-dashboard-mobile-menu-390.jpg`;
          await page.screenshot({ path: resolve(outputDir, menuFile), type: "jpeg", quality: 80, fullPage: false, animations: "disabled" });
          results.push({ account: account.key, route: `${route}#mobile-menu`, viewport: `${viewport.width}x${viewport.height}`, file: menuFile, ...metrics });
          await page.locator(".do-mobile-menu summary").click();
        }
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
  "| Account | Route | Viewport | Mode | Overflow | Main | Responsive shell | Dashboard actions | Screenshot |",
  "|---|---|---:|---|---|---|---|---|---|",
  ...results.map((item) => {
    const width = Number(item.viewport.split("x")[0]);
    const shellPass = item.account === "public" || item.shellMode === "onboarding" ? true : width <= 820
      ? item.route.startsWith("/digital-observer/cameras/add")
        ? item.visibleFlowShell && !item.visibleDesktopSidebar
        : item.visibleBottomNav && item.mobileMenuAvailable && !item.visibleDesktopSidebar
      : item.visibleDesktopSidebar && !item.visibleBottomNav;
    return `| ${item.account} | ${item.route} | ${item.viewport} | ${item.shellMode} | ${item.horizontalOverflow ? "FAIL" : "PASS"} | ${item.visibleMain ? "PASS" : "FAIL"} | ${shellPass ? "PASS" : "FAIL"} | ${item.route === "/digital-observer/dashboard" ? (item.visibleCoreActions ? "PASS" : "FAIL") : "N/A"} | ${item.file} |`;
  }),
  "",
  ...results.filter((item) => item.horizontalOverflow).flatMap((item) => [
    `Overflow detail: ${item.account} ${item.route} ${item.viewport} viewport=${item.viewportWidth}px document=${item.scrollWidth}px`,
    ...item.overflowNodes.map((node) => `- ${node.selector}: left=${node.left}, right=${node.right}, width=${node.width}`)
  ]),
  "",
  `Final result: ${results.every((item) => {
    const width = Number(item.viewport.split("x")[0]);
    const shellPass = item.account === "public" || item.shellMode === "onboarding" ? true : width <= 820
      ? item.route.startsWith("/digital-observer/cameras/add")
        ? item.visibleFlowShell && !item.visibleDesktopSidebar
        : item.visibleBottomNav && item.mobileMenuAvailable && !item.visibleDesktopSidebar
      : item.visibleDesktopSidebar && !item.visibleBottomNav;
    return !item.horizontalOverflow && item.visibleMain && shellPass && (item.route !== "/digital-observer/dashboard" || item.visibleCoreActions);
  }) ? "PASS" : "FAIL"}`,
  "",
  "> Screenshots prove layout rendering for synthetic authenticated home and business accounts. They do not prove live camera, biometric, billing, notification, or emergency-provider operation."
];
writeFileSync(resolve(outputDir, "REPORT.md"), `${lines.join("\n")}\n`, "utf8");
process.stdout.write(`Captured ${results.length} screenshots without printing credentials.\n`);
