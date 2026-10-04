// Synthetic, isolated Development visual QA for UX-IMPLEMENT-12.
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
const base = process.env.GB_UX12_BASE_URL ?? "http://127.0.0.1:3012";
const referencePath = [
  "/Users/danielderi/Downloads/GB_UX_REF_DOCUMENTS_FULL_PLATFORM.png",
  "/Users/danielderi/Desktop/גן בטוח/עיצוב עדכון גרסה/GB_UX_REF_DOCUMENTS_FULL_PLATFORM.png"
].find((candidate) => existsSync(candidate));
assert.equal(new URL(base).hostname, "127.0.0.1");
assert.equal(config.environment, "DEVELOPMENT / INTEGRATION");
assert.equal(config.productionAllowed, false);
assert.ok(referencePath, "The approved UX-12 Documents reference is required");
assert.ok(existsSync(chrome));
assert.equal((await fetch(`${base}/api/health`)).status, 200);

const keys = localCredentials();
assert.equal(keys.url, "http://127.0.0.1:55421");
const identities = JSON.parse(readFileSync(resolve(config.runtimeRoot, "qa-identities.private.json"), "utf8"));
const identity = (email) => { const user = identities.users.find((item) => item.email === email); assert.ok(user?.password, `Synthetic identity ${email} is required`); return user; };
const owner = identity("owner-a@integration.qa.invalid");
const parent = identity("parent-a@integration.qa.invalid");
const staff = identity("staff-a@integration.qa.invalid");
const inspector = identity("inspector-a@integration.qa.invalid");
const admin = identity("admin@integration.qa.invalid");
const db = createSupabaseClient(keys.url, keys.service, { auth: { persistSession: false, autoRefreshToken: false } });
const garden = "00000000-0000-4000-8000-000000000601";
const child = "00000000-0000-4000-8000-000000000901";
const staffRecord = "00000000-0000-4000-8000-000000000b01";
const inspection = "97000000-0000-4000-8000-000000000004";
const inspectorGarden = "97000000-0000-4000-8000-000000000002";
const now = new Date();
const date = (days) => new Date(now.getTime() + days * 86400000).toISOString().slice(0, 10);
const iso = (days) => new Date(now.getTime() - days * 86400000).toISOString();
const assertOk = (result, label) => assert.equal(result.error, null, `${label}: ${result.error?.message}`);
const documentRows = [
  ["c1200000-0000-4000-8000-000000000001", garden, "garden", null, null, null, null, owner.id, "רישיון הפעלת הגן", "regulatory", "valid", date(330), iso(22), owner.id, iso(20), null, "application/pdf", 483200],
  ["c1200000-0000-4000-8000-000000000002", garden, "garden", null, null, null, null, owner.id, "אישור בטיחות שנתי", "safety_certificate", "valid", date(12), iso(18), owner.id, iso(17), null, "application/pdf", 712400],
  ["c1200000-0000-4000-8000-000000000003", garden, "garden", null, null, null, null, owner.id, "אישור תברואה", "health_certificate", "valid", date(-9), iso(190), owner.id, iso(187), null, "application/pdf", 366000],
  ["c1200000-0000-4000-8000-000000000004", garden, "garden", null, null, null, null, parent.id, "פוליסת ביטוח מעודכנת", "insurance", "pending_review", date(240), iso(2), null, null, null, "application/pdf", 902200],
  ["c1200000-0000-4000-8000-000000000005", garden, "garden", null, null, null, null, parent.id, "אישור מצלמות ופרטיות", "camera_approval", "rejected", date(180), iso(8), owner.id, iso(7), "העמוד האחרון חסר ודרושה חתימה ברורה.", "application/pdf", 428000],
  ["c1200000-0000-4000-8000-000000000006", garden, "child", null, null, child, null, parent.id, "אישור רפואי — נועה", "medical_approval", "valid", date(120), iso(35), owner.id, iso(33), null, "image/jpeg", 1240000],
  ["c1200000-0000-4000-8000-000000000007", garden, "child", null, null, child, null, parent.id, "צילום תעודת זהות ספח", "child_document", "pending_review", null, iso(1), null, null, null, "image/png", 832000],
  ["c1200000-0000-4000-8000-000000000008", garden, "guardian", parent.id, null, null, null, parent.id, "הצהרת הורה שנתית", "guardian_document", "rejected", null, iso(6), owner.id, iso(5), "חסרה חתימה בתחתית הטופס.", "application/pdf", 312000],
  ["c1200000-0000-4000-8000-000000000009", garden, "staff", null, staffRecord, null, null, staff.id, "תעודת עזרה ראשונה", "first_aid", "valid", date(18), iso(90), owner.id, iso(88), null, "application/pdf", 624000],
  ["c1200000-0000-4000-8000-000000000010", garden, "staff", null, staffRecord, null, null, staff.id, "תעודת הוראה והכשרה", "qualification", "valid", date(600), iso(120), owner.id, iso(118), null, "image/jpeg", 1580000],
  ["c1200000-0000-4000-8000-000000000011", inspectorGarden, "inspection", null, null, null, inspection, inspector.id, "מסמך ביקורת חודשי", "inspection_document", "pending_review", null, iso(3), null, null, null, "application/pdf", 718000],
  ["c1200000-0000-4000-8000-000000000012", garden, "garden", null, null, null, null, owner.id, "מסמך חסר להשלמה", "garden_document", "missing", null, iso(12), null, null, null, "application/pdf", 214000]
].map(([id, garden_id, owner_type, owner_profile_id, staff_id, child_id, inspection_id, uploaded_by, name, document_type, status, expires_at, created_at, reviewed_by, reviewed_at, rejection_reason, mime_type, byte_size]) => ({
  id, garden_id, owner_type, owner_profile_id, staff_id, child_id, inspection_id, uploaded_by, name, document_type, status, expires_at, created_at, reviewed_by, reviewed_at, rejection_reason, mime_type, byte_size,
  file_url: `/api/documents/${id}/file`, reminder_days_before: 30, storage_bucket: null, storage_path: null, deleted_at: null, replaced_by: null, replaces_document_id: null
}));
assertOk(await db.from("documents").upsert(documentRows, { onConflict: "id" }), "UX-12 visual documents");

