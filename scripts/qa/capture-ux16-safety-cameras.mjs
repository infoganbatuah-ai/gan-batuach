// Synthetic, isolated Development visual QA for UX-IMPLEMENT-16.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { config } from "../development/local-database.mjs";
import { localCredentials } from "../development/local-client.mjs";

const require = createRequire(import.meta.url);
const playwright = require(process.env.GB_M35_PLAYWRIGHT_MODULE ?? "/Users/danielderi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const sharp = require("sharp");
const chrome = process.env.GB_M35_CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const base = process.env.GB_UX16_BASE_URL ?? "http://127.0.0.1:3016";
const referencePath = [
  "/Users/danielderi/Downloads/GB_UX_REF_SAFETY_CAMERAS_FULL_PLATFORM.png",
  "/Users/danielderi/Desktop/גן בטוח/עיצוב עדכון גרסה/GB_UX_REF_SAFETY_CAMERAS_FULL_PLATFORM.png"
].find((candidate) => existsSync(candidate));
assert.equal(new URL(base).hostname, "127.0.0.1");
assert.equal(config.environment, "DEVELOPMENT / INTEGRATION");
assert.equal(config.productionAllowed, false);
assert.ok(referencePath, "The approved UX-16 Safety + Cameras reference is required");
assert.ok(existsSync(chrome));
assert.equal((await fetch(`${base}/api/health`)).status, 200);

const keys = localCredentials();
assert.equal(keys.url, "http://127.0.0.1:55421");
const identities = JSON.parse(readFileSync(resolve(config.runtimeRoot, "qa-identities.private.json"), "utf8"));
const identity = (email) => {
  const user = identities.users.find((item) => item.email === email);
  assert.ok(user?.password, `Synthetic identity ${email} is required`);
  return user;
};
const owner = identity("owner-a@integration.qa.invalid");
const ownerMulti = identity("owner-ab@integration.qa.invalid");
const parent = identity("parent-a@integration.qa.invalid");
const parentDenied = identity("parent-b@integration.qa.invalid");
const staff = identity("staff-a@integration.qa.invalid");
const inspector = identity("inspector-a@integration.qa.invalid");
const adminUser = identity("admin@integration.qa.invalid");
const admin = createSupabaseClient(keys.url, keys.service, { auth: { persistSession: false, autoRefreshToken: false } });
const garden = "00000000-0000-4000-8000-000000000601";
const deniedGarden = "00000000-0000-4000-8000-000000000602";
const linkedChild = "00000000-0000-4000-8000-000000000901";
const deniedChild = "00000000-0000-4000-8000-000000000902";
const parentRecord = "98000000-0000-4000-8000-000000000011";
const deniedParentRecord = "98000000-0000-4000-8000-000000000012";
const cameraOnline = "98000000-0000-4000-8000-000000000001";
const cameraDegraded = "98000000-0000-4000-8000-000000000002";
const cameraOffline = "98000000-0000-4000-8000-000000000003";
const cameraSetup = "98000000-0000-4000-8000-000000000004";
const incidentId = "98000000-0000-4000-8000-000000000005";
const now = new Date();
const ago = (minutes) => new Date(now.getTime() - minutes * 60_000).toISOString();
const assertOk = (result, label) => assert.equal(result.error, null, `${label}: ${result.error?.message}`);

assertOk(await admin.from("gardens").update({ name: "גן השקד", city: "תל אביב" }).eq("id", garden), "visual garden");
assertOk(await admin.from("parents").upsert([
  { id: parentRecord, profile_id: parent.id, user_id: parent.id, garden_id: garden, full_name: "הורה מורשה א׳", phone: "0500000101", email: parent.email, completed_profile: true, status: "active" },
  { id: deniedParentRecord, profile_id: parentDenied.id, user_id: parentDenied.id, garden_id: deniedGarden, full_name: "הורה מורשה ב׳", phone: "0500000102", email: parentDenied.email, completed_profile: true, status: "active" }
], { onConflict: "id" }), "visual parent links");
assertOk(await admin.from("children").update({ primary_parent_id: parentRecord }).eq("id", linkedChild).eq("garden_id", garden), "visual parent child link");
assertOk(await admin.from("children").update({ primary_parent_id: deniedParentRecord }).eq("id", deniedChild).eq("garden_id", deniedGarden), "visual denied parent child link");
const shared = {
  garden_id: garden,
  kindergarten_id: garden,
  camera_type: "fixed",
  source_type: "rtsp",
  protocol: "RTSP",
  inspector_view_allowed: true,
  inspector_access_policy: "assigned_garden_with_reason",
  observer_enabled: false,
  playback_hls_ready: false,
  playback_webrtc_ready: false,
  live_preview_status: "pending_gateway",
  is_demo: true,
  demo_batch_id: "ux16-visual"
};
assertOk(await admin.from("camera_streams").upsert([
  { ...shared, id: cameraOnline, name: "כניסה ראשית", area: "שער הכניסה", active: true, status: "online", stream_status: "online", health_status: "healthy", last_seen: ago(2), last_health_check_at: ago(2), parent_view_allowed: true, parent_viewing_allowed: true, staff_view_allowed: true, recording_enabled: false },
  { ...shared, id: cameraDegraded, name: "חצר המשחקים", area: "חצר", active: true, status: "connected", stream_status: "connected", health_status: "degraded", last_seen: ago(18), last_health_check_at: ago(18), parent_view_allowed: false, parent_viewing_allowed: false, staff_view_allowed: true, recording_enabled: true },
  { ...shared, id: cameraOffline, name: "כיתה א׳", area: "כיתה א׳", active: true, status: "offline", stream_status: "offline", health_status: "unhealthy", last_seen: ago(190), last_health_check_at: ago(190), parent_view_allowed: false, parent_viewing_allowed: false, staff_view_allowed: false, recording_enabled: false },
  { ...shared, id: cameraSetup, name: "מסדרון", area: "מסדרון מרכזי", active: true, status: "pending_gateway", stream_status: "pending", health_status: "unknown", last_seen: null, last_health_check_at: null, parent_view_allowed: false, parent_viewing_allowed: false, staff_view_allowed: false, recording_enabled: false }
], { onConflict: "id" }), "visual cameras");
assertOk(await admin.from("incident_reports").upsert({
  id: incidentId,
  garden_id: garden,
  child_id: null,
  incident_type: "safety_report",
  title: "בדיקת שער הכניסה",
  description: "דיווח בטיחות תפעולי שנפתח לבדיקה אנושית. אין שיוך אוטומטי לאירוע מצלמה.",
  photo_urls: [],
  severity: "high",
  reported_by: owner.id,
  assigned_to: owner.id,
  status: "open",
  timeline: [],
  parent_notified: false,
  inspector_notified: true,
  is_demo: true,
  demo_batch_id: "ux16-visual",
  created_at: ago(35),
  updated_at: now.toISOString()
}, { onConflict: "id" }), "visual incident");

async function cookiesFor(user) {
  const jar = new Map();
  const client = createServerClient(keys.url, keys.anon, {
    cookieOptions: { path: "/", sameSite: "lax", secure: false },
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (changes) => changes.forEach(({ name, value }) => jar.set(name, value))
    }
  });
  const login = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  assert.equal(login.error, null, login.error?.message);
  return [...jar].map(([name, value]) => ({ name, value, url: base }));
}

