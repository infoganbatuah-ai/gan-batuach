// One read-only, capped default-Turbopack Development navigation. No inspection mutation.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequestGuard, fingerprint, persistReceipt, RUN_DEADLINE_MS, TARGET_PATH, withinDeadline, boundedCleanup } from "./inspector-retry-guard.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const app = "http://127.0.0.1:3000";
const expectedSha = process.argv[2];
const started = Date.now();
const observed = { task: "GB-PRODUCT-DEVELOPMENT-RETRY-LOOP-DIAGNOSIS-20261107", startedAt: new Date(started).toISOString(), expectedSha, environment: "DEVELOPMENT / INTEGRATION", route: TARGET_PATH, readOnly: true, status: "BROKEN", firstError: null, responses: [], requests: [], cleanup: "NOT_STARTED", elapsedMs: null };
let browser;
let context;
let auth;
let receiptPath;
let exitCode = 1;
let resolveActionable;
const actionable = new Promise((resolve) => { resolveActionable = resolve; });

function firstError(kind, value) {
  if (observed.firstError) return;
  observed.firstError = { kind, fingerprint: fingerprint(value) };
  resolveActionable();
}

try {
  assert.match(expectedSha ?? "", /^[a-f0-9]{40}$/);
  const privateConfig = JSON.parse(readFileSync(resolve(root, "development/database/environment.json"), "utf8"));
  receiptPath = resolve(privateConfig.runtimeRoot, "inspector-retry-loop-diagnosis-20261107", "evidence", `receipt-${Date.now()}.json`);
  const rel = relative(privateConfig.runtimeRoot, receiptPath);
  assert.ok(rel && rel !== ".." && !rel.startsWith(`..${sep}`));
  const { config } = await import("../development/local-database.mjs");
  assert.equal(config.environment, "DEVELOPMENT / INTEGRATION");
  assert.equal(config.productionAllowed, false);
  assert.equal(config.runtimeRoot, privateConfig.runtimeRoot);

  await withinDeadline(async () => {
    const versionResponse = await fetch(`${app}/api/development/version`, { signal: AbortSignal.timeout(5_000), redirect: "error" });
    assert.equal(versionResponse.status, 200);
    const version = await versionResponse.json();
    assert.equal(version.commit, expectedSha);
    assert.equal(version.production, false);
    assert.equal(version.backend, "LOCAL_SUPABASE");
    observed.actualSha = version.commit;
    observed.backend = version.backend;

    const identities = JSON.parse(readFileSync(resolve(config.runtimeRoot, "qa-identities.private.json"), "utf8"));
    assert.equal(identities.environment, config.environment);
    const inspector = identities.users.find((user) => user.email === "inspector-a@integration.qa.invalid");
    assert.ok(inspector?.password && inspector?.id, "Synthetic assigned Inspector unavailable");
    const { localCredentials } = await import("../development/local-client.mjs");
    const keys = localCredentials();
    assert.equal(keys.url, "http://127.0.0.1:55421");
    const { createServerClient } = await import("@supabase/ssr");
    const jar = new Map();
    auth = createServerClient(keys.url, keys.anon, {
      cookieOptions: { path: "/", sameSite: "lax", secure: false },
      cookies: {
        getAll: () => [...jar].map(([name, value]) => ({ name, value })),
        setAll: (changes) => changes.forEach(({ name, value }) => jar.set(name, value)),
      },
    });
    const login = await auth.auth.signInWithPassword({ email: inspector.email, password: inspector.password });
    assert.equal(login.error, null, "Synthetic Inspector login failed");
    auth.auth.stopAutoRefresh();

    const require = createRequire(import.meta.url);
    const { chromium } = require("/Users/danielderi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
    browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, timeout: 10_000 });
    context = await browser.newContext({ viewport: { width: 1440, height: 1024 }, locale: "he-IL" });
    await context.addCookies([...jar].map(([name, value]) => ({ name, value, url: app })));
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    const guard = createRequestGuard({ origin: app, onLimit: () => firstError("REQUEST_CAP", "target document/RSC request 7 blocked") });
    observed.requests = guard.attempts;
    await page.route("**/dashboard/inspector/inspections/due**", (route) => guard.route(route));
    page.on("pageerror", (error) => firstError("PAGE_ERROR", error.stack || error.name));
    page.on("console", (message) => { if (message.type() === "error") firstError("CONSOLE_ERROR", message.text()); });
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (url.origin !== app || url.pathname !== TARGET_PATH) return;
      if (observed.responses.length < 12) observed.responses.push({ at: new Date().toISOString(), status: response.status(), kind: response.request().resourceType() });
      if (response.status() >= 500) firstError("SERVER_RESPONSE", `${response.status()} ${url.pathname}`);
    });
    await Promise.race([
      (async () => {
        await page.goto(`${app}${TARGET_PATH}`, { waitUntil: "domcontentloaded", timeout: 20_000 });
        await page.locator('a[href^="/dashboard/inspector/inspections/"]').first().waitFor({ state: "visible", timeout: 15_000 });
        // Catch hydration recovery immediately after the first visible row.
        await page.waitForTimeout(1_500);
      })(),
      actionable,
    ]);
    if (observed.firstError) throw new Error(`ACTIONABLE_${observed.firstError.kind}`);
    assert.equal(guard.limited, false);
    observed.renderedInspectionLink = true;
    observed.status = "NOT_REPRODUCED_UNRESOLVED";
    exitCode = 0;
  }, RUN_DEADLINE_MS);
} catch (error) {
  observed.status = observed.firstError ? "REPRODUCED_CAUSE_UNRESOLVED" : "DIAGNOSTIC_INCONCLUSIVE";
  observed.failure = { kind: error instanceof Error ? error.name : "UnknownError", fingerprint: fingerprint(error instanceof Error ? error.stack || error.message : String(error)) };
} finally {
  auth?.auth.stopAutoRefresh();
  const cleanupErrors = [];
  if (context) try { await boundedCleanup(() => context.close()); } catch (error) { cleanupErrors.push(fingerprint(error)); }
  if (browser) try { await boundedCleanup(() => browser.close()); } catch (error) {
    cleanupErrors.push(fingerprint(error));
    browser.process()?.kill("SIGKILL");
  }
  observed.cleanup = cleanupErrors.length ? "FAILED" : "COMPLETE";
  observed.cleanupErrorFingerprints = cleanupErrors;
  observed.elapsedMs = Date.now() - started;
  if (receiptPath) {
    const receiptSha256 = persistReceipt(receiptPath, observed);
    console.log(JSON.stringify({ status: observed.status, receiptPath, receiptSha256, cleanup: observed.cleanup, targetRequests: observed.requests.length }));
  } else {
    console.error(JSON.stringify({ status: observed.status, receipt: "UNAVAILABLE_BEFORE_PRIVATE_ROOT_VALIDATION", failure: observed.failure }));
  }
  process.exitCode = observed.cleanup === "COMPLETE" ? exitCode : 1;
}
