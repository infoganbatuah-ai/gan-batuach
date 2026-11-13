// One bounded synthetic Candidate -> Manager -> Candidate journey on local Development.
// A failed run requires DB/receipt inspection before retrying; never targets Production.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServerClient } from "@supabase/ssr";
import { config, sql } from "../development/local-database.mjs";
import { localCredentials } from "../development/local-client.mjs";

const app = "http://127.0.0.1:3100";
const expectedSha = process.argv[2];
const resumeApplicationId = process.env.GB_CANDIDATE_APP_ID || null;
const candidateId = "00000000-0000-4000-8000-000000000304";
const gardenId = "00000000-0000-4000-8000-000000000601";
const openingId = "81000000-0000-4000-8000-000000000005";
const note = "נא לפרט זמינות לעבודה בגן בימי ראשון ושני.";
const answer = "זמינה לעבודה בימי ראשון ושני בשעות הבוקר.";
const started = Date.now();
const evidenceRoot = resolve(config.runtimeRoot, "candidate-application-review-journey-20261107");
const receiptPath = resolve(evidenceRoot, `receipt-${started}.json`);
const receipt = { task: "GB-PRODUCT-CANDIDATE-APPLICATION-REVIEW-JOURNEY-20261107", expectedSha,
  environment: config.environment, startedAt: new Date(started).toISOString(), status: "INCOMPLETE",
  actions: [], checks: [], captures: [], browserWrites: [], productionAccess: false };
const check = (name, pass) => { receipt.checks.push({ name, pass: Boolean(pass) }); assert.ok(pass, name); };
const cookieHeader = (person) => [...person.jar].map(([key, value]) => `${key}=${value}`).join("; ");
let browser; let applicationId; let runError;
const contexts = [];
const deadline = setTimeout(() => { receipt.deadline = "45_SECONDS"; void browser?.close().catch(() => {}); }, 45_000);
deadline.unref();

async function login(label, keys, identities) {
  const persona = identities.users.find((item) => item.email === `${label}@integration.qa.invalid`);
  assert.ok(persona?.password, `Missing ${label} synthetic persona`);
  const jar = new Map();
  const client = createServerClient(keys.url, keys.anon, { cookieOptions: { path: "/", sameSite: "lax", secure: false }, cookies: {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: (changes) => changes.forEach(({ name, value }) => jar.set(name, value))
  } });
  const result = await client.auth.signInWithPassword({ email: persona.email, password: persona.password });
  assert.equal(result.error, null, `${label} local authentication`);
  client.auth.stopAutoRefresh();
  return { label, jar, client, id: result.data.user.id };
}

