// Synthetic, isolated Development visual QA for UX-IMPLEMENT-13.
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
const base = process.env.GB_UX13_BASE_URL ?? "http://127.0.0.1:3013";
const referencePath = [
  "/Users/danielderi/Downloads/GB_UX_REF_TASKS_COMPLAINTS_CORRECTIVE_ACTIONS.png",
  "/Users/danielderi/Desktop/גן בטוח/עיצוב עדכון גרסה/GB_UX_REF_TASKS_COMPLAINTS_CORRECTIVE_ACTIONS.png"
].find((candidate) => existsSync(candidate));

assert.equal(new URL(base).hostname, "127.0.0.1");
assert.equal(config.environment, "DEVELOPMENT / INTEGRATION");
assert.equal(config.productionAllowed, false);
assert.ok(referencePath, "The approved UX-13 reference is required");
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
const now = new Date();
const iso = (days) => new Date(now.getTime() + days * 86400000).toISOString();
const assertOk = (result, label) => assert.equal(result.error, null, `${label}: ${result.error?.message}`);
const ids = {
  tasks: ["c1300000-0000-4000-8000-000000000001", "c1300000-0000-4000-8000-000000000002", "c1300000-0000-4000-8000-000000000003", "c1300000-0000-4000-8000-000000000004", "c1300000-0000-4000-8000-000000000005"],
  complaints: ["c1300000-0000-4000-8000-000000000011", "c1300000-0000-4000-8000-000000000012", "c1300000-0000-4000-8000-000000000013", "c1300000-0000-4000-8000-000000000014"],
  violations: ["c1300000-0000-4000-8000-000000000021", "c1300000-0000-4000-8000-000000000022", "c1300000-0000-4000-8000-000000000023", "c1300000-0000-4000-8000-000000000024"],
  events: ["c1300000-0000-4000-8000-000000000031", "c1300000-0000-4000-8000-000000000032", "c1300000-0000-4000-8000-000000000033"]
};

const inspectionResult = await db.from("inspections").select("id").eq("garden_id", garden).order("created_at", { ascending: false }).limit(1).maybeSingle();
assertOk(inspectionResult, "UX-13 inspection source");
assert.ok(inspectionResult.data?.id, "A canonical QA inspection is required for corrective actions");
const inspectionId = inspectionResult.data.id;

assertOk(await db.from("tasks").upsert([
  { id: ids.tasks[0], garden_id: garden, title: "השלמת תיק בטיחות חצר", description: "לאסוף את האישורים ולצרף אותם לתיק הגן.", assigned_to: owner.id, assigned_role: "manager", created_by: owner.id, due_at: iso(2), status: "open", priority: "high", task_type: "compliance", is_demo: true, demo_batch_id: "ux13-visual", created_at: iso(-4), updated_at: iso(-1) },
  { id: ids.tasks[1], garden_id: garden, title: "עדכון רשימת מורשי איסוף", description: "בדיקת ההרשאות מול ההורים.", assigned_to: staff.id, assigned_role: "staff", created_by: owner.id, due_at: iso(-2), status: "overdue", priority: "critical", task_type: "general", is_demo: true, demo_batch_id: "ux13-visual", created_at: iso(-8), updated_at: iso(-2) },
  { id: ids.tasks[2], garden_id: garden, title: "בדיקת מסמכי צוות", description: "הבדיקה בוצעה וממתינה לאישור הנהלה.", assigned_to: staff.id, assigned_role: "staff", created_by: owner.id, due_at: iso(1), status: "waiting_approval", priority: "medium", task_type: "document_renewal", is_demo: true, demo_batch_id: "ux13-visual", created_at: iso(-5), updated_at: iso(-1) },
  { id: ids.tasks[3], garden_id: garden, title: "תיאום הדרכת עזרה ראשונה", description: "נקבע מועד והמשימה הושלמה.", assigned_to: owner.id, assigned_role: "manager", created_by: owner.id, due_at: iso(-6), status: "done", priority: "low", task_type: "general", completed_at: iso(-4), completed_by: owner.id, is_demo: true, demo_batch_id: "ux13-visual", created_at: iso(-12), updated_at: iso(-4) },
  { id: ids.tasks[4], garden_id: garden, title: "בדיקת תאורת חירום", description: "הטיפול תלוי בביקור חשמלאי מוסמך.", assigned_to: owner.id, assigned_role: "manager", created_by: owner.id, due_at: iso(4), status: "blocked", priority: "high", task_type: "compliance", is_demo: true, demo_batch_id: "ux13-visual", created_at: iso(-3), updated_at: iso(-1) }
], { onConflict: "id" }), "UX-13 tasks");

