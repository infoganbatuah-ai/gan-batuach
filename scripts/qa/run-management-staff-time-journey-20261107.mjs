// One bounded synthetic Development journey. Never run against Production.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createServerClient } from "@supabase/ssr";
import { config } from "../development/local-database.mjs";
import { localCredentials } from "../development/local-client.mjs";
import { boundedCleanup, fingerprint, persistReceipt, sanitizeError } from "./inspector-retry-guard.mjs";

const app = "http://127.0.0.1:3000";
const expectedSha = process.argv[2];
const toolSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" } }).trim();
const started = Date.now();
const evidenceRoot = resolve(config.runtimeRoot, "staff-time-journey-20261107", "evidence");
const receiptPath = resolve(evidenceRoot, `receipt-${started}.json`);
const evidence = { task: "GB-PRODUCT-STAFF-TIME-JOURNEY-20261107", startedAt: new Date(started).toISOString(), environment: config.environment, expectedSha, toolSha, status: "INCOMPLETE", simulatedGeolocation: true, gpsActions: [], navigations: [], checks: [], captures: [], cleanup: "NOT_STARTED" };
let browser;
let context;
let staffSession;
let createdShiftId;
let staffId;
let gardenId;
let gps;
let runError;
const sessions = [];
const timer = setTimeout(() => { evidence.deadline = "45_SECONDS"; void browser?.close().catch(() => {}); }, 45_000);
timer.unref();

