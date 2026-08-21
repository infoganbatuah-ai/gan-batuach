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
  try { playwright = require(candidate); break; } catch { /* Continue to the bundled runtime. */ }
}
if (!playwright) throw new Error("Playwright runtime is unavailable.");

const email = process.env.QA_DEMO_ADMIN_EMAIL;
const password = process.env.QA_DEMO_ADMIN_PASSWORD;
if (!email || !password) throw new Error("Local global-admin QA credentials are required for the legacy transition visual check.");
if (String(process.env.QA_DEMO_ENVIRONMENT).toLowerCase() === "production") throw new Error("Refusing admin visual QA against production.");

const baseUrl = process.env.VISUAL_BASE_URL || "http://127.0.0.1:3000";
const outputDir = resolve(process.cwd(), process.env.VISUAL_OUTPUT_DIR || "qa-evidence/digital-observer-admin-control-center-1");
mkdirSync(outputDir, { recursive: true });

const centerViewports = [
  ["mobile-390", { width: 390, height: 844 }],
  ["mobile-430", { width: 430, height: 932 }],
  ["tablet-768", { width: 768, height: 1024 }],
  ["tablet-landscape", { width: 1024, height: 768 }],
  ["desktop-1366", { width: 1366, height: 768 }],
  ["desktop-1440", { width: 1440, height: 900 }]
];
const secondaryRoutes = [
  ["access", "/digital-observer/admin/access"],
  ["operations", "/digital-observer/admin/operations"],
  ["billing", "/digital-observer/admin/billing"],
  ["packages", "/digital-observer/admin/packages"]
];
const results = [];

async function inspect(page, route, viewport, file) {
  const metrics = await page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const overflowNodes = Array.from(document.querySelectorAll("body *"))
      .map((node) => ({ node, rect: node.getBoundingClientRect(), style: getComputedStyle(node) }))
      .filter(({ rect, style }) => rect.width > 0 && style.position !== "fixed" && (rect.left < -2 || rect.right > viewportWidth + 2))
      .slice(0, 8)
      .map(({ node, rect }) => ({
        selector: `${node.tagName.toLowerCase()}${node.id ? `#${node.id}` : ""}${Array.from(node.classList).slice(0, 3).map((name) => `.${name}`).join("")}`,
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width)
      }));
    const mobile = viewportWidth <= 820;
    const bottomNav = document.querySelector(".do-bottom-nav");
    const blackN = Array.from(document.querySelectorAll("body *")).some((node) => {
      const text = node.textContent?.trim();
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return text === "N"
        && style.position === "fixed"
        && rect.width >= 20 && rect.width <= 64
        && rect.height >= 20 && rect.height <= 64
        && window.innerHeight - rect.bottom < 100;
    });
    return {
      horizontalOverflow: document.documentElement.scrollWidth > viewportWidth + 2,
      overflowNodes,
      mainVisible: Boolean(document.querySelector("main")?.getBoundingClientRect().height),
      adminShell: Boolean(document.querySelector(".do-mode-admin")),
      navCorrect: mobile ? Boolean(bottomNav && getComputedStyle(bottomNav).display !== "none") : Boolean(document.querySelector(".do-sidebar") && getComputedStyle(document.querySelector(".do-sidebar")).display !== "none"),
      blackN,
      errorState: Boolean(document.querySelector(".do-error-state")),
      adminLinks: Array.from(document.querySelectorAll('a[href^="/digital-observer/admin"]')).filter((link) => link.getBoundingClientRect().width > 0).length
    };
  });
  await page.screenshot({ path: resolve(outputDir, file), fullPage: false, animations: "disabled" });
  results.push({ route, viewport: `${viewport.width}x${viewport.height}`, file, ...metrics });
}

const browser = await playwright.chromium.launch({
  headless: true,
  executablePath: existsSync("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : undefined
});

try {
  const context = await browser.newContext({ locale: "he-IL", timezoneId: "Asia/Jerusalem" });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /התחבר/ }).click();
  await page.waitForURL((url) => !url.pathname.endsWith("/login"), { timeout: 25000 });

  for (const [key, viewport] of centerViewports) {
    await page.setViewportSize(viewport);
    await page.goto(`${baseUrl}/digital-observer/admin`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.locator(".do-mode-admin").waitFor({ state: "visible", timeout: 20000 });
    await inspect(page, "/digital-observer/admin", viewport, `center-${key}.png`);
  }

  for (const [routeKey, route] of secondaryRoutes) {
    for (const [viewportKey, viewport] of [["mobile", { width: 390, height: 844 }], ["desktop", { width: 1440, height: 900 }]]) {
      await page.setViewportSize(viewport);
      await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.locator(".do-mode-admin").waitFor({ state: "visible", timeout: 20000 });
      await inspect(page, route, viewport, `${routeKey}-${viewportKey}.png`);
    }
  }
  await context.close();
} finally {
  await browser.close();
}

const failed = results.filter((item) => item.horizontalOverflow || !item.mainVisible || !item.adminShell || !item.navCorrect || item.blackN || item.errorState || item.adminLinks < 5);
const lines = [
  "# DIGITAL OBSERVER ADMIN CONTROL CENTER VISUAL QA",
  "",
  `Generated: ${new Date().toISOString()}`,
  "Authentication: normal Supabase login with an existing legacy admin for transition-only visual verification",
  "Credentials printed: no",
  "Live camera, AI, notification, emergency or billing service activated: no",
  "",
  "| Route | Viewport | Overflow | Admin shell | Navigation | Black N overlay | Error state | Admin links | Screenshot |",
  "|---|---:|---|---|---|---|---|---:|---|",
  ...results.map((item) => `| ${item.route} | ${item.viewport} | ${item.horizontalOverflow ? "FAIL" : "PASS"} | ${item.adminShell ? "PASS" : "FAIL"} | ${item.navCorrect ? "PASS" : "FAIL"} | ${item.blackN ? "FAIL" : "PASS"} | ${item.errorState ? "FAIL" : "PASS"} | ${item.adminLinks} | ${item.file} |`),
  "",
  ...results.filter((item) => item.horizontalOverflow).flatMap((item) => [
    `Overflow detail: ${item.route} ${item.viewport}`,
    ...item.overflowNodes.map((node) => `- ${node.selector}: left=${node.left}, right=${node.right}, width=${node.width}`)
  ]),
  "",
  `Final result: ${failed.length ? "FAIL" : "PASS"}`,
  `Passed: ${results.length - failed.length}/${results.length}`,
  "",
  "> Visual QA proves the authenticated responsive control-center UI. It does not prove live camera, AI, provider, billing, biometric or emergency operation. The dedicated observer-only pilot identity remains a separate access-control gate."
];
writeFileSync(resolve(outputDir, "REPORT.md"), `${lines.join("\n")}\n`, "utf8");
process.stdout.write(`Captured ${results.length} admin screenshots without printing credentials.\n`);
if (failed.length) process.exitCode = 1;