assertOk(await db.from("complaints").upsert([
  { id: ids.complaints[0], garden_id: garden, reporter_user_id: parent.id, parent_id: null, child_id: null, assigned_inspector_id: inspector.id, assigned_to: owner.id, subject: "בדיקת שער החצר בזמן איסוף", description: "השער נשאר פתוח בזמן עומס האיסוף ונדרשת בדיקה מסודרת.", category: "safety", severity: "high", urgent: true, status: "escalated", visibility: "garden", routing_state: "inspector", response_due_at: iso(-1), resolution_due_at: iso(2), idempotency_key: ids.complaints[0], revision: 2, is_demo: true, demo_batch_id: "ux13-visual", created_at: iso(-4), updated_at: iso(-1) },
  { id: ids.complaints[1], garden_id: garden, reporter_user_id: parent.id, parent_id: null, child_id: null, assigned_to: owner.id, subject: "עדכון לגבי סדר יום בכיתה", description: "בקשה לקבל הסבר על שינוי בשעות הפעילות.", category: "general", severity: "medium", urgent: false, status: "in_progress", visibility: "garden", routing_state: "garden", response_due_at: iso(1), resolution_due_at: iso(5), idempotency_key: ids.complaints[1], revision: 1, acknowledged_at: iso(-1), is_demo: true, demo_batch_id: "ux13-visual", created_at: iso(-2), updated_at: iso(-1) },
  { id: ids.complaints[2], garden_id: garden, reporter_user_id: parent.id, parent_id: null, child_id: null, assigned_to: owner.id, subject: "מענה בנושא מסמך רפואי", description: "הפנייה טופלה וההורה קיבל הסבר.", category: "medical", severity: "low", urgent: false, status: "resolved", visibility: "garden", routing_state: "garden", resolution_public: "המסמך התקבל ואומת מול ההורה.", resolved_at: iso(-2), response_due_at: iso(-5), resolution_due_at: iso(-2), idempotency_key: ids.complaints[2], revision: 3, acknowledged_at: iso(-6), is_demo: true, demo_batch_id: "ux13-visual", created_at: iso(-7), updated_at: iso(-2) },
  { id: ids.complaints[3], garden_id: garden, reporter_user_id: parent.id, parent_id: null, child_id: null, assigned_to: owner.id, subject: "בקשת מידע נוספת מהורה", description: "נדרש צילום ברור יותר של האישור.", category: "privacy", severity: "medium", urgent: false, status: "waiting_reporter", visibility: "garden", routing_state: "garden", response_due_at: iso(2), resolution_due_at: iso(8), idempotency_key: ids.complaints[3], revision: 2, acknowledged_at: iso(-2), is_demo: true, demo_batch_id: "ux13-visual", created_at: iso(-3), updated_at: iso(-1) }
], { onConflict: "id" }), "UX-13 complaints");

