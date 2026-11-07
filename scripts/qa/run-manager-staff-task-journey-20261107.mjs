// One bounded synthetic UI journey against the isolated local Development backend.
// A failed run is never blindly retried: inspect its receipt and the task row first.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createServerClient } from "@supabase/ssr";
import { config, sql } from "../development/local-database.mjs";
import { localCredentials } from "../development/local-client.mjs";
import { boundedCleanup, fingerprint, persistReceipt, sanitizeError } from "./inspector-retry-guard.mjs";

const app = process.env.GB_QA_APP ?? "http://127.0.0.1:3100";
const expectedSha = process.argv[2];
const title = "GB QA Manager Staff task 2026-11-07";
const started = Date.now();
const evidenceRoot = resolve(config.runtimeRoot, "manager-staff-task-journey-20261107", "evidence");
const receiptPath = resolve(evidenceRoot, `receipt-${started}.json`);
const evidence = { task: "GB-PRODUCT-MANAGER-STAFF-TASK-JOURNEY-20261107", startedAt: new Date(started).toISOString(), expectedSha, environment: config.environment, status: "INCOMPLETE", checks: [], actions: [], captures: [], browserWrites: [], navigationCounts: {}, cleanup: "NOT_STARTED" };
const sessions = [];
const contexts = [];
let browser;
let taskId;
let runError;
const deadline = setTimeout(() => { evidence.deadline = "45_SECONDS"; void browser?.close().catch(() => {}); }, 45_000);
deadline.unref();