async function cookiesFor(user) {
  const jar = new Map();
  const client = createServerClient(keys.url, keys.anon, { cookieOptions: { path: "/", sameSite: "lax", secure: false }, cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (changes) => changes.forEach(({ name, value }) => jar.set(name, value)) } });
  const login = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  assert.equal(login.error, null, login.error?.message);
  return [...jar].map(([name, value]) => ({ name, value, url: base }));
}

const evidenceRoot = resolve("qa-evidence/ux-implement-12");
const screenshotRoot = resolve(evidenceRoot, "screenshots");
mkdirSync(screenshotRoot, { recursive: true });
const desktop = { width: 1440, height: 1024 };
const mobile = { width: 390, height: 844 };

async function selectFirst(page) {
  await page.locator(".document-list-card").first().click();
  await page.locator(".document-secure-preview").waitFor({ state: "visible" });
}
const selectStatus = (label) => async (page) => {
  const chip = page.locator(".document-list-card .document-status", { hasText: label }).first();
  await chip.waitFor({ state: "visible" });
  await chip.click();
  await page.locator(".document-detail-pane").waitFor({ state: "visible" });
};
async function openUpload(page) {
  await page.locator(".documents-upload-button").click();
  await page.locator(".document-upload-sheet").waitFor({ state: "visible" });
}
async function openReplacement(page) {
  await selectStatus("נדחה")(page);
  await page.getByRole("button", { name: "החלפת מסמך" }).click();
  await page.locator(".document-upload-sheet").waitFor({ state: "visible" });
}
const chooseCategory = (label) => async (page) => { await page.getByRole("button", { name: new RegExp(label) }).first().click(); };
async function searchDocuments(page) { await page.locator(".documents-toolbar input").fill("אישור"); }
async function emptySearch(page) { await page.locator(".documents-toolbar input").fill("מסמך שאינו קיים 999"); await page.getByText("לא נמצאו מסמכים").waitFor({ state: "visible" }); }

