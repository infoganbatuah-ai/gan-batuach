#!/usr/bin/env node
// Diagnostic only: disposable PostgreSQL, no host mounts, network or TCP listener.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));
const image = 'public.ecr.aws/supabase/postgres:17.6.1.167';
let container;
let checks = 0;

function docker(args, input) {
  const result = spawnSync('docker', args, {
    input, encoding: 'utf8', timeout: 20000, maxBuffer: 2000000,
  });
  if (result.error) throw result.error;
  return result;
}

function query(statement, role = 'postgres') {
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

const scope = {
  owner: '11111111-1111-4111-8111-111111111111',
  tenant: '22222222-2222-4222-8222-222222222222',
  otherTenant: '33333333-3333-4333-8333-333333333333',
  site: '44444444-4444-4444-8444-444444444444',
  otherSite: '55555555-5555-4555-8555-555555555555',
  source: '66666666-6666-4666-8666-666666666666',
  signal: '88888888-8888-4888-8888-888888888888',
  otherSignal: '99999999-9999-4999-8999-999999999999',
  historical: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  registration: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  authority: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
};

try {
  const fixture = readFileSync(`${dir}isolated-schema.sql`, 'utf8');
  const proposal = readFileSync(`${dir}HOME-REGISTRATION-SOURCE-NOT-APPLIED.sql`, 'utf8');
  assert.equal(createHash('sha256').update(proposal).digest('hex'),
    'b0e313f5d76e7faf6c2d104da3873205df6974a0a3faf9d2980a280aa89cc2e5',
    'source proposal changed without provenance review');
  assert.match(fixture, /ISOLATED_FIXTURE_ONLY/);
  assert.match(proposal, /NOT_APPLIED: Home registration authority/);
  assert.doesNotMatch(fixture + proposal, /^\s*(?:COMMIT|ROLLBACK)\s*;/im);
  const fixtureStart = fixture.indexOf('CREATE ROLE anon LOGIN;');
  const proposalStart = proposal.indexOf('CREATE SCHEMA observer_home_review;');
  assert.ok(fixtureStart > 0 && proposalStart > 0, 'guarded source missing');
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
  assert.ok(ready, 'disposable PostgreSQL unavailable');
  denied(fixture, /ISOLATED_FIXTURE_ONLY/);
  assert.equal(query("SELECT count(*) FROM pg_roles WHERE rolname='anon'"), '0');
  denied(proposal, /NOT_APPLIED: Home registration authority/);
  assert.equal(query("SELECT count(*) FROM pg_namespace WHERE nspname='observer_home_review'"), '0');
  query(fixture.slice(fixtureStart));
  query(proposal.slice(proposalStart));

  query(`INSERT INTO observer_home_review.registration_identities
    (registration_id, tenant_id, site_id, source_id, owner_profile_id)
    VALUES ('${scope.registration}','${scope.tenant}','${scope.site}','${scope.source}','${scope.owner}');
    INSERT INTO observer_home_review.registration_versions
    (registration_id, version, tenant_id, site_id, source_id, owner_profile_id,
     registering_actor_id, authorized_actor_id, authority_ref, qualification_audit_ref)
    VALUES ('${scope.registration}',1,'${scope.tenant}','${scope.site}','${scope.source}',
      '${scope.owner}','${scope.owner}','${scope.owner}','${scope.authority}',
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
    UPDATE observer_home_review.registration_identities SET current_version=1
      WHERE registration_id='${scope.registration}';`);
  checks++;

  query(`INSERT INTO observer_home_review.event_acceptances
    (event_id, tenant_id, site_id, source_id, owner_profile_id, registration_id,
     registration_version, authority_ref, acceptance_ref, observation_snapshot)
    VALUES ('${scope.signal}','${scope.tenant}','${scope.site}','${scope.source}',
      '${scope.owner}','${scope.registration}',1,'${scope.authority}',
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','{}');`);
  const firstBinding = query(`SELECT observer_home_review.bind_accepted_event_v1('${scope.signal}')`);
  assert.equal(query(`SELECT observer_home_review.bind_accepted_event_v1('${scope.signal}')`), firstBinding);
  assert.equal(query(`SELECT count(*) FROM observer_home_review.registration_audit WHERE action='BOUND'`), '1');
  checks++;

  query(`INSERT INTO observer_home_review.registration_versions
    (registration_id, version, tenant_id, site_id, source_id, owner_profile_id,
     registering_actor_id, authorized_actor_id, authority_ref, qualification_audit_ref)
    VALUES ('${scope.registration}',2,'${scope.tenant}','${scope.site}',
      '${scope.source}','${scope.owner}','${scope.owner}','${scope.owner}',
      '10101010-1010-4010-8010-101010101010',
      '20202020-2020-4020-8020-202020202020');
    UPDATE observer_home_review.registration_identities SET current_version=2
      WHERE registration_id='${scope.registration}';`);
  assert.equal(query(`SELECT registration_version FROM observer_home_review.event_bindings
    WHERE event_id='${scope.signal}'`), '1');
  checks++;

  denied(`SELECT observer_home_review.bind_accepted_event_v1('${scope.historical}')`, /HOME_EVENT_ACCEPTANCE_UNVERIFIED/);
  denied(`SELECT observer_home_review.bind_accepted_event_v1('${scope.signal}')`, /permission denied/, 'anon');
  denied('SELECT count(*) FROM observer_home_review.event_acceptances', /permission denied/, 'authenticated');
  denied(`UPDATE observer_home_review.event_acceptances SET site_id='${scope.otherSite}' WHERE event_id='${scope.signal}'`, /HOME_REGISTRATION_HISTORY_IMMUTABLE/);

  denied(`INSERT INTO observer_home_review.registration_versions
    (registration_id, version, tenant_id, site_id, source_id, owner_profile_id,
     registering_actor_id, authorized_actor_id, authority_ref, qualification_audit_ref)
    VALUES ('${scope.registration}',3,'${scope.otherTenant}','${scope.otherSite}',
      '${scope.source}','${scope.owner}','${scope.owner}','${scope.owner}',
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
      '11111111-2222-4333-8444-555555555555')`, /foreign key constraint/);
  denied(`INSERT INTO observer_home_review.registration_identities
    (registration_id, tenant_id, site_id, source_id, owner_profile_id)
    VALUES ('22222222-3333-4444-8555-666666666666','${scope.otherTenant}',
      '${scope.otherSite}','${scope.source}','${scope.owner}')`, /unique constraint/);

  // Expected diagnostic failure of the proposed integrity contract: a receipt
  // can bind a different Signal's Site/Source because the FK checks only its ID.
  query(`INSERT INTO observer_home_review.event_acceptances
    (event_id, tenant_id, site_id, source_id, owner_profile_id, registration_id,
     registration_version, authority_ref, acceptance_ref, observation_snapshot)
    VALUES ('${scope.otherSignal}','${scope.tenant}','${scope.site}','${scope.source}',
      '${scope.owner}','${scope.registration}',1,'${scope.authority}',
      'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee','{}')`);
  assert.match(query(`SELECT observer_home_review.bind_accepted_event_v1('${scope.otherSignal}')`), /^[0-9a-f-]{36}$/);
  assert.equal(query(`SELECT (b.site_id <> s.observer_site_id)::text
    FROM observer_home_review.event_bindings b
    JOIN public.observer_intelligence_signals s ON s.id=b.event_id
    WHERE b.event_id='${scope.otherSignal}'`), 'true');
  checks++;

  console.log(`PASS: ${checks} isolated diagnostic checks; historical receipt absent denies, direct roles deny, cross-Site false binding REPRODUCED. NOT SAFE TO APPLY.`);
} finally {
  if (container) {
    const stopped = docker(['stop', '--time', '3', container]);
    if (stopped.status !== 0) {
      process.exitCode = 1;
      console.error('FAIL: isolated container cleanup requires attention');
    }
  }
}
