#!/usr/bin/env node
// Tests guarded SQL only in a disposable, network-disabled PostgreSQL container.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));
const image = 'public.ecr.aws/supabase/postgres:17.6.1.167';
const owner = '11111111-1111-4111-8111-111111111111';
const tenant = '22222222-2222-4222-8222-222222222222';
const otherTenant = '33333333-3333-4333-8333-333333333333';
const site = '44444444-4444-4444-8444-444444444444';
const otherSite = '55555555-5555-4555-8555-555555555555';
const camera = '66666666-6666-4666-8666-666666666666';
const registration = '88888888-8888-4888-8888-888888888888';
let container;
let checks = 0;

function docker(args, input) {
  const result = spawnSync('docker', args, {
    input, encoding: 'utf8', timeout: 20_000, maxBuffer: 2_000_000,
  });
  if (result.error) throw result.error;
  return result;
}

function psql(statement, role = 'postgres') {
  const result = docker([
    'exec', '-i', container, 'psql', '-X', '-h', '/tmp', '-U', role,
    '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-A', '-t',
  ], statement);
  if (result.status !== 0) throw new Error(result.stderr.trim() || `psql ${result.status}`);
  return result.stdout.trim();
}

function denied(statement, pattern, role = 'postgres') {
  const result = docker([
    'exec', '-i', container, 'psql', '-X', '-h', '/tmp', '-U', role,
    '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-A', '-t',
  ], statement);
  assert.notEqual(result.status, 0, `expected denial: ${pattern}`);
  assert.match(result.stderr, pattern);
  checks++;
}

function psqlAsync(statement) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', [
      'exec', '-i', container, 'psql', '-X', '-h', '/tmp', '-U', 'postgres',
      '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-A', '-t',
    ], { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', value => { out += value; });
    child.stderr.on('data', value => { err += value; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(out.trim()) : reject(new Error(err.trim())));
    child.stdin.end(statement);
  });
}

function observation(sourceId, overrides = {}) {
  return {
    siteId: site, sourceId, cameraId: camera, streamId: 'synthetic-stream',
    eventType: 'person_entered', severity: 'medium', confidence: 0.812345,
    occurredAt: new Date().toISOString(), trackId: 'synthetic-track',
    evidenceKind: 'line_crossing', recordingRequired: false,
    modelProvenance: null, verificationEvidence: null, ...overrides,
  };
}

function accept(value, registrationId = registration) {
  const json = JSON.stringify(value).replaceAll("'", "''");
  return `SELECT observer_home_review.accept_live_home_signal_v1('${registrationId}','${json}'::jsonb)`;
}

function count(table) {
  return Number(psql(`SELECT count(*) FROM ${table}`));
}