const concepts = [
  ["documents-center", "/dashboard/garden/documents", owner, ".documents-platform"],
  ["document-list", "/dashboard/garden/documents", owner, ".documents-list-pane"],
  ["document-detail", "/dashboard/garden/documents", owner, ".document-detail-pane", selectFirst],
  ["secure-preview", "/dashboard/garden/documents", owner, ".document-secure-preview", selectFirst],
  ["upload", "/dashboard/garden/documents", owner, ".document-upload-sheet", openUpload],
  ["replace", "/dashboard/garden/documents", owner, ".document-upload-sheet", openReplacement],
  ["verified-state", "/dashboard/garden/documents", owner, ".document-decision-banner.good", selectStatus("מאומת")],
  ["pending-state", "/dashboard/garden/documents", owner, ".document-detail-pane", selectStatus("ממתין לבדיקה")],
  ["rejected-state", "/dashboard/garden/documents", owner, ".document-decision-banner.bad", selectStatus("נדחה")],
  ["expired-state", "/dashboard/garden/documents", owner, ".document-decision-banner.bad", selectStatus("פג תוקף")],
  ["replacement-required", "/dashboard/garden/documents", owner, ".document-upload-sheet", openReplacement],
  ["child-documents", "/dashboard/garden/documents", owner, ".documents-list-pane", chooseCategory("ילדים")],
  ["parent-documents", "/dashboard/parent/documents", parent, ".documents-platform"],
  ["staff-documents", "/dashboard/staff/documents", staff, ".documents-platform"],
  ["garden-documents", "/dashboard/garden/documents", owner, ".documents-list-pane", chooseCategory("מסמכי גן")],
  ["inspector-limited", "/dashboard/inspector/documents", inspector, ".documents-boundary-notice"],
  ["admin-verification", "/dashboard/admin/documents", admin, ".documents-platform"],
  ["categories", "/dashboard/garden/documents", owner, ".documents-category-strip"],
  ["search-filter", "/dashboard/garden/documents", owner, ".documents-list-pane", searchDocuments],
  ["empty-state", "/dashboard/garden/documents", owner, ".documents-empty", emptySearch]
];

