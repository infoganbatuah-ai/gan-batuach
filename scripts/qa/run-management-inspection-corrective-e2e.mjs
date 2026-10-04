// Synthetic Inspector -> Garden corrective-action API journey in isolated Development only.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { config, sql } from '../development/local-database.mjs';
import { localCredentials } from '../development/local-client.mjs';

const base = 'http://127.0.0.1:3000';
const keys = localCredentials();
assert.equal(config.environment, 'DEVELOPMENT / INTEGRATION');
assert.equal(config.productionAllowed, false);
assert.equal(keys.url, 'http://127.0.0.1:55421');
const healthResponse = await fetch(base + '/api/health');
assert.equal(healthResponse.status, 200);
const health = await healthResponse.json();
assert.equal(health.supabase, 'ok');
const saved = JSON.parse(readFileSync(resolve(config.runtimeRoot, 'qa-identities.private.json'), 'utf8'));
assert.equal(saved.environment, config.environment);
const garden = '00000000-0000-4000-8000-000000000601';
const form = '00000000-0000-4000-8000-000000003501';
const goodQuestion = '00000000-0000-4000-8000-000000003502';
const failedQuestion = '00000000-0000-4000-8000-000000003503';
const fixture = sql("select count(*),min(name) from public.inspection_forms where id='" + form + "';");
assert.ok(fixture.trim() === '0|' || fixture.trim() === '1|GB-M35 isolated QA form', 'Unexpected inspection form collision');
sql("insert into public.inspection_forms(id,name,description,active,frequency_months) values('" + form + "','GB-M35 isolated QA form','Synthetic product verification; no regulatory claim',true,1) on conflict(id) do nothing;\n" +
  "insert into public.inspection_form_questions(id,form_id,category,question_text,required,critical,weight,sort_order,violation_threshold) values" +
  "('" + goodQuestion + "','" + form + "','QA operations','GB-M35 synthetic passing check',true,false,1,1,4)," +
  "('" + failedQuestion + "','" + form + "','QA maintenance','GB-M35 synthetic corrective check',true,false,1,2,4) on conflict(id) do nothing;");
const questionCount = Number(sql("select count(*) from public.inspection_form_questions where form_id='" + form + "';").trim());
assert.equal(questionCount, 2);
const service = createClient(keys.url, keys.service, { auth: { persistSession: false, autoRefreshToken: false } });
const scheduled = await service.rpc('schedule_management_monthly_inspections', { p_month: '2026-09-01' });
assert.equal(scheduled.error, null, 'Canonical scheduler failed: ' + scheduled.error?.message);
const inspection = sql("select id from public.inspections where garden_id='" + garden + "' and period_month='2026-09-01';").trim();
assert.match(inspection, /^[0-9a-f-]{36}$/);