async function api(person, path, method = "GET", body) {
  const response = await fetch(`${app}${path}`, { method, redirect: "manual", signal: AbortSignal.timeout(8_000),
    headers: { ...(person ? { Cookie: cookieHeader(person) } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json().catch(() => null) };
}

async function pageFor(person, viewport) {
  const context = await browser.newContext({ viewport, locale: "he-IL" });
  contexts.push(context);
  await context.addCookies([...person.jar].map(([name, value]) => ({ name, value, url: app })));
  await context.route("**/*", (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== app) return route.abort("blockedbyclient");
    if (!["GET", "HEAD"].includes(request.method())) {
      if (url.pathname.startsWith("/__nextjs_")) return route.abort("blockedbyclient");
      receipt.browserWrites.push({ method: request.method(), path: url.pathname });
      const allowed = request.method() === "POST" && (url.pathname === "/api/staff/job-applications" ||
        /^\/api\/(garden\/staff-applications|staff\/job-applications)\/[0-9a-f-]{36}$/i.test(url.pathname));
      if (!allowed || receipt.browserWrites.length > 4) return route.abort("blockedbyclient");
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(4_000);
  return page;
}

async function capture(page, name) {
  const path = resolve(evidenceRoot, `${name}-${started}.png`);
  await page.screenshot({ path, fullPage: false, animations: "disabled", timeout: 4_000 });
  chmodSync(path, 0o600);
  receipt.captures.push({ name, path });
}

function state(id) {
  assert.match(id, /^[0-9a-f-]{36}$/i);
  return JSON.parse(sql(`select json_build_object(
    'applications',(select count(*) from public.staff_job_applications where staff_candidate_id='${candidateId}'::uuid and opening_id='${openingId}'::uuid),
    'status',(select status from public.staff_job_applications where id='${id}'::uuid),
    'request',(select information_request from public.staff_job_applications where id='${id}'::uuid),
    'response',(select candidate_response from public.staff_job_applications where id='${id}'::uuid),
    'notifications',(select count(*) from public.notifications where entity_type='staff_job_applications' and entity_id='${id}'::uuid),
    'external_accepted',(select count(*) from public.communication_logs l join public.notifications n on n.id=l.notification_id where n.entity_type='staff_job_applications' and n.entity_id='${id}'::uuid and l.status in ('sent','delivered','accepted_by_provider')),
    'employment',(select count(*) from public.staff_kindergarten_employments where profile_id='${candidateId}'::uuid and garden_id='${gardenId}'::uuid and status in ('pending_approval','active')))` ).trim());
}

try {
  mkdirSync(evidenceRoot, { recursive: true, mode: 0o700 });
  assert.match(expectedSha ?? "", /^[0-9a-f]{40}$/);
  check("exact isolated feature source", execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim() === expectedSha);
  check("isolated Development only", config.environment === "DEVELOPMENT / INTEGRATION" && config.productionAllowed === false && config.projectId === "gan-batuach-integration");
  check("external provider delivery disabled", process.env.GB_M31_EXTERNAL_DELIVERY_ENABLED !== "true" && !process.env.GB_M31_DELIVERY_WORKER_SECRET);
  const keys = localCredentials();
  check("loopback Supabase", keys.url === "http://127.0.0.1:55421");
  const version = await api(null, "/api/development/version");
  check("exact running feature QA", version.status === 200 && version.body?.commit === expectedSha && version.body?.backend === "LOCAL_SUPABASE" && version.body?.production === false && version.body?.canonicalProduct === false);
  const identities = JSON.parse(readFileSync(resolve(config.runtimeRoot, "qa-identities.private.json"), "utf8"));
  check("synthetic identities", identities.environment === config.environment);
  const candidate = await login("staff-candidate", keys, identities);
  const manager = await login("manager-a", keys, identities);
  const foreignManager = await login("manager-b", keys, identities);
  const otherCandidate = await login("staff-b", keys, identities);
  check("candidate identity", candidate.id === candidateId);
  const eligibility = JSON.parse(sql(`select json_build_object('opening',exists(select 1 from public.kindergarten_staff_openings where id='${openingId}'::uuid and garden_id='${gardenId}'::uuid and active_status='published'),'complete',(select profile_completeness->>'required_fields_complete' from public.staff_candidate_profiles where profile_id='${candidateId}'::uuid),'applications',(select count(*) from public.staff_job_applications where staff_candidate_id='${candidateId}'::uuid and opening_id='${openingId}'::uuid),'employment',(select count(*) from public.staff_kindergarten_employments where profile_id='${candidateId}'::uuid and garden_id='${gardenId}'::uuid and status in ('pending_approval','active')))`).trim());
  if (resumeApplicationId) assert.match(resumeApplicationId, /^[0-9a-f-]{36}$/i);
  check("one eligible opening, bounded application and no employment", eligibility.opening && eligibility.complete === "true" && eligibility.applications === (resumeApplicationId ? 1 : 0) && eligibility.employment === 0);
  const require = createRequire(import.meta.url);
  const { chromium } = require("/Users/danielderi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
  browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, timeout: 8_000 });

  const candidatePage = await pageFor(candidate, { width: 1440, height: 1024 });
  await candidatePage.goto(`${app}/dashboard/staff/job-market/${openingId}`, { waitUntil: "domcontentloaded", timeout: 8_000 });
  if (resumeApplicationId) await candidatePage.getByRole("heading", { name: "גננת", exact: true }).waitFor();
  else await candidatePage.getByRole("button", { name: /הגשת מועמדות/ }).waitFor();
  check("Candidate sees local opening", resumeApplicationId
    ? await candidatePage.getByRole("heading", { name: "גננת", exact: true }).count() === 1
    : await candidatePage.getByRole("button", { name: /הגשת מועמדות/ }).count() === 1);
  if (resumeApplicationId) {
    applicationId = resumeApplicationId;
    check("resumed only recorded submitted application", state(applicationId).applications === 1 && state(applicationId).status === "submitted");
  } else {
    const submittedResponse = candidatePage.waitForResponse((response) => new URL(response.url()).pathname === "/api/staff/job-applications" && response.request().method() === "POST", { timeout: 15_000 });
    await candidatePage.getByRole("button", { name: /הגשת מועמדות/ }).click();
    const submitted = await submittedResponse;
    const submittedBody = await submitted.json();
    applicationId = submittedBody?.data?.application?.id;
    receipt.actions.push({ actor: "candidate-ui", action: "submit", status: submitted.status(), applicationId });
    check("one UI submission", submitted.status() === 201 && /^[0-9a-f-]{36}$/i.test(applicationId ?? "") && state(applicationId).status === "submitted");
  }
  await candidatePage.reload({ waitUntil: "domcontentloaded" });
  await capture(candidatePage, "candidate-desktop-submitted");
  const retry = await api(candidate, "/api/staff/job-applications", "POST", { opening_id: openingId, idempotency_key: `candidate-opening:${openingId}` });
  check("same-key retry preserves one application", retry.status === 201 && retry.body?.data?.application?.id === applicationId && retry.body?.data?.idempotent === true && state(applicationId).applications === 1);

  const managerPage = await pageFor(manager, { width: 1440, height: 1024 });
  await managerPage.goto(`${app}/dashboard/garden/staff-applications/${applicationId}`, { waitUntil: "domcontentloaded", timeout: 8_000 });
  await managerPage.getByText("נועה כהן").first().waitFor();
  check("Manager sees Candidate application", await managerPage.getByText("נועה כהן").count() > 0);
  await capture(managerPage, "manager-desktop-submitted");
  const form = managerPage.locator("#decision form");
  await form.locator('select[name="action"]').selectOption("review");
  const reviewedResponse = managerPage.waitForResponse((response) => new URL(response.url()).pathname === `/api/garden/staff-applications/${applicationId}` && response.request().method() === "POST", { timeout: 15_000 });
  await form.getByRole("button", { name: /שמירה/ }).click();
  const reviewed = await reviewedResponse;
  receipt.actions.push({ actor: "manager-ui", action: "review", status: reviewed.status() });
  check("Manager review refreshes status", reviewed.status() === 200 && state(applicationId).status === "under_review");
  await managerPage.getByText("בבדיקה").first().waitFor();
  await form.locator('select[name="action"]').selectOption("request_information");
  await form.locator('textarea[name="decision_reason"]').fill(note);
  const requestResponse = managerPage.waitForResponse((response) => new URL(response.url()).pathname === `/api/garden/staff-applications/${applicationId}` && response.request().method() === "POST", { timeout: 15_000 });
  await form.getByRole("button", { name: /שמירה/ }).click();
  const requested = await requestResponse;
  receipt.actions.push({ actor: "manager-ui", action: "request_information", status: requested.status() });
  check("Manager requests only information", requested.status() === 200 && state(applicationId).status === "information_required" && state(applicationId).request === note);
  await managerPage.getByText(note).first().waitFor();
  await capture(managerPage, "manager-desktop-information-required");

  await candidatePage.goto(`${app}/dashboard/staff/job-market/applications/${applicationId}`, { waitUntil: "domcontentloaded" });
  await candidatePage.getByText(note).first().waitFor();
  await capture(candidatePage, "candidate-desktop-information-required");
  await candidatePage.getByRole("button", { name: /השלמת המידע/ }).click();
  await candidatePage.locator(".ux08-action-panel textarea").fill(answer);
  const responsePromise = candidatePage.waitForResponse((response) => new URL(response.url()).pathname === `/api/staff/job-applications/${applicationId}` && response.request().method() === "POST", { timeout: 15_000 });
  await candidatePage.getByRole("button", { name: /שליחה לבדיקה/ }).click();
  const answered = await responsePromise;
  receipt.actions.push({ actor: "candidate-ui", action: "respond", status: answered.status() });
  check("Candidate responds without activation", answered.status() === 200 && state(applicationId).status === "resubmitted" && state(applicationId).response === answer);
  await candidatePage.getByText(answer).first().waitFor();
  await capture(candidatePage, "candidate-desktop-resubmitted");
  await managerPage.reload({ waitUntil: "domcontentloaded" });
  await managerPage.getByText(answer).first().waitFor();
  await capture(managerPage, "manager-desktop-resubmitted");
  const candidateMobile = await pageFor(candidate, { width: 390, height: 844 });
  await candidateMobile.goto(`${app}/dashboard/staff/job-market/applications/${applicationId}`, { waitUntil: "domcontentloaded" });
  await candidateMobile.getByText(answer).first().waitFor();
  await capture(candidateMobile, "candidate-mobile-resubmitted");
  const managerMobile = await pageFor(manager, { width: 390, height: 844 });
  await managerMobile.goto(`${app}/dashboard/garden/staff-applications/${applicationId}`, { waitUntil: "domcontentloaded" });
  await managerMobile.getByText(answer).first().waitFor();
  await capture(managerMobile, "manager-mobile-resubmitted");

  const baseline = state(applicationId);
  for (const person of [foreignManager, otherCandidate]) {
    const rows = await person.client.from("staff_job_applications").select("id,status,information_request,candidate_response").eq("id", applicationId);
    check(`${person.label} known-ID RLS denial`, !rows.error && rows.data.length === 0);
    const denied = await api(person, `/api/garden/staff-applications/${applicationId}`, "POST", { action: "review" });
    check(`${person.label} known-ID Manager action denied`, [403, 404].includes(denied.status) && !JSON.stringify(denied.body ?? {}).includes(note) && !JSON.stringify(denied.body ?? {}).includes(answer));
    check(`${person.label} denial leaves application unchanged`, JSON.stringify(state(applicationId)) === JSON.stringify(baseline));
  }
  const guest = await api(null, `/api/garden/staff-applications/${applicationId}`, "POST", { action: "review" });
  check("guest known-ID action denied", [401, 403, 404].includes(guest.status) && !JSON.stringify(guest.body ?? {}).includes(note));
  check("Candidate denied operational shift access", [401, 403].includes((await api(candidate, "/api/staff/shifts")).status));
  const final = state(applicationId);
  check("bounded application, notifications, no employment or external delivery", final.applications === 1 && final.status === "resubmitted" && final.employment === 0 && final.external_accepted === 0 && final.notifications <= 4);
  receipt.state = final;
  receipt.status = "PASS";
} catch (error) {
  runError = error;
  receipt.error = error instanceof Error ? error.message.slice(0, 200) : "unknown";
  receipt.state = applicationId ? state(applicationId) : null;
  receipt.status = "BLOCKED";
} finally {
  clearTimeout(deadline);
  for (const context of contexts) await context.close().catch(() => {});
  await browser?.close().catch(() => {});
  receipt.cleanup = "BROWSER_CLOSED; ONE_QA_APPLICATION_PRESERVED_FOR_READBACK";
  receipt.finishedAt = new Date().toISOString();
  mkdirSync(evidenceRoot, { recursive: true, mode: 0o700 });
  writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  chmodSync(receiptPath, 0o600);
  console.log(JSON.stringify({ status: receipt.status, checks: receipt.checks.length, applicationId, receiptPath, captures: receipt.captures.length, productionAccess: false }));
  if (runError) process.exitCode = 1;
}
