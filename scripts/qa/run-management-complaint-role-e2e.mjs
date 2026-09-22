// Synthetic formal Complaint role journey on the guarded isolated Development stack.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServerClient } from '@supabase/ssr';
import { config } from '../development/local-database.mjs';
import { localCredentials } from '../development/local-client.mjs';

const keys = localCredentials();
assert.equal(config.environment, 'DEVELOPMENT / INTEGRATION');
assert.equal(config.productionAllowed, false);
assert.equal(keys.url, 'http://127.0.0.1:55421');
const base = 'http://127.0.0.1:3000';
const health = await fetch(`${base}/api/health`);
assert.equal(health.status, 200);
const saved = JSON.parse(readFileSync(resolve(config.runtimeRoot, 'qa-identities.private.json'), 'utf8'));
assert.equal(saved.environment, config.environment);
const actors = ['parent-a', 'parent-b', 'manager-a', 'manager-b', 'inspector-a', 'inspector-unassigned', 'inspector-suspended', 'admin'];
const cookies = {};
for (const role of actors) {
  const user = saved.users.find(item => item.email === `${role}@integration.qa.invalid`);
  assert.ok(user?.password, `Missing synthetic identity ${role}`);
  const jar = new Map();
  const client = createServerClient(keys.url, keys.anon, {
    cookieOptions: { path: '/', sameSite: 'lax', secure: false },
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: changes => changes.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const login = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  assert.equal(login.error, null, `${role} login failed`);
  cookies[role] = [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
}
async function api(role, path, { method = 'GET', body, key } = {}) {
  const response = await fetch(`${base}${path}`, {
    method, headers: { Cookie: cookies[role],
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(key ? { 'Idempotency-Key': key } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    redirect: 'manual', signal: AbortSignal.timeout(60_000),
  });
  return { status: response.status, payload: await response.json().catch(() => null) };
}
const gardenA = '00000000-0000-4000-8000-000000000601';
const gardenB = '00000000-0000-4000-8000-000000000602';
const childA = '00000000-0000-4000-8000-000000000901';
const childB = '00000000-0000-4000-8000-000000000902';
const keyA = '00000000-0000-4000-8000-000000035101';
const keyB = '00000000-0000-4000-8000-000000035102';
const results = [];
function check(name, actual, expected) {
  const pass = actual === expected;
  results.push({ name, actual, expected, pass });
  assert.equal(actual, expected, name);
}
const bodyA = { garden_id: gardenA, child_id: childA,
  subject: 'GB-M35 QA synthetic safety complaint',
  description: 'Synthetic QA workflow record only; no actual safety allegation.',
  category: 'safety', severity: 'medium', urgent: false };
const submission = await api('parent-a', '/api/parent/complaints', { method: 'POST', body: bodyA, key: keyA });
check('Parent A submits formal complaint', submission.status, 201);
const complaint = submission.payload?.data;
assert.ok(complaint?.id, 'Complaint ID missing');
const replay = await api('parent-a', '/api/parent/complaints', { method: 'POST', body: bodyA, key: keyA });
check('Complaint replay accepted', replay.status, 201);
check('Complaint replay is idempotent', replay.payload?.data?.id, complaint.id);
check('Wrong Child context denied', (await api('parent-a', '/api/parent/complaints', {
  method: 'POST', body: { ...bodyA, child_id: childB }, key: '00000000-0000-4000-8000-000000035103',
})).status, 403);
check('Wrong Garden context denied', (await api('parent-a', '/api/parent/complaints', {
  method: 'POST', body: { ...bodyA, garden_id: gardenB }, key: '00000000-0000-4000-8000-000000035104',
})).status, 403);
const own = await api('parent-a', '/api/parent/complaints');
check('Reporter sees own complaint', own.status, 200);
assert.ok(own.payload?.data?.some(item => item.id === complaint.id));
assert.ok(!JSON.stringify(own.payload).includes(bodyA.description), 'Reporter list exposed raw description');
const otherParent = await api('parent-b', '/api/parent/complaints');
check('Other Parent list', otherParent.status, 200);
assert.ok(!otherParent.payload?.data?.some(item => item.id === complaint.id), 'Other Parent sees complaint');
for (const [role, visible] of [['inspector-a', true], ['manager-a', false], ['manager-b', false],
  ['inspector-unassigned', false], ['inspector-suspended', false], ['admin', true]]) {
  const list = await api(role, '/api/complaints');
  assert.ok([200, 403].includes(list.status), `${role} complaint list status ${list.status}`);
  const found = list.payload?.data?.some(item => item.id === complaint.id) ?? false;
  check(`${role} restricted complaint visibility`, found, visible);
}
const taskList = await api('inspector-a', `/api/tasks?garden_id=${gardenA}`);
check('Assigned Inspector task list', taskList.status, 200);
const linked = taskList.payload?.data?.filter(item => item.source_entity_type === 'complaint' && item.source_entity_id === complaint.id);
check('One canonical complaint Task', linked?.length, 1);
check('Unassigned Inspector cannot acknowledge', (await api('inspector-unassigned', `/api/complaints/${complaint.id}/actions`, {
  method: 'POST', body: { action: 'acknowledge' },
})).status, 403);
check('Assigned Inspector acknowledges', (await api('inspector-a', `/api/complaints/${complaint.id}/actions`, {
  method: 'POST', body: { action: 'acknowledge' },
})).status, 200);
check('Inspector starts review', (await api('inspector-a', `/api/complaints/${complaint.id}/actions`, {
  method: 'POST', body: { action: 'review' },
})).status, 200);
check('Inspector requests reporter information', (await api('inspector-a', `/api/complaints/${complaint.id}/actions`, {
  method: 'POST', body: { action: 'request_reporter', publicNote: 'GB-M35 QA: please add context' },
})).status, 200);
check('Parent responds to request', (await api('parent-a', `/api/complaints/${complaint.id}/actions`, {
  method: 'POST', body: { action: 'reporter_reply', publicNote: 'GB-M35 QA synthetic reply' },
})).status, 200);
check('Inspector resolves complaint', (await api('inspector-a', `/api/complaints/${complaint.id}/actions`, {
  method: 'POST', body: { action: 'resolve', publicNote: 'GB-M35 QA synthetic resolution', internalNote: 'Synthetic internal only' },
})).status, 200);
const resolved = await api('parent-a', '/api/parent/complaints');
const projected = resolved.payload?.data?.find(item => item.id === complaint.id);
check('Reporter sees resolved state', projected?.status, 'resolved');
check('Reporter sees public resolution', projected?.resolution_public, 'GB-M35 QA synthetic resolution');
assert.ok(!JSON.stringify(projected).includes('Synthetic internal only'), 'Internal note leaked to Parent');
const completedTask = await api('inspector-a', `/api/tasks?garden_id=${gardenA}`);
check('Complaint Task completes only after domain resolution', completedTask.payload?.data?.find(item => item.id === linked[0].id)?.status, 'done');

// Garden B has no assigned Inspector; this synthetic case must route to Admin.
const bodyB = { ...bodyA, garden_id: gardenB, child_id: childB,
  subject: 'GB-M35 QA no-Inspector case' };
const noInspector = await api('parent-b', '/api/parent/complaints', { method: 'POST', body: bodyB, key: keyB });
check('No-Inspector complaint preserved', noInspector.status, 201);
const adminCases = await api('admin', '/api/complaints');
const adminCase = adminCases.payload?.data?.find(item => item.id === noInspector.payload?.data?.id);
check('No-Inspector case reaches Admin queue', adminCase?.routing_state, 'admin_queue');

const receipt = { observedAt: new Date().toISOString(), environment: config.environment,
  productionAccess: false, syntheticOnly: true, complaintId: complaint.id,
  noInspectorComplaintId: noInspector.payload?.data?.id, results };
writeFileSync(process.env.GB_M35_QA_RECEIPT ?? '/private/tmp/gb-m35-complaint-e2e.json',
  JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
console.log(`GB-M35 synthetic Complaint role E2E PASS: ${results.length} checks`);
