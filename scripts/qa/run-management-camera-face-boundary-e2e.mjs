// Non-mutating synthetic proof that camera/face fields cannot establish Child attendance or release.
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
const saved = JSON.parse(readFileSync(resolve(config.runtimeRoot, 'qa-identities.private.json'), 'utf8'));
assert.equal(saved.environment, config.environment);
const user = saved.users.find(item => item.email === 'staff-a@integration.qa.invalid');
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
const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
const child = '00000000-0000-4000-8000-000000000901';
const fakeEvent = '00000000-0000-4000-8000-000000035099';
const before = sql(`select (select count(*) from public.attendance where child_id='${child}') || ':' || (select count(*) from public.child_pickup_events where child_id='${child}');`).trim();
const results = [];
async function denied(name, path, body, status) {
  const response = await fetch(base + path, {
    method: 'POST', headers: {Cookie: cookie, 'Content-Type': 'application/json'},
    body: JSON.stringify(body), signal: AbortSignal.timeout(60_000),
  });
  assert.equal(response.status, status, name);
  results.push({name, status, pass: true});
}
await denied('Camera event without Child cannot establish arrival', '/api/garden/attendance-action',
  {action: 'check_in', camera_event_id: fakeEvent}, 422);
await denied('Camera event cannot mark departure', '/api/garden/attendance-action',
  {action: 'check_out', child_id: child, camera_event_id: fakeEvent}, 422);
await denied('Mock face result cannot release Child', '/api/garden/pickup-events',
  {child_id: child, face_match_result_id: fakeEvent}, 422);
const after = sql(`select (select count(*) from public.attendance where child_id='${child}') || ':' || (select count(*) from public.child_pickup_events where child_id='${child}');`).trim();
assert.equal(after, before, 'Camera/face request changed attendance or pickup rows');
results.push({name: 'No attendance or pickup event mutation', pass: true});
writeFileSync('/private/tmp/gb-m35-camera-face-boundary.json', JSON.stringify({observedAt: new Date().toISOString(), environment: config.environment, syntheticOnly: true, productionAccess: false, results}, null, 2) + '\n', {mode: 0o600});
console.log(`GB-M35 camera/face Management boundary PASS: ${results.length} checks`);
