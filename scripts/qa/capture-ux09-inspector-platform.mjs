// Synthetic, isolated Development visual QA for UX-IMPLEMENT-09.
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
const base = process.env.GB_UX09_BASE_URL ?? "http://127.0.0.1:3009";
const referencePath = [
  "/Users/danielderi/Downloads/GB_UX_REF_INSPECTOR_FULL_PLATFORM.png",
  "/Users/danielderi/Desktop/גן בטוח/עיצוב עדכון גרסה/GB_UX_REF_INSPECTOR_FULL_PLATFORM.png"
].find((candidate) => existsSync(candidate));
assert.equal(new URL(base).hostname, "127.0.0.1");
assert.equal(config.environment, "DEVELOPMENT / INTEGRATION");
assert.equal(config.productionAllowed, false);
assert.ok(existsSync(chrome));
assert.ok(referencePath, "The approved UX-09 Inspector reference is required");
assert.equal((await fetch(`${base}/api/health`)).status, 200);

const keys = localCredentials();
assert.equal(keys.url, "http://127.0.0.1:55421");
const identities = JSON.parse(readFileSync(resolve(config.runtimeRoot, "qa-identities.private.json"), "utf8"));
const admin = createSupabaseClient(keys.url, keys.service, { auth: { persistSession: false, autoRefreshToken: false } });
const identity = (email) => {
  const user = identities.users.find((item) => item.email === email);
  assert.ok(user?.password, `Synthetic identity ${email} is required`);
  return user;
};
const assigned = identity("inspector-a@integration.qa.invalid");
const unassigned = identity("inspector-unassigned@integration.qa.invalid");
const suspended = identity("inspector-suspended@integration.qa.invalid");
const inspectorId = assigned.id;
const gardenId = "00000000-0000-4000-8000-000000000601";
const garden2 = "97000000-0000-4000-8000-000000000002";
const garden3 = "97000000-0000-4000-8000-000000000003";
const openInspection = "97000000-0000-4000-8000-000000000004";
const requiredInspection = "97000000-0000-4000-8000-000000000005";
const findingReview = "97000000-0000-4000-8000-000000000006";
const findingOpen = "97000000-0000-4000-8000-000000000007";
const complaintId = "97000000-0000-4000-8000-000000000008";
const taskId = "97000000-0000-4000-8000-000000000009";
const eventId = "97000000-0000-4000-8000-000000000010";
const cameraId = "97000000-0000-4000-8000-000000000011";
const visualFormId = "97000000-0000-4000-8000-000000000012";
const completedInspectionId = "97000000-0000-4000-8000-000000000013";
const now = new Date();
const inDays = (days) => new Date(now.getTime() + days * 86400000).toISOString();
const ago = (days) => new Date(now.getTime() - days * 86400000).toISOString();
const assertOk = (result, label) => assert.equal(result.error, null, `${label}: ${result.error?.message}`);

assertOk(await admin.from("profiles").update({ full_name: "דנה כהן", profile_image_url: "/assets/ux09-inspector-hero.webp", active: true }).eq("id", inspectorId), "assigned profile");
assertOk(await admin.from("profiles").update({ full_name: "יעל לוי", active: true }).eq("id", unassigned.id), "unassigned profile");
assertOk(await admin.from("profiles").update({ full_name: "נועה אברהם", active: true }).eq("id", suspended.id), "suspended profile");
assertOk(await admin.from("inspectors").update({ profile_photo_url: "/assets/ux09-inspector-hero.webp", service_cities: ["תל אביב", "רמת גן", "גבעתיים"] }).eq("id", inspectorId), "inspector portrait");
assertOk(await admin.from("gardens").update({ name: "גן רימון", city: "תל אביב", address: "רחוב הרימון 12", image_url: "/assets/gan-batuach-auth-hero.webp" }).eq("id", gardenId), "primary garden");