function check(name, pass) { evidence.checks.push({ name, pass: Boolean(pass) }); assert.ok(pass, name); }
function cookieHeader(session) { return [...session.jar].map(([name, value]) => `${name}=${value}`).join("; "); }
async function session(label, keys, identities) {
  const persona = identities.users.find((item) => item.email === `${label}@integration.qa.invalid`);
  assert.ok(persona?.password, `Missing ${label} QA persona`);
  const jar = new Map();
  const client = createServerClient(keys.url, keys.anon, { cookieOptions: { path: "/", sameSite: "lax", secure: false }, cookies: {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: (changes) => changes.forEach(({ name, value }) => jar.set(name, value))
  } });
  const login = await client.auth.signInWithPassword({ email: persona.email, password: persona.password });
  assert.equal(login.error, null, `${label} login`);
  client.auth.stopAutoRefresh();
  const result = { label, client, jar, userId: login.data.user.id };
  sessions.push(result);
  return result;
}
async function api(sessionValue, path, method = "GET", body) {
  const response = await fetch(`${app}${path}`, { method, redirect: "manual", signal: AbortSignal.timeout(8_000),
    headers: { ...(sessionValue ? { Cookie: cookieHeader(sessionValue) } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, body: await response.json().catch(() => null) };
}
async function taskRow(client, id) {
  const result = await client.from("tasks").select("id,garden_id,assigned_to,status,updated_at,completed_at").eq("id", id).maybeSingle();
  assert.equal(result.error, null);
  return result.data;
}
async function contextFor(person, viewport) {
  const context = await browser.newContext({ viewport, locale: "he-IL" });
  contexts.push(context);
  await context.addCookies([...person.jar].map(([name, value]) => ({ name, value, url: app })));
  await context.route("**/*", (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== app) return route.abort("blockedbyclient");
    if (request.method() !== "GET" && request.method() !== "HEAD") {
      evidence.browserWrites.push({ method: request.method(), path: url.pathname });
      if (request.method() !== "POST" || (url.pathname !== "/api/tasks" && !/^\/api\/tasks\/[0-9a-f-]{36}\/status$/i.test(url.pathname)) || evidence.browserWrites.length > 4) {
        return route.abort("blockedbyclient");
      }
    }
    if ((request.isNavigationRequest() || url.searchParams.has("_rsc")) && ["/dashboard/garden/tasks", "/dashboard/staff/tasks"].includes(url.pathname)) {
      const count = (evidence.navigationCounts[url.pathname] ?? 0) + 1;
      evidence.navigationCounts[url.pathname] = count;
      if (count > 6) return route.abort("blockedbyclient");
    }
    return route.continue();
  });
  return context;
}
async function ready(page) {
  await page.waitForFunction(() => {
    const splash = document.querySelector(".branded-splash");
    const transition = document.querySelector(".app-page-transition");
    return (!splash || Number(getComputedStyle(splash).opacity) < 0.01) && (!transition || Number(getComputedStyle(transition).opacity) >= 0.99);
  }, null, { timeout: 8_000 });
}
async function capture(page, name) {
  const path = resolve(evidenceRoot, `${name}-${started}.png`);
  await page.screenshot({ path, fullPage: false, animations: "disabled", timeout: 6_000 });
  chmodSync(path, 0o600);
  evidence.captures.push({ name, path });
}
function countEvidence(id) {
  assert.match(id, /^[0-9a-f-]{36}$/i);
  const result = sql(`select json_build_object('audit',(select count(*) from public.audit_logs where entity_type='tasks' and entity_id='${id}'::uuid),'notifications',(select count(*) from public.notifications where entity_type='task' and entity_id='${id}'::uuid),'channels',(select coalesce(json_agg(distinct channel), '[]'::json) from public.notifications where entity_type='task' and entity_id='${id}'::uuid))`);
  return JSON.parse(result.trim());
}

try {
  assert.match(expectedSha ?? "", /^[0-9a-f]{40}$/);
  assert.equal(execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), expectedSha);
  check("isolated Development configuration", config.environment === "DEVELOPMENT / INTEGRATION" && config.productionAllowed === false && config.projectId === "gan-batuach-integration");
  check("loopback feature preview", app === "http://127.0.0.1:3100");
  const keys = localCredentials();
  check("local backend only", keys.url === "http://127.0.0.1:55421");
  const version = await api(null, "/api/development/version");
  check("exact feature SHA and local backend", version.status === 200 && version.body?.commit === expectedSha && version.body?.backend === "LOCAL_SUPABASE" && version.body?.production === false);
  const identities = JSON.parse(readFileSync(resolve(config.runtimeRoot, "qa-identities.private.json"), "utf8"));
  assert.equal(identities.environment, config.environment);
  const manager = await session("manager-b", keys, identities);
  const staff = await session("staff-b", keys, identities);
  const foreignManager = await session("manager-a", keys, identities);
  const foreignStaff = await session("staff-a", keys, identities);
  const parent = await session("parent-a", keys, identities);
  const staffRows = await manager.client.from("staff_kindergarten_employments").select("garden_id,status,profile_id,staff(approved_to_work,onboarding_status)").eq("profile_id", staff.userId).eq("status", "active").limit(2);
  check("one eligible Garden B Staff employment", !staffRows.error && staffRows.data?.length === 1 && staffRows.data[0].staff?.approved_to_work === true && staffRows.data[0].staff?.onboarding_status === "active");
  const gardenId = staffRows.data[0].garden_id;
  const manages = await manager.client.rpc("can_manage_garden", { target_garden_id: gardenId });
  check("Manager B has Garden B authority", !manages.error && manages.data === true);
  const existing = await manager.client.from("tasks").select("id,status").eq("garden_id", gardenId).eq("title", title).limit(2);
  check("no existing task with the fixed QA title; no blind retry", !existing.error && existing.data?.length === 0);
  const require = createRequire(import.meta.url);
  const { chromium } = require("/Users/danielderi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
  browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, timeout: 10_000 });
  const managerPage = await (await contextFor(manager, { width: 1440, height: 1024 })).newPage();
  managerPage.setDefaultTimeout(8_000);
  await managerPage.goto(`${app}/dashboard/garden/tasks`, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await managerPage.getByRole("button", { name: "משימה חדשה" }).waitFor();
  await ready(managerPage);
  await capture(managerPage, "manager-before");
  await managerPage.getByRole("button", { name: "משימה חדשה" }).click();
  const dialog = managerPage.getByRole("dialog", { name: "משימה חדשה" });
  await dialog.getByLabel("כותרת").fill(title);
  await dialog.getByLabel("תיאור").fill("בדיקת תהליך מקומית בלבד");
  await dialog.getByLabel("אחראי").selectOption(staff.userId);
  const createdResponse = managerPage.waitForResponse((response) => new URL(response.url()).pathname === "/api/tasks" && response.request().method() === "POST");
  await dialog.getByRole("button", { name: "יצירת משימה" }).click();
  const created = await createdResponse;
  const createdBody = await created.json();
  taskId = createdBody?.data?.id;
  evidence.actions.push({ actor: "manager-b-ui", action: "create", status: created.status(), taskId });
  check("Manager UI created exactly one assigned ordinary task", created.status() === 201 && /^[0-9a-f-]{36}$/i.test(taskId ?? "") && createdBody.data.assigned_to === staff.userId && createdBody.data.garden_id === gardenId && createdBody.data.task_type === "general" && createdBody.data.status === "open");
  const staffPage = await (await contextFor(staff, { width: 390, height: 844 })).newPage();
  staffPage.setDefaultTimeout(8_000);
  await staffPage.goto(`${app}/dashboard/staff/tasks`, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await staffPage.getByText(title).first().waitFor();
  await ready(staffPage);
  await staffPage.getByRole("listitem").filter({ hasText: title }).click();
  await capture(staffPage, "staff-open");
  for (const [action, label, expected] of [["start", "התחלת טיפול", "in_progress"], ["submit", "שליחה לאישור", "waiting_approval"]]) {
    const next = staffPage.waitForResponse((response) => new URL(response.url()).pathname === `/api/tasks/${taskId}/status` && response.request().method() === "POST");
    await staffPage.getByRole("button", { name: label }).click();
    const response = await next;
    const body = await response.json();
    evidence.actions.push({ actor: "staff-b-ui", action, status: response.status(), resultingStatus: body?.data?.status });
    check(`Staff ${action} transition`, response.status() === 200 && body?.data?.id === taskId && body.data.status === expected);
  }
  await staffPage.reload({ waitUntil: "domcontentloaded", timeout: 12_000 });
  await staffPage.getByText(title).first().waitFor();
  await ready(staffPage);
  check("Staff refresh retains submitted task", (await taskRow(staff.client, taskId))?.status === "waiting_approval");
  await capture(staffPage, "staff-submitted");
  await managerPage.reload({ waitUntil: "domcontentloaded", timeout: 12_000 });
  await managerPage.getByText(title).first().waitFor();
  await ready(managerPage);
  await managerPage.getByRole("listitem").filter({ hasText: title }).click();
  await managerPage.getByRole("button", { name: "אישור השלמה" }).waitFor();
  const completedResponse = managerPage.waitForResponse((response) => new URL(response.url()).pathname === `/api/tasks/${taskId}/status` && response.request().method() === "POST");
  await managerPage.getByRole("button", { name: "אישור השלמה" }).click();
  const completed = await completedResponse;
  const completedBody = await completed.json();
  evidence.actions.push({ actor: "manager-b-ui", action: "complete", status: completed.status(), resultingStatus: completedBody?.data?.status });
  check("Manager UI approved Staff submission", completed.status() === 200 && completedBody?.data?.id === taskId && completedBody.data.status === "done");
  await managerPage.reload({ waitUntil: "domcontentloaded", timeout: 12_000 });
  await managerPage.getByText(title).first().waitFor();
  await ready(managerPage);
  await capture(managerPage, "manager-completed");
  const beforeRepeat = countEvidence(taskId);
  const repeat = await api(manager, `/api/tasks/${taskId}/status`, "POST", { action: "complete" });
  const afterRepeat = countEvidence(taskId);
  check("repeat approval is idempotent with no duplicate audit or notification", repeat.status === 200 && repeat.body?.data?.id === taskId && repeat.body.data.status === "done" && JSON.stringify(beforeRepeat) === JSON.stringify(afterRepeat));
  const own = await taskRow(staff.client, taskId);
  const managerOwn = await taskRow(manager.client, taskId);
  check("Manager and Staff read identical completed task", own?.status === "done" && own?.assigned_to === staff.userId && own?.completed_at && managerOwn?.id === taskId && managerOwn?.updated_at === own.updated_at);
  for (const actor of [foreignStaff, foreignManager, parent]) {
    const direct = await taskRow(actor.client, taskId);
    check(`${actor.label} known-ID direct read denied`, direct === null);
    const denial = await api(actor, `/api/tasks/${taskId}/status`, "POST", { action: "reopen" });
    evidence.actions.push({ actor: actor.label, action: "denied_reopen", status: denial.status });
    check(`${actor.label} known-ID transition denied without task data`, [401, 403, 404].includes(denial.status) && denial.body?.data == null && !(JSON.stringify(denial.body ?? {}).includes(title)));
    check(`${actor.label} denial leaves task unchanged`, (await taskRow(manager.client, taskId))?.status === "done");
  }
  const guest = await api(null, `/api/tasks/${taskId}/status`, "POST", { action: "reopen" });
  check("guest known-ID transition denied", [401, 403].includes(guest.status) && guest.body?.data == null);
  const after = await manager.client.from("tasks").select("id,status").eq("garden_id", gardenId).eq("title", title).limit(2);
  check("exactly one completed QA task remains", !after.error && after.data?.length === 1 && after.data[0].id === taskId && after.data[0].status === "done");
  const counts = countEvidence(taskId);
  evidence.counts = counts;
  check("bounded canonical audit and in-app-only notifications", Number(counts.audit) === 4 && Number(counts.notifications) === 2 && JSON.stringify(counts.channels) === '["in_app"]');
  check("browser request and navigation caps respected", evidence.browserWrites.length === 4 && Object.values(evidence.navigationCounts).every((count) => count <= 6) && !evidence.deadline);
  evidence.status = "SCOPED_PASS";
} catch (error) {
  runError = error;
  evidence.status = "FAILED";
  evidence.failure = sanitizeError(error);
} finally {
  if (taskId) {
    evidence.taskId = taskId;
    try { evidence.finalDatabaseStatus = JSON.parse(sql(`select row_to_json(t) from (select id,status,assigned_to,garden_id,updated_at from public.tasks where id='${taskId}'::uuid) t`).trim() || "null")?.status ?? "MISSING"; }
    catch (error) { evidence.finalDatabaseStatus = `UNKNOWN_${fingerprint(error).slice(0, 12)}`; }
  }
  const cleanupErrors = [];
  for (const context of contexts) try { await boundedCleanup(() => context.close()); } catch (error) { cleanupErrors.push(fingerprint(error)); }
  if (browser) try { await boundedCleanup(() => browser.close()); } catch (error) { cleanupErrors.push(fingerprint(error)); browser.process()?.kill("SIGKILL"); }
  for (const item of sessions) item.client.auth.stopAutoRefresh();
  clearTimeout(deadline);
  evidence.cleanup = cleanupErrors.length ? "FAILED" : "COMPLETE";
  evidence.cleanupErrorFingerprints = cleanupErrors;
  evidence.elapsedMs = Date.now() - started;
  const digest = persistReceipt(receiptPath, evidence);
  console.log(JSON.stringify({ status: evidence.status, receiptPath, sha256: digest, checks: evidence.checks.length, taskId: taskId ?? null, cleanup: evidence.cleanup, finalDatabaseStatus: evidence.finalDatabaseStatus ?? null }));
  process.exitCode = runError || evidence.cleanup !== "COMPLETE" ? 1 : 0;
}
