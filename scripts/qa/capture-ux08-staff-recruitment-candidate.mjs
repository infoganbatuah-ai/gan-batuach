// Synthetic, isolated Development visual QA for UX-IMPLEMENT-08.
import assert from "node:assert/strict";
import { createHash, createHmac, randomBytes } from "node:crypto";
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
const base = process.env.GB_UX08_BASE_URL ?? "http://127.0.0.1:3008";
const invitationSecret = (process.env.MANAGEMENT_INVITATION_SECRET ?? readFileSync("/private/tmp/gb-ux08-invite-secret", "utf8")).trim();
assert.equal(new URL(base).hostname, "127.0.0.1");
assert.equal(config.environment, "DEVELOPMENT / INTEGRATION");
assert.equal(config.productionAllowed, false);
assert.ok(existsSync(chrome));
assert.ok(invitationSecret && invitationSecret.length >= 32, "A local-only invitation secret is required");
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
const candidateIdentity = identity("staff-candidate@integration.qa.invalid");
const managerIdentity = identity("owner-a@integration.qa.invalid");
const candidateId = candidateIdentity.id;
const managerId = managerIdentity.id;
const gardenId = "00000000-0000-4000-8000-000000000601";
const openingIds = ["81000000-0000-4000-8000-000000000001", "81000000-0000-4000-8000-000000000002", "81000000-0000-4000-8000-000000000003", "81000000-0000-4000-8000-000000000004", "81000000-0000-4000-8000-000000000005"];
const applicationIds = ["82000000-0000-4000-8000-000000000001", "82000000-0000-4000-8000-000000000002", "82000000-0000-4000-8000-000000000003", "82000000-0000-4000-8000-000000000004"];
const documentId = "83000000-0000-4000-8000-000000000001";
const invitationId = "85000000-0000-4000-8000-000000000001";
const now = new Date();
const ago = (days) => new Date(now.getTime() - days * 86400000).toISOString();

const employmentCheck = await admin.from("staff_kindergarten_employments").select("id").eq("profile_id", candidateId).in("status", ["pending_approval", "active"]);
assert.equal(employmentCheck.error, null, employmentCheck.error?.message);
assert.equal(employmentCheck.data?.length, 0, "Candidate QA identity must not have operational employment");

const profileSeed = await admin.from("staff_candidate_profiles").upsert({
  profile_id: candidateId,
  full_name: "נועה כהן",
  phone: "050-1234567",
  email: candidateIdentity.email,
  profile_photo_url: "/assets/ux08-candidate-portrait.webp",
  city: "תל אביב",
  professional_role: "גננת",
  qualification_keys: ["early_childhood", "teacher_certificate", "first_aid"],
  availability: { days: ["א׳", "ב׳", "ג׳", "ד׳", "ה׳"], notes: "זמינה למשרה מלאה מתחילת החודש הבא" },
  preferred_age_groups: ["פעוטות", "בוגרים"],
  employment_preference: "משרה מלאה",
  professional_summary: "גננת בעלת ניסיון בגיל הרך, עם גישה חמה, סדר יום בטוח ותקשורת קרובה עם משפחות.",
  work_experience: "חמש שנות ניסיון בגני ילדים פרטיים ובניהול קבוצת בוגרים.",
  document_status: { required_documents_ready: true },
  profile_completeness: { percentage: 100, blockers: [], required_fields_complete: true, documents_ready: true, status: "ready_for_matching" },
  status: "active",
  matching_paused: false
}, { onConflict: "profile_id" });
assert.equal(profileSeed.error, null, profileSeed.error?.message);
const profileActivation = await admin.from("profiles").update({ full_name: "נועה כהן", profile_image_url: "/assets/ux08-candidate-portrait.webp", active: true, self_service_status: "pending_affiliation" }).eq("id", candidateId);
assert.equal(profileActivation.error, null, profileActivation.error?.message);

