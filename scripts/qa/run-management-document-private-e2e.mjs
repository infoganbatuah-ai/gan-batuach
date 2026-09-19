// Explicit loopback-only, synthetic-identity QA. Secrets and signed links come
// from restricted local configuration and are never printed or committed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const config = {
  app: process.env.GB_M32_QA_APP_URL,
  supabase: process.env.GB_M32_QA_SUPABASE_URL,
  anon: process.env.GB_M32_QA_ANON_KEY,
  service: process.env.GB_M32_QA_SERVICE_KEY,
  identitiesFile: process.env.GB_M32_QA_IDENTITIES_FILE
};
for (const [key, value] of Object.entries(config)) assert.ok(value, `Missing local GB-M32 QA setting ${key}`);
for (const url of [config.app, config.supabase]) {
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(url).hostname), 'GB-M32 E2E must stay on loopback');
}
const gardenA = '00000000-0000-4000-8000-000000000601';
const childA = '00000000-0000-4000-8000-000000000901';
const ids = {
  parentA: '00000000-0000-4000-8000-000000000101',
  parentB: '00000000-0000-4000-8000-000000000102',
  managerA: '00000000-0000-4000-8000-000000000201',
  managerB: '00000000-0000-4000-8000-000000000202',
  staffA: '00000000-0000-4000-8000-000000000301',
  revokedStaff: '00000000-0000-4000-8000-000000000305',
  inspector: '00000000-0000-4000-8000-000000000401',
  admin: '00000000-0000-4000-8000-000000000501'
};
const privateIdentities = JSON.parse(readFileSync(config.identitiesFile, 'utf8'));
const identities = Object.fromEntries(Object.entries(ids).map(([role, id]) => {
  const user = privateIdentities.users.find((item) => item.id === id);
  assert.ok(user?.email && user?.password, `Missing disposable ${role} identity`);
  return [role, user];
}));

async function cookieFor(identity) {
  const jar = new Map();
  const client = createServerClient(config.supabase, config.anon, {
    cookieOptions: { path: '/', sameSite: 'lax', secure: false },
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (changes) => changes.forEach(({ name, value }) => jar.set(name, value))
    }
  });
  const { error } = await client.auth.signInWithPassword({ email: identity.email, password: identity.password });
  assert.ifError(error);
  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
}
async function api(path, cookie, options = {}) {
  return fetch(`${config.app}${path}`, { ...options, redirect: 'manual', headers: {
    ...(cookie ? { Cookie: cookie } : {}), ...options.headers
  } });
}

const cookies = {};
for (const [role, identity] of Object.entries(identities)) cookies[role] = await cookieFor(identity);
const admin = createClient(config.supabase, config.service, { auth: { persistSession: false, autoRefreshToken: false } });
const bytes = new TextEncoder().encode('%PDF-1.4\nGB-M32 synthetic private document\n%%EOF\n');
const form = new FormData();
form.set('garden_id', gardenA);
form.set('owner_id', childA);
form.set('document_type', 'child_document');
form.set('name', 'Synthetic private Child document');
form.set('file', new File([bytes], 'qa.pdf', { type: 'application/pdf' }));
let documentId = null;
let objectPath = null;
try {
  const created = await api('/api/documents', cookies.parentA, { method: 'POST', body: form });
  assert.equal(created.status, 201, `authorized upload returned ${created.status}`);
  const payload = (await created.json()).data;
  documentId = payload.id;
  assert.ok(documentId && payload.file_url === `/api/documents/${documentId}/file`);
  assert.equal(payload.status, 'pending_review');
  const { data: metadata, error: metadataError } = await admin.from('documents')
    .select('id,garden_id,child_id,storage_bucket,storage_path,status').eq('id', documentId).single();
  assert.ifError(metadataError);
  assert.equal(metadata.garden_id, gardenA);
  assert.equal(metadata.child_id, childA);
  assert.equal(metadata.storage_bucket, 'documents');
  assert.ok(metadata.storage_path.startsWith(`management/${gardenA}/${documentId}/`));
  objectPath = metadata.storage_path;
  const { data: bucket, error: bucketError } = await admin.storage.getBucket('documents');
  assert.ifError(bucketError);
  assert.equal(bucket.public, false);
  for (const role of ['parentA', 'managerA']) {
    const signedResponse = await api(payload.file_url, cookies[role]);
    assert.equal(signedResponse.status, 302, `${role} signed retrieval returned ${signedResponse.status}`);
    const signed = signedResponse.headers.get('location');
    assert.ok(signed && !signed.includes('/object/public/'));
    const object = await fetch(signed);
    assert.equal(object.status, 200);
    assert.deepEqual(new Uint8Array(await object.arrayBuffer()), bytes);
  }
  for (const role of ['parentB', 'managerB', 'staffA', 'revokedStaff', 'inspector', 'admin']) {
    assert.equal((await api(payload.file_url, cookies[role])).status, 404, `${role} read unrelated private document`);
  }
  assert.equal((await api(payload.file_url, null)).status, 401);
  assert.equal((await api(payload.file_url.replace(documentId, '00000000-0000-4000-8000-000000000001'), cookies.parentA)).status, 404);
  const anon = createClient(config.supabase, config.anon, { auth: { persistSession: false, autoRefreshToken: false } });
  assert.ok((await anon.storage.from('documents').download(objectPath)).error, 'anonymous raw object access allowed');
  assert.ok((await anon.storage.from('documents').createSignedUrl(objectPath, 60)).error, 'anonymous signing allowed');
  assert.notEqual((await fetch(`${config.supabase}/storage/v1/object/public/documents/${objectPath}`)).status, 200);
  const parent = createClient(config.supabase, config.anon, { auth: { persistSession: false, autoRefreshToken: false } });
  assert.ifError((await parent.auth.signInWithPassword({ email: identities.parentA.email, password: identities.parentA.password })).error);
  assert.ok((await parent.storage.from('documents').download(objectPath)).error, 'direct authenticated object access allowed');
  const expiring = await api(payload.file_url, cookies.parentA);
  assert.equal(expiring.status, 302);
  await new Promise((resolve) => setTimeout(resolve, 65_000));
  assert.notEqual((await fetch(expiring.headers.get('location'))).status, 200, '60-second signed URL did not expire');
  console.log('GB-M32 private document E2E PASS: scoped upload, authorized retrieval, negative roles, private Storage, expiry');
} finally {
  // Disposable synthetic QA only. Preserve historical audit rows but remove
  // the fixture document and object so subsequent Development QA is clean.
  if (documentId) await admin.from('documents').delete().eq('id', documentId);
  if (objectPath) await admin.storage.from('documents').remove([objectPath]);
}
