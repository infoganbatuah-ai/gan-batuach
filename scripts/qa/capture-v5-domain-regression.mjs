import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { config } from "../development/local-database.mjs";
import {
  CaptureAdmissionError, captureResult, requireCaptureSource, requireDevelopmentVersion,
  requireRegressionScenarios, requireSyntheticIdentities,
} from "./uxv6-capture-admission-contract.mjs";

const base = process.env.GB_V5_REGRESSION_BASE_URL ?? "http://127.0.0.1:3000";
const evidenceRoot = process.env.GB_V5_REGRESSION_OUTPUT;
const expectedSha = process.env.GB_V5_EXPECTED_SHA;
const unassignedEmail = process.env.GB_V5_UNASSIGNED_PARENT_EMAIL;

const targets = [
  { id: "auth-registration", route: "/app/login", role: "Public / invited user", reference: "GB_UX_REF_AUTH_MASTER.png" },
  { id: "owner-onboarding", route: "/onboarding/kindergarten?new=1", email: "owner-ab@integration.qa.invalid", role: "Owner / Manager", reference: "GB_UX_REF_OWNER_ONBOARDING.png" },
  { id: "children-classrooms", route: "/dashboard/garden/children", email: "owner-ab@integration.qa.invalid", role: "Owner / Manager", reference: "GB_UX_REF_CHILDREN_CLASSROOMS_PROFILE_ENROLLMENT.png" },
  { id: "parent-unassigned", route: "/dashboard/parent", email: unassignedEmail, role: "Unassigned Parent", reference: "GB_UX_REF_PARENT_FULL_PLATFORM.png" },
  { id: "attendance-pickup", route: "/dashboard/garden/attendance", email: "owner-a@integration.qa.invalid", role: "Owner / Staff / Parent", reference: "GB_UX_REF_ATTENDANCE_PICKUP_OPERATIONS.png" },
  { id: "staff-full-platform", route: "/dashboard/staff", email: "staff-a@integration.qa.invalid", role: "Staff / Owner", reference: "GB_UX_REF_STAFF_FULL_PLATFORM.png" },
  { id: "candidate-recruitment", route: "/dashboard/staff/job-market", email: "staff-candidate@integration.qa.invalid", role: "Candidate / Owner", reference: "GB_UX_REF_STAFF_CANDIDATE_RECRUITMENT.png" },
  { id: "inspector", route: "/dashboard/inspector", email: "inspector-a@integration.qa.invalid", role: "Inspector / Owner", reference: "GB_UX_REF_INSPECTOR_FULL_PLATFORM.png" },
  { id: "finance", route: "/dashboard/garden/finance", email: "owner-a@integration.qa.invalid", role: "Owner / Parent / Admin", reference: "GB_UX_REF_FINANCE_FULL_PLATFORM.png" },
  { id: "messaging-notifications", route: "/dashboard/garden/messages", email: "owner-a@integration.qa.invalid", role: "Owner / Parent / Staff / Inspector", reference: "GB_UX_REF_FULL_PRODUCT_VISUAL_REGRESSION.png" },
  { id: "documents", route: "/dashboard/garden/documents", email: "owner-a@integration.qa.invalid", role: "Owner / Parent / Staff / Inspector / Admin", reference: "GB_UX_REF_DOCUMENTS_FULL_PLATFORM.png" },
  { id: "tasks-complaints-corrective-actions", route: "/dashboard/garden/tasks", email: "owner-a@integration.qa.invalid", role: "Owner / Staff / Parent / Inspector / Admin", reference: "GB_UX_REF_TASKS_COMPLAINTS_CORRECTIVE_ACTIONS.png" },
  { id: "inspections", route: "/dashboard/inspector", email: "inspector-a@integration.qa.invalid", role: "Inspector / Owner", reference: "GB_UX_REF_INSPECTOR_FULL_PLATFORM.png" },
  { id: "reports-analytics", route: "/dashboard/garden/reports", email: "owner-a@integration.qa.invalid", role: "Owner / Staff / Inspector / Admin", reference: "GB_UX_REF_REPORTS_ANALYTICS_FULL_PLATFORM.png" },
  { id: "safety-cameras", route: "/dashboard/garden/cameras", email: "owner-a@integration.qa.invalid", role: "Owner / Parent / Staff / Inspector", reference: "GB_UX_REF_SAFETY_CAMERAS_FULL_PLATFORM.png" },
  { id: "global-states-rtl-accessibility", route: "/ux19-system-states?view=loading", role: "All roles", reference: "GB_UX_REF_GLOBAL_STATES_RTL_ACCESSIBILITY_RESPONSIVE.png" },
];