async function cookieFor(role) {
  const user = saved.users.find(item => item.email === role + '@integration.qa.invalid');
  assert.ok(user?.password, 'Missing synthetic identity ' + role);
  const jar = new Map();
  const client = createServerClient(keys.url, keys.anon, {
    cookieOptions: { path: '/', sameSite: 'lax', secure: false },
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: changes => changes.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const login = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  assert.equal(login.error, null, role + ' login failed');
  return [...jar].map(([name, value]) => name + '=' + value).join('; ');
}
const cookies = {};
for (const role of ['inspector-a', 'inspector-a-second', 'inspector-unassigned', 'parent-a', 'parent-b', 'manager-a', 'manager-b']) {
  cookies[role] = await cookieFor(role === 'inspector-a-second' ? 'inspector-a' : role);
}
async function request(role, path, { method = 'GET', body, formData, redirect = 'manual' } = {}) {
  const response = await fetch(base + path, {
    method, headers: { Cookie: cookies[role], ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    ...(formData ? { body: formData } : {}),
    redirect, signal: AbortSignal.timeout(60_000),
  });
  const contentType = response.headers.get('content-type') ?? '';
  return { status: response.status, location: response.headers.get('location'),
    payload: contentType.includes('application/json') ? await response.json() : await response.text() };
}
const results = [];
function check(name, actual, expected) {
  results.push({ name, actual, expected, pass: actual === expected });
  assert.equal(actual, expected, name);
}
const draftAnswers = [{ question_id: goodQuestion, score: 9 }, { question_id: failedQuestion, score: 2, note: 'Synthetic repair needed' }];
check('Assigned Inspector reads draft', (await request('inspector-a', '/api/inspections/' + inspection + '/draft')).status, 200);
check('Unassigned Inspector denied draft', (await request('inspector-unassigned', '/api/inspections/' + inspection + '/draft')).status, 403);
check('Inspector saves draft', (await request('inspector-a', '/api/inspections/' + inspection + '/draft', {
  method: 'PUT', body: { answers: draftAnswers },
})).status, 200);
const resumed = await request('inspector-a-second', '/api/inspections/' + inspection + '/draft');
check('Independent Inspector session resumes draft', resumed.status, 200);
check('Draft retains two answers', resumed.payload?.data?.answers?.length, 2);

const evidenceForm = new FormData();
evidenceForm.set('file', new File([new TextEncoder().encode('%PDF-1.4\nGB-M35 synthetic inspection evidence\n%%EOF\n')],
  'gb-m35-inspection.pdf', { type: 'application/pdf' }));
const uploaded = await request('inspector-a', '/api/inspections/' + inspection + '/evidence', { method: 'POST', formData: evidenceForm });
check('Inspector uploads private evidence', uploaded.status, 200);
const evidencePath = uploaded.payload?.data?.path;
assert.ok(evidencePath?.startsWith('inspection-reports/inspections/' + inspection + '/'));
const answers = [{ ...draftAnswers[0] }, { ...draftAnswers[1], document_url: evidencePath }];
const signature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l5kAAAAASUVORK5CYII=';
const submitBody = { answers, gps_lat: 0, gps_lng: 0, gps_radius_meters: 120, signature_image: signature };
const [submitA, submitB] = await Promise.all([
  request('inspector-a', '/api/inspections/' + inspection + '/submit', { method: 'POST', body: submitBody }),
  request('inspector-a-second', '/api/inspections/' + inspection + '/submit', { method: 'POST', body: submitBody }),
]);
check('Concurrent Inspector submit A', submitA.status, 200);
check('Concurrent Inspector submit B', submitB.status, 200);
const reportCount = Number(sql("select count(*) from public.inspections where id='" + inspection + "' and status='done' and report_snapshot is not null;").trim());
check('One canonical immutable inspection', reportCount, 1);
const findingCount = Number(sql("select count(*) from public.inspection_answers where inspection_id='" + inspection + "';").trim());
check('One answer per question', findingCount, 2);
const scoreBefore = Number(sql("select weighted_score from public.inspections where id='" + inspection + "';").trim());
check('Server score 5.5', scoreBefore, 5.5);
const violations = await request('manager-a', '/api/violations?garden_id=' + garden);
check('Garden reads corrective actions', violations.status, 200);
const action = violations.payload?.data?.find(item => item.inspection_id === inspection);
assert.ok(action?.id, 'Actionable finding did not create corrective action');
check('Exactly one corrective action', violations.payload?.data?.filter(item => item.inspection_id === inspection).length, 1);
check('Wrong Garden denied corrective action', (await request('manager-b', '/api/violations/' + action.id + '/status', {
  method: 'POST', body: { action: 'acknowledge' },
})).status, 403);
check('Garden acknowledges action', (await request('manager-a', '/api/violations/' + action.id + '/status', {
  method: 'POST', body: { action: 'acknowledge' },
})).status, 200);
const remediationForm = new FormData();
remediationForm.set('file', new File([new TextEncoder().encode('%PDF-1.4\nGB-M35 synthetic remediation\n%%EOF\n')],
  'gb-m35-remediation.pdf', { type: 'application/pdf' }));
const remediation = await request('manager-a', '/api/violations/' + action.id + '/evidence', { method: 'POST', formData: remediationForm });
check('Garden uploads private remediation', remediation.status, 200);
const remediationPath = remediation.payload?.data?.path;
assert.ok(remediationPath?.startsWith('inspection-reports/corrective-actions/' + action.id + '/'));
check('Garden submits remediation', (await request('manager-a', '/api/violations/' + action.id + '/status', {
  method: 'POST', body: { action: 'submit', note: 'GB-M35 synthetic remediation complete', evidencePaths: [remediationPath] },
})).status, 200);
check('Unassigned Inspector denied review', (await request('inspector-unassigned', '/api/violations/' + action.id + '/status', {
  method: 'POST', body: { action: 'accept' },
})).status, 403);
check('Assigned Inspector accepts remediation', (await request('inspector-a', '/api/violations/' + action.id + '/status', {
  method: 'POST', body: { action: 'accept' },
})).status, 200);
const scoreAfter = Number(sql("select weighted_score from public.inspections where id='" + inspection + "';").trim());
check('Historical inspection score immutable', scoreAfter, scoreBefore);
const parentSafe = await request('parent-a', '/dashboard/parent/inspections/' + inspection + '/report');
check('Parent sees safe report page', parentSafe.status, 200);
assert.ok(!parentSafe.payload.includes(evidencePath), 'Parent report leaked private evidence path');
assert.ok(!parentSafe.payload.includes('GPS:'), 'Parent report leaked GPS');
results.push({ name: 'Parent report excludes private evidence and GPS', pass: true });
check('Parent denied raw inspection evidence route', (await request('parent-a', '/api/inspections/' + inspection + '/evidence?path=' + encodeURIComponent(evidencePath))).status, 403);
check('Other Parent denied safe report content', (await request('parent-b', '/dashboard/parent/inspections/' + inspection + '/report')).payload.includes('QA Garden A'), false);
const safeAction = await request('parent-a', '/api/parent/gardens/' + garden + '/corrective-actions');
check('Parent sees safe corrective summary', safeAction.status, 200);
assert.ok(!JSON.stringify(safeAction.payload).includes(remediationPath));

const receipt = { observedAt: new Date().toISOString(), environment: config.environment, syntheticOnly: true,
  productionAccess: false, inspectionId: inspection, correctiveActionId: action.id,
  separateInspectorSessions: true, results };
writeFileSync('/private/tmp/gb-m35-inspection-corrective-e2e.json', JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
console.log('GB-M35 synthetic inspection/corrective E2E PASS: ' + results.length + ' checks');