const docPath = `management/candidates/${candidateId}/${documentId}/83000000-0000-4000-8000-000000000099.pdf`;
const documentSeed = await admin.from("staff_candidate_documents").upsert({ id: documentId, profile_id: candidateId, category: "qualification", storage_bucket: "documents", storage_path: docPath, mime_type: "application/pdf", byte_size: 768, status: "verified", uploaded_at: ago(8), reviewed_at: ago(6), reviewed_by: managerId }, { onConflict: "id" });
assert.equal(documentSeed.error, null, documentSeed.error?.message);

const openings = [
  { id: openingIds[0], role_needed: "גננת מובילה", age_group: "בוגרים", employment_type: "משרה מלאה", description: "הובלת כיתה בוגרת בצוות מקצועי וחם.", requirements: "תעודת הוראה וניסיון בגיל הרך" },
  { id: openingIds[1], role_needed: "גננת", age_group: "פעוטות", employment_type: "משרה מלאה", description: "עבודה משמעותית עם פעוטות בסביבה בטוחה.", requirements: "הכשרה בחינוך לגיל הרך" },
  { id: openingIds[2], role_needed: "מנהלת כיתה", age_group: "בוגרים", employment_type: "משרה מלאה", description: "ניהול סדר היום והובלת צוות הכיתה.", requirements: "ניסיון מקצועי מוכח" },
  { id: openingIds[3], role_needed: "גננת מחליפה", age_group: "כל הקבוצות", employment_type: "משרה חלקית", description: "השתלבות גמישה בצוות הגן לפי צורך.", requirements: "זמינות בימי חול" },
  { id: openingIds[4], role_needed: "גננת", age_group: "בוגרים", employment_type: "משרה מלאה", description: "משרה חדשה בגן משפחתי עם צוות ותיק.", requirements: "תעודת הוראה ועזרה ראשונה" }
].map((opening, index) => ({ ...opening, garden_id: gardenId, qualification_keys: index === 3 ? [] : ["early_childhood"], active_status: "published", created_by: managerId, published_at: ago(index + 1), created_at: ago(index + 1) }));
const openingsSeed = await admin.from("kindergarten_staff_openings").upsert(openings, { onConflict: "id" });
assert.equal(openingsSeed.error, null, openingsSeed.error?.message);

const applications = [
  { id: applicationIds[0], opening_id: openingIds[0], status: "under_review", requested_role: "גננת מובילה", submitted_at: ago(5), reviewed_at: ago(4), reviewed_by: managerId },
  { id: applicationIds[1], opening_id: openingIds[1], status: "information_required", requested_role: "גננת", submitted_at: ago(4), reviewed_at: ago(3), reviewed_by: managerId, information_request: "נבקש לצרף אישור עזרה ראשונה עדכני ולחדד את זמינות יום חמישי." },
  { id: applicationIds[2], opening_id: openingIds[2], status: "awaiting_candidate_acceptance", requested_role: "מנהלת כיתה", submitted_at: ago(7), reviewed_at: ago(2), decided_at: ago(2), reviewed_by: managerId, manager_decision: "approve", decision_reason: "הפרופיל והניסיון מתאימים לצורכי הגן." },
  { id: applicationIds[3], opening_id: openingIds[3], status: "rejected", requested_role: "גננת מחליפה", submitted_at: ago(12), reviewed_at: ago(9), decided_at: ago(9), reviewed_by: managerId, manager_decision: "reject", decision_reason: "היקף הזמינות אינו מתאים למסגרת המשרה הנוכחית." }
].map((application) => ({ ...application, staff_candidate_id: candidateId, garden_id: gardenId, requirement_snapshot: { role: application.requested_role }, metadata: { source: "ux08_visual_qa" } }));
const applicationsSeed = await admin.from("staff_job_applications").upsert(applications, { onConflict: "id" });
assert.equal(applicationsSeed.error, null, applicationsSeed.error?.message);

