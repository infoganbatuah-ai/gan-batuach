// One-time synthetic operational-day QA. Run only against guarded local Development.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createServerClient } from '@supabase/ssr';
import { config } from '../development/local-database.mjs';
import { localCredentials } from '../development/local-client.mjs';

const keys = localCredentials();
assert.equal(config.environment, 'DEVELOPMENT / INTEGRATION');
assert.equal(config.productionAllowed, false);
assert.equal(keys.url, 'http://127.0.0.1:55421');
const base = 'http://127.0.0.1:3000';
const versionResponse = await fetch(`${base}/api/development/version`);
if (versionResponse.status === 200) {
  const version = await versionResponse.json();
  assert.equal(version.production, false);
  assert.equal(version.backend, 'LOCAL_SUPABASE');
} else {
  // The locally built production-mode server intentionally hides the development endpoint.
  assert.equal(versionResponse.status, 404);
  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);
}
const applicationCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const saved = JSON.parse(readFileSync(resolve(config.runtimeRoot, 'qa-identities.private.json'), 'utf8'));
assert.equal(saved.environment, config.environment);
const childA = '00000000-0000-4000-8000-000000000901';
const childB = '00000000-0000-4000-8000-000000000902';
const roles = ['parent-a', 'parent-b', 'staff-a', 'staff-b', 'inspector-a'];
const cookies = {};
for (const role of roles) {
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
async function api(role, path, method = 'GET', body) {
  const response = await fetch(`${base}${path}`, {
    method, headers: { Cookie: cookies[role], ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    redirect: 'manual', signal: AbortSignal.timeout(60_000),
  });
  return { status: response.status, payload: await response.json().catch(() => null) };
}
const results = [];
function check(name, actual, expected) {
  const pass = actual === expected;
  results.push({ name, actual, expected, pass });
  assert.equal(actual, expected, name);
}
const contacts = await api('parent-a', '/api/parent/pickup-contacts');
check('Parent A contact list', contacts.status, 200);
const current = contacts.payload?.data?.contacts ?? [];
async function contact(name) {
  const existing = current.find(item => item.child_id === childA && item.full_name === name);
  if (existing) return existing;
  const created = await api('parent-a', '/api/parent/pickup-contacts', 'POST', {
    child_id: childA, full_name: name, relation: 'grandparent',
  });
  check(`Parent A creates ${name}`, created.status, 200);
  assert.ok(created.payload?.data?.id, `Contact ID missing for ${name}`);
  return created.payload.data;
}
const allowed = await contact('GB-M35 QA pickup allowed');
const revoked = await contact('GB-M35 QA pickup revoked');
const revoke = await api('parent-a', '/api/parent/pickup-contacts', 'PATCH', { id: revoked.id, active: false });
check('Parent A revokes contact', revoke.status, 200);
const wrongParent = await api('parent-b', '/api/parent/pickup-contacts', 'POST', {
  child_id: childA, full_name: 'GB-M35 unauthorized pickup', relation: 'other',
});
check('Unrelated Parent cannot add pickup', wrongParent.status, 403);
const wrongGarden = await api('staff-b', '/api/garden/attendance-action', 'POST', {
  child_id: childA, action: 'check_in',
});
assert.ok([403, 409].includes(wrongGarden.status), `Wrong-Garden Staff arrival allowed (${wrongGarden.status})`);
results.push({ name: 'Wrong-Garden Staff arrival denied', actual: wrongGarden.status, expected: '403/409', pass: true });
const arrival = await api('staff-a', '/api/garden/attendance-action', 'POST', {
  child_id: childA, action: 'check_in',
});
check('Staff A records arrival', arrival.status, 200);
const repeatedArrival = await api('staff-a', '/api/garden/attendance-action', 'POST', {
  child_id: childA, action: 'check_in',
});
check('Duplicate arrival is safe', repeatedArrival.status, 200);
const parentView = await api('parent-a', '/api/parent/attendance');
check('Parent A attendance view', parentView.status, 200);
assert.ok(JSON.stringify(parentView.payload).includes(childA), 'Parent A cannot see Child A attendance');
const parentMutation = await api('parent-a', '/api/parent/attendance', 'POST', {
  child_id: childA, status: 'departed',
});
check('Parent cannot self-release', parentMutation.status, 403);
const revokedRelease = await api('staff-a', '/api/garden/pickup-events', 'POST', {
  child_id: childA, pickup_contact_id: revoked.id,
});
assert.ok([403, 409].includes(revokedRelease.status), `Revoked contact released Child (${revokedRelease.status})`);
results.push({ name: 'Revoked contact cannot release Child', actual: revokedRelease.status, expected: '403/409', pass: true });
const inspectorRelease = await api('inspector-a', '/api/garden/pickup-events', 'POST', {
  child_id: childA, pickup_contact_id: allowed.id,
});
check('Inspector cannot release Child', inspectorRelease.status, 403);
const release = await api('staff-a', '/api/garden/pickup-events', 'POST', {
  child_id: childA, pickup_contact_id: allowed.id,
});
check('Authorized Staff releases Child', release.status, 200);
const repeat = await api('staff-a', '/api/garden/pickup-events', 'POST', {
  child_id: childA, pickup_contact_id: allowed.id,
});
check('Duplicate release is safe', repeat.status, 200);
const departed = await api('parent-a', '/api/parent/attendance');
check('Parent A sees final attendance', departed.status, 200);
assert.ok(JSON.stringify(departed.payload).includes(childA), 'Child A history missing after release');
const otherChild = await api('parent-b', '/api/parent/attendance');
check('Parent B attendance list', otherChild.status, 200);
assert.ok(!JSON.stringify(otherChild.payload).includes(childA), 'Parent B sees unrelated Child A attendance');
assert.ok(JSON.stringify(otherChild.payload).includes(childB) || otherChild.payload?.data?.length === 0,
  'Unexpected Parent B attendance projection');
const receipt = { observedAt: new Date().toISOString(), environment: config.environment,
  applicationCommit, productionAccess: false, syntheticOnly: true,
  childId: childA, results };
writeFileSync(process.env.GB_M35_QA_RECEIPT ?? '/private/tmp/gb-m35-attendance-pickup.json',
  JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
console.log(`GB-M35 synthetic attendance/pickup E2E PASS: ${results.length} checks`);
