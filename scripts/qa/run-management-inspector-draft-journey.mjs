// One bounded synthetic Development journey. Never submit an inspection or use a service-role client.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, relative, resolve, sep } from "node:path";
import { parseEnv } from "node:util";
import { createServerClient } from "@supabase/ssr";
import { config, sql } from "../development/local-database.mjs";
import { localCredentials } from "../development/local-client.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("/Users/danielderi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const app = "http://127.0.0.1:3100";
const inspectionId = "97000000-0000-4000-8000-000000000004";
const questionId = "97000000-0000-4000-8000-000000000020";
const marker = "QA draft journey 2026-11-07";
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const expectedSha = process.argv[2];
assert.match(expectedSha ?? "", /^[a-f0-9]{40}$/);
assert.equal(config.environment, "DEVELOPMENT / INTEGRATION");
assert.equal(config.productionAllowed, false);

const identityFile = resolve(config.runtimeRoot, "qa-identities.private.json");
const identities = JSON.parse(readFileSync(identityFile, "utf8"));
assert.equal(identities.environment, config.environment);
function identity(email) {
  const value = identities.users.find((item) => item.email === email);
  assert.ok(value?.id && value?.password, `Synthetic identity unavailable: ${email}`);
  return value;
}
const assigned = identity("inspector-a@integration.qa.invalid");
const unassigned = identity("inspector-unassigned@integration.qa.invalid");
const staff = identity("staff-a@integration.qa.invalid");
const keys = localCredentials();
assert.equal(keys.url, "http://127.0.0.1:55421");

function snapshot() {
  const query = `select i.status, i.completed_at is null, i.weighted_score is null,
      (select count(*) from public.inspection_drafts d where d.inspection_id=i.id),
      coalesce((select jsonb_array_length(d.answers) from public.inspection_drafts d where d.inspection_id=i.id),0),
      coalesce((select d.answers @> '[{"question_id":"${questionId}","score":8,"note":"${marker}"}]'::jsonb from public.inspection_drafts d where d.inspection_id=i.id),false),
      f.active, (select count(*) from public.inspection_form_questions q where q.form_id=f.id),
      (select count(*) from public.required_inspections r where r.inspection_id=i.id),
      i.report_snapshot is null,
      (select count(*) from public.regulatory_audit_events a where a.inspection_id=i.id)
    from public.inspections i join public.inspection_forms f on f.id=i.form_id
    where i.id='${inspectionId}' and i.inspector_id='${assigned.id}'`;
  const fields = sql(query).trim().split("|");
  assert.equal(fields.length, 11, "Expected one isolated synthetic inspection");
  const [status, uncompleted, scoreUnset, drafts, answers, markerSaved, activeForm, questions, dueLinks, reportUnset, auditRows] = fields;
  return { status, uncompleted: uncompleted === "t", scoreUnset: scoreUnset === "t", drafts: Number(drafts), answers: Number(answers), markerSaved: markerSaved === "t", activeForm: activeForm === "t", questions: Number(questions), dueLinks: Number(dueLinks), reportUnset: reportUnset === "t", auditRows: Number(auditRows) };
}

async function signedInContext(browser, user) {
  const jar = new Map();
  const auth = createServerClient(keys.url, keys.anon, {
    cookieOptions: { path: "/", sameSite: "lax", secure: false },
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (changes) => changes.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const login = await auth.auth.signInWithPassword({ email: user.email, password: user.password });
  assert.equal(login.error, null, `Synthetic login failed for ${user.email}`);
  auth.auth.stopAutoRefresh();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1024 }, locale: "he-IL" });
  await context.addCookies([...jar].map(([name, value]) => ({ name, value, url: app })));
  return { context, auth };
}

async function jsonRequest(context, method) {
  const path = `${app}/api/inspections/${inspectionId}/draft`;
  const response = method === "GET"
    ? await context.request.get(path, { timeout: 30000 })
    : await context.request.put(path, { data: { answers: [{ question_id: questionId, score: 8, note: marker }] }, timeout: 30000 });
  return { status: response.status(), body: await response.json() };
}