const viewports = [
  { label: "desktop", width: 1440, height: 1024 },
  { label: "mobile", width: 390, height: 844 },
];

async function cookiesFor(user) {
  const jar = new Map();
  const client = createServerClient(config.apiUrl, anonKey, {
    cookieOptions: { path: "/", sameSite: "lax", secure: false },
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (changes) => changes.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const login = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (login.error || !login.data?.user || login.data.user.id !== user.id) {
    throw new CaptureAdmissionError("SYNTHETIC_LOGIN_FAILED");
  }
  return [...jar].map(([name, value]) => ({ name, value, url: base }));
}

// Admission is intentionally before imports that can open a browser or authenticate.
requireRegressionScenarios(targets);
const git = (args) => execFileSync("git", args, {
  encoding: "utf8", timeout: 10_000, maxBuffer: 1024 * 1024,
}).trim();
const sourceSha = git(["rev-parse", "HEAD"]);
requireCaptureSource({
  branch: git(["branch", "--show-current"]), sourceSha, expectedSha, baseUrl: base,
  environment: config.environment, productionAllowed: config.productionAllowed,
  projectId: config.projectId, runtimeRoot: config.runtimeRoot,
  outputRoot: evidenceRoot, outputExists: Boolean(evidenceRoot && existsSync(evidenceRoot)),
  workingTreeClean: git(["status", "--porcelain"]) === "",
});
if (evidenceRoot !== resolve(evidenceRoot) ||
    realpathSync(dirname(evidenceRoot)) !== dirname(evidenceRoot) ||
    !lstatSync(dirname(evidenceRoot)).isDirectory() ||
    realpathSync(config.runtimeRoot) !== config.runtimeRoot ||
    config.apiUrl !== "http://127.0.0.1:55421") {
  throw new CaptureAdmissionError("UNSAFE_ENVIRONMENT");
}
const fixtureFile = resolve(config.runtimeRoot, "qa-identities.private.json");
if (realpathSync(fixtureFile) !== fixtureFile || !lstatSync(fixtureFile).isFile() ||
    lstatSync(fixtureFile).nlink !== 1) throw new CaptureAdmissionError("UNSAFE_FIXTURE");
const identities = JSON.parse(readFileSync(fixtureFile, "utf8"));
const users = requireSyntheticIdentities({
  metadata: identities, requiredEmails: targets.filter(target => target.id !== "parent-unassigned")
    .map(target => target.email).filter(Boolean), unassignedEmail,
});
const anonKey = process.env.GB_V5_LOCAL_ANON_KEY;
let anonRole;
try {
  anonRole = JSON.parse(Buffer.from(anonKey.split(".")[1], "base64url").toString("utf8")).role;
} catch { throw new CaptureAdmissionError("LOCAL_ANON_KEY_REQUIRED"); }
if (anonRole !== "anon") throw new CaptureAdmissionError("LOCAL_ANON_KEY_REQUIRED");
const versionResponse = await fetch(`${base}/api/development/version`, {
  signal: AbortSignal.timeout(10_000), redirect: "error", cache: "no-store",
});
if (versionResponse.status !== 200) throw new CaptureAdmissionError("VERSION_UNAVAILABLE");
const version = requireDevelopmentVersion(await versionResponse.json(), expectedSha);
const healthResponse = await fetch(`${base}/api/health`, {
  signal: AbortSignal.timeout(10_000), redirect: "error", cache: "no-store",
});
if (healthResponse.status !== 200) throw new CaptureAdmissionError("HEALTH_UNAVAILABLE");

const require = createRequire(import.meta.url);
const playwright = require(process.env.GB_M35_PLAYWRIGHT_MODULE ?? "/Users/danielderi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const sharp = require("sharp");
const { createServerClient } = await import("@supabase/ssr");
const chrome = process.env.GB_M35_CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (!existsSync(chrome)) throw new CaptureAdmissionError("BROWSER_UNAVAILABLE");
mkdirSync(evidenceRoot, { mode: 0o700 });
const screenshotRoot = resolve(evidenceRoot, "screenshots");
mkdirSync(screenshotRoot, { mode: 0o700 });

const captures = [];
let failedAt = null;
let failureCode = null;
let current = null;
let browser;
try {
  browser = await playwright.chromium.launch({ headless: true, executablePath: chrome });
  for (const target of targets) {
    const user = target.email ? users.get(target.email) : null;
    let context;
    current = { id: target.id, viewport: "1440x1024" };
    try {
      context = await browser.newContext({ viewport: viewports[0], locale: "he-IL", reducedMotion: "reduce" });
      if (user) await context.addCookies(await cookiesFor(user));
      for (const viewport of viewports) {
        current = { id: target.id, viewport: `${viewport.width}x${viewport.height}` };
        const page = await context.newPage();
        try {
          await page.setViewportSize(viewport);
          let pageError = false;
          page.on("pageerror", () => { pageError = true; });
          page.on("response", response => {
            if (response.url().startsWith(`${base}/`) && response.status() >= 500) pageError = true;
          });
          const response = await page.goto(`${base}${target.route}`, { waitUntil: "domcontentloaded", timeout: 180_000 });
          if (response?.status() !== 200 || new URL(page.url()).origin !== base ||
              (user && /\/app\/login|\/login$/.test(page.url()))) {
            throw new CaptureAdmissionError("ROUTE_UNAVAILABLE");
          }
          await page.locator("main, .role-app-shell, .app-shell, body").first().waitFor({ state: "visible", timeout: 120_000 });
          if (target.id === "parent-unassigned") {
            await page.locator(".parent-child-card.no-child").first().waitFor({ state: "visible", timeout: 30_000 });
          }
          await page.evaluate(() => scrollTo(0, 0));
          await page.waitForTimeout(850);
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
          if (overflow || pageError) throw new CaptureAdmissionError("RENDER_FAILURE");
          const body = await page.locator("body").innerText();
          if (/Application error|Internal Server Error|Unhandled Runtime Error|SUPABASE_SERVICE_ROLE_KEY|access_token|refresh_token|rtsp:\/\//i.test(body)) {
            throw new CaptureAdmissionError("UNSAFE_RENDER");
          }
          const png = await page.screenshot({ fullPage: false, animations: "disabled" });
          const webp = await sharp(png).webp({ quality: 93, effort: 5 }).toBuffer();
          const file = resolve(screenshotRoot, `${target.id}-${viewport.label}.webp`);
          writeFileSync(file, webp, { flag: "wx", mode: 0o600 });
          captures.push({ id: target.id, viewport: current.viewport, file,
            sha256: createHash("sha256").update(webp).digest("hex") });
        } finally {
          await page.close();
        }
      }
    } finally {
      if (context) await context.close();
    }
  }
} catch (error) {
  failedAt = current;
  failureCode = error instanceof CaptureAdmissionError ? error.code : "CAPTURE_FAILED";
} finally {
  if (browser) {
    try { await browser.close(); }
    catch { failedAt ??= current; failureCode ??= "BROWSER_CLOSE_FAILED"; }
  }
}
const result = captureResult({ targets, viewports, captures, sourceSha, version, failedAt });
writeFileSync(resolve(evidenceRoot, "capture-results.json"), `${JSON.stringify({
  ...result, capturedAt: new Date().toISOString(), failureCode,
}, null, 2)}\n`, { flag: "wx", mode: 0o600 });
if (failureCode) {
  console.error(`V5 regression capture stopped: ${failureCode}`);
  process.exitCode = 1;
} else {
  console.log(`V5 regression captured ${captures.length} screenshots; visual review pending`);
}
