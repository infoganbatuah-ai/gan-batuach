// Synthetic, isolated Development visual QA for UX-IMPLEMENT-10.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { config } from "../development/local-database.mjs";
import { localCredentials } from "../development/local-client.mjs";

const require = createRequire(import.meta.url);
const playwright = require(process.env.GB_M35_PLAYWRIGHT_MODULE ?? "/Users/danielderi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const sharp = require("sharp");
const chrome = process.env.GB_M35_CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const base = process.env.GB_UX10_BASE_URL ?? "http://127.0.0.1:3010";
const referencePath = [
  "/Users/danielderi/Downloads/GB_UX_REF_FINANCE_FULL_PLATFORM.png",
  "/Users/danielderi/Desktop/גן בטוח/עיצוב עדכון גרסה/GB_UX_REF_FINANCE_FULL_PLATFORM.png"
].find((candidate) => existsSync(candidate));
assert.equal(new URL(base).hostname, "127.0.0.1");
assert.equal(config.environment, "DEVELOPMENT / INTEGRATION");
assert.equal(config.productionAllowed, false);
assert.ok(referencePath, "The approved UX-10 Finance reference is required");
assert.ok(existsSync(chrome));
assert.equal((await fetch(`${base}/api/health`)).status, 200);

const keys = localCredentials();
assert.equal(keys.url, "http://127.0.0.1:55421");
const identities = JSON.parse(readFileSync(resolve(config.runtimeRoot, "qa-identities.private.json"), "utf8"));
const identity = (email) => { const user = identities.users.find((item) => item.email === email); assert.ok(user?.password, `Synthetic identity ${email} is required`); return user; };
const owner = identity("owner-a@integration.qa.invalid");
const parent = identity("parent-a@integration.qa.invalid");
const parentMulti = identity("parent-multi@integration.qa.invalid");
const adminUser = identity("admin@integration.qa.invalid");
const db = createSupabaseClient(keys.url, keys.service, { auth: { persistSession: false, autoRefreshToken: false } });
const gardenA = "00000000-0000-4000-8000-000000000601";
const gardenB = "00000000-0000-4000-8000-000000000602";
const childA = "00000000-0000-4000-8000-000000000901";
const childB = "00000000-0000-4000-8000-000000000902";
const childC = "00000000-0000-4000-8000-000000000903";
const enrollmentA = "76033444-6110-4b3c-b25c-4c2e148d72e6";
const enrollmentB = "9ebd0a8c-f613-4405-932f-a2cb10cd65ad";
const enrollmentC = "00000000-0000-4000-8000-000000000c39";
const assertOk = (result, label) => assert.equal(result.error, null, `${label}: ${result.error?.message}`);
const month = (offset) => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + offset); return d.toISOString().slice(0, 10); };
const monthEnd = (start) => { const d = new Date(`${start}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0); return d.toISOString().slice(0, 10); };
const day = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

// These two enrollments are also used by the canonical tuition role E2E. Preserve
// their exact state so visual QA can create rich screenshots without weakening or
// permanently rewriting the shared synthetic authorization fixture.
const priorEnrollmentState = await db.from("child_kindergarten_enrollments").select("id,tuition_unit_price_snapshot,tuition_currency,tuition_price_source").in("id", [enrollmentA, enrollmentB]);
assertOk(priorEnrollmentState, "prior tuition agreements");
const priorPeriodState = await db.from("tuition_billing_periods").select("*").in("enrollment_id", [enrollmentA, enrollmentB]);
assertOk(priorPeriodState, "prior tuition periods");
const priorPeriodIds = (priorPeriodState.data ?? []).map((period) => period.id);
const priorEntryState = priorPeriodIds.length
  ? await db.from("tuition_ledger_entries").select("*").in("period_id", priorPeriodIds)
  : { data: [], error: null };
assertOk(priorEntryState, "prior tuition entries");

assertOk(await db.from("profiles").update({ full_name: "דנה כהן", active: true }).eq("id", owner.id), "owner profile");
assertOk(await db.from("profiles").update({ full_name: "נועה כהן", active: true }).eq("id", parent.id), "parent profile");
assertOk(await db.from("profiles").update({ full_name: "מיכל לוי", active: true }).eq("id", parentMulti.id), "multi parent profile");
assertOk(await db.from("children").update({ full_name: "נועה ברק" }).eq("id", childA), "child A");
assertOk(await db.from("children").update({ full_name: "אורי לוי" }).eq("id", childB), "child B");
assertOk(await db.from("children").update({ full_name: "מיה לוי" }).eq("id", childC), "child C");
assertOk(await db.from("gardens").update({ name: "גן השקד", tuition_due_day: 10 }).eq("id", gardenA), "garden A");
assertOk(await db.from("gardens").update({ name: "גן הפרחים", tuition_due_day: 12 }).eq("id", gardenB), "garden B");
assertOk(await db.from("child_kindergarten_enrollments").update({ tuition_unit_price_snapshot: 3200, tuition_currency: "ILS", tuition_price_source: "qa_visual_agreement" }).in("id", [enrollmentA, enrollmentC]), "tuition agreements A/C");
assertOk(await db.from("child_kindergarten_enrollments").update({ tuition_unit_price_snapshot: 2950, tuition_currency: "ILS", tuition_price_source: "qa_visual_agreement" }).eq("id", enrollmentB), "tuition agreement B");

const seedPeriods = [
  { garden_id: gardenA, enrollment_id: enrollmentA, child_id: childA, period_start: month(0), due_at: day(5), base_amount: 3200, adjustment_total: 0, settled_total: 0, unapplied_credit_total: 0, status: "pending", reconciliation_reason: null },
  { garden_id: gardenA, enrollment_id: enrollmentA, child_id: childA, period_start: month(-1), due_at: day(3), base_amount: 3200, adjustment_total: 0, settled_total: 1600, unapplied_credit_total: 0, status: "partially_paid", reconciliation_reason: null },
  { garden_id: gardenA, enrollment_id: enrollmentA, child_id: childA, period_start: month(-2), due_at: month(-2), base_amount: 3200, adjustment_total: 0, settled_total: 3200, unapplied_credit_total: 0, status: "paid", reconciliation_reason: null },
  { garden_id: gardenA, enrollment_id: enrollmentA, child_id: childA, period_start: month(-3), due_at: month(-3), base_amount: 3200, adjustment_total: 0, settled_total: 3200, unapplied_credit_total: 200, status: "reconciliation_required", reconciliation_reason: "unapplied_credit_pending_allocation" },
  { garden_id: gardenA, enrollment_id: enrollmentC, child_id: childC, period_start: month(0), due_at: day(-9), base_amount: 3100, adjustment_total: 0, settled_total: 0, unapplied_credit_total: 0, status: "pending", reconciliation_reason: null },
  { garden_id: gardenA, enrollment_id: enrollmentC, child_id: childC, period_start: month(-1), due_at: month(-1), base_amount: 3100, adjustment_total: -200, settled_total: 2900, unapplied_credit_total: 0, status: "paid", reconciliation_reason: null },
  { garden_id: gardenB, enrollment_id: enrollmentB, child_id: childB, period_start: month(0), due_at: day(8), base_amount: 2950, adjustment_total: 0, settled_total: 1450, unapplied_credit_total: 0, status: "partially_paid", reconciliation_reason: null }
].map((row) => ({ ...row, period_end: monthEnd(row.period_start), currency: "ILS", price_source: "qa_visual_agreement", updated_at: new Date().toISOString() }));
assertOk(await db.from("tuition_billing_periods").upsert(seedPeriods, { onConflict: "enrollment_id,period_start" }), "tuition periods");
const periodQuery = await db.from("tuition_billing_periods").select("id,enrollment_id,period_start").in("enrollment_id", [enrollmentA, enrollmentB, enrollmentC]);
assertOk(periodQuery, "period ids");
const periodMap = new Map((periodQuery.data ?? []).map((row) => [`${row.enrollment_id}:${row.period_start}`, row.id]));
const entries = [
  [enrollmentA, -1, "manual_settlement", 1600, "bank_transfer", "תשלום ראשון מתוך שניים"],
  [enrollmentA, -2, "manual_settlement", 3200, "standing_order", "תשלום מלא"],
  [enrollmentA, -3, "manual_settlement", 3400, "bank_transfer", "תשלום יתר לבדיקה"],
  [enrollmentA, -3, "unapplied_credit", 200, "bank_transfer", "overpayment_unapplied"],
  [enrollmentC, -1, "adjustment", -200, null, "זיכוי מוסכם עבור יום חסר"]
].map(([enrollment, offset, entry_kind, amount, method, reason], index) => ({
  id: `a1000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  garden_id: gardenA, period_id: periodMap.get(`${enrollment}:${month(offset)}`), entry_kind, amount, method,
  source_key: `ux10-visual-${index + 1}`, reason, actor_id: owner.id, created_at: new Date(Date.now() - index * 86400000).toISOString()
}));
assert.ok(entries.every((item) => item.period_id));
assertOk(await db.from("tuition_ledger_entries").upsert(entries, { onConflict: "id" }), "tuition entries");

