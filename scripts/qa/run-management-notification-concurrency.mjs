// Separate-connection, synthetic-only Development QA. Never run against Production.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {assertLocalDatabase, config, sql} from '../development/local-database.mjs';

assertLocalDatabase();
const parent = '00000000-0000-4000-8000-000000000101';
const garden = '00000000-0000-4000-8000-000000000601';
const child = '00000000-0000-4000-8000-000000000901';
const thread = sql(`select t.id from public.communication_threads t
  join public.communication_thread_participants p on p.thread_id=t.id
  where t.garden_id='${garden}' and t.child_id='${child}'
    and p.profile_id='${parent}' and p.left_at is null limit 1;`).trim();
assert.match(thread, /^[0-9a-f-]{36}$/);
assert.equal(sql(`select count(*) from public.communication_preferences where profile_id='${parent}'`).trim(), '0',
  'The disposable Parent preference must not overwrite existing test data');

const ids = [randomUUID(), randomUUID(), randomUUID()];
const keys = ids.map(id => `message:${id}`);
function psql(query) {
  return new Promise((resolveResult, reject) => {
    const childProcess = spawn('docker', ['--config', resolve(config.runtimeRoot, 'docker'),
      '--context', config.dockerContext, 'exec', '-i', config.container,
      'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'],
    {stdio: ['pipe', 'pipe', 'pipe']});
    let stdout = ''; let stderr = '';
    childProcess.stdout.on('data', chunk => { stdout += chunk; });
    childProcess.stderr.on('data', chunk => { stderr += chunk; });
    childProcess.on('error', reject);
    childProcess.on('close', code => code === 0 ? resolveResult(stdout.trim()) : reject(new Error(stderr.trim())));
    childProcess.stdin.end(query + '\n');
  });
}
function insert(id) {
  return `insert into public.notifications(garden_id,recipient_id,title,body,entity_type,entity_id,metadata)
    values ('${garden}','${parent}','QA private subject','QA private body',
      'communication_thread','${thread}','{"message_id":"${id}"}'::jsonb);`;
}
const keyList = keys.map(key => `'${key}'`).join(',');
sql(`insert into public.communication_preferences(profile_id,receive_push,notification_category_channels)
  values ('${parent}',true,'{"message":["push"]}'::jsonb);`);
try {
  await Promise.all([psql(insert(ids[0])), psql(insert(ids[0]))]);
  await Promise.all([psql(insert(ids[1])), psql(insert(ids[2]))]);
  const result = JSON.parse(sql(`select json_build_object(
    'notifications',(select count(*) from public.notifications where recipient_id='${parent}' and dedupe_key in (${keyList})),
    'intents',(select count(*) from public.communication_logs l join public.notifications n on n.id=l.notification_id
      where n.recipient_id='${parent}' and n.dedupe_key in (${keyList}) and l.channel='push'),
    'unsafe',(select count(*) from public.notifications where recipient_id='${parent}' and dedupe_key in (${keyList})
      and (title='QA private subject' or body='QA private body')));`));
  assert.equal(Number(result.notifications), 3, 'duplicate and distinct sends must produce three notifications');
  assert.equal(Number(result.intents), 3, 'each notification must have exactly one truthful delivery intent');
  assert.equal(Number(result.unsafe), 0, 'private message content must be sanitized');
  console.log('GB-M30 separate-connection notification concurrency PASS');
} finally {
  sql(`delete from public.communication_logs where notification_id in
    (select id from public.notifications where recipient_id='${parent}' and dedupe_key in (${keyList}));
    delete from public.notifications where recipient_id='${parent}' and dedupe_key in (${keyList});
    delete from public.communication_preferences where profile_id='${parent}';`);
}
