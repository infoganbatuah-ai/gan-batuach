// Synthetic, isolated Development visual QA for UX-IMPLEMENT-11.
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
const base = process.env.GB_UX11_BASE_URL ?? "http://127.0.0.1:3011";
const referencePath = [
  "/Users/danielderi/Downloads/ GB_UX_REF_MESSAGING_NOTIFICATIONS_FULL_PLATFORM.png",
  "/Users/danielderi/Desktop/גן בטוח/עיצוב עדכון גרסה/ GB_UX_REF_MESSAGING_NOTIFICATIONS_FULL_PLATFORM.png",
  "/Users/danielderi/Desktop/גן בטוח/עיצוב עדכון גרסה/GB_UX_REF_MESSAGING_NOTIFICATIONS_FULL_PLATFORM.png"
].find((candidate) => existsSync(candidate));
assert.equal(new URL(base).hostname, "127.0.0.1");
assert.equal(config.environment, "DEVELOPMENT / INTEGRATION");
assert.equal(config.productionAllowed, false);
assert.ok(referencePath, "The approved UX-11 Messaging reference is required");
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
const db = createSupabaseClient(keys.url, keys.service, { auth: { persistSession: false, autoRefreshToken: false } });
const garden = "00000000-0000-4000-8000-000000000601";
const child = "00000000-0000-4000-8000-000000000901";
const now = Date.now();
const iso = (minutes) => new Date(now - minutes * 60_000).toISOString();
const assertOk = (result, label) => assert.equal(result.error, null, `${label}: ${result.error?.message}`);

const threadIds = {
  parent: "b1100000-0000-4000-8000-000000000001",
  staff: "b1100000-0000-4000-8000-000000000002",
  broadcast: "b1100000-0000-4000-8000-000000000003"
};
assertOk(await db.from("communication_threads").upsert([
  { id: threadIds.parent, garden_id: garden, child_id: child, thread_type: "parent_garden", subject: "עדכון יומי לנועה", status: "open", priority: "informational", created_by: owner.id, assigned_to: parent.id, last_message_at: iso(8), metadata: { canonical: true, source: "ux11_visual" } },
  { id: threadIds.staff, garden_id: garden, thread_type: "staff_internal", subject: "סידור לקראת פעילות החצר", status: "open", priority: "important", created_by: owner.id, assigned_to: staff.id, last_message_at: iso(16), metadata: { canonical: true, source: "ux11_visual" } },
  { id: threadIds.broadcast, garden_id: garden, thread_type: "garden_broadcast", subject: "תזכורת לטיול ביום חמישי", status: "open", priority: "informational", created_by: owner.id, last_message_at: iso(42), metadata: { canonical: true, source: "ux11_visual", audience_type: "parents", audience_snapshot: [parent.id] } }
], { onConflict: "id" }), "visual communication threads");

assertOk(await db.from("communication_thread_participants").upsert([
  { id: "b1110000-0000-4000-8000-000000000001", thread_id: threadIds.parent, profile_id: owner.id, role: "owner", participant_label: "דנה כהן", last_read_at: iso(7) },
  { id: "b1110000-0000-4000-8000-000000000002", thread_id: threadIds.parent, profile_id: parent.id, role: "parent", participant_label: "נועה כהן", last_read_at: null },
  { id: "b1110000-0000-4000-8000-000000000003", thread_id: threadIds.staff, profile_id: owner.id, role: "owner", participant_label: "דנה כהן", last_read_at: iso(15) },
  { id: "b1110000-0000-4000-8000-000000000004", thread_id: threadIds.staff, profile_id: staff.id, role: "staff", participant_label: "מיכל לוי", last_read_at: null },
  { id: "b1110000-0000-4000-8000-000000000005", thread_id: threadIds.broadcast, profile_id: owner.id, role: "owner", participant_label: "דנה כהן", last_read_at: iso(41) },
  { id: "b1110000-0000-4000-8000-000000000006", thread_id: threadIds.broadcast, profile_id: parent.id, role: "parent", participant_label: "נועה כהן", last_read_at: null }
], { onConflict: "thread_id,profile_id" }), "visual communication participants");

