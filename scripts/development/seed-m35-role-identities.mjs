// Add GB-M35-only synthetic identities to the guarded local Development stack.
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { config, sql } from './local-database.mjs';
import { localCredentials } from './local-client.mjs';

if (config.environment !== 'DEVELOPMENT / INTEGRATION' || config.productionAllowed !== false) {
  throw Error('GB-M35 fixtures are restricted to isolated Development');
}
if (sql("select count(*) from development_metadata.baselines;").trim() !== '1' ||
    sql("select count(*) from public.gardens where id in ('00000000-0000-4000-8000-000000000601','00000000-0000-4000-8000-000000000602');").trim() !== '2') {
  throw Error('Canonical synthetic Development baseline and A/B Gardens required');
}
const definitions = [
  ['103', 'parent-multi', 'parent'],
  ['203', 'owner-a', 'owner'],
  ['204', 'owner-ab', 'owner'],
  ['205', 'owner-teacher', 'owner'],
  ['306', 'delegated-teacher', 'staff'],
  ['402', 'inspector-unassigned', 'inspector'],
  ['403', 'inspector-suspended', 'inspector'],
];
const path = resolve(config.runtimeRoot, 'qa-identities.private.json');
if (!existsSync(path)) throw Error('Base synthetic QA identities must exist first');
const saved = JSON.parse(readFileSync(path, 'utf8'));
if (saved.environment !== config.environment || !Array.isArray(saved.users)) throw Error('Wrong QA identity file');
const keys = localCredentials();
const client = createClient(keys.url, keys.service, { auth: { persistSession: false, autoRefreshToken: false } });
for (const [suffix, name, role] of definitions) {
  const id = `00000000-0000-4000-8000-000000000${suffix}`;
  const email = `${name}@integration.qa.invalid`;
  let savedUser = saved.users.find(user => user.id === id);
  if (!savedUser) {
    savedUser = { id, email, role, password: randomBytes(24).toString('base64url') };
    saved.users.push(savedUser);
    writeFileSync(path, JSON.stringify(saved, null, 2) + '\n', { mode: 0o600 });
  }
  if (savedUser.email !== email || savedUser.role !== role) throw Error(`Synthetic identity collision: ${name}`);
  const existing = await client.auth.admin.getUserById(id);
  if (existing.data.user) {
    if (existing.data.user.email !== email || existing.data.user.user_metadata?.environment !== 'DEVELOPMENT') {
      throw Error(`Refusing to take over a non-QA user: ${name}`);
    }
    continue;
  }
  if (existing.error?.status !== 404) throw Error(`Synthetic Auth lookup failed: ${name}`);
  const { error } = await client.auth.admin.createUser({
    id, email, password: savedUser.password, email_confirm: true,
    app_metadata: { role, environment: 'DEVELOPMENT' },
    user_metadata: { full_name: `QA ${name}`, environment: 'DEVELOPMENT' },
  });
  if (error) throw Error(`Synthetic Auth creation failed (${name}): ${error.message}`);
}
const fixture = readFileSync(new URL('../../development/database/qa-m35-role-fixtures.sql', import.meta.url), 'utf8');
sql(`BEGIN;\n${fixture}\nCOMMIT;`);
console.log(JSON.stringify({ environment: config.environment, addedRoles: definitions.map(([, name]) => name),
  totalSyntheticIdentities: saved.users.length, credentials: 'private local file; values not printed', productionAccess: false }));
