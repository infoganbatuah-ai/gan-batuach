// Complete one existing synthetic complaint on the guarded isolated Development stack.
// This is deliberately resumable and never creates a complaint or SLA policy.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServerClient } from '@supabase/ssr';
import { config, sql } from '../development/local-database.mjs';
import { localCredentials } from '../development/local-client.mjs';

const complaintId = 'c2e9cc2a-e81c-4aab-9ec5-3975ccb3dce7';
const subject = 'GB-20261113 synthetic SLA complaint';
const resolution = 'Synthetic QA: the escalated complaint was reviewed and resolved.';
const internalNote = 'Synthetic internal closure verification only';
const receiptPath = process.env.GB_COMPLAINT_CLOSURE_RECEIPT;
assert.ok(receiptPath?.startsWith('/Volumes/DIGITAL_OBSERVER/'), 'External receipt path required');
assert.equal(config.environment, 'DEVELOPMENT / INTEGRATION');
assert.equal(config.productionAllowed, false);
const keys = localCredentials();
assert.equal(keys.url, 'http://127.0.0.1:55421');
const base = 'http://127.0.0.1:3000';
const health = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(10000) });
assert.equal(health.status, 200, 'Canonical Development Product must be running');

const readCase = () => JSON.parse(sql(`select row_to_json(c) from
  (select id,subject,status,routing_state,visibility,sla_policy_id,
          reporter_user_id,garden_id,resolution_public,closed_at
   from public.complaints where id='${complaintId}') c;`));
const before = readCase();
assert.equal(before.subject, subject);
assert.equal(before.visibility, 'garden');
assert.ok(before.sla_policy_id, 'Synthetic SLA policy snapshot missing');
assert.ok(['escalated', 'resolved', 'closed'].includes(before.status));
const eventsBefore = JSON.parse(sql(`select coalesce(json_agg(action order by created_at),'[]')
  from public.complaint_events where complaint_id='${complaintId}';`));
for (const action of ['submitted', 'request_garden', 'garden_reply', 'sla_escalated']) {
  assert.ok(eventsBefore.includes(action), `Missing prior journey step: ${action}`);
}
assert.equal(eventsBefore.filter(action => action === 'sla_escalated').length, 1);

const saved = JSON.parse(readFileSync(resolve(config.runtimeRoot, 'qa-identities.private.json'), 'utf8'));
assert.equal(saved.environment, config.environment);
const roles = ['parent-a', 'parent-b', 'manager-b', 'inspector-unassigned', 'inspector-suspended', 'admin'];
const cookies = {};
for (const role of roles) {
  const user = saved.users.find(item => item.email === `${role}@integration.qa.invalid`);
  assert.ok(user?.password, `Synthetic identity missing: ${role}`);
  const jar = new Map();
  const client = createServerClient(keys.url, keys.anon, {
    cookieOptions: { path: '/', sameSite: 'lax', secure: false },
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: changes => changes.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const login = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  assert.equal(login.error, null, `Synthetic login failed: ${role}`);
  cookies[role] = [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
}
async function api(role, path, action, publicNote, note) {
  const response = await fetch(`${base}${path}`, {
    method: action ? 'POST' : 'GET',
    headers: { Cookie: cookies[role], ...(action ? { 'Content-Type': 'application/json' } : {}) },
    ...(action ? { body: JSON.stringify({ action, ...(publicNote ? { publicNote } : {}),
      ...(note ? { internalNote: note } : {}) }) } : {}),
    redirect: 'manual', signal: AbortSignal.timeout(60000),
  });
  return { status: response.status, payload: await response.json().catch(() => null) };
}
const results = [];
function check(label, actual, expected) {
  results.push({ label, actual, expected, pass: actual === expected });
  assert.equal(actual, expected, label);
}
for (const role of ['parent-b', 'manager-b', 'inspector-unassigned', 'inspector-suspended']) {
  const denied = await api(role, `/api/complaints/${complaintId}/actions`, 'close');
  check(`${role} cannot close known complaint`, denied.status, 403);
}
if (before.status === 'escalated') {
  const resolved = await api('admin', `/api/complaints/${complaintId}/actions`, 'resolve', resolution, internalNote);
  check('Admin resolves escalated case', resolved.status, 200);
}
const afterResolution = readCase();
check('Case resolved before closure', afterResolution.status, before.status === 'closed' ? 'closed' : 'resolved');
if (afterResolution.status === 'resolved') {
  check('Public resolution matches synthetic marker', afterResolution.resolution_public, resolution);
  const closed = await api('admin', `/api/complaints/${complaintId}/actions`, 'close');
  check('Admin closes resolved case', closed.status, 200);
}
const after = readCase();
check('Final state closed', after.status, 'closed');
check('Public resolution retained', after.resolution_public, resolution);
assert.ok(after.closed_at);
const own = await api('parent-a', '/api/parent/complaints');
check('Reporter list readable', own.status, 200);
const projected = own.payload?.data?.find(item => item.id === complaintId);
check('Reporter sees closed case', projected?.status, 'closed');
check('Reporter sees public resolution', projected?.resolution_public, resolution);
assert.ok(!JSON.stringify(own.payload).includes(internalNote), 'Internal note leaked to reporter');
const other = await api('parent-b', '/api/parent/complaints');
check('Other Parent list readable', other.status, 200);
assert.ok(!other.payload?.data?.some(item => item.id === complaintId), 'Other Parent sees case');
for (const [role, visible] of [['parent-a', true], ['parent-b', false]]) {
  const page = await fetch(`${base}/dashboard/parent/complaints`, {
    headers: { Cookie: cookies[role] }, redirect: 'manual', signal: AbortSignal.timeout(60000),
  });
  check(`${role} complaint page renders`, page.status, 200);
  const html = await page.text();
  check(`${role} sees only authorized complaint subject in rendered page`, html.includes(subject), visible);
  assert.ok(!html.includes(internalNote), `${role} rendered internal note`);
  if (visible) assert.ok(html.includes('טופלו'), 'Completed-case filter missing in Parent page');
}
const eventsAfter = JSON.parse(sql(`select coalesce(json_agg(action order by created_at),'[]')
  from public.complaint_events where complaint_id='${complaintId}';`));
check('Exactly one SLA escalation', eventsAfter.filter(action => action === 'sla_escalated').length, 1);
check('Exactly one resolution', eventsAfter.filter(action => action === 'resolve').length, 1);
check('Exactly one closure', eventsAfter.filter(action => action === 'close').length, 1);
const tasks = JSON.parse(sql(`select coalesce(json_agg(status),'[]') from public.tasks
  where source_entity_type='complaint' and source_entity_id='${complaintId}';`));
check('One canonical task', tasks.length, 1);
check('Task complete after resolution', tasks[0], 'done');
const receipt = { observedAt: new Date().toISOString(), environment: config.environment,
  productionAccess: false, syntheticOnly: true, complaintId, sourceHead: process.env.GB_INTEGRATION_SHA,
  priorEvents: eventsBefore, finalEvents: eventsAfter, results };
writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
console.log(`Synthetic Complaint SLA closure PASS: ${results.length} checks`);