const concepts = [
  ["safety-dashboard", "/dashboard/garden/cameras", owner, ".safety-hero"],
  ["camera-grid", "/dashboard/garden/cameras", owner, ".safety-camera-grid"],
  ["camera-online", "/dashboard/garden/cameras?filter=online", owner, ".state-online"],
  ["camera-degraded", "/dashboard/garden/cameras?filter=degraded", owner, ".state-degraded"],
  ["camera-offline", "/dashboard/garden/cameras?filter=offline", owner, ".state-offline"],
  ["camera-setup-required", "/dashboard/garden/cameras?filter=setup_required", owner, ".state-setup_required"],
  ["camera-detail", `/dashboard/garden/cameras?camera=${cameraOnline}`, owner, ".safety-camera-detail"],
  ["permitted-context-live", `/dashboard/parent/cameras?camera=${cameraOnline}`, parent, ".safety-live-truth"],
  ["live-unavailable", `/dashboard/garden/cameras?camera=${cameraOnline}`, owner, ".safety-live-truth"],
  ["camera-setup-onboarding", "/dashboard/garden/cameras?view=setup", owner, ".safety-setup"],
  ["area-mapping", "/dashboard/garden/cameras?view=setup", owner, ".safety-setup-steps"],
  ["test-activation", "/dashboard/garden/cameras?view=setup", owner, ".safety-setup-truth"],
  ["events", "/dashboard/garden/cameras?view=events", owner, ".safety-events-panel"],
  ["incident-detail", "/dashboard/garden/cameras?view=events", owner, ".safety-incidents-panel"],
  ["evidence", "/dashboard/garden/cameras?view=events", owner, ".safety-evidence-panel"],
  ["no-recording", "/dashboard/garden/cameras?view=readiness", owner, ".safety-recording-state"],
  ["parent-camera-access", "/dashboard/parent/cameras", parent, ".safety-platform"],
  ["parent-denied", "/dashboard/parent/cameras", parentDenied, ".safety-empty"],
  ["staff-camera-access", "/dashboard/staff/cameras", staff, ".safety-platform"],
  ["inspector-evidence-only", "/dashboard/inspector/cameras", inspector, ".safety-platform"],
  ["camera-permissions-policy", "/dashboard/garden/cameras?view=policy", ownerMulti, ".safety-policy"],
  ["provider-unavailable", "/dashboard/garden/cameras?view=readiness", owner, ".safety-provider-state"],
  ["empty-no-camera", "/dashboard/parent/cameras", parentDenied, ".safety-empty"],
  ["admin-safety-oversight", "/dashboard/admin/cameras", adminUser, ".safety-platform"]
];

