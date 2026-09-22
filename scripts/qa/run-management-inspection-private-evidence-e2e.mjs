// Isolated synthetic inspection/remediation Storage authorization and expiry E2E.
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
assert.equal((await fetch(base + '/api/health')).status, 200);
const saved = JSON.parse(readFileSync(resolve(config.runtimeRoot, 'qa-identities.private.json'), 'utf8'));
assert.equal(saved.environment, config.environment);
const inspection = sql("select id from public.inspections where garden_id='00000000-0000-4000-8000-000000000601' and period_month='2026-09-01' and status='done';").trim();
assert.match(inspection, /^[0-9a-f-]{36}$/);
const violation = sql("select id from public.violations where inspection_id='" + inspection + "';").trim();
assert.match(violation, /^[0-9a-f-]{36}$/);
const inspectionPath = sql("select document_url from public.inspection_answers where inspection_id='" + inspection + "' and document_url is not null;").trim();
const correctionPath = sql("select correction_files->>0 from public.violations where id='" + violation + "';").trim();
assert.ok(inspectionPath.startsWith('inspection-reports/inspections/' + inspection + '/'));
assert.ok(correctionPath.startsWith('inspection-reports/corrective-actions/' + violation + '/'));

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
for (const role of ['inspector-a', 'inspector-unassigned', 'manager-a', 'manager-b', 'parent-a', 'parent-b', 'staff-b', 'admin']) {
  cookies[role] = await cookieFor(role);
}
async function get(role, route) {
  return fetch(base + route, { headers: role ? { Cookie: cookies[role] } : {},
    redirect: 'manual', signal: AbortSignal.timeout(30_000) });
}
const results = [];
async function authorized(name, route) {
  for (const role of ['inspector-a', 'manager-a', 'admin']) {
    const response = await get(role, route);
    assert.equal(response.status, 302, name + ' ' + role + ' route');
    const signed = response.headers.get('location');
    assert.ok(signed && !signed.includes('/public/'));
    const object = await fetch(signed, { signal: AbortSignal.timeout(30_000) });
    assert.equal(object.status, 200, name + ' ' + role + ' private object');
    results.push({ name, role, routeStatus: 302, objectStatus: 200, pass: true });
  }
}
async function denied(name, route) {
  for (const role of ['inspector-unassigned', 'manager-b', 'parent-a', 'parent-b', 'staff-b']) {
    const response = await get(role, route);
    assert.ok([403, 404].includes(response.status), name + ' ' + role + ' status ' + response.status);
    results.push({ name, role, routeStatus: response.status, pass: true });
  }
  const anon = await get(null, route);
  assert.ok([401, 403, 404].includes(anon.status), name + ' anonymous access');
  results.push({ name, role: 'anonymous', routeStatus: anon.status, pass: true });
}
const inspectionRoute = '/api/inspections/' + inspection + '/evidence?path=' + encodeURIComponent(inspectionPath);
const correctionRoute = '/api/violations/' + violation + '/evidence?path=' + encodeURIComponent(correctionPath);
await authorized('inspection evidence', inspectionRoute);
await denied('inspection evidence', inspectionRoute);
await authorized('corrective evidence', correctionRoute);
await denied('corrective evidence', correctionRoute);
const alteredInspection = await get('inspector-a', inspectionRoute.replace(inspection, '00000000-0000-4000-8000-000000000001'));
assert.ok([403, 404, 422].includes(alteredInspection.status), 'altered inspection ID allowed');
const alteredCorrection = await get('manager-a', correctionRoute.replace(violation, '00000000-0000-4000-8000-000000000001'));
assert.ok([403, 404, 422].includes(alteredCorrection.status), 'altered corrective action ID allowed');
results.push({ name: 'altered IDs denied', pass: true });
const admin = createClient(keys.url, keys.service, { auth: { persistSession: false, autoRefreshToken: false } });
const bucket = await admin.storage.getBucket('inspection-reports');
assert.equal(bucket.error, null);
assert.equal(bucket.data.public, false);
const anon = createClient(keys.url, keys.anon, { auth: { persistSession: false, autoRefreshToken: false } });
for (const path of [inspectionPath, correctionPath]) {
  const objectPath = path.slice('inspection-reports/'.length);
  assert.ok((await anon.storage.from('inspection-reports').download(objectPath)).error, 'anonymous raw object access allowed');
  assert.notEqual((await fetch(keys.url + '/storage/v1/object/public/' + path)).status, 200, 'public object URL exposed file');
  assert.ok((await anon.storage.from('inspection-reports').createSignedUrl(objectPath, 60)).error, 'anonymous signed URL allowed');
}
results.push({ name: 'private bucket and anonymous raw access denied', pass: true });
const fresh = await get('manager-a', correctionRoute);
assert.equal(fresh.status, 302);
await new Promise(resolve => setTimeout(resolve, 65_000));
assert.notEqual((await fetch(fresh.headers.get('location'))).status, 200, '60-second signed link did not expire');
results.push({ name: 'signed URL expiry', pass: true });
writeFileSync('/private/tmp/gb-m35-inspection-private-evidence.json', JSON.stringify({
  observedAt: new Date().toISOString(), environment: config.environment, syntheticOnly: true,
  productionAccess: false, inspectionId: inspection, correctiveActionId: violation, results,
}, null, 2) + '\n', { mode: 0o600 });
console.log('GB-M35 inspection/remediation private evidence PASS: ' + results.length + ' checks');