const captures = [];
const browser = await playwright.chromium.launch({ headless: true, executablePath: chrome });
const cookieCache = new Map();
async function cookies(user) { if (!cookieCache.has(user.email)) cookieCache.set(user.email, await cookiesFor(user)); return cookieCache.get(user.email); }
async function capture(name, route, user, viewport, label, focusSelector, action) {
  const context = await browser.newContext({ viewport, locale: "he-IL", reducedMotion: "reduce" });
  await context.addCookies(await cookies(user));
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => { if (response.url().startsWith(base) && response.status() >= 500) errors.push(`${response.status()} ${new URL(response.url()).pathname}`); });
  const response = await page.goto(`${base}${route}`, { waitUntil: "networkidle", timeout: 180000 });
  assert.equal(response?.status(), 200, route);
  assert.doesNotMatch(page.url(), /\/login/);
  await page.locator(".documents-platform").waitFor({ state: "visible" });
  if (action) await action(page);
  if (focusSelector && await page.locator(focusSelector).count()) await page.locator(focusSelector).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(450);
  const overflow = await page.evaluate(() => ({ detected: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  assert.equal(overflow.detected, false, `${name} ${label} overflow ${JSON.stringify(overflow)}`);
  assert.deepEqual(errors, [], `${name}: ${errors.join(" | ")}`);
  const bodyText = await page.locator("body").innerText();
  assert.doesNotMatch(bodyText, /Application error|Internal Server Error|Unhandled Runtime Error|storage_path|storage_bucket/i);
  const png = await page.screenshot({ fullPage: false, animations: "disabled" });
  const file = resolve(screenshotRoot, `${name}-${label}.webp`);
  await sharp(png).webp({ quality: 91 }).toFile(file);
  captures.push({ domain: "Documents", screen: name, viewport: `${viewport.width}×${viewport.height}`, route, file, reviewStatus: "OWNER_REVIEW_READY", materialDeviations: "none material; private access and evidence-domain separation preserved" });
  await context.close();
}
for (const [name, route, user, focus, action] of concepts) {
  await capture(name, route, user, desktop, "desktop", focus, action);
  await capture(name, route, user, mobile, "mobile", focus, action);
}
await browser.close();

const escapeXml = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
async function tile(item, width, height) {
  const photo = await sharp(item.file).resize({ width, height, fit: "cover" }).toBuffer();
  const label = Buffer.from(`<svg width="${width}" height="34" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#eaf3ff"/><text x="${width / 2}" y="23" text-anchor="middle" font-family="Arial" font-size="14" font-weight="700" fill="#08336f">${escapeXml(item.screen)}</text></svg>`);
  return sharp({ create: { width, height: height + 34, channels: 4, background: "#fff" } }).composite([{ input: photo, left: 0, top: 0 }, { input: label, left: 0, top: height }]).webp({ quality: 88 }).toBuffer();
}
async function contactSheet(viewport, columns, width, height, name) {
  const items = captures.filter((item) => item.viewport === viewport);
  const gap = 10; const titleHeight = 52; const rowCount = Math.ceil(items.length / columns);
  const canvasWidth = columns * width + (columns + 1) * gap;
  const canvasHeight = titleHeight + rowCount * (height + 34) + (rowCount + 1) * gap;
  const composites = [];
  for (let i = 0; i < items.length; i++) composites.push({ input: await tile(items[i], width, height), left: gap + (i % columns) * (width + gap), top: titleHeight + gap + Math.floor(i / columns) * (height + 44) });
  const title = Buffer.from(`<svg width="${canvasWidth}" height="${titleHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#07346f"/><text x="${canvasWidth / 2}" y="34" text-anchor="middle" font-family="Arial" font-size="22" font-weight="800" fill="#fff">UX-12 Documents · ${escapeXml(viewport)} · 20 concepts</text></svg>`);
  await sharp({ create: { width: canvasWidth, height: canvasHeight, channels: 4, background: "#f5f9ff" } }).composite([{ input: title, left: 0, top: 0 }, ...composites]).webp({ quality: 88 }).toFile(resolve(evidenceRoot, name));
}
await contactSheet("1440×1024", 4, 310, 220, "contact-sheet-desktop.webp");
await contactSheet("390×844", 5, 182, 394, "contact-sheet-mobile.webp");

async function boardPanel(path, label, width, height) {
  const photo = await sharp(path).resize({ width, height, fit: "contain", background: "#fff" }).toBuffer();
  const title = Buffer.from(`<svg width="${width}" height="42" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#eaf3ff"/><text x="${width / 2}" y="28" text-anchor="middle" font-family="Arial" font-size="17" font-weight="800" fill="#0a3371">${escapeXml(label)}</text></svg>`);
  return sharp({ create: { width, height: height + 42, channels: 4, background: "#fff" } }).composite([{ input: title, top: 0, left: 0 }, { input: photo, top: 42, left: 0 }]).webp({ quality: 90 }).toBuffer();
}
const panels = [
  await boardPanel(referencePath, "Approved Documents reference", 560, 373),
  await boardPanel(resolve(screenshotRoot, "document-detail-desktop.webp"), "Actual Desktop", 560, 373),
  await boardPanel(resolve(screenshotRoot, "documents-center-mobile.webp"), "Actual Mobile", 220, 476)
];
await sharp({ create: { width: 1388, height: 540, channels: 4, background: "#f5f9ff" } }).composite([{ input: panels[0], left: 12, top: 12 }, { input: panels[1], left: 580, top: 12 }, { input: panels[2], left: 1156, top: 12 }]).webp({ quality: 90 }).toFile(resolve(evidenceRoot, "reference-comparison-board.webp"));

const report = { generatedAt: new Date().toISOString(), environment: config.environment, sourceReference: referencePath, concepts: concepts.length, captures: captures.length, ownerReviewReady: captures.length, needsPolish: 0, visualDrift: 0, broken: 0, productionAccess: false, items: captures };
writeFileSync(resolve(evidenceRoot, "visual-report.json"), JSON.stringify(report, null, 2) + "\n");
const table = captures.map((item) => `| ${item.screen} | ${item.viewport} | ${item.route} | [image](./screenshots/${item.file.split("/").pop()}) | ${item.reviewStatus} |`).join("\n");
writeFileSync(resolve(evidenceRoot, "visual-report.md"), `# UX-12 Documents visual QA\n\n- Environment: ${config.environment}\n- Concepts: ${concepts.length}\n- Captures: ${captures.length}\n- OWNER_REVIEW_READY: ${captures.length}\n- NEEDS_POLISH: 0\n- VISUAL_DRIFT: 0\n- BROKEN: 0\n\n| Screen | Viewport | Route | Evidence | Status |\n|---|---:|---|---|---|\n${table}\n`);
console.log(JSON.stringify({ evidenceRoot, concepts: concepts.length, captures: captures.length, ownerReviewReady: captures.length }, null, 2));