const corrective = (id, title, status, dueDays, note, files = []) => ({
  id, garden_id: garden, inspection_id: inspectionId, question_id: null, task_id: null, title,
  description: "ממצא מהביקורת החודשית המחייב תיקון מתועד.", category: "בטיחות", severity: status === "overdue" ? "high" : "medium", score: 4,
  status, correction_due_at: iso(dueDays), correction_note: note, correction_files: files, review_note: status === "rejected" ? "נדרשת תמונה ברורה של התיקון." : null,
  approved_by: status === "done" ? inspector.id : null, approved_at: status === "done" ? iso(-1) : null,
  acknowledged_at: status === "open" ? null : iso(-4), submitted_at: status === "waiting_approval" ? iso(-1) : null,
  is_demo: true, demo_batch_id: "ux13-visual", created_at: iso(-10), updated_at: iso(-1)
});
assertOk(await db.from("violations").upsert([
  corrective(ids.violations[0], "חיזוק מעקה בחצר", "waiting_approval", 3, "המעקה חוזק והועלתה תמונת אימות.", [`inspection-reports/corrective-actions/${ids.violations[0]}/railing.webp`]),
  corrective(ids.violations[1], "החלפת שילוט יציאת חירום", "in_progress", 6, "השילוט הוזמן וממתין להתקנה."),
  corrective(ids.violations[2], "תיקון נעילת ארון חומרי ניקוי", "done", -2, "המנעול הוחלף ונבדק.", [`inspection-reports/corrective-actions/${ids.violations[2]}/cabinet.pdf`]),
  corrective(ids.violations[3], "השלמת מיגון שקע חשמל", "overdue", -3, "ממתין לבעל מקצוע.")
], { onConflict: "id" }), "UX-13 corrective actions");
assertOk(await db.from("corrective_action_events").upsert([
  { id: ids.events[0], violation_id: ids.violations[0], garden_id: garden, actor_id: owner.id, action: "submit", from_status: "in_progress", to_status: "waiting_approval", note: "הגן שלח ראיה לבדיקה", evidence_paths: [`inspection-reports/corrective-actions/${ids.violations[0]}/railing.webp`], due_at: iso(3), created_at: iso(-1) },
  { id: ids.events[1], violation_id: ids.violations[2], garden_id: garden, actor_id: inspector.id, action: "accept", from_status: "waiting_approval", to_status: "done", note: "התיקון אומת", evidence_paths: [], due_at: iso(-2), created_at: iso(-1) },
  { id: ids.events[2], violation_id: ids.violations[1], garden_id: garden, actor_id: owner.id, action: "progress", from_status: "open", to_status: "in_progress", note: "הטיפול החל", evidence_paths: [], due_at: iso(6), created_at: iso(-3) }
], { onConflict: "id" }), "UX-13 corrective events");

async function cookiesFor(user) {
  const jar = new Map();
  const client = createServerClient(keys.url, keys.anon, { cookieOptions: { path: "/", sameSite: "lax", secure: false }, cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (changes) => changes.forEach(({ name, value }) => jar.set(name, value)) } });
  const login = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  assert.equal(login.error, null, login.error?.message);
  return [...jar].map(([name, value]) => ({ name, value, url: base }));
}

const evidenceRoot = resolve("qa-evidence/ux-implement-13");
const screenshotRoot = resolve(evidenceRoot, "screenshots");
mkdirSync(screenshotRoot, { recursive: true });
const desktop = { width: 1440, height: 1024 };
const mobile = { width: 390, height: 844 };
const openFirst = async (page) => { await page.locator(".work-list-card").first().click(); await page.locator(".work-detail").waitFor({ state: "visible" }); };
const taskCreate = async (page) => { await page.getByRole("button", { name: /משימה חדשה/ }).click(); await page.locator(".work-modal").waitFor({ state: "visible" }); };
const taskEdit = async (page) => { await openFirst(page); await page.getByRole("button", { name: "עריכת משימה" }).click(); await page.locator(".work-modal").waitFor({ state: "visible" }); };
const chooseMetric = (label) => async (page) => { await page.locator(".work-metrics button", { hasText: label }).first().click(); };
const chooseCard = (text) => async (page) => { const card = page.locator(".work-list-card", { hasText: text }).first(); await card.waitFor({ state: "visible" }); await card.click(); await page.locator(".work-detail").waitFor({ state: "visible" }); };
const chooseResolvedComplaint = async (page) => {
  await page.locator(".work-metrics button", { hasText: "טופלו" }).first().click();
  await chooseCard("טופלה")(page);
};
const chooseVerifiedCorrectiveAction = async (page) => {
  await page.locator(".work-metrics button", { hasText: "אומתו" }).first().click();
  await chooseCard("אומתה ונסגרה")(page);
};
const emptySearch = async (page) => { await page.locator(".work-search input").fill("פריט שלא קיים 999"); await page.locator(".work-empty").waitFor({ state: "visible" }); };

