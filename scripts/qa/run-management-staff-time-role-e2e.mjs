// Synthetic Staff operational-day QA; never points at Production.
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
assert.equal((await fetch(`${base}/api/health`)).status, 200);
const saved = JSON.parse(readFileSync(resolve(config.runtimeRoot, 'qa-identities.private.json'), 'utf8'));
assert.equal(saved.environment, config.environment);
const roles = ['manager-a', 'manager-b', 'staff-a', 'staff-b', 'staff-candidate', 'inspector-a'];
const cookies = {};
for (const role of roles) {
  const user = saved.users.find(item => item.email === `${role}@integration.qa.invalid`);
  assert.ok(user?.password);
  const jar = new Map();
  const client = createServerClient(keys.url, keys.anon, {
    cookieOptions: { path: '/', sameSite: 'lax', secure: false },
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: changes => changes.forEach(({ name, value }) => jar.set(name, value)) },
  });
  assert.equal((await client.auth.signInWithPassword({ email: user.email, password: user.password })).error, null);
  cookies[role] = [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
}
async function api(role, path, method = 'GET', body) {
  const response = await fetch(`${base}${path}`, { method,
    headers: { Cookie: cookies[role], ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), redirect: 'manual', signal: AbortSignal.timeout(60_000) });
  return { status: response.status, payload: await response.json().catch(() => null) };
}
const ids = {
  gardenA: '00000000-0000-4000-8000-000000000601',
  gardenB: '00000000-0000-4000-8000-000000000602',
  staffA: '00000000-0000-4000-8000-000000000b01',
  classroomA1: '00000000-0000-4000-8000-000000000701',
};
const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jerusalem' });
const month = `${today.slice(0, 7)}-01`;
const results = [];
function check(name, actual, expected) {
  const pass = actual === expected;
  results.push({ name, actual, expected, pass });
  assert.equal(actual, expected, name);
}
const shift = { staff_id: ids.staffA, garden_id: ids.gardenA, classroom_id: ids.classroomA1,
  shift_date: today, planned_start: '09:00:00', planned_end: '16:00:00' };
const before = await api('staff-a', '/api/staff/shifts');
check('Staff A shift list', before.status, 200);
let scheduled = before.payload?.data?.find(item => item.shift_date === today && item.staff_id === ids.staffA);
if (!scheduled) {
  const assigned = await api('manager-a', '/api/staff/shifts', 'POST', shift);
  check('Manager A schedules active Staff A', assigned.status, 200);
  scheduled = assigned.payload?.data;
}
assert.ok(scheduled?.id, 'Scheduled shift ID missing');
const wrongManager = await api('manager-b', '/api/staff/shifts', 'POST', shift);
check('Manager B cannot schedule Garden A Staff', wrongManager.status, 403);
const candidate = await api('staff-candidate', '/api/staff/shifts');
assert.ok([401, 403].includes(candidate.status), `Candidate saw operational shifts (${candidate.status})`);
results.push({ name: 'Candidate denied operational shifts', actual: candidate.status, expected: '401/403', pass: true });
const sample = { staff_id: ids.staffA, garden_id: ids.gardenA, gps_lat: 0, gps_lng: 0,
  gps_accuracy_meters: 999, network_reliable: false };
const clockIn = await api('staff-a', '/api/staff/gps-attendance', 'POST', { ...sample, action: 'check_in' });
check('Staff A clocks in', clockIn.status, 200);
const repeatedIn = await api('staff-a', '/api/staff/gps-attendance', 'POST', { ...sample, action: 'check_in' });
check('Duplicate clock-in', repeatedIn.status, 200);
check('Duplicate clock-in retains shift', repeatedIn.payload?.data?.shift?.id, clockIn.payload?.data?.shift?.id);
const wrongStaff = await api('staff-b', '/api/staff/gps-attendance', 'POST', { ...sample, action: 'check_in' });
assert.ok([403, 404].includes(wrongStaff.status), `Wrong-Garden Staff clocked in (${wrongStaff.status})`);
results.push({ name: 'Wrong-Garden Staff cannot clock for A', actual: wrongStaff.status,
  expected: '403/404', pass: true });
const clockOut = await api('staff-a', '/api/staff/gps-attendance', 'POST', { ...sample, action: 'check_out' });
check('Staff A clocks out', clockOut.status, 200);
const repeatedOut = await api('staff-a', '/api/staff/gps-attendance', 'POST', { ...sample, action: 'check_out' });
check('Duplicate clock-out', repeatedOut.status, 200);
check('Duplicate clock-out retains shift', repeatedOut.payload?.data?.shift?.id, clockOut.payload?.data?.shift?.id);
const own = await api('staff-a', '/api/staff/shifts');
check('Staff A sees own completed shift', own.payload?.data?.find(item => item.id === scheduled.id)?.status, 'completed');
const otherStaff = await api('staff-b', '/api/staff/shifts');
check('Staff B shift list', otherStaff.status, 200);
assert.ok(!otherStaff.payload?.data?.some(item => item.id === scheduled.id), 'Staff B saw A shift');
const managerExport = await api('manager-a', `/api/garden/staff-time?period=${month}`);
check('Manager A payroll-ready projection', managerExport.status, 200);
assert.ok(managerExport.payload?.data?.rows?.some(item => item.staff_id === ids.staffA), 'Manager A export missing Staff A');
const managerBExport = await api('manager-b', `/api/garden/staff-time?period=${month}`);
check('Manager B own-Garden export', managerBExport.status, 200);
assert.ok(!managerBExport.payload?.data?.rows?.some(item => item.staff_id === ids.staffA), 'Manager B export leaked Staff A');
check('Inspector payroll export denied', (await api('inspector-a', `/api/garden/staff-time?period=${month}`)).status, 403);
const receipt = { observedAt: new Date().toISOString(), environment: config.environment,
  productionAccess: false, syntheticOnly: true, shiftId: scheduled.id, results };
writeFileSync(process.env.GB_M35_QA_RECEIPT ?? '/private/tmp/gb-m35-staff-time-e2e.json',
  JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
console.log(`GB-M35 synthetic Staff-time role E2E PASS: ${results.length} checks`);
