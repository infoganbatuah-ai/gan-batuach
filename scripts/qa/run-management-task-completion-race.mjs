// Synthetic two-session Task completion replay. It never touches customer Tasks.
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createServerClient} from '@supabase/ssr';
import {config, sql} from '../development/local-database.mjs';
import {localCredentials} from '../development/local-client.mjs';

const base = 'http://127.0.0.1:3000';
const keys = localCredentials();
assert.equal(config.environment, 'DEVELOPMENT / INTEGRATION');
assert.equal(config.productionAllowed, false);
assert.equal(keys.url, 'http://127.0.0.1:55421');
assert.equal((await fetch(`${base}/api/health`)).status, 200);
const users = JSON.parse(readFileSync(resolve(config.runtimeRoot, 'qa-identities.private.json'), 'utf8'));
assert.equal(users.environment, config.environment);
const garden = '00000000-0000-4000-8000-000000000601';
const staff = '00000000-0000-4000-8000-000000000301';
const title = 'GB-M35 QA concurrent Task completion';
async function cookie(role) {
  const user = users.users.find(item => item.email === `${role}@integration.qa.invalid`);
  assert.ok(user?.password);
  const jar = new Map();
  const client = createServerClient(keys.url, keys.anon, {
    cookieOptions: {path: '/', sameSite: 'lax', secure: false},
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({name, value})),
      setAll: changes => changes.forEach(({name, value}) => jar.set(name, value)),
    },
  });
  assert.equal((await client.auth.signInWithPassword({email: user.email, password: user.password})).error, null);
  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
}
const [managerOne, managerTwo, staffCookie] = await Promise.all([cookie('manager-a'), cookie('manager-a'), cookie('staff-a')]);
async function api(auth, path, body) {
  const response = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: {Cookie: auth, ...(body ? {'Content-Type': 'application/json'} : {})},
    ...(body ? {body: JSON.stringify(body)} : {}), signal: AbortSignal.timeout(60_000),
  });
  return {status: response.status, payload: await response.json().catch(() => null)};
}
const results = [];
function check(name, actual, expected) {
  assert.equal(actual, expected, name);
  results.push({name, actual, pass: true});
}
const list = await api(managerOne, `/api/tasks?garden_id=${garden}`);
check('Manager lists Garden A Tasks', list.status, 200);
let task = list.payload?.data?.find(row => row.title === title);
if (!task) {
  const created = await api(managerOne, '/api/tasks', {garden_id: garden, title, description: 'Synthetic concurrent transition fixture', assigned_to: staff, priority: 'medium'});
  check('Manager creates Task', created.status, 201);
  task = created.payload?.data;
}
assert.ok(task?.id);
if (task.status === 'open') {
  check('Staff starts Task', (await api(staffCookie, `/api/tasks/${task.id}/status`, {action: 'start'})).status, 200);
  task.status = 'in_progress';
}
if (task.status === 'in_progress') {
  check('Staff submits Task', (await api(staffCookie, `/api/tasks/${task.id}/status`, {action: 'submit'})).status, 200);
  task.status = 'waiting_approval';
}
const raced = task.status === 'waiting_approval';
if (raced) {
  const [a, b] = await Promise.all([
    api(managerOne, `/api/tasks/${task.id}/status`, {action: 'complete'}),
    api(managerTwo, `/api/tasks/${task.id}/status`, {action: 'complete'}),
  ]);
  check('First completion accepted', a.status, 200);
  check('Second completion is idempotent', b.status, 200);
}
const final = await api(managerOne, `/api/tasks?garden_id=${garden}`);
check('Final Task list loads', final.status, 200);
check('One canonical completed Task', final.payload?.data?.filter(row => row.id === task.id && row.status === 'done').length, 1);
const auditCount = Number(sql(`select count(*) from public.audit_logs where entity_type='tasks' and entity_id='${task.id}' and action='task_complete';`).trim());
check('Exactly one terminal completion audit', auditCount, 1);
writeFileSync('/private/tmp/gb-m35-task-completion-race.json', JSON.stringify({observedAt: new Date().toISOString(), environment: config.environment, syntheticOnly: true, productionAccess: false, independentAuthSessions: true, independentDatabaseConnectionsVerified: false, raced, taskId: task.id, results}, null, 2) + '\n', {mode: 0o600});
console.log(`GB-M35 synthetic two-session Task completion PASS: ${results.length} checks`);
