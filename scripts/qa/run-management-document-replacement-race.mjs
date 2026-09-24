// Separate-connection, synthetic-only GB-M32 replacement race. Never run on
// Production: local-database asserts the dedicated isolated Development VM.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { assertLocalDatabase, config, sql } from '../development/local-database.mjs';
import { localCredentials } from '../development/local-client.mjs';

assertLocalDatabase();
const local = localCredentials();
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(local.url).hostname));
const storage = createClient(local.url, local.service,
  { auth: { persistSession: false, autoRefreshToken: false } }).storage.from('documents');
const garden = '00000000-0000-4000-8000-000000000601';
const manager = '00000000-0000-4000-8000-000000000201';
const ids = [randomUUID(), randomUUID(), randomUUID()];
const paths = ids.map((id) => `management/${garden}/${id}/${randomUUID()}.pdf`);
const quote = (value) => `'${value.replaceAll("'", "''")}'`;
const args = ['--config', resolve(config.runtimeRoot, 'docker'), '--context', config.dockerContext,
  'exec', '-i', config.container, 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'];
function asManager(statement) {
  return `BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub',${quote(manager)},true); ${statement} COMMIT;`;
}
function separateConnection(statement) {
  return new Promise((done) => {
    const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let error = '';
    child.stderr.on('data', (chunk) => { error += chunk.toString(); });
    child.stdout.resume();
    child.on('error', (reason) => done({ code: -1, error: reason.message }));
    child.on('close', (code) => done({ code, error }));
    child.stdin.end(asManager(statement));
  });
}
const call = (id, path, replacement = 'null') =>
  `SELECT id FROM public.register_management_document(${quote(id)},${quote(garden)},'garden',null,null,null,null,
    'garden_document','Synthetic replacement race',${quote(path)},'application/pdf',100,null,${replacement});`;

try {
  for (const path of paths) {
    const { error } = await storage.upload(path, new TextEncoder().encode('%PDF-1.4\nSynthetic race\n%%EOF\n'),
      { contentType: 'application/pdf', upsert: false });
    assert.ifError(error);
  }
  sql(asManager(call(ids[0], paths[0])));
  const results = await Promise.all([1, 2].map((index) => separateConnection(
    `SELECT pg_sleep(0.5); ${call(ids[index], paths[index], quote(ids[0]))}`)));
  assert.equal(results.filter((result) => result.code === 0).length, 1, 'one replacement must win');
  assert.equal(results.filter((result) => result.code !== 0).length, 1, 'one replacement must be rejected');
  const state = JSON.parse(sql(`SELECT json_build_object('current',count(*) FILTER (WHERE id IN (${quote(ids[1])},${quote(ids[2])})),
    'linked',count(*) FILTER (WHERE replaces_document_id=${quote(ids[0])}))
    FROM public.documents WHERE id IN (${ids.map(quote).join(',')});`));
  assert.deepEqual(state, { current: 1, linked: 1 });
  console.log('GB-M32 separate-connection replacement race PASS: one current version');
} finally {
  // Audit history is append-only. Remove only the disposable document/object
  // fixtures; keep the synthetic audit events as truthful QA history.
  sql(`DELETE FROM public.documents WHERE id IN (${ids.map(quote).join(',')});`);
  const { error } = await storage.remove(paths);
  assert.ifError(error);
}