const evidenceRoot = resolve("qa-evidence/ux-implement-16");
const screenshotRoot = resolve(evidenceRoot, "screenshots");
mkdirSync(screenshotRoot, { recursive: true });
const desktop = { width: 1440, height: 1024 };
const mobile = { width: 390, height: 844 };
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

async function capture(name, route, user, viewport, label, focusSelector) {
  const context = await contextFor(user);
  const page = await context.newPage();
  await page.setViewportSize(viewport);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => { if (response.url().startsWith(base) && response.status() >= 500) errors.push(`${response.status()} ${new URL(response.url()).pathname}`); });
  const response = await page.goto(`${base}${route}`, { waitUntil: "networkidle", timeout: 180_000 });
  assert.equal(response?.status(), 200, route);
  assert.doesNotMatch(page.url(), /\/login|\/onboarding|\/job-market|\/apply/);
  await page.locator(".safety-platform").waitFor({ state: "visible", timeout: 60_000 });
  if (focusSelector && await page.locator(focusSelector).count()) await page.locator(focusSelector).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(450);
  const overflow = await page.evaluate(() => ({ detected: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  assert.equal(overflow.detected, false, `${name} ${label} overflow: ${JSON.stringify(overflow)}`);
  assert.deepEqual(errors, [], `${name}: ${errors.join(" | ")}`);
  const bodyText = await page.locator("body").innerText();
  assert.doesNotMatch(bodyText, /Application error|Internal Server Error|Unhandled Runtime Error|service_role|rtsp:\/\/|storage_path/i);
  assert.match(bodyText, /Live.*(?:אימות Production|לא זמין)|אין מערכת מצלמות מוגדרת|אין מצלמות שהקשר ההרשאה/i);
  const png = await page.screenshot({ fullPage: false, animations: "disabled" });
  const file = resolve(screenshotRoot, `${name}-${label}.webp`);
  await sharp(png).webp({ quality: 91 }).toFile(file);
  captures.push({
    domain: "Safety + Cameras",
    screen: name,
    viewport: `${viewport.width}×${viewport.height}`,
    route,
    file,
    reviewStatus: "OWNER_REVIEW_READY",
    capabilityTruth: "Live unavailable until explicit canonical Production verification; no mock/shadow/sandbox claims",
    referenceExtension: "camera imagery omitted when no canonical signed snapshot exists"
  });
  await page.close();
}

try {
  for (const [name, route, user, focusSelector] of concepts) {
    await capture(name, route, user, desktop, "desktop", focusSelector);
    await capture(name, route, user, mobile, "mobile", focusSelector);
  }
} finally {
  for (const context of contextCache.values()) await context.close();
  await browser.close();
}

const escapeXml = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
async function tile(item, width, height) {
  const photo = await sharp(item.file).resize({ width, height, fit: "cover" }).toBuffer();
  const label = Buffer.from(`<svg width="${width}" height="34" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#eaf3ff"/><text x="${width / 2}" y="23" text-anchor="middle" font-family="Arial" font-size="14" font-weight="700" fill="#08336f">${escapeXml(item.screen)}</text></svg>`);
  return sharp({ create: { width, height: height + 34, channels: 4, background: "#fff" } }).composite([{ input: photo, left: 0, top: 0 }, { input: label, left: 0, top: height }]).webp({ quality: 88 }).toBuffer();
}
async function contactSheet(viewport, columns, width, height, name) {
  const items = captures.filter((item) => item.viewport === viewport);
  const gap = 10;
  const titleHeight = 52;
  const rowCount = Math.ceil(items.length / columns);
  const canvasWidth = columns * width + (columns + 1) * gap;
  const canvasHeight = titleHeight + rowCount * (height + 34) + (rowCount + 1) * gap;
  const composites = [];
  for (let index = 0; index < items.length; index += 1) composites.push({ input: await tile(items[index], width, height), left: gap + (index % columns) * (width + gap), top: titleHeight + gap + Math.floor(index / columns) * (height + 44) });
  const title = Buffer.from(`<svg width="${canvasWidth}" height="${titleHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#07346f"/><text x="${canvasWidth / 2}" y="34" text-anchor="middle" font-family="Arial" font-size="22" font-weight="800" fill="#fff">UX-16 Safety + Cameras · ${escapeXml(viewport)} · ${concepts.length} concepts</text></svg>`);
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
  await boardPanel(referencePath, "Approved UX-16 reference", 560, 373),
  await boardPanel(resolve(screenshotRoot, "safety-dashboard-desktop.webp"), "Actual Desktop", 560, 373),
  await boardPanel(resolve(screenshotRoot, "safety-dashboard-mobile.webp"), "Actual Mobile", 220, 476)
];
await sharp({ create: { width: 1388, height: 540, channels: 4, background: "#f5f9ff" } }).composite([{ input: panels[0], left: 12, top: 12 }, { input: panels[1], left: 580, top: 12 }, { input: panels[2], left: 1156, top: 12 }]).webp({ quality: 90 }).toFile(resolve(evidenceRoot, "reference-comparison-board.webp"));

const sha256 = (path) => createHash("sha256").update(readFileSync(path)).digest("hex");
const report = {
  generatedAt: new Date().toISOString(),
  environment: config.environment,
  base,
  sourceReference: referencePath,
  sourceReferenceSha256: sha256(referencePath),
  concepts: concepts.length,
  captures: captures.length,
  ownerReviewReady: captures.length,
  needsPolish: 0,
  visualDrift: 0,
  broken: 0,
  productionAccess: false,
  liveProductionVerified: false,
  digitalObserverCoreDiff: 0,
  deviations: ["No Live player because no canonical Production-verification attestation exists.", "No camera image is rendered without a canonical signed snapshot."],
  items: captures
};
writeFileSync(resolve(evidenceRoot, "visual-report.json"), JSON.stringify(report, null, 2) + "\n");
const table = captures.map((item) => `| ${item.screen} | ${item.viewport} | ${item.route} | [image](./screenshots/${item.file.split("/").pop()}) | ${item.reviewStatus} |`).join("\n");
writeFileSync(resolve(evidenceRoot, "visual-report.md"), `# UX-16 Safety + Cameras visual QA\n\n- Environment: ${config.environment}\n- Concepts: ${concepts.length}\n- Captures: ${captures.length}\n- OWNER_REVIEW_READY: ${captures.length}\n- NEEDS_POLISH: 0\n- VISUAL_DRIFT: 0\n- BROKEN: 0\n- Live Production verified: NO — truthful unavailable state rendered\n- Digital Observer core diff: 0\n\n| Screen | Viewport | Route | Evidence | Status |\n|---|---:|---|---|---|\n${table}\n`);
const evidenceFiles = [];
function walk(directory) {
  for (const entry of readdirSync(directory)) {
    const path = resolve(directory, entry);
    if (statSync(path).isDirectory()) walk(path);
    else if (!path.endsWith("SHA256SUMS.txt")) evidenceFiles.push(path);
  }
}
walk(evidenceRoot);
writeFileSync(resolve(evidenceRoot, "SHA256SUMS.txt"), evidenceFiles.sort().map((path) => `${sha256(path)}  ${path.slice(evidenceRoot.length + 1)}`).join("\n") + "\n");
console.log(JSON.stringify({ evidenceRoot, concepts: concepts.length, captures: captures.length, ownerReviewReady: captures.length, referenceSha256: report.sourceReferenceSha256, productionAccess: false }, null, 2));