function assertDenial(result, label, gardenId, gardenName) {
  assert.ok([401, 403, 404].includes(result.status), `${label} must be denied`);
  const body = JSON.stringify(result.body);
  for (const secret of [inspectionId, questionId, gardenId, gardenName, marker]) {
    if (secret) assert.equal(body.includes(secret), false, `${label} leaked protected content`);
  }
  assert.equal(result.body?.data, undefined, `${label} returned draft data`);
}

async function boundedClose(action, label) {
  let timer;
  try {
    await Promise.race([
      action(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(Error(`${label} cleanup timeout`)), 10000); }),
    ]);
  } finally { clearTimeout(timer); }
}

let browser;
const sessions = [];
const checks = [];
const pageErrors = [];
const started = Date.now();
const hardStop = setTimeout(() => { console.error("Inspector draft QA hard timeout"); process.exit(124); }, 240000);
let receipt;
try {
  const versionResponse = await fetch(`${app}/api/development/version`, { signal: AbortSignal.timeout(30000), redirect: "error" });
  assert.equal(versionResponse.status, 200);
  const version = await versionResponse.json();
  assert.equal(version.commit, expectedSha);
  assert.equal(version.production, false);
  assert.equal(version.backend, "LOCAL_SUPABASE");
  checks.push("feature identity and isolated backend");

  const before = snapshot();
  assert.ok(["open", "in_progress"].includes(before.status));
  assert.ok(before.uncompleted && before.scoreUnset && before.reportUnset && before.activeForm && before.questions > 0 && before.dueLinks > 0);
  assert.ok(before.drafts === 0 || (before.drafts === 1 && before.markerSaved), "Unexpected pre-existing draft: do not overwrite");
  checks.push("approved open inspection and active form");

  browser = await chromium.launch({ executablePath: chrome, headless: true });
  const assignedSession = await signedInContext(browser, assigned);
  sessions.push(assignedSession);
  const page = await assignedSession.context.newPage();
  page.on("pageerror", (error) => pageErrors.push(error.name));
  page.setDefaultTimeout(20000);
  await page.goto(`${app}/dashboard/inspector/inspections/due`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.locator(`a[href="/dashboard/inspector/inspections/${inspectionId}"]`).first().click();
  await page.waitForURL(`**/dashboard/inspector/inspections/${inspectionId}`, { timeout: 90000 });
  const score = page.locator(".inspection-question-card .inspection-score-input input").first();
  await score.waitFor({ state: "visible", timeout: 90000 });
  await score.fill("8");
  await page.getByPlaceholder("תצפית, הקשר או פעולה מומלצת").first().fill(marker);
  await page.getByRole("button", { name: "שמירת טיוטה" }).click();
  await page.getByText("הטיוטה נשמרה בשרת. אפשר לחזור ולהמשיך מאותו מקום.").waitFor();
  checks.push("UI opened existing due inspection and saved one marked answer");

  const ownerRead = await jsonRequest(assignedSession.context, "GET");
  assert.equal(ownerRead.status, 200);
  assert.ok(ownerRead.body?.data?.answers?.some((answer) => answer.question_id === questionId && answer.score === 8 && answer.note === marker));
  const saved = snapshot();
  assert.equal(saved.drafts, 1);
  assert.equal(saved.answers, 1);
  assert.equal(saved.markerSaved, true);
  assert.equal(saved.status, "in_progress");
  assert.ok(saved.uncompleted && saved.scoreUnset && saved.reportUnset);
  assert.equal(saved.auditRows, before.auditRows);
  checks.push("authorized API and isolated Development DB agree; no completion or score");

  await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
  await page.locator(".inspection-question-card .inspection-score-input input").first().waitFor({ state: "visible", timeout: 90000 });
  await page.getByPlaceholder("תצפית, הקשר או פעולה מומלצת").first().waitFor();
  await page.waitForFunction(() => document.querySelector(".inspection-question-card .inspection-score-input input")?.value === "8", null, { timeout: 20000 });
  assert.equal(await page.locator(".inspection-question-card .inspection-score-input input").first().inputValue(), "8");
  assert.equal(await page.getByPlaceholder("תצפית, הקשר או פעולה מומלצת").first().inputValue(), marker);
  await page.getByRole("button", { name: "שמירת טיוטה" }).click();
  await page.getByText("הטיוטה נשמרה בשרת. אפשר לחזור ולהמשיך מאותו מקום.").waitFor();
  const repeated = snapshot();
  assert.equal(repeated.drafts, 1);
  assert.equal(repeated.answers, 1);
  assert.equal(repeated.markerSaved, true);
  checks.push("reload resumes answer; repeat UI save is idempotent");

  const garden = sql(`select g.id, g.name from public.inspections i join public.gardens g on g.id=i.garden_id where i.id='${inspectionId}'`).trim().split("|");
  assert.equal(garden.length, 2);
  const denials = [];
  for (const [label, user] of [["unassigned inspector", unassigned], ["staff", staff]]) {
    const session = await signedInContext(browser, user);
    sessions.push(session);
    const get = await jsonRequest(session.context, "GET");
    const put = await jsonRequest(session.context, "PUT");
    assertDenial(get, `${label} GET`, garden[0], garden[1]);
    assertDenial(put, `${label} PUT`, garden[0], garden[1]);
    denials.push({ role: label, getStatus: get.status, putStatus: put.status, leakedDraftData: false });
    checks.push(`${label} read/write denied without payload leak`);
  }
  const afterDenied = snapshot();
  assert.equal(afterDenied.drafts, 1);
  assert.equal(afterDenied.answers, 1);
  assert.equal(afterDenied.markerSaved, true);
  assert.ok(afterDenied.uncompleted && afterDenied.scoreUnset && afterDenied.reportUnset);
  assert.equal(afterDenied.auditRows, before.auditRows);
  assert.deepEqual(pageErrors, []);
  checks.push("denials left draft unchanged and browser had no page errors");

  receipt = {
    task: "GB-PRODUCT-INSPECTOR-DRAFT-JOURNEY-20261107",
    observedAt: new Date().toISOString(), environment: config.environment,
    sourceSha: expectedSha, backend: version.backend, status: "PASS",
    checks, before: { draftRows: before.drafts, regulatoryAuditRows: before.auditRows }, after: { draftRows: afterDenied.drafts, answerRows: afterDenied.answers, regulatoryAuditRows: afterDenied.auditRows, inspectionStatus: afterDenied.status, completed: !afterDenied.uncompleted, finalScorePresent: !afterDenied.scoreUnset, reportPublished: !afterDenied.reportUnset },
    denials,
    limitations: ["Synthetic isolated Development only", "No submission, report publication, upload, real provider, camera, AI or Production"],
    elapsedMs: Date.now() - started,
  };
} finally {
  clearTimeout(hardStop);
  for (const session of sessions.reverse()) {
    try { await boundedClose(() => session.context.close(), "context"); }
    finally { session.auth.auth.stopAutoRefresh(); }
  }
  if (browser) {
    try { await boundedClose(() => browser.close(), "browser"); }
    catch (error) { browser.process()?.kill("SIGKILL"); throw error; }
  }
  console.log("Inspector draft QA cleanup complete");
}
assert.ok(receipt, "No completed Inspector draft verification");
receipt.cleanup = "COMPLETE";
const path = resolve(config.runtimeRoot, "inspector-draft-journey-20261107", "evidence", `receipt-${Date.now()}.json`);
const rel = relative(config.runtimeRoot, path);
assert.ok(rel && rel !== ".." && !rel.startsWith(`..${sep}`));
mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
const content = JSON.stringify(receipt, null, 2) + "\n";
writeFileSync(path, content, { mode: 0o600, flag: "wx" });
console.log(JSON.stringify({ status: "PASS", checks: checks.length, receiptPath: path, receiptSha256: createHash("sha256").update(content).digest("hex") }));