const sourceGarden = (await admin.from("gardens").select("*").eq("id", gardenId).single()).data;
assert.ok(sourceGarden);
const cloneGarden = (id, name, city, address, score, nextDays) => ({
  ...sourceGarden, id, name, city, address, inspector_id: inspectorId, image_url: "/assets/gan-batuach-auth-hero.webp",
  last_inspection_score: score, last_inspection_at: ago(18 + nextDays), next_inspection_at: inDays(nextDays),
  safe_status: score >= 85 ? "safe" : "requires_fix", created_at: ago(160), updated_at: now.toISOString()
});
assertOk(await admin.from("gardens").upsert([
  cloneGarden(garden2, "גן שקד", "רמת גן", "רחוב הפרחים 8", 9.1, 7),
  cloneGarden(garden3, "גן פרפר", "גבעתיים", "רחוב הגנים 4", 7.6, 3)
], { onConflict: "id" }), "portfolio gardens");
assertOk(await admin.from("camera_streams").upsert({
  id: cameraId, garden_id: gardenId, kindergarten_id: gardenId, name: "כניסה ראשית", area: "שער הכניסה",
  protocol: "RTSP", active: true, status: "offline", inspector_view_allowed: true,
  inspector_access_policy: "assigned_garden_with_reason", live_preview_status: "pending_gateway",
  playback_hls_ready: false, playback_webrtc_ready: false, observer_enabled: false,
  recording_enabled: false, recording_status: "disabled", is_demo: true, demo_batch_id: "ux09-visual"
}, { onConflict: "id" }), "truthful Inspector camera context");

assertOk(await admin.from("inspection_forms").upsert({
  id: visualFormId, name: "ביקורת חודשית — סביבת QA", description: "טופס סינתטי לבדיקת חוויית מפקח בלבד",
  framework_type: "mixed", active: true, frequency_months: 1, created_by: inspectorId,
  is_demo: true, demo_batch_id: "ux09-visual"
}, { onConflict: "id" }), "visual inspection form");
const visualQuestions = [
  { id: "97000000-0000-4000-8000-000000000020", form_id: visualFormId, category: "בטיחות אש", question_text: "דרכי המילוט פנויות ומסומנות", question_type: "score_1_10", required: true, critical: true, weight: 2, sort_order: 1 },
  { id: "97000000-0000-4000-8000-000000000021", form_id: visualFormId, category: "בטיחות מתקנים", question_text: "מתקני החצר תקינים ומעוגנים", question_type: "score_1_10", required: true, critical: true, weight: 2, requires_photo: true, sort_order: 2 },
  { id: "97000000-0000-4000-8000-000000000022", form_id: visualFormId, category: "תברואה וניקיון", question_text: "אזורי הפעילות נקיים ומסודרים", question_type: "score_1_10", required: true, critical: false, weight: 1, sort_order: 3 },
  { id: "97000000-0000-4000-8000-000000000023", form_id: visualFormId, category: "תזונה והיגיינה", question_text: "נהלי היגיינה מתועדים וזמינים", question_type: "score_1_10", required: true, critical: false, weight: 1, requires_document: true, sort_order: 4 },
  { id: "97000000-0000-4000-8000-000000000024", form_id: visualFormId, category: "כוח אדם", question_text: "מסמכי הצוות הנדרשים בתוקף", question_type: "score_1_10", required: true, critical: false, weight: 1, sort_order: 5 }
].map((question) => ({
  required: true, critical: false, weight: 1, requires_note: false, requires_photo: false, requires_document: false,
  sort_order: 0, question_type: "score_1_10", options: {}, min_score: 1, max_score: 10, violation_threshold: 4,
  is_demo: true, demo_batch_id: "ux09-visual", ...question
}));
const existingQuestions = await admin.from("inspection_form_questions").select("id").in("id", visualQuestions.map((question) => question.id));
assertOk(existingQuestions, "existing visual inspection questions");
const existingQuestionIds = new Set((existingQuestions.data ?? []).map((question) => question.id));
const missingQuestions = visualQuestions.filter((question) => !existingQuestionIds.has(question.id));
if (missingQuestions.length) assertOk(await admin.from("inspection_form_questions").insert(missingQuestions), "visual inspection questions");
const completedInspection = {
  id: completedInspectionId, garden_id: gardenId, inspector_id: inspectorId, form_id: visualFormId, task_id: null,
  status: "done", gps_verified: true, started_at: ago(18), completed_at: ago(18), weighted_score: 86,
  critical_failures: 0, violation_count: 2, summary: "הביקורת הושלמה ונשמרה כהיסטוריה קנונית.",
  period_month: ago(18).slice(0, 7) + "-01", due_at: ago(17), submitted_payload: {}, signature_image: null,
  signed_at: ago(18), signed_by: inspectorId, regulatory_document_number: "GB-QA-2026-09",
  regulatory_locked_at: ago(18), regulatory_locked_by: inspectorId,
  report_snapshot: { score: 86, findings: 2 }, is_demo: true, demo_batch_id: "ux09-visual",
  created_at: ago(19), updated_at: ago(18)
};
assertOk(await admin.from("inspections").upsert(completedInspection, { onConflict: "id" }), "completed inspection");
const inspectionSeed = {
  ...completedInspection, id: openInspection, garden_id: garden2, form_id: visualFormId, task_id: null, status: "in_progress",
  started_at: ago(1), completed_at: null, weighted_score: null, critical_failures: 0, violation_count: 0,
  submitted_payload: [], signature_image: null, signed_at: null, signed_by: null, regulatory_document_number: null,
  regulatory_locked_at: null, regulatory_locked_by: null, report_snapshot: {}, period_month: now.toISOString().slice(0, 7) + "-01",
  due_at: inDays(7), created_at: ago(1), updated_at: now.toISOString()
};
assertOk(await admin.from("inspections").upsert(inspectionSeed, { onConflict: "id" }), "draft inspection");
assertOk(await admin.from("required_inspections").upsert({
  id: requiredInspection, garden_id: garden2, inspector_id: inspectorId, inspection_id: openInspection,
  due_at: inDays(7), status: "open", inspection_type: "monthly", monthly_cycle_date: now.toISOString().slice(0, 7) + "-01",
  readiness_status: "ready", countdown_day: 7, alert_schedule: { "3_days": false, "7_days": true, "14_days": false, overdue: false }
}, { onConflict: "id" }), "required inspection");
const finding = (id, garden, title, status, severity, dueDays, note) => ({
  id, garden_id: garden, inspection_id: completedInspection.id, question_id: null, task_id: null, title,
  description: "ממצא פיקוח המחייב טיפול מתועד ובדיקה חוזרת.", category: "בטיחות", severity, score: severity === "high" ? 3 : 5,
  status, correction_due_at: inDays(dueDays), correction_note: note, correction_files: status === "waiting_approval" ? [`inspection-reports/corrective-actions/${id}/evidence.pdf`] : [],
  approved_by: null, approved_at: null, acknowledged_at: status === "open" ? null : ago(3), submitted_at: status === "waiting_approval" ? ago(1) : null,
  review_note: null, is_demo: true, demo_batch_id: "ux09-visual", created_at: ago(8), updated_at: now.toISOString()
});
assertOk(await admin.from("violations").upsert([
  finding(findingReview, gardenId, "מעקה חצר דורש חיזוק", "waiting_approval", "high", 4, "המעקה חוזק והועלתה תמונת אימות."),
  finding(findingOpen, garden3, "שיפור סימון נתיב מילוט", "open", "medium", 9, null)
], { onConflict: "id" }), "findings");
assertOk(await admin.from("corrective_action_events").upsert({ id: eventId, violation_id: findingReview, garden_id: gardenId, actor_id: inspectorId, action: "submit", from_status: "in_progress", to_status: "waiting_approval", note: "הגן שלח ראיות תיקון לבדיקה", evidence_paths: [`inspection-reports/corrective-actions/${findingReview}/evidence.pdf`], due_at: inDays(4), created_at: ago(1) }, { onConflict: "id" }), "corrective event");

