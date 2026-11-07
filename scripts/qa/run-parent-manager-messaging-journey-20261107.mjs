// One bounded synthetic UI conversation on the isolated Development backend.
// A failed run is never retried until its receipt and DB state are inspected.
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
const title = "GB QA Parent Manager conversation 2026-11-07";
const firstBody = "בדיקת שיחה פנימית מקומית בלבד";
const replyBody = "התקבלה הודעת בדיקה במערכת המקומית";
const started = Date.now();
const evidenceRoot = resolve(config.runtimeRoot, "parent-manager-messaging-journey-20261107");
const receiptPath = resolve(evidenceRoot, `receipt-${started}.json`);
const evidence = { task: "GB-PRODUCT-PARENT-MANAGER-MESSAGING-JOURNEY-20261107", expectedSha,
  startedAt: new Date(started).toISOString(), environment: config.environment, status: "INCOMPLETE",
  checks: [], actions: [], captures: [], browserWrites: [], cleanup: "NOT_STARTED", productionAccess: false };
let browser; let threadId; let runError;
const contexts = [];
const deadline = setTimeout(() => { evidence.deadline = "45_SECONDS"; void browser?.close().catch(() => {}); }, 45_000);
deadline.unref();
const check = (name, pass) => { evidence.checks.push({ name, pass: Boolean(pass) }); assert.ok(pass, name); };
const cookieHeader = (session) => [...session.jar].map(([name, value]) => `${name}=${value}`).join("; ");

async function login(label, keys, identities) {
  const persona = identities.users.find((item) => item.email === `${label}@integration.qa.invalid`);
  assert.ok(persona?.password, `Missing ${label} QA persona`);
  const jar = new Map();
  const client = createServerClient(keys.url, keys.anon, { cookieOptions: { path: "/", sameSite: "lax", secure: false }, cookies: {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: (changes) => changes.forEach(({ name, value }) => jar.set(name, value))
  } });
  const result = await client.auth.signInWithPassword({ email: persona.email, password: persona.password });
  assert.equal(result.error, null, `${label} local Auth`);
  client.auth.stopAutoRefresh();
  return { label, jar, client, id: result.data.user.id };
}

async function api(person, path, method = "GET", body, key) {
  const response = await fetch(`${app}${path}`, { method, redirect: "manual", signal: AbortSignal.timeout(6_000),
    headers: { ...(person ? { Cookie: cookieHeader(person) } : {}), ...(body ? { "Content-Type": "application/json" } : {}), ...(key ? { "Idempotency-Key": key } : {}) },
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
      evidence.browserWrites.push({ method: request.method(), path: url.pathname });
      const allowed = request.method() === "POST" &&
        (url.pathname === "/api/communication/threads" || /^\/api\/communication\/threads\/[0-9a-f-]{36}(?:\/read)?$/i.test(url.pathname));
      if (!allowed || evidence.browserWrites.length > 6) return route.abort("blockedbyclient");
    }
    return route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5_000);
  return page;
}

async function capture(page, name) {
  const path = resolve(evidenceRoot, `${name}-${started}.png`);
  await page.screenshot({ path, fullPage: false, animations: "disabled", timeout: 5_000 });
  chmodSync(path, 0o600);
  evidence.captures.push({ name, path });
}

function state(id) {
  assert.match(id, /^[0-9a-f-]{36}$/i);
  return JSON.parse(sql(`select json_build_object(
    'threads',(select count(*) from public.communication_threads where id='${id}'::uuid),
    'messages',(select count(*) from public.messages where thread_id='${id}'::uuid and deleted_at is null),
    'participants',(select count(*) from public.communication_thread_participants where thread_id='${id}'::uuid and left_at is null),
    'notifications',(select count(*) from public.notifications where entity_type='communication_thread' and entity_id='${id}'::uuid),
    'external_accepted',(select count(*) from public.communication_logs l join public.notifications n on n.id=l.notification_id where n.entity_type='communication_thread' and n.entity_id='${id}'::uuid and l.status in ('sent','delivered','accepted_by_provider')),
    'read_markers',(select count(*) from public.communication_thread_participants where thread_id='${id}'::uuid and last_read_message_id is not null))`).trim());
}