try {
  const fixture = readFileSync(`${dir}isolated-schema.sql`, 'utf8');
  const source = readFileSync(`${dir}HOME-REGISTRATION-SOURCE-NOT-APPLIED.sql`, 'utf8');
  const writer = readFileSync(`${dir}ACCEPT-LIVE-HOME-SIGNAL-NOT-APPLIED.sql`, 'utf8');
  assert.equal(createHash('sha256').update(source).digest('hex'),
    'b0e313f5d76e7faf6c2d104da3873205df6974a0a3faf9d2980a280aa89cc2e5');
  assert.match(fixture, /ISOLATED_FIXTURE_ONLY/);
  assert.match(source, /NOT_APPLIED: Home registration authority/);
  assert.match(writer, /NOT_APPLIED: caller authority/);
  assert.doesNotMatch(fixture + source + writer, /^\s*(?:COMMIT|ROLLBACK)\s*;/im);
  const fixtureStart = fixture.indexOf('CREATE ROLE anon LOGIN;');
  const sourceStart = source.indexOf('CREATE SCHEMA observer_home_review;');
  const writerStart = writer.indexOf('CREATE FUNCTION observer_home_review.accept_live_home_signal_v1(');
  assert.ok(fixtureStart > 0 && sourceStart > 0 && writerStart > 0);
  assert.equal(docker(['context', 'show']).stdout.trim(), 'colima-gbi');
  assert.match(docker(['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}']).stdout.trim(), /^unix:\/\//);

  const launched = docker([
    'run', '--detach', '--rm', '--network', 'none', '--read-only',
    '--memory', '768m', '--cpus', '1', '--pids-limit', '128',
    '--user', 'postgres', '--tmpfs', '/tmp:rw,nosuid,nodev,mode=1777',
    '--entrypoint', '/bin/sh', image, '-ec',
    'initdb -D /tmp/qa-data -A trust --no-instructions >/dev/null && exec postgres -D /tmp/qa-data -c listen_addresses= -c unix_socket_directories=/tmp',
  ]);
  assert.equal(launched.status, 0, launched.stderr);
  container = launched.stdout.trim();
  assert.match(container, /^[0-9a-f]{64}$/);
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    if (docker(['exec', container, 'pg_isready', '-h', '/tmp', '-U', 'postgres']).status === 0) {
      ready = true;
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready);
  denied(fixture, /ISOLATED_FIXTURE_ONLY/);
  assert.equal(psql("SELECT count(*) FROM pg_roles WHERE rolname='anon'"), '0');
  denied(source, /NOT_APPLIED: Home registration authority/);
  assert.equal(psql("SELECT count(*) FROM pg_namespace WHERE nspname='observer_home_review'"), '0');
  psql(fixture.slice(fixtureStart));
  psql(source.slice(sourceStart));
  denied(writer, /NOT_APPLIED: caller authority/);
  assert.equal(psql("SELECT count(*) FROM pg_proc WHERE proname='accept_live_home_signal_v1'"), '0');
  psql(writer.slice(writerStart));

  psql(`INSERT INTO observer_home_review.registration_identities
    (registration_id,tenant_id,site_id,source_id,owner_profile_id)
    VALUES ('${registration}','${tenant}','${site}','${camera}','${owner}');
    INSERT INTO observer_home_review.registration_versions
    (registration_id,version,tenant_id,site_id,source_id,owner_profile_id,
     registering_actor_id,authorized_actor_id,authority_ref,qualification_audit_ref,qualified_at)
    VALUES ('${registration}',1,'${tenant}','${site}','${camera}',
      '${owner}','${owner}','${owner}','99999999-9999-4999-8999-999999999999',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',clock_timestamp()-interval '10 seconds');
    UPDATE observer_home_review.registration_identities SET current_version=1
    WHERE registration_id='${registration}';`);
  checks++;

  const first = observation('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  const firstId = psql(accept(first));
  assert.match(firstId, /^[0-9a-f-]{36}$/);
  assert.equal(count('public.observer_intelligence_signals'), 1);
  assert.equal(count('observer_home_review.event_acceptances'), 1);
  assert.equal(count('observer_home_review.event_bindings'), 1);
  assert.equal(count('public.observer_correlated_events'), 1);
  assert.equal(psql(accept(first)), firstId);
  assert.equal(count('observer_home_review.registration_audit'), 2);
  checks++;

  psql(`UPDATE public.observer_correlated_event_links SET observer_site_id='${otherSite}'
    WHERE source_type='observer_intelligence_signal' AND source_id='${firstId}';`);
  denied(accept(first), /HOME_INCIDENT_SCOPE_UNVERIFIED/);
  psql(`UPDATE public.observer_correlated_event_links SET observer_site_id='${site}'
    WHERE source_type='observer_intelligence_signal' AND source_id='${firstId}';`);
  assert.equal(psql(accept(first)), firstId);
  checks++;

  const concurrent = observation('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  const raced = await Promise.all([psqlAsync(accept(concurrent)), psqlAsync(accept(concurrent))]);
  assert.equal(raced[0], raced[1]);
  assert.equal(count('observer_home_review.event_acceptances'), 2);
  assert.equal(count('observer_home_review.event_bindings'), 2);
  checks++;

  denied(accept(observation('dddddddd-dddd-4ddd-8ddd-dddddddddddd', { siteId: otherSite })),
    /HOME_REGISTRATION_SCOPE_OR_TRANSFER_UNVERIFIED/);
  denied(accept(observation('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', { cameraId: '77777777-7777-4777-8777-777777777777' })),
    /HOME_REGISTRATION_SCOPE_OR_TRANSFER_UNVERIFIED/);
  denied(accept(observation('ffffffff-ffff-4fff-8fff-ffffffffffff'),
    'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'), /HOME_REGISTRATION_SCOPE_OR_TRANSFER_UNVERIFIED/);
  assert.equal(count('observer_home_review.event_acceptances'), 2);
  checks++;

  const stale = observation('11111111-2222-4333-8444-555555555555', {
    occurredAt: new Date(Date.now() - 90_000).toISOString(),
  });
  denied(accept(stale), /HOME_EVENT_TIME_UNVERIFIED/);
  const conflicting = { ...first, streamId: 'wrong-stream' };
  denied(accept(conflicting), /HOME_EVENT_REPLAY_CONFLICT_OR_UNRECEIPTED/);
  checks++;

  const noReceipt = observation('22222222-3333-4444-8555-666666666666');
  psql(`INSERT INTO public.observer_intelligence_signals
    (source_type,source_id,signal_type,observer_site_id,severity,confidence,
     created_at,review_status,human_review_required,parent_visible,metadata)
    VALUES ('system','${noReceipt.sourceId}','ai_camera','${site}','medium',0.8123,
    now(),'needs_review',true,false,'{}')`);
  denied(accept(noReceipt), /HOME_EVENT_REPLAY_CONFLICT_OR_UNRECEIPTED/);
  checks++;

  psql(`CREATE FUNCTION public.qa_reject_accept_audit() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.action='ACCEPTED' THEN RAISE EXCEPTION 'synthetic mandatory audit failure'; END IF;
    RETURN NEW; END $$;
    CREATE TRIGGER qa_reject_accept_audit BEFORE INSERT ON observer_home_review.registration_audit
    FOR EACH ROW EXECUTE FUNCTION public.qa_reject_accept_audit();`);
  const before = count('public.observer_intelligence_signals');
  denied(accept(observation('33333333-4444-4555-8666-777777777777')),
    /synthetic mandatory audit failure/);
  assert.equal(count('public.observer_intelligence_signals'), before);
  assert.equal(count('observer_home_review.event_acceptances'), 2);
  psql('DROP TRIGGER qa_reject_accept_audit ON observer_home_review.registration_audit; DROP FUNCTION public.qa_reject_accept_audit();');
  checks++;

  psql(`CREATE FUNCTION public.qa_wrong_link_site() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN NEW.observer_site_id='${otherSite}'; RETURN NEW; END $$;
    CREATE TRIGGER qa_wrong_link_site BEFORE INSERT ON public.observer_correlated_event_links
    FOR EACH ROW EXECUTE FUNCTION public.qa_wrong_link_site();`);
  denied(accept(observation('44444444-5555-4666-8777-888888888888')),
    /HOME_INCIDENT_SCOPE_UNVERIFIED/);
  assert.equal(count('public.observer_intelligence_signals'), before);
  psql('DROP TRIGGER qa_wrong_link_site ON public.observer_correlated_event_links; DROP FUNCTION public.qa_wrong_link_site();');
  checks++;

  psql(`UPDATE public.observer_sites SET digital_observer_organization_id='${otherTenant}'
    WHERE id='${site}';`);
  denied(accept(observation('55555555-6666-4777-8888-999999999999')),
    /HOME_CURRENT_SOURCE_SCOPE_UNVERIFIED/);
  assert.equal(psql(accept(first)), firstId); // existing receipt survives current mapping change
  psql(`UPDATE public.observer_sites SET digital_observer_organization_id='${tenant}'
    WHERE id='${site}';`);
  checks++;

  psql(`UPDATE public.digital_observer_camera_sources SET observer_site_id='${otherSite}'
    WHERE id='${camera}';`);
  denied(accept(observation('77777777-8888-4999-8aaa-bbbbbbbbbbbb')),
    /HOME_CURRENT_SOURCE_SCOPE_UNVERIFIED/);
  assert.equal(psql(accept(first)), firstId);
  psql(`UPDATE public.digital_observer_camera_sources SET observer_site_id='${site}'
    WHERE id='${camera}';`);
  psql(`UPDATE public.observer_sites SET digital_observer_organization_id=NULL
    WHERE id='${site}';`);
  denied(accept(observation('88888888-9999-4aaa-8bbb-cccccccccccc')),
    /HOME_CURRENT_SOURCE_SCOPE_UNVERIFIED/);
  psql(`UPDATE public.observer_sites SET digital_observer_organization_id='${tenant}'
    WHERE id='${site}';`);
  checks++;

  denied(accept(observation('99999999-aaaa-4bbb-8ccc-dddddddddddd', {
    streamId: 'x'.repeat(5000),
  })), /HOME_OBSERVATION_INVALID/);

  psql(`INSERT INTO observer_home_review.registration_versions
    (registration_id,version,tenant_id,site_id,source_id,owner_profile_id,
     registering_actor_id,authorized_actor_id,authority_ref,qualification_audit_ref)
    VALUES ('${registration}',2,'${tenant}','${site}','${camera}',
      '${owner}','${owner}','${owner}','66666666-7777-4888-8999-aaaaaaaaaaaa',
      '77777777-8888-4999-8aaa-bbbbbbbbbbbb');
    UPDATE observer_home_review.registration_identities SET current_version=2
      WHERE registration_id='${registration}';`);
  denied(accept(observation('66666666-7777-4888-8999-aaaaaaaaaaaa')),
    /HOME_REGISTRATION_SCOPE_OR_TRANSFER_UNVERIFIED/);
  assert.equal(psql(accept(first)), firstId);
  checks++;

  denied(accept(first), /permission denied/, 'anon');
  denied(accept(first), /permission denied/, 'authenticated');
  denied('SELECT count(*) FROM observer_home_review.event_acceptances',
    /permission denied/, 'service_role');
  checks++;

  console.log(`PASS: ${checks} isolated transaction/negative assertions; cross-Site false binding denied by writer. Conditional proposal remains NOT READY TO APPLY.`);
} finally {
  if (container) {
    const stopped = docker(['stop', '--time', '3', container]);
    if (stopped.status !== 0) {
      process.exitCode = 1;
      console.error('FAIL: disposable container cleanup requires attention');
    }
  }
}
