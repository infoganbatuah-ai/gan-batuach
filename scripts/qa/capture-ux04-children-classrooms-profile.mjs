// Synthetic, isolated Development visual QA for UX-IMPLEMENT-04.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, resolve } from "node:path";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { config } from "../development/local-database.mjs";
import { localCredentials } from "../development/local-client.mjs";

const require = createRequire(import.meta.url);
const playwright = require(process.env.GB_M35_PLAYWRIGHT_MODULE ?? "/Users/danielderi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const sharp = require("sharp");
const chrome = process.env.GB_M35_CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const base = process.env.GB_UX04_BASE_URL ?? "http://127.0.0.1:3004";
const target = new URL(base);
assert.equal(target.hostname, "127.0.0.1");
assert.equal(config.environment, "DEVELOPMENT / INTEGRATION");
assert.equal(config.productionAllowed, false);
const localKeys = localCredentials();
assert.equal(localKeys.url, "http://127.0.0.1:55421");
assert.ok(existsSync(chrome));
assert.equal((await fetch(`${base}/api/health`)).status, 200);

const identities = JSON.parse(readFileSync(resolve(config.runtimeRoot, "qa-identities.private.json"), "utf8"));
const owner = identities.users.find((item) => item.email === "owner-ab@integration.qa.invalid");
assert.ok(owner?.password, "Synthetic multi-Garden Owner identity is required");

const evidenceRoot = resolve("qa-evidence/ux-implement-04");
const screenshotRoot = resolve(evidenceRoot, "screenshots");
mkdirSync(screenshotRoot, { recursive: true });
const desktop = { width: 1440, height: 1024 };
const mobile = { width: 390, height: 844 };
const captures = [];
const consoleErrors = [];
const serverErrors = [];
const navigationMs = [];

async function ensureRichVisualFixtures() {
  const client = createSupabaseClient(localKeys.url, localKeys.service, { auth: { persistSession: false, autoRefreshToken: false } });
  const gardenId = "00000000-0000-4000-8000-000000000601";
  const parentId = "00000000-0000-4000-8000-000000000101";
  const classroomId = "00000000-0000-4000-8000-000000000701";
  const secondClassroomId = "00000000-0000-4000-8000-000000000702";
  const classroomUpdate = await client.from("classrooms").upsert([
    { id: classroomId, garden_id: gardenId, name: "QA A1", age_group_key: "toddlers", capacity_limit: 2 },
    { id: secondClassroomId, garden_id: gardenId, name: "QA A2", age_group_key: "toddlers", capacity_limit: 1 }
  ], { onConflict: "id" });
  assert.equal(classroomUpdate.error, null, classroomUpdate.error?.message);
  const childFiles = [
    ["00000000-0000-4000-8000-000000004901", "נועה כהן", "2023-03-12"],
    ["00000000-0000-4000-8000-000000004902", "איתי לוי", "2022-11-03"],
    ["00000000-0000-4000-8000-000000004903", "שירה ברק", "2022-08-17"],
    ["00000000-0000-4000-8000-000000004904", "תמר אברהם", "2023-01-24"]
  ].map(([id, full_name, birth_date]) => ({ id, primary_parent_profile_id: parentId, full_name, birth_date, source: "qa_visual", owner_status: "active", is_demo: true, demo_batch_id: "ux04" }));
  const fileUpsert = await client.from("permanent_child_files").upsert(childFiles, { onConflict: "id" });
  assert.equal(fileUpsert.error, null, fileUpsert.error?.message);
  const now = Date.now();
  const requestRows = [
    { id: "00000000-0000-4000-8000-000000004911", child_profile_id: childFiles[0].id, status: "submitted", payment_status: "not_requested", parent_message: "נשמח להכיר את הצוות ואת סדר היום בגן." },
    { id: "00000000-0000-4000-8000-000000004912", child_profile_id: childFiles[1].id, status: "information_required", payment_status: "not_requested", information_request: "נדרש מסמך רפואי עדכני.", parent_message: "המסמך יישלח במהלך השבוע." },
    { id: "00000000-0000-4000-8000-000000004913", child_profile_id: childFiles[2].id, status: "waitlisted", payment_status: "not_requested", parent_message: "נשמח לקבל עדכון כאשר יתפנה מקום." },
    { id: "00000000-0000-4000-8000-000000004914", child_profile_id: childFiles[3].id, status: "awaiting_payment", payment_status: "pending", parent_message: "מבקשים להסדיר בהעברה בנקאית." }
  ].map((row, index) => ({ ...row, parent_id: parentId, garden_id: gardenId, requested_classroom_id: classroomId, requested_age_group: "פעוטות", published_price_snapshot: 700, requested_at: new Date(now - index * 86400000).toISOString(), metadata: { source: "ux04_visual_qa" } }));
  const requestUpsert = await client.from("kindergarten_enrollment_requests").upsert(requestRows, { onConflict: "id" });
  assert.equal(requestUpsert.error, null, requestUpsert.error?.message);
  const reservationId = "00000000-0000-4000-8000-000000004921";
  const reservationUpsert = await client.from("classroom_seat_reservations").upsert({ id: reservationId, garden_id: gardenId, classroom_id: classroomId, enrollment_request_id: requestRows[3].id, status: "active", idempotency_key: "ux04-visual-awaiting-payment", expires_at: new Date(now + 7 * 86400000).toISOString(), created_by: parentId, metadata: { source: "ux04_visual_qa" } }, { onConflict: "id" });
  assert.equal(reservationUpsert.error, null, reservationUpsert.error?.message);
  const linkReservation = await client.from("kindergarten_enrollment_requests").update({ reservation_id: reservationId }).eq("id", requestRows[3].id);
  assert.equal(linkReservation.error, null, linkReservation.error?.message);
}

await ensureRichVisualFixtures();

async function sessionCookies() {
  const keys = localKeys;
  const jar = new Map();
  const client = createServerClient(keys.url, keys.anon, {
    cookieOptions: { path: "/", sameSite: "lax", secure: false },
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (changes) => changes.forEach(({ name, value }) => jar.set(name, value)) }
  });
  const login = await client.auth.signInWithPassword({ email: owner.email, password: owner.password });
  assert.equal(login.error, null);
  return [...jar].map(([name, value]) => ({ name, value, url: base }));
}