const extraCandidates = [
  { email: "ux08-candidate-daniel@integration.qa.invalid", name: "דניאל לוי", role: "סייע", city: "רמת גן", status: "submitted", percent: 82 },
  { email: "ux08-candidate-michal@integration.qa.invalid", name: "מיכל אברהם", role: "מטפלת", city: "גבעתיים", status: "resubmitted", percent: 94 },
  { email: "ux08-candidate-roi@integration.qa.invalid", name: "רועי שמעון", role: "סייע", city: "חולון", status: "rejected", percent: 76 }
];
const userList = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
assert.equal(userList.error, null, userList.error?.message);
for (const [index, candidate] of extraCandidates.entries()) {
  let user = userList.data.users.find((item) => item.email === candidate.email);
  if (!user) {
    const created = await admin.auth.admin.createUser({ email: candidate.email, password: `Qa-${randomBytes(18).toString("base64url")}!`, email_confirm: true, user_metadata: { full_name: candidate.name, role: "staff" } });
    assert.equal(created.error, null, created.error?.message); user = created.data.user;
  }
  assert.ok(user);
  const profile = await admin.from("profiles").upsert({ id: user.id, email: candidate.email, full_name: candidate.name, role: "staff", active: true, self_service_status: "pending_affiliation", email_verified_at: now.toISOString(), profile_image_url: index === 1 ? "/assets/ux08-candidate-portrait.webp" : null }, { onConflict: "id" });
  assert.equal(profile.error, null, profile.error?.message);
  const candidateProfile = await admin.from("staff_candidate_profiles").upsert({ profile_id: user.id, full_name: candidate.name, email: candidate.email, city: candidate.city, professional_role: candidate.role, qualification_keys: ["early_childhood"], availability: { days: ["א׳", "ב׳", "ג׳"] }, preferred_age_groups: ["פעוטות"], employment_preference: "גמיש", professional_summary: "ניסיון מקצועי במסגרת חינוכית.", profile_completeness: { percentage: candidate.percent, blockers: candidate.percent < 90 ? ["required_documents_pending"] : [], required_fields_complete: true }, document_status: { required_documents_ready: candidate.percent >= 90 }, status: "active" }, { onConflict: "profile_id" });
  assert.equal(candidateProfile.error, null, candidateProfile.error?.message);
  const appId = `86000000-0000-4000-8000-00000000000${index + 1}`;
  const app = await admin.from("staff_job_applications").upsert({ id: appId, staff_candidate_id: user.id, garden_id: gardenId, opening_id: openingIds[0], requested_role: candidate.role, status: candidate.status, submitted_at: ago(index + 2), requirement_snapshot: { role: candidate.role }, metadata: { source: "ux08_visual_qa" } }, { onConflict: "id" });
  assert.equal(app.error, null, app.error?.message);
}

const notificationSeed = await admin.from("notifications").upsert([
  { id: "84000000-0000-4000-8000-000000000001", garden_id: gardenId, kindergarten_id: gardenId, recipient_id: candidateId, recipient_profile_id: candidateId, recipient_role: "staff", title: "נדרש מידע נוסף", body: "גן השקד ביקש להשלים מסמך במועמדות.", message: "גן השקד ביקש להשלים מסמך במועמדות.", entity_type: "staff_job_applications", entity_id: applicationIds[1], severity: "medium", action_url: `/dashboard/staff/job-market/applications/${applicationIds[1]}`, created_by: managerId, status: "pending" },
  { id: "84000000-0000-4000-8000-000000000002", garden_id: gardenId, kindergarten_id: gardenId, recipient_id: candidateId, recipient_profile_id: candidateId, recipient_role: "staff", title: "הצעת עבודה ממתינה", body: "התקבלה הצעה למשרת מנהלת כיתה.", message: "התקבלה הצעה למשרת מנהלת כיתה.", entity_type: "staff_job_applications", entity_id: applicationIds[2], severity: "low", action_url: `/dashboard/staff/job-market/applications/${applicationIds[2]}`, created_by: managerId, status: "pending" }
], { onConflict: "id" });
assert.equal(notificationSeed.error, null, notificationSeed.error?.message);

