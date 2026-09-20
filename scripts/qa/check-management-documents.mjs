import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { documentOwnerFor, effectiveDocumentStatus, managementDocumentId, supportedDocumentSignature } from '../../lib/management/document-policy.ts';

const read = (path) => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');

test('document routes accept full canonical UUIDs and reject truncated identifiers', () => {
  assert.equal(managementDocumentId.test('00000000-0000-4000-8000-000000000601'), true);
  assert.equal(managementDocumentId.test('00000000-0000-4000-000000000601'), false);
  for (const route of ['app/api/documents/route.ts', 'app/api/documents/[id]/file/route.ts',
    'app/api/documents/[id]/delete-request/route.ts', 'app/api/documents/[id]/purge/route.ts']) {
    assert.match(read(route), /const uuid = managementDocumentId/);
  }
});

test('document categories bind to one explicit owner type', () => {
  assert.equal(documentOwnerFor('medical_approval'), 'child');
  assert.equal(documentOwnerFor('teacher_certificate'), 'teacher');
  assert.equal(documentOwnerFor('training'), 'staff');
  assert.equal(documentOwnerFor('arbitrary_table'), null);
});

test('expiry and replacement are server-evaluated without erasing history', () => {
  const today = new Date('2026-09-20T12:00:00Z');
  assert.equal(effectiveDocumentStatus({ status: 'valid', expires_at: '2026-09-19' }, today), 'expired');
  assert.equal(effectiveDocumentStatus({ status: 'valid', expires_at: '2026-09-25', reminder_days_before: 7 }, today), 'expiring_soon');
  assert.equal(effectiveDocumentStatus({ status: 'valid', expires_at: '2026-09-25', reminder_days_before: 2 }, today), 'valid');
  assert.equal(effectiveDocumentStatus({ status: 'valid', replaced_by: 'new-id' }, today), 'replaced');
  assert.equal(effectiveDocumentStatus({ status: 'valid', deleted_at: '2026-09-01' }, today), 'deleted');
  assert.equal(effectiveDocumentStatus({ status: 'valid', expires_at: '2026-09-19' }, new Date('2026-09-19T22:30:00Z')), 'expired');
});

test('upload accepts declared safe content only when signature agrees', () => {
  assert.equal(supportedDocumentSignature('application/pdf', new TextEncoder().encode('%PDF-1.7')), true);
  assert.equal(supportedDocumentSignature('application/pdf', new TextEncoder().encode('<script>')), false);
  assert.equal(supportedDocumentSignature('image/jpeg', new Uint8Array([0xff, 0xd8, 0xff, 0x11])), true);
  assert.equal(supportedDocumentSignature('application/zip', new Uint8Array([0x50, 0x4b])), false);
});

test('private storage is reached only via a session-scoped document row', () => {
  const upload = read('app/api/documents/route.ts');
  const retrieval = read('app/api/documents/[id]/file/route.ts');
  const generic = read('app/api/storage/upload/route.ts');
  assert.match(upload, /register_management_document/);
  assert.match(upload, /storage\.upload\(path/);
  assert.match(retrieval, /\.from\("documents" as never\)[\s\S]*?\.eq\("id", id\)/);
  assert.match(retrieval, /createSignedUrl\(row\.storage_path, 60/);
  assert.doesNotMatch(generic, /"documents"\s*,/);
  assert.doesNotMatch(generic, /"inspection-reports"\s*,/);
});

test('migration removes direct document writes and permanent public storage access', () => {
  const migration = read('supabase/migrations/20260920130000_management_private_documents.sql');
  assert.match(migration, /create policy "management documents server only" on storage\.objects as restrictive/);
  assert.match(migration, /drop policy if exists "documents scoped update hardened"/);
  assert.match(migration, /create policy "management documents private read"/);
  assert.match(migration, /for update/);
  assert.match(migration, /retention_until/);
});