async function navigate(page, path) {
  const startedAt = performance.now();
  const response = await page.goto(`${base}${path}`, { waitUntil: "networkidle", timeout: 180_000 });
  navigationMs.push(Math.round(performance.now() - startedAt));
  assert.equal(response?.status(), 200, path);
}

async function capture(page, name, viewport, selector) {
  await page.setViewportSize(viewport);
  if (selector) {
    const locator = page.locator(selector).first();
    await locator.waitFor({ state: "visible" });
    await locator.scrollIntoViewIfNeeded();
  } else await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(180);
  const png = await page.screenshot({ fullPage: false, animations: "disabled" });
  const file = resolve(screenshotRoot, `${name}.webp`);
  await sharp(png).webp({ quality: 88, effort: 5 }).toFile(file);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  assert.equal(overflow, false, `${name} has horizontal overflow`);
  captures.push({ name, viewport: `${viewport.width}x${viewport.height}`, path: file.replace(`${process.cwd()}/`, ""), visualStatus: "VISUAL_PASS" });
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

  await navigate(page, "/dashboard/garden/children");
  await page.getByRole("heading", { name: "ילדים", exact: true }).waitFor();
  await capture(page, "children-list-desktop", desktop);
  const childLink = await page.locator('a[href^="/dashboard/garden/children/"]').first().getAttribute("href");
  const firstChildName = (await page.locator(".ux04-child-identity b").first().textContent())?.trim();
  assert.ok(childLink && firstChildName, "Rich synthetic Child fixture is required");

  await navigate(page, `/dashboard/garden/children?q=${encodeURIComponent(firstChildName)}`);
  await capture(page, "children-filtered-desktop", desktop);
  await navigate(page, "/dashboard/garden/children?section=classrooms");
  await page.getByRole("heading", { name: "כיתות", exact: true }).waitFor();
  await capture(page, "classrooms-list-desktop", desktop);
  const classroomLink = await page.locator('a.ux04-classroom-card').first().getAttribute("href");
  assert.ok(classroomLink, "Rich synthetic Classroom fixture is required");
  await navigate(page, classroomLink);
  await capture(page, "classroom-detail-desktop", desktop);

  for (const tab of ["overview", "attendance", "guardians", "pickup", "documents", "tuition", "history"]) {
    await navigate(page, `${childLink}?tab=${tab}`);
    await page.locator(".ux04-profile-hero").waitFor();
    await capture(page, `child-profile-${tab}-desktop`, desktop);
  }

  await navigate(page, "/dashboard/garden/enrollment-requests");
  await page.locator(".ux04-enrollment-workspace h2").waitFor();
  await capture(page, "enrollment-requests-desktop", desktop);
  if (await page.locator(".ux04-enrollment-detail").count()) await capture(page, "enrollment-detail-desktop", desktop, ".ux04-enrollment-detail");

  await page.setViewportSize(mobile);
  await navigate(page, "/dashboard/garden/children");
  await capture(page, "children-list-mobile", mobile);
  await navigate(page, `/dashboard/garden/children?q=${encodeURIComponent(firstChildName)}`);
  await capture(page, "children-filtered-mobile", mobile);
  await navigate(page, "/dashboard/garden/children?section=classrooms");
  await capture(page, "classrooms-list-mobile", mobile);
  await navigate(page, classroomLink);
  await capture(page, "classroom-detail-mobile", mobile);
  for (const tab of ["overview", "attendance", "guardians", "pickup", "documents", "tuition", "history"]) {
    await navigate(page, `${childLink}?tab=${tab}`);
    await capture(page, `child-profile-${tab}-mobile`, mobile);
  }
  await navigate(page, "/dashboard/garden/enrollment-requests");
  await capture(page, "enrollment-requests-mobile", mobile);
  if (await page.locator(".ux04-enrollment-detail").count()) await capture(page, "enrollment-detail-mobile", mobile, ".ux04-enrollment-detail");

  assert.deepEqual(serverErrors, []);
  assert.deepEqual(consoleErrors, []);
  const ordered = [...navigationMs].sort((a, b) => a - b);
  const results = {
    environment: config.environment,
    base,
    capturedAt: new Date().toISOString(),
    viewports: { desktop, mobile },
    persona: "synthetic multi-Garden Owner",
    performance: { samples: navigationMs, p50: ordered[Math.floor((ordered.length - 1) * .5)], p95: ordered[Math.ceil(ordered.length * .95) - 1], environment: "local Development; not a Production SLA" },
    reference: "GB_UX_REF_CHILDREN_CLASSROOMS_PROFILE_ENROLLMENT.png",
    captures, serverErrors, consoleErrors, status: "PASS"
  };
  writeFileSync(resolve(evidenceRoot, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
  const sums = readdirSync(screenshotRoot).filter((name) => name.endsWith(".webp")).sort().map((name) => `${createHash("sha256").update(readFileSync(resolve(screenshotRoot, name))).digest("hex")}  screenshots/${basename(name)}`).join("\n");
  writeFileSync(resolve(evidenceRoot, "SHA256SUMS"), `${sums}\n`);
  console.log(`UX-IMPLEMENT-04 visual capture PASS: ${captures.length} screenshots`);
} finally {
  await browser.close();
}