function check(name, condition) {
  evidence.checks.push({ name, pass: Boolean(condition) });
  assert.ok(condition, name);
}
function dayKey() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const x = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${x.year}-${x.month}-${x.day}`;
}
async function session(label, keys, identities) {
  const persona = identities.users.find((x) => x.email === `${label}@integration.qa.invalid`);
  assert.ok(persona?.password, `Missing ${label} synthetic persona`);
  const jar = new Map();
  const client = createServerClient(keys.url, keys.anon, { cookieOptions: { path: "/", sameSite: "lax", secure: false }, cookies: {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: (changes) => changes.forEach(({ name, value }) => jar.set(name, value)),
  } });
  const login = await client.auth.signInWithPassword({ email: persona.email, password: persona.password });
  assert.equal(login.error, null, `${label} login`);
  client.auth.stopAutoRefresh();
  const result = { label, client, jar, userId: login.data.user.id };
  sessions.push(result);
  return result;
}
function cookieHeader(s) { return [...s.jar].map(([name, value]) => `${name}=${value}`).join("; "); }
async function api(s, path, method = "GET", body) {
  const response = await fetch(`${app}${path}`, { method, headers: { Cookie: s ? cookieHeader(s) : "", ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined, redirect: "manual", signal: AbortSignal.timeout(8_000) });
  return { status: response.status, data: await response.json().catch(() => null) };
}
async function gpsAction(s, action, targetStaff = staffId, targetGarden = gardenId) {
  assert.ok(evidence.gpsActions.length < 6, "GPS action cap");
  const result = await api(s, "/api/staff/gps-attendance", "POST", { staff_id: targetStaff, garden_id: targetGarden, action, gps_lat: gps.latitude, gps_lng: gps.longitude, gps_accuracy_meters: 25, network_reliable: true });
  evidence.gpsActions.push({ action, role: s.label, status: result.status, inside: result.data?.data?.inside_geofence ?? null });
  return result;
}
async function ownShifts() {
  const result = await staffSession.client.from("staff_shifts").select("id,staff_id,garden_id,shift_date,actual_start,actual_end,status,total_minutes").eq("staff_id", staffId).eq("garden_id", gardenId).order("created_at", { ascending: false }).limit(25);
  assert.equal(result.error, null);
  return result.data ?? [];
}
function navGuard(page, target) {
  let count = 0;
  page.route(`**${target}**`, (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== app || url.pathname !== target || !(request.isNavigationRequest() || url.searchParams.has("_rsc"))) return route.continue();
    count += 1;
    if (count <= 7) evidence.navigations.push({ target, count, kind: request.isNavigationRequest() ? "document" : "rsc", disposition: count > 6 ? "aborted" : "allowed" });
    if (count === 7) void browser?.close().catch(() => {});
    return count > 6 ? route.abort("blockedbyclient") : route.continue();
  });
}
async function capture(page, name) {
  const path = resolve(evidenceRoot, `${name}.png`);
  await page.screenshot({ path, fullPage: false, timeout: 5_000 });
  chmodSync(path, 0o600);
  evidence.captures.push(path);
}

try {
  assert.match(expectedSha ?? "", /^[a-f0-9]{40}$/);
  assert.equal(config.environment, "DEVELOPMENT / INTEGRATION");
  assert.equal(config.productionAllowed, false);
  const keys = localCredentials();
  assert.equal(keys.url, "http://127.0.0.1:55421");
  const version = await api(null, "/api/development/version");
  check("canonical Development SHA and local backend", version.status === 200 && version.data?.commit === expectedSha && version.data?.backend === "LOCAL_SUPABASE" && version.data?.production === false);
  const identities = JSON.parse(readFileSync(resolve(config.runtimeRoot, "qa-identities.private.json"), "utf8"));
  assert.equal(identities.environment, config.environment);
  staffSession = await session("staff-b", keys, identities);
  const manager = await session("manager-b", keys, identities);
  const foreignManager = await session("manager-a", keys, identities);
  const foreignStaff = await session("staff-a", keys, identities);
  const parent = await session("parent-a", keys, identities);
  const staffResult = await staffSession.client.from("staff").select("id,garden_id,approved_to_work,onboarding_status").eq("profile_id", staffSession.userId).limit(2);
  assert.equal(staffResult.error, null);
  check("one active approved Staff identity", staffResult.data?.length === 1 && staffResult.data[0].approved_to_work && staffResult.data[0].onboarding_status === "active");
  staffId = staffResult.data[0].id; gardenId = staffResult.data[0].garden_id;
  const employment = await staffSession.client.from("staff_kindergarten_employments").select("id,status").eq("staff_id", staffId).eq("garden_id", gardenId).eq("status", "active").limit(2);
  check("existing active employment", !employment.error && employment.data?.length === 1);
  const garden = await staffSession.client.from("gardens").select("gps_lat,gps_lng,attendance_radius_meters,operational_timezone").eq("id", gardenId).maybeSingle();
  assert.equal(garden.error, null);
  gps = { latitude: Number(garden.data?.gps_lat), longitude: Number(garden.data?.gps_lng) };
  check("Garden center permits truthful simulated geofence calculation", Number.isFinite(gps.latitude) && Number.isFinite(gps.longitude) && Number(garden.data?.attendance_radius_meters) > 0 && garden.data?.operational_timezone === "Asia/Jerusalem");
  const today = dayKey();
  const before = await ownShifts();
  check("no prior open or used current-day Staff shift", !before.some((x) => x.actual_start && !x.actual_end) && !before.some((x) => x.shift_date === today));
  evidence.baselineShiftCount = before.length;
  const temp = resolve(config.runtimeRoot, "staff-time-journey-20261107", "tmp");
  mkdirSync(temp, { recursive: true, mode: 0o700 }); mkdirSync(evidenceRoot, { recursive: true, mode: 0o700 });
  process.env.TMPDIR = temp;
  const require = createRequire(import.meta.url);
  const { chromium } = require("/Users/danielderi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
  browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, timeout: 10_000 });
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "he-IL", geolocation: { ...gps, accuracy: 25 }, permissions: ["geolocation"] });
  await context.addCookies([...staffSession.jar].map(([name, value]) => ({ name, value, url: app })));
  const page = await context.newPage();
  page.setDefaultTimeout(8_000);
  page.on("pageerror", (error) => { if (!evidence.firstPageError) evidence.firstPageError = sanitizeError(error); });
  let browserGpsRequests = 0;
  await page.route("**/api/staff/gps-attendance", (route) => {
    if (route.request().method() !== "POST") return route.continue();
    browserGpsRequests += 1;
    evidence.browserGpsRequests = Math.min(browserGpsRequests, 3);
    return browserGpsRequests > 2 ? route.abort("blockedbyclient") : route.continue();
  });
  navGuard(page, "/dashboard/staff/attendance");
  await page.goto(`${app}/dashboard/staff/attendance`, { waitUntil: "domcontentloaded", timeout: 12_000 });
  const inButton = page.getByRole("button", { name: /כניסה למשמרת/ });
  await inButton.waitFor({ state: "visible", timeout: 8_000 });
  await capture(page, "staff-before");
  check("manual Staff UI available without enabling continuous tracking", await inButton.isEnabled());
  const inResponse = page.waitForResponse((r) => r.url().endsWith("/api/staff/gps-attendance") && r.request().method() === "POST", { timeout: 8_000 });
  await inButton.click();
  const startedResponse = await inResponse;
  const startedBody = await startedResponse.json();
  evidence.gpsActions.push({ action: "check_in", role: "staff-b-ui", status: startedResponse.status(), inside: startedBody?.data?.inside_geofence ?? null });
  check("Staff UI check-in accepted within simulated Garden center", startedResponse.status() === 200 && startedBody?.data?.inside_geofence === true && startedBody?.data?.mode === "manual_fallback");
  createdShiftId = startedBody?.data?.shift?.id;
  check("new shift has server start but no end", Boolean(createdShiftId && startedBody?.data?.shift?.actual_start && !startedBody?.data?.shift?.actual_end));
  const duplicate = await gpsAction(staffSession, "check_in");
  check("duplicate check-in reuses same shift", duplicate.status === 200 && duplicate.data?.data?.shift?.id === createdShiftId);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 12_000 });
  const outButton = page.getByRole("button", { name: /יציאה מהמשמרת/ });
  await outButton.waitFor({ state: "visible", timeout: 8_000 });
  check("reload shows open shift and exit action", await outButton.isEnabled());
  await capture(page, "staff-open-after-reload");
  const outResponse = page.waitForResponse((r) => r.url().endsWith("/api/staff/gps-attendance") && r.request().method() === "POST", { timeout: 8_000 });
  await outButton.click();
  const closedResponse = await outResponse;
  const closedBody = await closedResponse.json();
  evidence.gpsActions.push({ action: "check_out", role: "staff-b-ui", status: closedResponse.status(), inside: closedBody?.data?.inside_geofence ?? null });
  check("Staff UI check-out closes same shift", closedResponse.status() === 200 && closedBody?.data?.shift?.id === createdShiftId && Boolean(closedBody?.data?.shift?.actual_end));
  await page.reload({ waitUntil: "domcontentloaded", timeout: 12_000 });
  check("reload shows no open shift", await inButton.isEnabled());
  await capture(page, "staff-closed-after-reload");
  const after = await ownShifts();
  const shift = after.find((x) => x.id === createdShiftId);
  check("one current-day shift with ordered server timestamps", after.length === before.length + 1 && shift?.shift_date === today && shift.actual_start && shift.actual_end && Date.parse(shift.actual_end) >= Date.parse(shift.actual_start));
  evidence.createdShiftId = createdShiftId;
  evidence.observedMinutes = shift.total_minutes;
  const ownApi = await api(staffSession, "/api/staff/shifts");
  check("Staff API matches database after reload", ownApi.status === 200 && ownApi.data?.data?.some((x) => x.id === createdShiftId && x.status === "completed"));
  const period = `${today.slice(0, 7)}-01`;
  const managerRead = await api(manager, `/api/garden/staff-time?period=${period}`);
  check("same-Garden Manager reads the same completed shift", managerRead.status === 200 && managerRead.data?.data?.rows?.some((x) => x.shift_id === createdShiftId && x.staff_id === staffId));
  const managerContext = await browser.newContext({ viewport: { width: 1440, height: 1024 }, locale: "he-IL" });
  await managerContext.addCookies([...manager.jar].map(([name, value]) => ({ name, value, url: app })));
  const managerPage = await managerContext.newPage();
  navGuard(managerPage, "/dashboard/garden/staff-time");
  await managerPage.goto(`${app}/dashboard/garden/staff-time`, { waitUntil: "domcontentloaded", timeout: 12_000 });
  await managerPage.getByText("שעות עבודה ומשמרות").first().waitFor({ state: "visible", timeout: 8_000 });
  await capture(managerPage, "manager-same-garden");
  await boundedCleanup(() => managerContext.close());
  const foreignManagerRead = await api(foreignManager, `/api/garden/staff-time?period=${period}`);
  check("foreign Manager export excludes known shift", foreignManagerRead.status === 200 && !foreignManagerRead.data?.data?.rows?.some((x) => x.shift_id === createdShiftId || x.staff_id === staffId));
  const foreignStaffRead = await api(foreignStaff, "/api/staff/shifts");
  check("foreign Staff list excludes known shift", foreignStaffRead.status === 200 && !foreignStaffRead.data?.data?.some((x) => x.id === createdShiftId));
  const directForeign = await foreignStaff.client.from("staff_shifts").select("id").eq("id", createdShiftId).maybeSingle();
  check("RLS denies foreign Staff known-ID read", !directForeign.error && directForeign.data === null);
  const deniedWrite = await gpsAction(foreignStaff, "check_in", staffId, gardenId);
  check("foreign Staff cannot clock for known Staff/Garden", [403, 404].includes(deniedWrite.status));
  const parentRead = await api(parent, `/api/garden/staff-time?period=${period}`);
  check("Parent denied Manager time ledger", parentRead.status === 403);
  const anonRead = await api(null, `/api/garden/staff-time?period=${period}`);
  check("unauthenticated denied Manager time ledger", [401, 403].includes(anonRead.status));
  check("no first page error or navigation burst", !evidence.firstPageError && !evidence.deadline && evidence.navigations.every((x) => x.disposition === "allowed"));
  evidence.status = "SCOPED_PASS";
} catch (error) {
  runError = error;
  evidence.status = "FAILED";
  evidence.failure = { name: error instanceof Error ? error.name : "UnknownError", fingerprint: fingerprint(error instanceof Error ? error.stack || error.message : error) };
} finally {
  // A partial browser failure must not leave this task's own new shift open.
  if (createdShiftId && staffSession && gps) {
    try {
      const rows = await ownShifts();
      const ownOpen = rows.find((x) => x.id === createdShiftId && x.actual_start && !x.actual_end);
      if (ownOpen && evidence.gpsActions.length < 6) {
        const close = await gpsAction(staffSession, "check_out");
        evidence.recovery = close.status === 200 && close.data?.data?.shift?.id === createdShiftId ? "OWN_SHIFT_CLOSED" : "OWN_SHIFT_CLOSE_FAILED";
      }
    } catch (error) { evidence.recovery = `OWN_SHIFT_STATE_UNKNOWN_${fingerprint(error).slice(0, 16)}`; }
  }
  const cleanupErrors = [];
  if (context) try { await boundedCleanup(() => context.close()); } catch (error) { cleanupErrors.push(fingerprint(error)); }
  if (browser) try { await boundedCleanup(() => browser.close()); } catch (error) { cleanupErrors.push(fingerprint(error)); browser.process()?.kill("SIGKILL"); }
  for (const s of sessions) s.client.auth.stopAutoRefresh();
  clearTimeout(timer);
  evidence.cleanup = cleanupErrors.length ? "FAILED" : "COMPLETE";
  evidence.cleanupErrorFingerprints = cleanupErrors;
  evidence.elapsedMs = Date.now() - started;
  const digest = persistReceipt(receiptPath, evidence);
  console.log(JSON.stringify({ status: evidence.status, receiptPath, sha256: digest, checks: evidence.checks.length, gpsActions: evidence.gpsActions.length, cleanup: evidence.cleanup, recovery: evidence.recovery ?? null }));
  process.exitCode = runError || evidence.cleanup !== "COMPLETE" || evidence.recovery === "OWN_SHIFT_CLOSE_FAILED" ? 1 : 0;
}