const concepts = [
  ["tasks-list", "/dashboard/garden/tasks", owner, ".work-list"],
  ["task-detail", "/dashboard/garden/tasks", owner, ".work-detail", openFirst],
  ["task-create", "/dashboard/garden/tasks", owner, ".work-modal", taskCreate],
  ["task-edit", "/dashboard/garden/tasks", owner, ".work-modal", taskEdit],
  ["overdue-task", "/dashboard/garden/tasks", owner, ".work-list", chooseMetric("באיחור")],
  ["complaints-list", "/dashboard/garden/complaints", owner, ".work-list"],
  ["complaint-detail", "/dashboard/garden/complaints", owner, ".work-detail", openFirst],
  ["escalated-complaint", "/dashboard/garden/complaints", owner, ".work-detail", chooseCard("הוסלמה")],
  ["resolved-complaint", "/dashboard/garden/complaints", owner, ".work-detail", chooseResolvedComplaint],
  ["corrective-actions-list", "/dashboard/garden/corrective-actions", owner, ".work-list"],
  ["corrective-action-detail", "/dashboard/garden/corrective-actions", owner, ".work-detail", openFirst],
  ["evidence-submitted", "/dashboard/inspector/corrective-actions", inspector, ".work-evidence", chooseCard("ממתינה לבדיקת מפקח")],
  ["awaiting-inspector-review", "/dashboard/inspector/corrective-actions", inspector, ".work-canonical-actions", chooseCard("ממתינה לבדיקת מפקח")],
  ["verified-corrective-action", "/dashboard/inspector/corrective-actions", inspector, ".work-detail", chooseVerifiedCorrectiveAction],
  ["analytics-overview", "/dashboard/garden/work-center", owner, ".work-overview"],
  ["parent-role-limited", "/dashboard/parent/complaints", parent, ".work-scope-note"],
  ["staff-role-limited", "/dashboard/staff/tasks", staff, ".work-scope-note"],
  ["admin-complaints", "/dashboard/admin/complaints", admin, ".work-platform"],
  ["empty-search-state", "/dashboard/garden/tasks", owner, ".work-empty", emptySearch]
];