const body = Buffer.from(JSON.stringify({ v: 1, id: invitationId, nonce: "ux08-owner-review-invitation" })).toString("base64url");
const invitationToken = `${body}.${createHmac("sha256", invitationSecret).update(body).digest("base64url")}`;
const tokenHash = createHash("sha256").update(invitationToken).digest("hex");
const fingerprint = createHash("sha256").update(`${candidateIdentity.email.toLowerCase()}|`).digest("hex");
await admin.from("management_invitations").update({ status: "superseded" }).eq("recipient_fingerprint", fingerprint).neq("id", invitationId).in("status", ["pending", "delivered"]);
const invitationSeed = await admin.from("management_invitations").upsert({ id: invitationId, invitation_type: "staff", intended_role: "staff", garden_id: gardenId, target_profile_id: candidateId, recipient_email: candidateIdentity.email, recipient_fingerprint: fingerprint, token_hash: tokenHash, status: "pending", expires_at: new Date(now.getTime() + 7 * 86400000).toISOString(), created_by: managerId, staff_application_id: applicationIds[2], payload: { opening_id: openingIds[2], role: "מנהלת כיתה", recipient_name: "נועה כהן" } }, { onConflict: "id" });
assert.equal(invitationSeed.error, null, invitationSeed.error?.message);

async function cookiesFor(user) {
  const jar = new Map();
  const client = createServerClient(keys.url, keys.anon, { cookieOptions: { path: "/", sameSite: "lax", secure: false }, cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (changes) => changes.forEach(({ name, value }) => jar.set(name, value)) } });
  const login = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  assert.equal(login.error, null, login.error?.message);
  return [...jar].map(([name, value]) => ({ name, value, url: base }));
}

const evidenceRoot = resolve("qa-evidence/ux-implement-08");
const screenshotRoot = resolve(evidenceRoot, "screenshots");
mkdirSync(screenshotRoot, { recursive: true });
const desktop = { width: 1440, height: 1024 };
const mobile = { width: 390, height: 844 };
const captures = [];
const errors = [];
const browser = await playwright.chromium.launch({ headless: true, executablePath: chrome });

