// Authenticated negative/positive API matrix on synthetic local Development only.
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
const saved = JSON.parse(readFileSync(resolve(config.runtimeRoot, 'qa-identities.private.json'), 'utf8'));
assert.equal(saved.environment, config.environment);
const gardenA = '00000000-0000-4000-8000-000000000601';
const gardenB = '00000000-0000-4000-8000-000000000602';
const gardenC = '00000000-0000-4000-8000-000000000603';
const childA = '00000000-0000-4000-8000-000000000801';
const childB = '00000000-0000-4000-8000-000000000802';
const childC = '00000000-0000-4000-8000-000000000803';
const matrix = [
  ['parent-a', 'own tuition', 'GET', `/api/parent/tuition-ledger?child_id=${childA}`, 200],
  ['parent-a', 'other Child tuition IDOR', 'GET', `/api/parent/tuition-ledger?child_id=${childB}`, 403],
  ['parent-b', 'other Child tuition IDOR', 'GET', `/api/parent/tuition-ledger?child_id=${childA}`, 403],
  ['parent-multi', 'Garden A Child', 'GET', `/api/parent/tuition-ledger?child_id=${childC}`, 200],
  ['parent-multi', 'Garden B Child', 'GET', `/api/parent/tuition-ledger?child_id=${childB}`, 200],
  ['manager-a', 'own Garden list', 'GET', '/api/management/gardens', 200],
  ['manager-a', 'other Garden selection', 'POST', '/api/management/gardens', 403, { garden_id: gardenB }],
  ['manager-a', 'other Garden documents', 'GET', `/api/documents?garden_id=${gardenB}`, 200, undefined, 'empty'],
  ['manager-b', 'other Garden selection', 'POST', '/api/management/gardens', 403, { garden_id: gardenA }],
  ['owner-ab', 'select Garden A', 'POST', '/api/management/gardens', 200, { garden_id: gardenA }],
  ['owner-ab', 'select Garden B', 'POST', '/api/management/gardens', 200, { garden_id: gardenB }],
  ['owner-ab', 'preliminary Garden C denied', 'POST', '/api/management/gardens', 403, { garden_id: gardenC }],
  ['staff-candidate', 'candidate Garden authority denied', 'GET', '/api/management/gardens', 403],
  ['delegated-teacher', 'payroll export denied', 'GET', '/api/garden/staff-time?period=2026-09-01', 403],
  ['inspector-a', 'payroll export denied', 'GET', '/api/garden/staff-time?period=2026-09-01', 403],
  ['inspector-suspended', 'payroll export denied', 'GET', '/api/garden/staff-time?period=2026-09-01', [401, 403]],
  ['parent-a', 'own notifications', 'GET', '/api/notifications', 200],
  ['staff-a', 'own notifications', 'GET', '/api/notifications', 200],
];
const cookieByActor = new Map();
for (const [actor] of matrix) {
  if (cookieByActor.has(actor)) continue;
  const identity = saved.users.find(user => user.email === `${actor}@integration.qa.invalid`);
  assert.ok(identity, `Synthetic identity missing: ${actor}`);
  const jar = new Map();
  const auth = createServerClient(keys.url, keys.anon, {
    cookieOptions: { path: '/', sameSite: 'lax', secure: false },
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: changes => changes.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const login = await auth.auth.signInWithPassword({ email: identity.email, password: identity.password });
  assert.equal(login.error, null, `Local synthetic login failed: ${actor}`);
  cookieByActor.set(actor, [...jar].map(([name, value]) => `${name}=${value}`).join('; '));
}
const results = [];
for (const [actor, scenario, method, path, expected, body, projection] of matrix) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { Cookie: cookieByActor.get(actor), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    redirect: 'manual',
    signal: AbortSignal.timeout(60_000),
  });
  let projected = true;
  if (projection === 'empty' && response.ok) {
    const payload = await response.json();
    const rows = Array.isArray(payload) ? payload : payload.data ?? payload.rows ?? [];
    projected = Array.isArray(rows) && rows.length === 0;
  }
  const result = { actor, scenario, status: response.status, expected, projected,
    pass: (Array.isArray(expected) ? expected.includes(response.status) : response.status === expected) && projected };
  results.push(result);
  console.log(JSON.stringify(result));
}
const out = process.env.GB_M35_QA_RECEIPT ?? '/private/tmp/gb-m35-api-matrix.json';
writeFileSync(out, JSON.stringify({ observedAt: new Date().toISOString(), environment: config.environment,
  productionAccess: false, syntheticOnly: true, results }, null, 2) + '\n', { mode: 0o600 });
if (results.some(result => !result.pass)) process.exitCode = 1;
