import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTs } from "./digital-guard-test-loader.mjs";

const fixture = loadTs("lib/domain/digital-observer/qa-learning-fixture.ts", { "@/lib/domain/video-gateway-client": {} });
const commit = "a".repeat(40);
const env = { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: fixture.GUARD_QA_BRANCH,
  VERCEL_GIT_COMMIT_SHA: commit, NEXT_PUBLIC_SUPABASE_URL: fixture.GUARD_QA_PROJECT_URL };
const session = { user: { id: "qa-user", email: fixture.GUARD_QA_EMAIL, email_confirmed_at: "now" }, profile: { id: "qa-user", garden_id: null } };

function page(overrides = {}, account = session) {
  const calls = [];
  const component = loadTs("app/digital-observer/qa/learning/page.tsx", {
    process: { env: { ...env, ...overrides } },
    "next/navigation": { notFound() { throw Error("404"); }, redirect(path) { throw Error(`redirect:${path}`); } },
    "@/lib/domain/digital-observer/access": { async getDigitalObserverApiUser() { calls.push("auth"); return account; } },
    "@/lib/domain/digital-observer/qa-learning-fixture": fixture,
    "@/components/digital-observer/guard-learning-qa-panel": { GuardLearningQaPanel(props) { calls.push(["panel", props.commit]); return null; } }
  }).default;
  return { calls, component };
}

test("QA page rejects production, foreign branch/project and missing environment before session access", async () => {
  for (const override of [{ VERCEL_ENV: "production" }, { VERCEL_ENV: undefined },
    { VERCEL_GIT_COMMIT_REF: "main" }, { NEXT_PUBLIC_SUPABASE_URL: "https://other.invalid" }]) {
    const p = page(override);
    await assert.rejects(p.component(), /^Error: 404$/);
    assert.deepEqual(p.calls, []);
  }
});

test("QA page redirects missing session through normal application login", async () => {
  const p = page({}, null);
  await assert.rejects(p.component(), /^Error: redirect:\/digital-observer\/login\?next=\/digital-observer\/qa\/learning$/);
  assert.deepEqual(p.calls, ["auth"]);
});

test("QA page rejects ordinary, unverified, mismatched and kindergarten accounts", async () => {
  for (const account of [
    { ...session, user: { ...session.user, email: "other@example.invalid" } },
    { ...session, user: { ...session.user, email_confirmed_at: undefined } },
    { ...session, profile: { id: "other", garden_id: null } },
    { ...session, profile: { id: "qa-user", garden_id: "garden" } }
  ]) await assert.rejects(page({}, account).component(), /^Error: 404$/);
});

test("QA page requires deployment SHA and sends only SHA to its client panel", async () => {
  for (const invalid of [undefined, "", "a".repeat(7)])
    await assert.rejects(page({ VERCEL_GIT_COMMIT_SHA: invalid }).component(), /^Error: 404$/);
  const p = page();
  const html = renderToStaticMarkup(await p.component());
  assert.match(html, /dir="rtl"/);
  assert.match(html, /בדיקת למידה מבודדת/);
  assert.deepEqual(p.calls, ["auth", ["panel", commit]]);
});

function panel({ confirmed = true, account = { access_token: "synthetic-test-token" }, response, error } = {}) {
  const states = [confirmed, false, "", null], refs = [], calls = [];
  let stateIndex = 0, refIndex = 0;
  const component = loadTs("components/digital-observer/guard-learning-qa-panel.tsx", {
    react: {
      useState(initial) { const i = stateIndex++; if (states[i] === undefined) states[i] = initial; return [states[i], (value) => { states[i] = value; }]; },
      useRef(initial) { const i = refIndex++; refs[i] ??= { current: initial }; return refs[i]; }
    },
    "@/lib/supabase/browser": { createClient() { return { auth: { async getSession() { calls.push("auth"); return { data: { session: account }, error: null }; } } }; } },
    async fetch(url, options) { calls.push({ url, options }); if (error) throw error; return response; }
  }).GuardLearningQaPanel;
  const render = () => { stateIndex = 0; refIndex = 0; return component({ commit }); };
  const button = render().props.children.find((child) => child?.type === "button");
  return { states, calls, button, render };
}
const validReport = { passed: true, cleanup: "complete", checks: ["verified"], failed_step: null,
  fixture_site_id: "11111111-1111-4111-a111-111111111111", commit, branch: fixture.GUARD_QA_BRANCH, synthetic_metrics_only: true, hardware_actions: 0 };
const response = (data = validReport, status = 200) => ({ ok: status === 200, status, async json() { return { data }; } });

test("QA panel never authenticates or writes without explicit confirmation", async () => {
  const p = panel({ confirmed: false });
  assert.equal(p.button.props.disabled, true);
  await p.button.props.onClick();
  assert.deepEqual(p.calls, []);
});

test("QA panel uses ordinary session for a same-origin, SHA-bound, non-retried request", async () => {
  const p = panel({ response: response() });
  await Promise.all([p.button.props.onClick(), p.button.props.onClick()]);
  assert.equal(p.calls.length, 2); // one auth, one request despite double-click
  const { url, options } = p.calls[1];
  assert.equal(url, "/api/digital-observer/qa/learning-fixture");
  assert.equal(options.credentials, "same-origin");
  assert.equal(options.redirect, "error");
  assert.equal(options.headers.authorization, "Bearer synthetic-test-token");
  assert.deepEqual(JSON.parse(options.body), { run_isolated_fixture: true, expected_commit: commit });
  assert.match(p.states[2], /הבדיקה עברה והניקוי אומת/);
  assert.equal(p.states[0], false);
  assert.equal(p.states[1], false);
});

test("QA panel requires renewed login when ordinary session has expired", async () => {
  const p = panel({ account: null });
  await p.button.props.onClick();
  assert.deepEqual(p.calls, ["auth"]);
  assert.match(p.states[2], /התחברות מחדש/);
});

test("QA panel never reports success for bad SHA, missing report, failed cleanup or rejected status", async () => {
  for (const res of [response({ ...validReport, commit: "b".repeat(40) }), response(null, 401),
    response({ ...validReport, cleanup: "failed" }), response(validReport, 500)]) {
    const p = panel({ response: res });
    await p.button.props.onClick();
    assert.doesNotMatch(p.states[2], /הבדיקה עברה והניקוי אומת/);
  }
});

test("QA panel reports unknown result on lost response and never exposes private error text or retries", async () => {
  const p = panel({ error: Error("provider-private-value") });
  await p.button.props.onClick();
  assert.equal(p.calls.length, 2);
  assert.match(p.states[2], /תוצאת הבדיקה אינה ידועה/);
  assert.doesNotMatch(p.states[2], /provider-private-value/);
  assert.equal(p.states[3], null);
});