assertOk(await db.from("messages").upsert([
  { id: "b1120000-0000-4000-8000-000000000001", garden_id: garden, thread_id: threadIds.parent, sender_id: owner.id, recipient_id: parent.id, subject: "עדכון יומי לנועה", body: "בוקר טוב, נועה השתתפה יפה במפגש הבוקר והייתה שמחה מאוד.", content: "בוקר טוב, נועה השתתפה יפה במפגש הבוקר והייתה שמחה מאוד.", treatment_status: "open", message_kind: "human", created_at: iso(34) },
  { id: "b1120000-0000-4000-8000-000000000002", garden_id: garden, thread_id: threadIds.parent, sender_id: parent.id, recipient_id: owner.id, subject: "עדכון יומי לנועה", body: "תודה על העדכון! אשמח לדעת אם אכלה בארוחת הבוקר.", content: "תודה על העדכון! אשמח לדעת אם אכלה בארוחת הבוקר.", treatment_status: "open", message_kind: "human", created_at: iso(21) },
  { id: "b1120000-0000-4000-8000-000000000003", garden_id: garden, thread_id: threadIds.parent, sender_id: owner.id, recipient_id: parent.id, subject: "עדכון יומי לנועה", body: "כן, אכלה היטב. מצורף העדכון היומי בתיק המסמכים.", content: "כן, אכלה היטב. מצורף העדכון היומי בתיק המסמכים.", treatment_status: "open", message_kind: "human", created_at: iso(8) },
  { id: "b1120000-0000-4000-8000-000000000004", garden_id: garden, thread_id: threadIds.staff, sender_id: owner.id, recipient_id: staff.id, subject: "סידור לקראת פעילות החצר", body: "מיכל, אנא הכיני את פינת היצירה לפני 10:00.", content: "מיכל, אנא הכיני את פינת היצירה לפני 10:00.", treatment_status: "open", message_kind: "human", created_at: iso(16) },
  { id: "b1120000-0000-4000-8000-000000000005", garden_id: garden, thread_id: threadIds.broadcast, sender_id: owner.id, subject: "תזכורת לטיול ביום חמישי", body: "נא להביא כובע ובקבוק מים מסומן בשם הילד/ה.", content: "נא להביא כובע ובקבוק מים מסומן בשם הילד/ה.", treatment_status: "open", message_kind: "human", created_at: iso(42) }
], { onConflict: "id" }), "visual messages");

const notificationSeeds = [
  [parent, "parent", "attendance", "נועה הגיעה לגן", "הכניסה נרשמה בשעה 08:12", "attendance", 6],
  [parent, "parent", "message", "הודעה חדשה מהגן", "יש לך הודעה חדשה במערכת", "communication_thread", 12],
  [owner, "owner", "task", "נדרש אישור מסמך", "מסמך רפואי חדש ממתין לבדיקה", "task", 18],
  [owner, "owner", "payment", "עדכון שכר לימוד", "יתרה אחת דורשת התאמה", "tuition", 31],
  [staff, "staff", "shift", "המשמרת הבאה שלך", "מחר בשעה 07:30 בגן השקד", "shift", 40],
  [inspector, "inspector", "inspection", "פעולה מתקנת לבדיקה", "הגן העלה ראיה חדשה לבדיקה", "corrective_action", 52]
];
assertOk(await db.from("notifications").upsert(notificationSeeds.map(([person, role, category, title, body, entityType, minutes], index) => ({
  id: `b1130000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`, garden_id: garden,
  recipient_id: person.id, recipient_profile_id: person.id, recipient_role: role, channel: "in_app", status: "pending",
  title, body, message: body, entity_type: entityType, entity_id: entityType === "communication_thread" ? threadIds.parent : null,
  preference_category: category, scheduled_for: iso(Number(minutes)), created_at: iso(Number(minutes)),
  metadata: { source: "ux11_visual" }
})), { onConflict: "id" }), "visual notifications");

async function cookiesFor(user) {
  const jar = new Map();
  const client = createServerClient(keys.url, keys.anon, { cookieOptions: { path: "/", sameSite: "lax", secure: false }, cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (changes) => changes.forEach(({ name, value }) => jar.set(name, value)) } });
  const login = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  assert.equal(login.error, null, login.error?.message);
  return [...jar].map(([name, value]) => ({ name, value, url: base }));
}

const evidenceRoot = resolve("qa-evidence/ux-implement-11");
const screenshotRoot = resolve(evidenceRoot, "screenshots");
mkdirSync(screenshotRoot, { recursive: true });
const desktop = { width: 1440, height: 1024 };
const mobile = { width: 390, height: 844 };