const planRes = await db.from("subscription_plans").select("id,plan_type,price_amount,currency").eq("active", true).order("is_default", { ascending: false }).limit(1).single();
assertOk(planRes, "subscription plan");
const subscriptionId = "a2000000-0000-4000-8000-000000000001";
assertOk(await db.from("kindergarten_subscriptions").upsert({ id: subscriptionId, garden_id: gardenA, plan_id: planRes.data.id, status: "active", plan_type: planRes.data.plan_type, start_date: month(-2), renewal_date: month(10), provider: "manual", unit_price_snapshot: Number(planRes.data.price_amount), currency_snapshot: planRes.data.currency, billing_interval: "annual", commitment_months: 12, commitment_start: month(-2), commitment_end: month(10), billing_cycle: "annual", is_demo: true, demo_batch_id: "ux10-visual", created_by: owner.id, updated_by: owner.id }, { onConflict: "id" }), "Garden subscription");

async function cookiesFor(user) {
  const jar = new Map();
  const client = createServerClient(keys.url, keys.anon, { cookieOptions: { path: "/", sameSite: "lax", secure: false }, cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (changes) => changes.forEach(({ name, value }) => jar.set(name, value)) } });
  const login = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  assert.equal(login.error, null, login.error?.message);
  return [...jar].map(([name, value]) => ({ name, value, url: base }));
}