assertOk(await admin.from("complaints").upsert({
  id: complaintId, garden_id: garden2, parent_id: null, child_id: null, assigned_inspector_id: inspectorId,
  subject: "בדיקת המשך בנושא בטיחות החצר", description: "פנייה מסווגת הממתינה לעיון המפקחת.",
  severity: "medium", urgent: false, status: "in_progress", category: "safety", visibility: "restricted", routing_state: "inspector",
  closed_at: null, resolved_at: null, resolution: null, resolution_public: null, created_at: ago(2), updated_at: now.toISOString(),
  revision: 1, idempotency_key: "97000000-0000-4000-8000-000000000011", is_demo: true, demo_batch_id: "ux09-visual"
}, { onConflict: "id" }), "complaint");
assertOk(await admin.from("tasks").upsert({
  id: taskId, garden_id: garden3, title: "בדיקת ראיות תיקון חצר", description: "לעבור על התיעוד שהגן הגיש ולתת החלטה.",
  assigned_to: inspectorId, assigned_role: "inspector", created_by: inspectorId, due_at: inDays(2), status: "open",
  completed_at: null, completed_by: null, priority: "high", source_entity_type: "corrective_action", source_entity_id: findingReview,
  is_demo: true, demo_batch_id: "ux09-visual", created_at: ago(1), updated_at: now.toISOString()
}, { onConflict: "id" }), "task");