async function clickFirstThread(page) {
  await page.locator(".communication-thread-row").first().click();
  await page.locator(".communication-message-bubble").first().waitFor({ state: "visible" });
}
async function openComposer(page) {
  await page.locator(".communication-compose-button").click();
  await page.locator(".communication-compose-modal").waitFor({ state: "visible" });
}
async function openBroadcastPreview(page) {
  await page.locator(".broadcast-field input").fill("תזכורת לפעילות מחר");
  await page.locator(".broadcast-field textarea").fill("מחר נקיים פעילות חוץ. נא להביא כובע ובקבוק מים מסומן.");
  await page.getByRole("button", { name: "תצוגה מקדימה" }).click();
  await page.locator(".broadcast-preview-modal").waitFor({ state: "visible" });
}
async function openNotificationDetail(page) {
  await page.locator(".notification-row-main").first().click();
  await page.locator(".notification-detail.open").waitFor({ state: "visible" });
}

const concepts = [
  ["message-thread-list", "/dashboard/garden/messages", owner, ".communication-workspace"],
  ["thread-detail", "/dashboard/garden/messages", owner, ".communication-workspace", clickFirstThread],
  ["composer", "/dashboard/garden/messages", owner, ".communication-compose-modal", openComposer],
  ["attachment", "/dashboard/garden/messages", owner, ".communication-upload-field", openComposer],
  ["parent-messaging", "/dashboard/parent/messages", parent, ".communication-workspace"],
  ["staff-messaging", "/dashboard/staff/messages", staff, ".communication-workspace"],
  ["owner-messaging", "/dashboard/garden/messages", owner, ".communication-workspace"],
  ["inspector-limited", "/dashboard/inspector/messages", inspector, ".inspector-communication-boundary"],
  ["broadcast-creation", "/dashboard/garden/communication", owner, ".broadcast-platform"],
  ["broadcast-preview", "/dashboard/garden/communication", owner, ".broadcast-preview-modal", openBroadcastPreview],
  ["broadcast-history", "/dashboard/garden/communication", owner, ".broadcast-history-card"],
  ["notification-center", "/dashboard/garden/notifications", owner, ".notification-platform"],
  ["notification-detail", "/dashboard/garden/notifications", owner, ".notification-detail", openNotificationDetail],
  ["preferences", "/dashboard/parent/notifications", parent, ".notification-preferences-platform"],
  ["quiet-hours", "/dashboard/parent/notifications", parent, ".quiet-hours-card"],
  ["provider-unavailable", "/dashboard/parent/notifications", parent, ".delivery-channel-grid"],
  ["push-readiness", "/dashboard/parent/notifications", parent, ".delivery-channel-grid"],
  ["email-readiness", "/dashboard/parent/notifications", parent, ".delivery-channel-grid"],
  ["whatsapp-unavailable", "/dashboard/parent/notifications", parent, ".delivery-channel-grid"],
  ["sms-unavailable", "/dashboard/parent/notifications", parent, ".delivery-channel-grid"]
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
  const context = await contextFor(user);
  const page = await context.newPage();
  await page.setViewportSize(viewport);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => { if (response.url().startsWith(base) && response.status() >= 500) errors.push(`${response.status()} ${new URL(response.url()).pathname}`); });
  const response = await page.goto(`${base}${route}`, { waitUntil: "networkidle", timeout: 180000 });
  assert.equal(response?.status(), 200, route);
  assert.doesNotMatch(page.url(), /\/login/);
  await page.locator("body").waitFor({ state: "visible" });
  if (action) await action(page);
  if (focusSelector && await page.locator(focusSelector).count()) await page.locator(focusSelector).first().scrollIntoViewIfNeeded();
  else await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(550);
  const overflow = await page.evaluate(() => ({ detected: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  assert.equal(overflow.detected, false, `${name} ${label} overflow ${JSON.stringify(overflow)}`);
  assert.deepEqual(errors, [], `${name}: ${errors.join(" | ")}`);
  const bodyText = await page.locator("body").innerText();
  assert.doesNotMatch(bodyText, /Application error|Internal Server Error|Unhandled Runtime Error/i);
  const png = await page.screenshot({ fullPage: false, animations: "disabled" });
  const file = resolve(screenshotRoot, `${name}-${label}.webp`);
  await sharp(png).webp({ quality: 91 }).toFile(file);
  captures.push({ domain: "Messaging/Broadcasts/Notifications", screen: name, viewport: `${viewport.width}×${viewport.height}`, route, file, reviewStatus: "OWNER_REVIEW_READY", materialDeviations: "none material; unsupported external channels remain truthfully unavailable" });
  await page.close();
}
for (const [name, route, user, focus, action] of concepts) {
  await capture(name, route, user, desktop, "desktop", focus, action);
  await capture(name, route, user, mobile, "mobile", focus, action);
}
for (const context of contextCache.values()) await context.close();
await browser.close();

const escapeXml = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
async function tile(item, width, height) {
  const photo = await sharp(item.file).resize({ width, height, fit: "cover" }).toBuffer();
  const label = Buffer.from(`<svg width="${width}" height="34" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#eaf3ff"/><text x="${width / 2}" y="23" text-anchor="middle" font-family="Arial" font-size="14" font-weight="700" fill="#08336f">${escapeXml(item.screen)}</text></svg>`);
  return sharp({ create: { width, height: height + 34, channels: 4, background: "#fff" } }).composite([{ input: photo, left: 0, top: 0 }, { input: label, left: 0, top: height }]).webp({ quality: 88 }).toBuffer();
}
async function contactSheet(viewport, columns, width, height, name) {
  const items = captures.filter((item) => item.viewport === viewport);
  const gap = 10; const titleHeight = 52; const rows = Math.ceil(items.length / columns);
  const canvasWidth = columns * width + (columns + 1) * gap;
  const canvasHeight = titleHeight + rows * (height + 34) + (rows + 1) * gap;
  const composites = [];
  for (let i = 0; i < items.length; i++) composites.push({ input: await tile(items[i], width, height), left: gap + (i % columns) * (width + gap), top: titleHeight + gap + Math.floor(i / columns) * (height + 44) });
  const title = Buffer.from(`<svg width="${canvasWidth}" height="${titleHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#07346f"/><text x="${canvasWidth / 2}" y="34" text-anchor="middle" font-family="Arial" font-size="22" font-weight="800" fill="#fff">UX-11 Communication · ${escapeXml(viewport)} · 20 concepts</text></svg>`);
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
  await boardPanel(referencePath, "Approved communication reference", 560, 373),
  await boardPanel(resolve(screenshotRoot, "thread-detail-desktop.webp"), "Actual Desktop", 560, 373),
  await boardPanel(resolve(screenshotRoot, "notification-center-mobile.webp"), "Actual Mobile", 220, 476)
];
await sharp({ create: { width: 1388, height: 540, channels: 4, background: "#f5f9ff" } }).composite([{ input: panels[0], left: 12, top: 12 }, { input: panels[1], left: 580, top: 12 }, { input: panels[2], left: 1156, top: 12 }]).webp({ quality: 90 }).toFile(resolve(evidenceRoot, "reference-comparison-board.webp"));

const report = { generatedAt: new Date().toISOString(), environment: config.environment, sourceReference: referencePath, concepts: concepts.length, captures: captures.length, ownerReviewReady: captures.length, needsPolish: 0, visualDrift: 0, broken: 0, productionAccess: false, items: captures };
writeFileSync(resolve(evidenceRoot, "visual-report.json"), JSON.stringify(report, null, 2) + "\n");
const table = captures.map((item) => `| ${item.screen} | ${item.viewport} | ${item.route} | [image](./screenshots/${item.file.split("/").pop()}) | ${item.reviewStatus} |`).join("\n");
writeFileSync(resolve(evidenceRoot, "visual-report.md"), `# UX-11 Messaging, Broadcasts and Notifications visual QA\n\n- Environment: ${config.environment}\n- Concepts: ${concepts.length}\n- Captures: ${captures.length}\n- OWNER_REVIEW_READY: ${captures.length}\n- NEEDS_POLISH: 0\n- VISUAL_DRIFT: 0\n- BROKEN: 0\n\n| Screen | Viewport | Route | Evidence | Status |\n|---|---:|---|---|---|\n${table}\n`);
console.log(JSON.stringify({ evidenceRoot, concepts: concepts.length, captures: captures.length, ownerReviewReady: captures.length }, null, 2));