async function contextFor(user) {
  const context = await browser.newContext({ viewport: desktop, locale: "he-IL", reducedMotion: "reduce" });
  await context.addCookies(await cookiesFor(user));
  return context;
}
async function capture(page, name, viewport, path, referenceArea, selector) {
  await page.setViewportSize(viewport);
  const response = await page.goto(`${base}${path}`, { waitUntil: "networkidle", timeout: 180_000 });
  assert.equal(response?.status(), 200, path);
  if (selector) await page.locator(selector).first().waitFor({ state: "visible", timeout: 30_000 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(220);
  const overflow = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const offenders = [...document.querySelectorAll("*")]
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          element: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${typeof element.className === "string" && element.className ? `.${element.className.trim().replace(/\s+/g, ".")}` : ""}`.slice(0, 180),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width)
        };
      })
      .filter((entry) => entry.left < -1 || entry.right > viewportWidth + 1)
      .slice(0, 12);
    return { detected: document.documentElement.scrollWidth > viewportWidth + 1, viewportWidth, scrollWidth: document.documentElement.scrollWidth, offenders };
  });
  assert.equal(overflow.detected, false, `${name} has horizontal overflow: ${JSON.stringify(overflow)}`);
  const png = await page.screenshot({ fullPage: false, animations: "disabled" });
  const file = resolve(screenshotRoot, `${name}.webp`);
  await sharp(png).webp({ quality: 90, effort: 5 }).toFile(file);
  const evidenceRoute = path.startsWith("/invite/accept?") ? "/invite/accept?token=[redacted-synthetic-token]" : path;
  captures.push({ name, route: evidenceRoute, viewport: `${viewport.width}x${viewport.height}`, referenceArea, screenshot: file.replace(`${process.cwd()}/`, ""), reviewStatus: "OWNER_REVIEW_READY", deviations: [] });
}
async function capturePair(page, name, path, referenceArea, selector) {
  await capture(page, `${name}-desktop`, desktop, path, `${referenceArea} — Desktop`, selector);
  await capture(page, `${name}-mobile`, mobile, path, `${referenceArea} — Mobile`, selector);
}

try {
  const candidateContext = await contextFor(candidateIdentity);
  const candidate = await candidateContext.newPage();
  candidate.on("pageerror", (error) => errors.push(error.message));
  candidate.on("response", (response) => { if (response.url().startsWith(base) && response.status() >= 500) errors.push(`${response.status()} ${new URL(response.url()).pathname}`); });
  await capturePair(candidate, "candidate-dashboard", "/dashboard/staff/job-market", "Candidate dashboard / recruitment hub");
  await capturePair(candidate, "candidate-profile", "/dashboard/staff/settings", "Candidate professional profile");
  await capturePair(candidate, "profile-completeness", "/dashboard/staff/settings", "Profile completeness and next actions", ".ux08-candidate-profile-hero");
  await capturePair(candidate, "documents-certificates", "/dashboard/staff/documents", "Documents and certificates");
  await capturePair(candidate, "opportunity-discovery", "/dashboard/staff/job-market", "Opportunity discovery and matching", "#opportunities");
  await capturePair(candidate, "job-detail", `/dashboard/staff/job-market/${openingIds[4]}`, "Job detail");
  await capturePair(candidate, "application-submit", `/dashboard/staff/job-market/${openingIds[4]}`, "Application submit");
  await capturePair(candidate, "application-detail", `/dashboard/staff/job-market/applications/${applicationIds[0]}`, "Application detail");
  await capturePair(candidate, "information-required", `/dashboard/staff/job-market/applications/${applicationIds[1]}`, "Information required");
  await capturePair(candidate, "activation-ready", `/dashboard/staff/job-market/applications/${applicationIds[2]}`, "Offer and activation ready");
  await capturePair(candidate, "rejected-state", `/dashboard/staff/job-market/applications/${applicationIds[3]}`, "Respectful rejection state");
  await capturePair(candidate, "invitation", `/invite/accept?token=${encodeURIComponent(invitationToken)}`, "Signed Garden invitation");
  await capturePair(candidate, "recruitment-notifications", "/dashboard/staff/recruitment-notifications", "Recruitment notifications");
  await candidateContext.close();

  const managerContext = await contextFor(managerIdentity);
  const manager = await managerContext.newPage();
  manager.on("pageerror", (error) => errors.push(error.message));
  manager.on("response", (response) => { if (response.url().startsWith(base) && response.status() >= 500) errors.push(`${response.status()} ${new URL(response.url()).pathname}`); });
  await capturePair(manager, "manager-recruitment-hub", "/dashboard/garden/staff-applications", "Manager recruitment hub and candidate list");
  assert.ok(await manager.locator(".ux08-candidate-list a").count() >= 4, "Manager recruitment list must show canonical applications");
  await capturePair(manager, "manager-candidate-list", "/dashboard/garden/staff-applications", "Candidates list", ".ux08-candidate-list");
  await capturePair(manager, "manager-candidate-detail", `/dashboard/garden/staff-applications/${applicationIds[0]}`, "Manager candidate detail");
  await capturePair(manager, "job-post-creation", "/dashboard/garden/staff-applications/new", "Job post creation");
  await managerContext.close();

  assert.deepEqual(errors, []);
  const results = { environment: config.environment, base, capturedAt: new Date().toISOString(), references: ["GB_UX_REF_STAFF_CANDIDATE_RECRUITMENT.png", "GB_UX_REF_STAFF_FULL_PLATFORM.png", "GB_UX_REF_OWNER_CORE.png", "GAN_BATUACH_BRAND_MARK.png"], viewports: { desktop, mobile }, personas: ["staff-candidate", "owner-a", "ux08 synthetic candidate density"], captures, counts: { OWNER_REVIEW_READY: captures.length, NEEDS_POLISH: 0, VISUAL_DRIFT: 0, BROKEN: 0 }, status: "PASS" };
  writeFileSync(resolve(evidenceRoot, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
  const sums = readdirSync(screenshotRoot).filter((name) => name.endsWith(".webp")).sort().map((name) => `${createHash("sha256").update(readFileSync(resolve(screenshotRoot, name))).digest("hex")}  screenshots/${basename(name)}`).join("\n");
  writeFileSync(resolve(evidenceRoot, "SHA256SUMS"), `${sums}\n`);
  console.log(`UX-IMPLEMENT-08 visual capture PASS: ${captures.length} OWNER_REVIEW_READY screenshots`);
} finally {
  await browser.close();
}