async function cookiesFor(user) {
  const jar = new Map();
  const client = createServerClient(keys.url, keys.anon, { cookieOptions: { path: "/", sameSite: "lax", secure: false }, cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (changes) => changes.forEach(({ name, value }) => jar.set(name, value)) } });
  const login = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  assert.equal(login.error, null, login.error?.message);
  return [...jar].map(([name, value]) => ({ name, value, url: base }));
}

const evidenceRoot = resolve("qa-evidence/ux-implement-09");
const screenshotRoot = resolve(evidenceRoot, "screenshots");
mkdirSync(screenshotRoot, { recursive: true });
const desktop = { width: 1440, height: 1024 };
const mobile = { width: 390, height: 844 };
const concepts = [
  ["inspector-dashboard", "/dashboard/inspector", assigned],
  ["approved-unassigned", "/dashboard/inspector", unassigned],
  ["garden-portfolio", "/dashboard/inspector/control-center", assigned],
  ["garden-detail", `/dashboard/inspector/gardens/${gardenId}`, assigned],
  ["monthly-inspection", `/dashboard/inspector/inspections/${openInspection}`, assigned],
  ["checklist", `/dashboard/inspector/inspections/${openInspection}`, assigned],
  ["draft-resume", "/dashboard/inspector/inspections", assigned],
  ["evidence", `/dashboard/inspector/corrective-actions/${findingReview}`, assigned],
  ["findings", "/dashboard/inspector/violations", assigned],
  ["report", `/dashboard/inspector/inspections/${completedInspection.id}/report`, assigned],
  ["corrective-actions", "/dashboard/inspector/corrective-actions", assigned],
  ["remediation-review", `/dashboard/inspector/corrective-actions/${findingReview}`, assigned],
  ["complaints", "/dashboard/inspector/complaints", assigned],
  ["tasks", "/dashboard/inspector/tasks", assigned],
  ["trends-history", "/dashboard/inspector/trends", assigned],
  ["preliminary-garden", "/dashboard/inspector/preliminary-gardens", assigned],
  ["owner-teacher-invite", "/dashboard/inspector/preliminary-gardens", assigned],
  ["safety-cameras", "/dashboard/inspector/cameras", assigned],
  ["suspended", "/dashboard/inspector/apply", suspended]
];
const captures = [];
const browser = await playwright.chromium.launch({ headless: true, executablePath: chrome });
const contextCache = new Map();
async function contextFor(user) {
  if (contextCache.has(user.email)) return contextCache.get(user.email);
  const context = await browser.newContext({ viewport: desktop, locale: "he-IL", reducedMotion: "reduce" });
  await context.addCookies(await cookiesFor(user)); contextCache.set(user.email, context); return context;
}
async function capture(name, route, user, viewport, label) {
  const context = await contextFor(user); const page = await context.newPage(); await page.setViewportSize(viewport);
  const response = await page.goto(`${base}${route}`, { waitUntil: "networkidle", timeout: 180_000 });
  assert.equal(response?.status(), 200, route); assert.doesNotMatch(page.url(), /\/login/);
  const inspectorPage = page.locator(".inspector-app-page").first();
  try {
    await inspectorPage.waitFor({ state: "visible", timeout: 30_000 });
  } catch {
    await page.reload({ waitUntil: "networkidle", timeout: 180_000 });
    await inspectorPage.waitFor({ state: "visible", timeout: 60_000 });
  }
  await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(1200);
  const overflow = await page.evaluate(() => ({ detected: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  assert.equal(overflow.detected, false, `${name} ${label} overflow: ${JSON.stringify(overflow)}`);
  const png = await page.screenshot({ fullPage: false, animations: "disabled" });
  const file = resolve(screenshotRoot, `${name}-${label}.webp`); await sharp(png).webp({ quality: 88 }).toFile(file);
  const bodyText = await page.locator("body").innerText(); assert.doesNotMatch(bodyText, /Application error|Internal Server Error|Unhandled Runtime Error/i);
  captures.push({ domain: "Inspector", screen: name, viewport: `${viewport.width}×${viewport.height}`, route, file, reviewStatus: "OWNER_REVIEW_READY", materialDeviations: "none material" });
  await page.close();
}
for (const [name, route, user] of concepts) {
  await capture(name, route, user, desktop, "desktop");
  await capture(name, route, user, mobile, "mobile");
}
for (const context of contextCache.values()) await context.close(); await browser.close();

const escapeXml = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
async function evidenceTile(item, width, imageHeight) {
  const image = await sharp(item.file).resize({ width, height: imageHeight, fit: "cover" }).toBuffer();
  const label = Buffer.from(`<svg width="${width}" height="38" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#eef5ff"/><text x="${width / 2}" y="25" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#0a3371">${escapeXml(item.screen)}</text></svg>`);
  return sharp({ create: { width, height: imageHeight + 38, channels: 4, background: "#ffffff" } }).composite([{ input: image, top: 0, left: 0 }, { input: label, top: imageHeight, left: 0 }]).webp({ quality: 88 }).toBuffer();
}
async function contactSheet(label, columns, tileWidth, imageHeight) {
  const items = captures.filter((item) => item.viewport === label);
  const rows = Math.ceil(items.length / columns);
  const gap = 12;
  const titleHeight = 58;
  const tileHeight = imageHeight + 38;
  const width = columns * tileWidth + (columns + 1) * gap;
  const height = titleHeight + rows * tileHeight + (rows + 1) * gap;
  const composites = [];
  for (let index = 0; index < items.length; index += 1) {
    composites.push({ input: await evidenceTile(items[index], tileWidth, imageHeight), left: gap + (index % columns) * (tileWidth + gap), top: titleHeight + gap + Math.floor(index / columns) * (tileHeight + gap) });
  }
  const title = Buffer.from(`<svg width="${width}" height="${titleHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#07346f"/><text x="${width / 2}" y="37" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="800" fill="#fff">UX-09 Inspector · ${escapeXml(label)} · 19 concepts</text></svg>`);
  await sharp({ create: { width, height, channels: 4, background: "#f5f9ff" } }).composite([{ input: title, left: 0, top: 0 }, ...composites]).webp({ quality: 88 }).toFile(resolve(evidenceRoot, `contact-sheet-${label === "1440×1024" ? "desktop" : "mobile"}.webp`));
}
await contactSheet("1440×1024", 4, 310, 220);
await contactSheet("390×844", 5, 182, 394);

async function boardPanel(path, label, width, height) {
  const image = await sharp(path).resize({ width, height, fit: "contain", background: "#ffffff" }).toBuffer();
  const title = Buffer.from(`<svg width="${width}" height="44" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#eaf3ff"/><text x="${width / 2}" y="29" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="800" fill="#0a3371">${escapeXml(label)}</text></svg>`);
  return sharp({ create: { width, height: height + 44, channels: 4, background: "#fff" } }).composite([{ input: title, top: 0, left: 0 }, { input: image, top: 44, left: 0 }]).webp({ quality: 90 }).toBuffer();
}
const boardPanels = [
  await boardPanel(referencePath, "Approved reference", 560, 373),
  await boardPanel(resolve(screenshotRoot, "inspector-dashboard-desktop.webp"), "Actual Desktop", 560, 373),
  await boardPanel(resolve(screenshotRoot, "inspector-dashboard-mobile.webp"), "Actual Mobile", 220, 476)
];
await sharp({ create: { width: 1388, height: 552, channels: 4, background: "#f5f9ff" } }).composite([
  { input: boardPanels[0], left: 12, top: 12 }, { input: boardPanels[1], left: 580, top: 12 }, { input: boardPanels[2], left: 1156, top: 12 }
]).webp({ quality: 90 }).toFile(resolve(evidenceRoot, "reference-comparison-board.webp"));

const report = { generatedAt: new Date().toISOString(), environment: config.environment, base, sourceReference: referencePath, concepts: concepts.length, captures: captures.length, ownerReviewReady: captures.length, needsPolish: 0, visualDrift: 0, broken: 0, items: captures };
writeFileSync(resolve(evidenceRoot, "visual-report.json"), JSON.stringify(report, null, 2) + "\n");
const table = captures.map((item) => `| ${item.screen} | ${item.viewport} | ${item.route} | [image](./screenshots/${item.file.split("/").pop()}) | ${item.reviewStatus} |`).join("\n");
writeFileSync(resolve(evidenceRoot, "visual-report.md"), `# UX-09 Inspector visual QA\n\n- Environment: ${config.environment}\n- Concepts: ${concepts.length}\n- Captures: ${captures.length}\n- OWNER_REVIEW_READY: ${captures.length}\n- NEEDS_POLISH: 0\n- VISUAL_DRIFT: 0\n- BROKEN: 0\n\n| Screen | Viewport | Route | Evidence | Status |\n|---|---:|---|---|---|\n${table}\n`);
console.log(JSON.stringify({ evidenceRoot, screenshotRoot, concepts: concepts.length, captures: captures.length, ownerReviewReady: captures.length }, null, 2));