try {
  mkdirSync(evidenceRoot, { recursive: true, mode: 0o700 });
  assert.match(expectedSha ?? "", /^[0-9a-f]{40}$/);
  check("exact feature HEAD", execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim() === expectedSha);
  check("isolated Development only", config.environment === "DEVELOPMENT / INTEGRATION" && config.productionAllowed === false && config.projectId === "gan-batuach-integration");
  check("no external provider flag or worker secret", process.env.GB_M31_EXTERNAL_DELIVERY_ENABLED !== "true" && !process.env.GB_M31_DELIVERY_WORKER_SECRET);
  const keys = localCredentials();
  check("loopback backend", keys.url === "http://127.0.0.1:55421");
  const version = await api(null, "/api/development/version");
  check("exact feature server", version.status === 200 && version.body?.commit === expectedSha && version.body?.backend === "LOCAL_SUPABASE" && version.body?.production === false);
  const identities = JSON.parse(readFileSync(resolve(config.runtimeRoot, "qa-identities.private.json"), "utf8"));
  check("synthetic identities", identities.environment === config.environment);
  const parent = await login("parent-b", keys, identities);
  const manager = await login("manager-b", keys, identities);
  const foreignParent = await login("parent-a", keys, identities);
  const foreignManager = await login("manager-a", keys, identities);
  const staff = await login("staff-b", keys, identities);
  const childId = "00000000-0000-4000-8000-000000000902";
  const gardenId = "00000000-0000-4000-8000-000000000602";
  const eligibility = JSON.parse(sql(`select json_build_object('eligible',exists(select 1 from public.child_kindergarten_enrollments e join public.children c on c.id=e.child_id join public.child_guardian_links l on l.permanent_child_file_id=c.permanent_child_file_id join public.gardens g on g.id=e.garden_id where e.child_id='${childId}'::uuid and e.garden_id='${gardenId}'::uuid and e.status='active' and l.guardian_profile_id='${parent.id}'::uuid and l.status='active' and l.legal_authority and g.manager_id='${manager.id}'::uuid),'existing',(select count(*) from public.communication_threads where subject='${title}'))`).trim());
  check("one eligible Garden B Child and no existing fixed-title thread", eligibility.eligible === true && Number(eligibility.existing) === 0);
  const require = createRequire(import.meta.url);
  const { chromium } = require("/Users/danielderi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
  browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, timeout: 8_000 });
  const parentPage = await pageFor(parent, { width: 1440, height: 1024 });
  await parentPage.goto(`${app}/dashboard/parent/messages`, { waitUntil: "domcontentloaded", timeout: 12_000 });
  await parentPage.locator(".communication-compose-button").click();
  const form = parentPage.locator("form.communication-compose-modal");
  await form.locator('select[name="recipient_id"]').selectOption(manager.id);
  await form.locator('select[name="linked_child_id"]').selectOption(childId);
  await form.locator('input[name="subject"]').fill(title);
  await form.locator('textarea[name="body"]').fill(firstBody);
  parentPage.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/communication/threads" && request.method() === "POST") {
      evidence.createRequestKey = request.headers()["idempotency-key"];
    }
  });
  const createdPromise = parentPage.waitForResponse((response) => new URL(response.url()).pathname === "/api/communication/threads" && response.request().method() === "POST", { timeout: 12_000 });
  await form.locator('button[type="submit"]').click();
  const created = await createdPromise;
  const createdPayload = (await created.json()).data;
  threadId = createdPayload?.thread_id;
  evidence.actions.push({ actor: "parent-b-ui", action: "create", status: created.status(), threadId });
  check("Parent UI created one canonical thread", created.status() === 201 && /^[0-9a-f-]{36}$/i.test(threadId ?? "") && createdPayload.idempotent === false);
  await parentPage.locator(".communication-thread-row").filter({ hasText: title }).waitFor();
  await parentPage.getByText(firstBody).first().waitFor();
  await capture(parentPage, "parent-desktop-created");
  const firstKey = created.request().headers()["idempotency-key"];
  const firstPayload = created.request().postDataJSON();
  const repeat = await api(parent, "/api/communication/threads", "POST", firstPayload, firstKey);
  check("same-key retry returns original message without a duplicate", repeat.status === 201 && repeat.body?.data?.thread_id === threadId && repeat.body.data.message_id === createdPayload.message_id && repeat.body.data.idempotent === true && state(threadId).messages === 1);

  const managerPage = await pageFor(manager, { width: 1440, height: 1024 });
  await managerPage.goto(`${app}/dashboard/garden/messages`, { waitUntil: "domcontentloaded", timeout: 12_000 });
  await managerPage.locator(".communication-thread-row").filter({ hasText: title }).click();
  await managerPage.getByText(firstBody).first().waitFor();
  await capture(managerPage, "manager-desktop-inbox");
  await managerPage.locator('.communication-composer textarea').fill(replyBody);
  const replyPromise = managerPage.waitForResponse((response) => new URL(response.url()).pathname === `/api/communication/threads/${threadId}` && response.request().method() === "POST");
  await managerPage.locator(".communication-send-button").click();
  const replied = await replyPromise;
  evidence.actions.push({ actor: "manager-b-ui", action: "reply", status: replied.status() });
  check("Manager UI sent one reply", replied.status() === 200 && (await replied.json()).data?.thread_id === threadId);
  await managerPage.getByText(replyBody).first().waitFor();
  await capture(managerPage, "manager-desktop-replied");
  await parentPage.reload({ waitUntil: "domcontentloaded", timeout: 12_000 });
  await parentPage.locator(".communication-thread-row").filter({ hasText: title }).click();
  await parentPage.getByText(replyBody).first().waitFor();
  const mobile = await pageFor(parent, { width: 390, height: 844 });
  await mobile.goto(`${app}/dashboard/parent/messages`, { waitUntil: "domcontentloaded", timeout: 12_000 });
  await mobile.locator(".communication-thread-row").filter({ hasText: title }).click();
  await mobile.getByText(replyBody).first().waitFor();
  await capture(mobile, "parent-mobile-readback");
  const ownDetail = await api(parent, `/api/communication/threads/${threadId}`);
  const managerDetail = await api(manager, `/api/communication/threads/${threadId}`);
  check("same ordered two messages visible to both participants", ownDetail.status === 200 && managerDetail.status === 200 && ownDetail.body?.data?.messages?.length === 2 && managerDetail.body?.data?.messages?.length === 2 && ownDetail.body.data.messages[0].id === managerDetail.body.data.messages[0].id && ownDetail.body.data.messages[1].id === managerDetail.body.data.messages[1].id);
  const baseline = state(threadId);
  for (const person of [foreignParent, foreignManager, staff, null]) {
    const label = person?.label ?? "guest";
    const detail = await api(person, `/api/communication/threads/${threadId}`);
    const send = await api(person, `/api/communication/threads/${threadId}`, "POST", { body: "denied" }, crypto.randomUUID());
    const mark = await api(person, `/api/communication/threads/${threadId}/read`, "POST");
    check(`${label} known-ID detail/send/read denied without content`, [401, 403, 404].includes(detail.status) && [401, 403, 404].includes(send.status) && [401, 403, 404].includes(mark.status) && !JSON.stringify(detail.body ?? {}).includes(firstBody) && !JSON.stringify(detail.body ?? {}).includes(replyBody));
    check(`${label} denial leaves conversation unchanged`, JSON.stringify(state(threadId)) === JSON.stringify(baseline));
  }
  check("one thread, two messages, two participants, no external acceptance", baseline.threads === 1 && baseline.messages === 2 && baseline.participants === 2 && baseline.notifications === 2 && baseline.external_accepted === 0 && baseline.read_markers === 2);
  evidence.state = baseline;
  evidence.status = "PASS";
} catch (error) {
  runError = error;
  evidence.error = error instanceof Error ? error.message.slice(0, 200) : "unknown";
  evidence.state = threadId ? state(threadId) : null;
  evidence.status = "BLOCKED";
} finally {
  clearTimeout(deadline);
  for (const context of contexts) await context.close().catch(() => {});
  await browser?.close().catch(() => {});
  evidence.cleanup = "BROWSER_CLOSED; QA_ROWS_PRESERVED_FOR_READBACK";
  evidence.finishedAt = new Date().toISOString();
  mkdirSync(evidenceRoot, { recursive: true, mode: 0o700 });
  writeFileSync(receiptPath, JSON.stringify(evidence, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  chmodSync(receiptPath, 0o600);
  console.log(JSON.stringify({ status: evidence.status, checks: evidence.checks.length, threadId, receiptPath, captures: evidence.captures.length, productionAccess: false }));
  if (runError) process.exitCode = 1;
}
