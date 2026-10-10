// Repeatable synthetic Task and Message role journeys on isolated Development only.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServerClient } from '@supabase/ssr';
import { config } from '../development/local-database.mjs';
import { localCredentials } from '../development/local-client.mjs';

const base = 'http://127.0.0.1:3000';
const keys = localCredentials();
assert.equal(config.environment, 'DEVELOPMENT / INTEGRATION');
assert.equal(config.productionAllowed, false);
assert.equal(keys.url, 'http://127.0.0.1:55421');
const versionResponse = await fetch(`${base}/api/development/version`);
assert.equal(versionResponse.status, 200);
const version = await versionResponse.json();
assert.equal(version.production, false);
assert.equal(version.backend, 'LOCAL_SUPABASE');
const saved = JSON.parse(readFileSync(resolve(config.runtimeRoot, 'qa-identities.private.json'), 'utf8'));
assert.equal(saved.environment, config.environment);

const ids = {
  gardenA: '00000000-0000-4000-8000-000000000601',
  childA: '00000000-0000-4000-8000-000000000901',
  managerA: '00000000-0000-4000-8000-000000000201',
  staffA: '00000000-0000-4000-8000-000000000301',
};
const threadKey = '00000000-0000-4000-8000-000000035001';
const taskTitle = 'GB-M35 QA Garden A operational task';
const messageBody = 'GB-M35 synthetic Parent A message; no customer information.';

async function cookieFor(role) {
  const user = saved.users.find(item => item.email === `${role}@integration.qa.invalid`);
  assert.ok(user?.password, `Missing synthetic role ${role}`);
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
  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
}

const cookies = Object.fromEntries(await Promise.all(
  ['manager-a', 'manager-b', 'parent-a', 'parent-b', 'staff-a', 'staff-b', 'inspector-a', 'admin']
    .map(async role => [role, await cookieFor(role)]),
));
async function api(role, path, { method = 'GET', body, key } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      Cookie: cookies[role],
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    redirect: 'manual',
    signal: AbortSignal.timeout(60_000),
  });
  const payload = await response.json().catch(() => null);
  return { status: response.status, payload };
}
function rows(result) {
  return result.payload?.data ?? [];
}
const results = [];
function check(name, actual, expected) {
  const pass = actual === expected;
  results.push({ name, actual, expected, pass });
  assert.equal(actual, expected, name);
}

const initial = await api('manager-a', `/api/tasks?garden_id=${ids.gardenA}`);
check('Manager A Task list', initial.status, 200);
let task = rows(initial).find(item => item.title === taskTitle);
if (!task) {
  const created = await api('manager-a', '/api/tasks', { method: 'POST', body: {
    garden_id: ids.gardenA, title: taskTitle, description: 'Synthetic QA execution record',
    assigned_to: ids.staffA, priority: 'medium',
  } });
  check('Manager creates assigned Task', created.status, 201);
  task = rows(created);
}
assert.ok(task?.id, 'Task ID missing');
const staffTasks = await api('staff-a', `/api/tasks?garden_id=${ids.gardenA}`);
check('Staff A Task list', staffTasks.status, 200);
assert.ok(rows(staffTasks).some(item => item.id === task.id), 'Staff A cannot see assigned Task');
const otherStaffTasks = await api('staff-b', `/api/tasks?garden_id=${ids.gardenA}`);
check('Staff B Task list', otherStaffTasks.status, 200);
assert.ok(!rows(otherStaffTasks).some(item => item.id === task.id), 'Staff B sees Garden A Task');
if (task.status === 'open') {
  check('Staff starts Task', (await api('staff-a', `/api/tasks/${task.id}/status`, {
    method: 'POST', body: { action: 'start' },
  })).status, 200);
  task.status = 'in_progress';
}
if (task.status === 'in_progress') {
  check('Unrelated Staff cannot submit Task', (await api('staff-b', `/api/tasks/${task.id}/status`, {
    method: 'POST', body: { action: 'submit' },
  })).status, 403);
  check('Staff submits Task for approval', (await api('staff-a', `/api/tasks/${task.id}/status`, {
    method: 'POST', body: { action: 'submit' },
  })).status, 200);
  task.status = 'waiting_approval';
}
if (task.status === 'waiting_approval') {
  check('Manager completes Task', (await api('manager-a', `/api/tasks/${task.id}/status`, {
    method: 'POST', body: { action: 'complete' },
  })).status, 200);
}
const finalTasks = await api('manager-a', `/api/tasks?garden_id=${ids.gardenA}`);
check('Task remains completed on replay', rows(finalTasks).find(item => item.id === task.id)?.status, 'done');

const createBody = {
  garden_id: ids.gardenA, child_id: ids.childA, recipient_id: ids.managerA,
  subject: 'GB-M35 QA Parent message', body: messageBody,
};
const createdThread = await api('parent-a', '/api/communication/threads', {
  method: 'POST', body: createBody, key: threadKey,
});
check('Parent A creates thread', createdThread.status, 201);
const replayThread = await api('parent-a', '/api/communication/threads', {
  method: 'POST', body: createBody, key: threadKey,
});
check('Thread creation replay accepted', replayThread.status, 201);
assert.equal(rows(createdThread).thread_id, rows(replayThread).thread_id,
  'Idempotent thread creation returned a different thread');
assert.equal(rows(createdThread).message_id, rows(replayThread).message_id,
  'Idempotent thread creation returned a different message');
assert.equal(rows(replayThread).idempotent, true, 'Replay was not recognized as idempotent');
const ownThreads = await api('parent-a', '/api/communication/threads');
check('Parent A thread list', ownThreads.status, 200);
const thread = rows(ownThreads).find(item => item.subject === createBody.subject && item.garden_id === ids.gardenA);
assert.ok(thread?.id, 'Created thread missing from Parent A list');
check('Parent A reads thread', (await api('parent-a', `/api/communication/threads/${thread.id}`)).status, 200);
check('Manager A reads thread', (await api('manager-a', `/api/communication/threads/${thread.id}`)).status, 200);
for (const role of ['parent-b', 'manager-b', 'staff-b', 'inspector-a', 'admin']) {
  const denied = await api(role, `/api/communication/threads/${thread.id}`);
  assert.ok([403, 404].includes(denied.status), `${role} read ordinary private thread (${denied.status})`);
  results.push({ name: `${role} ordinary thread denied`, actual: denied.status, expected: '403/404', pass: true });
}
const notifications = await api('manager-a', '/api/notifications');
check('Manager A notifications', notifications.status, 200);
assert.ok(!JSON.stringify(rows(notifications)).includes(messageBody), 'Notification leaked private message body');
results.push({ name: 'notification excludes full private message body', actual: true, expected: true, pass: true });

const receipt = {
  observedAt: new Date().toISOString(), environment: config.environment,
  applicationCommit: version.commit, syntheticOnly: true, productionAccess: false,
  taskId: task.id, threadId: thread.id, results,
};
const out = process.env.GB_M35_QA_RECEIPT ?? '/private/tmp/gb-m35-role-domain-smoke.json';
writeFileSync(out, JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
console.log(`GB-M35 synthetic Task/Message role smoke PASS: ${results.length} checks`);