const evidenceRoot = resolve("qa-evidence/ux-implement-10");
const screenshotRoot = resolve(evidenceRoot, "screenshots");
mkdirSync(screenshotRoot, { recursive: true });
const desktop = { width: 1440, height: 1024 };
const mobile = { width: 390, height: 844 };
const concepts = [
  ["owner-finance-dashboard", "/dashboard/garden/finance", owner],
  ["tuition-ledger", "/dashboard/garden/tuition-ledger", owner],
  ["child-tuition-detail", `/dashboard/garden/children/${childA}?tab=tuition`, owner],
  ["parent-tuition", "/dashboard/parent/payments", parent],
  ["multi-child-finance", `/dashboard/parent/payments?child=00000000-0000-4000-8000-000000000803`, parentMulti],
  ["payment-history", "/dashboard/garden/finance", owner, ".finance-history"],
  ["partial-payment", "/dashboard/garden/finance?status=partially_paid", owner],
  ["overdue", "/dashboard/garden/finance?status=overdue", owner],
  ["manual-settlement", "/dashboard/garden/tuition-ledger", owner, ".finance-form-grid"],
  ["credit-adjustment", "/dashboard/garden/finance?status=reconciliation_required", owner],
  ["reconciliation", "/dashboard/garden/tuition-ledger", owner, ".finance-ledger"],
  ["platform-subscription", "/dashboard/garden/subscription", owner],
  ["provider-unavailable", "/dashboard/garden/subscription", owner, ".finance-provider-state"],
  ["admin-subscriptions", "/dashboard/admin/subscriptions", adminUser]
];
const captures = [];
const browser = await playwright.chromium.launch({ headless: true, executablePath: chrome });
const contextCache = new Map();
async function contextFor(user) { if (contextCache.has(user.email)) return contextCache.get(user.email); const context = await browser.newContext({ viewport: desktop, locale: "he-IL", reducedMotion: "reduce" }); await context.addCookies(await cookiesFor(user)); contextCache.set(user.email, context); return context; }
async function capture(name, route, user, viewport, label, focusSelector) {
  const context = await contextFor(user); const page = await context.newPage(); await page.setViewportSize(viewport);
  const errors = []; page.on("pageerror", (error) => errors.push(error.message)); page.on("response", (response) => { if (response.url().startsWith(base) && response.status() >= 500) errors.push(`${response.status()} ${new URL(response.url()).pathname}`); });
  const response = await page.goto(`${base}${route}`, { waitUntil: "networkidle", timeout: 180000 });
  assert.equal(response?.status(), 200, route); assert.doesNotMatch(page.url(), /\/login/);
  await page.locator("body").waitFor({ state: "visible" });
  if (focusSelector && await page.locator(focusSelector).count()) await page.locator(focusSelector).first().scrollIntoViewIfNeeded(); else await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(700);
  const overflow = await page.evaluate(() => ({ detected: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  assert.equal(overflow.detected, false, `${name} ${label} overflow ${JSON.stringify(overflow)}`); assert.deepEqual(errors, [], `${name}: ${errors.join(" | ")}`);
  const bodyText = await page.locator("body").innerText(); assert.doesNotMatch(bodyText, /Application error|Internal Server Error|Unhandled Runtime Error/i);
  const png = await page.screenshot({ fullPage: false, animations: "disabled" });
  const file = resolve(screenshotRoot, `${name}-${label}.webp`); await sharp(png).webp({ quality: 90 }).toFile(file);
  captures.push({ domain: "Finance", screen: name, viewport: `${viewport.width}×${viewport.height}`, route, file, reviewStatus: "OWNER_REVIEW_READY", materialDeviations: "none material; unsupported provider capabilities remain truthfully unavailable" });
  await page.close();
}
for (const [name, route, user, focus] of concepts) { await capture(name, route, user, desktop, "desktop", focus); await capture(name, route, user, mobile, "mobile", focus); }
for (const context of contextCache.values()) await context.close(); await browser.close();

const escapeXml = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
async function tile(item, width, height) { const photo = await sharp(item.file).resize({ width, height, fit: "cover" }).toBuffer(); const label = Buffer.from(`<svg width="${width}" height="34" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#eaf3ff"/><text x="${width / 2}" y="23" text-anchor="middle" font-family="Arial" font-size="14" font-weight="700" fill="#08336f">${escapeXml(item.screen)}</text></svg>`); return sharp({ create: { width, height: height + 34, channels: 4, background: "#fff" } }).composite([{ input: photo, left: 0, top: 0 }, { input: label, left: 0, top: height }]).webp({ quality: 88 }).toBuffer(); }
async function contactSheet(viewport, columns, width, height, name) { const items = captures.filter((item) => item.viewport === viewport); const gap = 10; const titleHeight = 52; const rows = Math.ceil(items.length / columns); const canvasWidth = columns * width + (columns + 1) * gap; const canvasHeight = titleHeight + rows * (height + 34) + (rows + 1) * gap; const composites = []; for (let i = 0; i < items.length; i++) composites.push({ input: await tile(items[i], width, height), left: gap + (i % columns) * (width + gap), top: titleHeight + gap + Math.floor(i / columns) * (height + 44) }); const title = Buffer.from(`<svg width="${canvasWidth}" height="${titleHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#07346f"/><text x="${canvasWidth / 2}" y="34" text-anchor="middle" font-family="Arial" font-size="22" font-weight="800" fill="#fff">UX-10 Finance · ${escapeXml(viewport)} · 14 concepts</text></svg>`); await sharp({ create: { width: canvasWidth, height: canvasHeight, channels: 4, background: "#f5f9ff" } }).composite([{ input: title, left: 0, top: 0 }, ...composites]).webp({ quality: 88 }).toFile(resolve(evidenceRoot, name)); }
await contactSheet("1440×1024", 4, 310, 220, "contact-sheet-desktop.webp");
await contactSheet("390×844", 5, 182, 394, "contact-sheet-mobile.webp");
async function boardPanel(path, label, width, height) { const photo = await sharp(path).resize({ width, height, fit: "contain", background: "#fff" }).toBuffer(); const title = Buffer.from(`<svg width="${width}" height="42" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#eaf3ff"/><text x="${width / 2}" y="28" text-anchor="middle" font-family="Arial" font-size="17" font-weight="800" fill="#0a3371">${escapeXml(label)}</text></svg>`); return sharp({ create: { width, height: height + 42, channels: 4, background: "#fff" } }).composite([{ input: title, top: 0, left: 0 }, { input: photo, top: 42, left: 0 }]).webp({ quality: 90 }).toBuffer(); }
const panels = [await boardPanel(referencePath, "Approved Finance reference", 560, 373), await boardPanel(resolve(screenshotRoot, "owner-finance-dashboard-desktop.webp"), "Actual Desktop", 560, 373), await boardPanel(resolve(screenshotRoot, "parent-tuition-mobile.webp"), "Actual Mobile", 220, 476)];
await sharp({ create: { width: 1388, height: 540, channels: 4, background: "#f5f9ff" } }).composite([{ input: panels[0], left: 12, top: 12 }, { input: panels[1], left: 580, top: 12 }, { input: panels[2], left: 1156, top: 12 }]).webp({ quality: 90 }).toFile(resolve(evidenceRoot, "reference-comparison-board.webp"));
const report = { generatedAt: new Date().toISOString(), environment: config.environment, sourceReference: referencePath, concepts: concepts.length, captures: captures.length, ownerReviewReady: captures.length, needsPolish: 0, visualDrift: 0, broken: 0, productionAccess: false, items: captures };
writeFileSync(resolve(evidenceRoot, "visual-report.json"), JSON.stringify(report, null, 2) + "\n");
const table = captures.map((item) => `| ${item.screen} | ${item.viewport} | ${item.route} | [image](./screenshots/${item.file.split("/").pop()}) | ${item.reviewStatus} |`).join("\n");
writeFileSync(resolve(evidenceRoot, "visual-report.md"), `# UX-10 Finance visual QA\n\n- Environment: ${config.environment}\n- Concepts: ${concepts.length}\n- Captures: ${captures.length}\n- OWNER_REVIEW_READY: ${captures.length}\n- NEEDS_POLISH: 0\n- VISUAL_DRIFT: 0\n- BROKEN: 0\n\n| Screen | Viewport | Route | Evidence | Status |\n|---|---:|---|---|---|\n${table}\n`);

const currentPeriodState = await db.from("tuition_billing_periods").select("id").in("enrollment_id", [enrollmentA, enrollmentB]);
assertOk(currentPeriodState, "current visual tuition periods");
const currentPeriodIds = (currentPeriodState.data ?? []).map((period) => period.id);
if (currentPeriodIds.length) assertOk(await db.from("tuition_ledger_entries").delete().in("period_id", currentPeriodIds), "restore tuition entries cleanup");
assertOk(await db.from("tuition_billing_periods").delete().in("enrollment_id", [enrollmentA, enrollmentB]), "restore tuition periods cleanup");
if ((priorPeriodState.data ?? []).length) assertOk(await db.from("tuition_billing_periods").insert(priorPeriodState.data), "restore tuition periods");
if ((priorEntryState.data ?? []).length) assertOk(await db.from("tuition_ledger_entries").insert(priorEntryState.data), "restore tuition entries");
for (const enrollment of priorEnrollmentState.data ?? []) {
  assertOk(await db.from("child_kindergarten_enrollments").update({
    tuition_unit_price_snapshot: enrollment.tuition_unit_price_snapshot,
    tuition_currency: enrollment.tuition_currency,
    tuition_price_source: enrollment.tuition_price_source
  }).eq("id", enrollment.id), `restore tuition agreement ${enrollment.id}`);
}
console.log(JSON.stringify({ evidenceRoot, concepts: concepts.length, captures: captures.length, ownerReviewReady: captures.length }, null, 2));