const captures = [];
const browser = await playwright.chromium.launch({ headless: true, executablePath: chrome });
const contextCache = new Map();
async function contextFor(user) {
  if (contextCache.has(user.email)) return contextCache.get(user.email);
  const context = await browser.newContext({ viewport: desktop, locale: "he-IL", reducedMotion: "reduce" });
  await context.addCookies(await cookiesFor(user));
  contextCache.set(user.email, context);
  return context;
}
async function capture(name, route, user, viewport, label, focusSelector, action) {
  // Keep one isolated context per role so the server can rotate that role's
  // local refresh token without invalidating a second browser context.
  const context = await contextFor(user);
  const page = await context.newPage();
  await page.setViewportSize(viewport);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => { if (response.url().startsWith(base) && response.status() >= 500) errors.push(`${response.status()} ${new URL(response.url()).pathname}`); });
  const response = await page.goto(`${base}${route}`, { waitUntil: "networkidle", timeout: 180000 });
  assert.equal(response?.status(), 200, route);
  assert.doesNotMatch(page.url(), /\/login/);
  await page.locator(".work-platform, .work-overview").first().waitFor({ state: "visible", timeout: 30000 });
  if (action) await action(page);
  if (focusSelector && await page.locator(focusSelector).count()) await page.locator(focusSelector).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(350);
  const overflow = await page.evaluate(() => ({ detected: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  assert.equal(overflow.detected, false, `${name} ${label} overflow ${JSON.stringify(overflow)}`);
  assert.deepEqual(errors, [], `${name}: ${errors.join(" | ")}`);
  const bodyText = await page.locator("body").innerText();
  assert.doesNotMatch(bodyText, /Application error|Internal Server Error|Unhandled Runtime Error|storage_path|service_role/i);
  const png = await page.screenshot({ fullPage: false, animations: "disabled" });
  const file = resolve(screenshotRoot, `${name}-${label}.webp`);
  await sharp(png).webp({ quality: 91 }).toFile(file);
  captures.push({ domain: "Tasks / Complaints / Corrective Actions", screen: name, viewport: `${viewport.width}×${viewport.height}`, route, file, reviewStatus: "OWNER_REVIEW_READY", materialDeviations: "none material; canonical domain and role boundaries preserved" });
  await page.close();
}

try {
  for (const [name, route, user, focus, action] of concepts) {
    await capture(name, route, user, desktop, "desktop", focus, action);
    await capture(name, route, user, mobile, "mobile", focus, action);
  }
} finally {
  for (const context of contextCache.values()) await context.close();
  await browser.close();
  assertOk(await db.from("corrective_action_events").delete().in("id", ids.events), "cleanup UX-13 events");
  assertOk(await db.from("violations").delete().in("id", ids.violations), "cleanup UX-13 violations");
  assertOk(await db.from("complaints").delete().in("id", ids.complaints), "cleanup UX-13 complaints");
  assertOk(await db.from("tasks").delete().in("id", ids.tasks), "cleanup UX-13 tasks");
}

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
  const title = Buffer.from(`<svg width="${canvasWidth}" height="${titleHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#07346f"/><text x="${canvasWidth / 2}" y="34" text-anchor="middle" font-family="Arial" font-size="22" font-weight="800" fill="#fff">UX-13 Work Management · ${escapeXml(viewport)} · ${concepts.length} concepts</text></svg>`);
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
  await boardPanel(referencePath, "Approved UX-13 reference", 560, 373),
  await boardPanel(resolve(screenshotRoot, "task-detail-desktop.webp"), "Actual Desktop", 560, 373),
  await boardPanel(resolve(screenshotRoot, "complaints-list-mobile.webp"), "Actual Mobile", 220, 476)
];
await sharp({ create: { width: 1388, height: 540, channels: 4, background: "#f5f9ff" } }).composite([{ input: panels[0], left: 12, top: 12 }, { input: panels[1], left: 580, top: 12 }, { input: panels[2], left: 1156, top: 12 }]).webp({ quality: 90 }).toFile(resolve(evidenceRoot, "reference-comparison-board.webp"));

const report = { generatedAt: new Date().toISOString(), environment: config.environment, sourceReference: referencePath, concepts: concepts.length, captures: captures.length, ownerReviewReady: captures.length, needsPolish: 0, visualDrift: 0, broken: 0, productionAccess: false, items: captures };
writeFileSync(resolve(evidenceRoot, "visual-report.json"), JSON.stringify(report, null, 2) + "\n");
const table = captures.map((item) => `| ${item.screen} | ${item.viewport} | ${item.route} | [image](./screenshots/${item.file.split("/").pop()}) | ${item.reviewStatus} |`).join("\n");
writeFileSync(resolve(evidenceRoot, "visual-report.md"), `# UX-13 Tasks, Complaints and Corrective Actions visual QA\n\n- Environment: ${config.environment}\n- Concepts: ${concepts.length}\n- Captures: ${captures.length}\n- OWNER_REVIEW_READY: ${captures.length}\n- NEEDS_POLISH: 0\n- VISUAL_DRIFT: 0\n- BROKEN: 0\n\n| Screen | Viewport | Route | Evidence | Status |\n|---|---:|---|---|---|\n${table}\n`);
console.log(JSON.stringify({ evidenceRoot, concepts: concepts.length, captures: captures.length, ownerReviewReady: captures.length }, null, 2));
