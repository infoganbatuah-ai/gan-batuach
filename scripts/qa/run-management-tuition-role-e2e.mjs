// Synthetic GB-M35 tuition role and same-evidence concurrency journey; isolated Development only.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServerClient } from '@supabase/ssr';
import { config, sql } from '../development/local-database.mjs';
import { localCredentials } from '../development/local-client.mjs';

const base = 'http://127.0.0.1:3000';
const keys = localCredentials();
assert.equal(config.environment, 'DEVELOPMENT / INTEGRATION');
assert.equal(config.productionAllowed, false);
assert.equal(keys.url, 'http://127.0.0.1:55421');
const health = await fetch(base + '/api/health');
assert.equal(health.status, 200);
const saved = JSON.parse(readFileSync(resolve(config.runtimeRoot, 'qa-identities.private.json'), 'utf8'));
assert.equal(saved.environment, config.environment);

const ids = {
  gardenA: '00000000-0000-4000-8000-000000000601',
  gardenB: '00000000-0000-4000-8000-000000000602',
  childA: '00000000-0000-4000-8000-000000000801',
  childB: '00000000-0000-4000-8000-000000000802',
};
const fixture = sql("select id,child_id,garden_id,status,start_date,tuition_unit_price_snapshot from public.child_kindergarten_enrollments where child_id in ('00000000-0000-4000-8000-000000000901','00000000-0000-4000-8000-000000000902') order by child_id;");
const lines = fixture.trim().split('\n');
assert.equal(lines.length, 2, 'Only the two canonical synthetic Child enrollments may be prepared');
for (const line of lines) {
  const [, child, garden, status, start, price] = line.split('|');
  assert.equal(status, 'active');
  assert.ok(
    (child === '00000000-0000-4000-8000-000000000901' && garden === ids.gardenA && (!price || Number(price) === 100)) ||
    (child === '00000000-0000-4000-8000-000000000902' && garden === ids.gardenB && (!price || Number(price) === 120)),
    'Unexpected enrollment or pre-existing tuition agreement',
  );
  assert.ok(!start || start === '2026-09-01', 'Existing enrollment start must not be changed');
}
sql("update public.child_kindergarten_enrollments set start_date=coalesce(start_date,date '2026-09-01'), tuition_unit_price_snapshot=coalesce(tuition_unit_price_snapshot,case when child_id='00000000-0000-4000-8000-000000000901' then 100 else 120 end), tuition_price_source=coalesce(tuition_price_source,'isolated_qa_fixture') where child_id in ('00000000-0000-4000-8000-000000000901','00000000-0000-4000-8000-000000000902') and garden_id in ('00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000602') and status='active';");

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
for (const role of ['manager-a', 'manager-b', 'parent-a', 'parent-b', 'inspector-a']) cookies[role] = await cookieFor(role);
async function api(role, path, body) {
  const response = await fetch(base + path, {
    method: body ? 'POST' : 'GET',
    headers: { Cookie: cookies[role], ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    redirect: 'manual', signal: AbortSignal.timeout(60_000),
  });
  return { status: response.status, payload: await response.json().catch(() => null) };
}
const results = [];
function check(name, actual, expected) {
  results.push({ name, actual, expected, pass: actual === expected });
  assert.equal(actual, expected, name);
}
const gardenAInitial = await api('manager-a', '/api/garden/tuition-ledger');
check('Garden A finance read', gardenAInitial.status, 200);
const gardenBInitial = await api('manager-b', '/api/garden/tuition-ledger');
check('Garden B finance read', gardenBInitial.status, 200);
const enrollA = gardenAInitial.payload?.data?.enrollments?.find(row => row.child_id === '00000000-0000-4000-8000-000000000901');
const enrollB = gardenBInitial.payload?.data?.enrollments?.find(row => row.child_id === '00000000-0000-4000-8000-000000000902');
assert.ok(enrollA?.id && enrollB?.id, 'Synthetic enrollments absent from Garden finance');
const generatedA = await api('manager-a', '/api/garden/tuition-ledger', { action: 'generate_period', enrollment_id: enrollA.id, month: '2026-09-01' });
check('Manager A generates September period', generatedA.status, 200);
const generatedAReplay = await api('manager-a', '/api/garden/tuition-ledger', { action: 'generate_period', enrollment_id: enrollA.id, month: '2026-09-01' });
check('Period generation replay accepted', generatedAReplay.status, 200);
const periodA = generatedA.payload?.data?.period;
assert.ok(periodA?.id, 'Garden A period ID missing');
check('One canonical period on replay', generatedAReplay.payload?.data?.period?.id, periodA.id);
check('Agreed price snapshot', Number(periodA.base_amount), 100);
const generatedB = await api('manager-b', '/api/garden/tuition-ledger', { action: 'generate_period', enrollment_id: enrollB.id, month: '2026-09-01' });
check('Manager B generates separate September period', generatedB.status, 200);
const periodB = generatedB.payload?.data?.period;
assert.ok(periodB?.id && periodB.id !== periodA.id);
check('Garden A cannot generate B enrollment', (await api('manager-a', '/api/garden/tuition-ledger', {
  action: 'generate_period', enrollment_id: enrollB.id, month: '2026-09-01',
})).status, 403);
check('Garden A cannot settle B period', (await api('manager-a', '/api/garden/tuition-ledger', {
  action: 'manual_settlement', period_id: periodB.id, amount: 10, method: 'bank_transfer', idempotency_key: 'gb-m35-cross-garden-deny',
})).status, 403);
check('Parent A cannot read Child B tuition', (await api('parent-a', '/api/parent/tuition-ledger?child_id=' + ids.childB)).status, 403);
check('Inspector cannot read Garden tuition', (await api('inspector-a', '/api/garden/tuition-ledger')).status, 403);
const parentBefore = await api('parent-a', '/api/parent/tuition-ledger?child_id=' + ids.childA);
check('Parent A sees own tuition', parentBefore.status, 200);
assert.ok(parentBefore.payload?.data?.periods?.some(row => row.id === periodA.id));
check('Provider unavailable to Parent', parentBefore.payload?.data?.provider_payment_available, false);

const first = { action: 'manual_settlement', period_id: periodA.id, amount: 40, method: 'bank_transfer', reference: 'GB-M35 synthetic bank reference', idempotency_key: 'gb-m35-tuition-a-sept-partial-40' };
const firstResult = await api('manager-a', '/api/garden/tuition-ledger', first);
check('Manager A records partial settlement', firstResult.status, 200);
check('Partial settled amount', Number(firstResult.payload?.data?.period?.settled_total), 40);
check('Partial outstanding amount', Number(firstResult.payload?.data?.period?.outstanding), 60);
const parentPartial = await api('parent-a', '/api/parent/tuition-ledger?child_id=' + ids.childA);
check('Parent sees partial settlement', Number(parentPartial.payload?.data?.periods?.find(row => row.id === periodA.id)?.outstanding), 60);

const second = { ...first, amount: 60, idempotency_key: 'gb-m35-tuition-a-sept-final-60' };
const [finishA, finishB] = await Promise.all([
  api('manager-a', '/api/garden/tuition-ledger', second),
  api('manager-a', '/api/garden/tuition-ledger', second),
]);
check('Concurrent same-evidence settlement A', finishA.status, 200);
check('Concurrent same-evidence settlement B', finishB.status, 200);
const final = await api('manager-a', '/api/garden/tuition-ledger?child_id=00000000-0000-4000-8000-000000000901');
check('Final Garden finance read', final.status, 200);
const finalPeriod = final.payload?.data?.periods?.find(row => row.id === periodA.id);
check('Period paid once', finalPeriod?.status, 'paid');
check('Final settled amount', Number(finalPeriod?.settled_total), 100);
check('No negative balance', Number(finalPeriod?.outstanding), 0);
const entryCount = Number(sql("select count(*) from public.tuition_ledger_entries where period_id='" + periodA.id + "' and entry_kind='manual_settlement';").trim());
check('Exactly two evidence entries despite concurrent replay', entryCount, 2);
const parentFinal = await api('parent-a', '/api/parent/tuition-ledger?child_id=' + ids.childA);
check('Parent sees paid state', parentFinal.payload?.data?.periods?.find(row => row.id === periodA.id)?.status, 'paid');

const receipt = { observedAt: new Date().toISOString(), environment: config.environment, syntheticOnly: true,
  productionAccess: false, periodA: periodA.id, periodB: periodB.id, separateHttpConnections: true, results };
writeFileSync('/private/tmp/gb-m35-tuition-role-e2e.json', JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
console.log('GB-M35 synthetic tuition role and concurrency E2E PASS: ' + results.length + ' checks');
