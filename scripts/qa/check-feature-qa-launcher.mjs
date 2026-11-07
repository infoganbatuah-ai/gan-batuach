import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { resolve } from 'node:path';
import { assertOwnedDependencyDirectory, featureRuntimePaths, selectFeatureBackendConfig, validateDatabaseConfig, validateFeatureQaPreflight, verifyLockedDependencies } from '../development/start-feature-qa.mjs';

const sha = 'a'.repeat(40);
const project = '/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach';
const canonical = resolve(project, 'worktrees/development-integration');
const featureRoot = resolve(project, 'worktrees/feature-fixture');
const { home, temp } = featureRuntimePaths(sha);
const valid = () => ({
  expectedSha: sha, head: sha, branch: 'codex/feature-fixture', dirty: false, sparse: false,
  featureRoot, project, canonical, output: resolve(featureRoot, '.next'),
  home, temp,
  local: { NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:55421/', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'synthetic-public-key' },
});

test('one clean complete feature commit with isolated output and loopback backend is eligible', () => {
  assert.doesNotThrow(() => validateFeatureQaPreflight(valid()));
  assert.equal(temp, resolve(home, 'tmp'));
  assert.throws(() => validateFeatureQaPreflight({ ...valid(), temp: resolve(home, '..', 'tmp') }), /home\/temp must be isolated/);
});

test('feature dependencies must be owned ordinary directory, never a shared symlink', () => {
  const fixture = mkdtempSync(resolve(tmpdir(), 'gb-feature-qa-'));
  try {
    const owned = resolve(fixture, 'owned');
    const linked = resolve(fixture, 'linked');
    mkdirSync(owned);
    mkdirSync(resolve(owned, 'node_modules'));
    mkdirSync(linked);
    symlinkSync(resolve(owned, 'node_modules'), resolve(linked, 'node_modules'));
    assert.doesNotThrow(() => assertOwnedDependencyDirectory(owned, resolve(owned, 'node_modules')));
    assert.throws(() => assertOwnedDependencyDirectory(linked, resolve(linked, 'node_modules')), /ordinary directory/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('wrong or abbreviated SHA and non-feature branch fail closed', () => {
  assert.throws(() => validateFeatureQaPreflight({ ...valid(), expectedSha: 'a'.repeat(8) }), /full feature SHA/);
  assert.throws(() => validateFeatureQaPreflight({ ...valid(), expectedSha: 'b'.repeat(40) }), /does not equal HEAD/);
  for (const branch of ['main', 'integration/development', 'codex/../escape', 'codex/']) {
    assert.throws(() => validateFeatureQaPreflight({ ...valid(), branch }), /codex\/ branch/);
  }
});

test('dirty or sparse checkout and canonical worktree fail closed', () => {
  assert.throws(() => validateFeatureQaPreflight({ ...valid(), dirty: true }), /clean, complete/);
  assert.throws(() => validateFeatureQaPreflight({ ...valid(), sparse: true }), /clean, complete/);
  assert.throws(() => validateFeatureQaPreflight({ ...valid(), featureRoot: canonical, output: resolve(canonical, '.next') }), /isolated project worktree/);
});

test('remote backend, unapproved environment and live activation fail closed', () => {
  assert.throws(() => validateFeatureQaPreflight({ ...valid(), local: { ...valid().local, NEXT_PUBLIC_SUPABASE_URL: 'https://example.org/' } }), /loopback|HTTP loopback/);
  assert.throws(() => validateFeatureQaPreflight({ ...valid(), local: { ...valid().local, UNAPPROVED_SETTING: 'yes' } }), /Unapproved integration variable/);
  assert.throws(() => validateFeatureQaPreflight({ ...valid(), local: { ...valid().local, PRODUCTION_ACTIVATION_APPROVED: 'true' } }), /Live activation/);
  assert.throws(() => validateFeatureQaPreflight({ ...valid(), local: { ...valid().local, NODE_OPTIONS: '--require=unsafe' } }), /Live activation/);
});

test('database configuration must be the named local isolated project', () => {
  const config = { environment: 'DEVELOPMENT / INTEGRATION', productionAllowed: false,
    projectId: 'gan-batuach-integration', runtimeRoot: '/Volumes/DIGITAL_OBSERVER/Development/gan-batuach/runtime' };
  assert.doesNotThrow(() => validateDatabaseConfig(config));
  assert.doesNotThrow(() => validateDatabaseConfig({ ...config, runtimeRoot: '/Volumes/DIGITAL_OBSERVER/Development/gan-batuach' }));
  assert.throws(() => validateDatabaseConfig({ ...config, productionAllowed: true }), /isolated local Development/);
  assert.throws(() => validateDatabaseConfig({ ...config, runtimeRoot: '/tmp/production' }), /isolated local Development/);
});

test('feature child receives public loopback config, never service or invitation secrets', () => {
  const selected = selectFeatureBackendConfig({ ...valid().local,
    SUPABASE_SERVICE_ROLE_KEY: 'synthetic-server-secret', MANAGEMENT_INVITATION_SECRET: 'synthetic-invitation-secret' });
  assert.deepEqual(Object.keys(selected).sort(), ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL']);
  assert.throws(() => selectFeatureBackendConfig({ ...valid().local, DIGITAL_OBSERVER_PUSH42_QA_CREDENTIAL: 'synthetic' }), /unapproved variable/);
});

test('canonical output and non-isolated temp/home fail closed', () => {
  assert.throws(() => validateFeatureQaPreflight({ ...valid(), output: resolve(canonical, '.next') }), /feature worktree cache/);
  assert.throws(() => validateFeatureQaPreflight({ ...valid(), home: resolve(featureRoot, 'private') }), /isolated on the external/);
  assert.throws(() => validateFeatureQaPreflight({ ...valid(), temp: resolve(canonical, 'tmp') }), /isolated on the external/);
});

test('existing dependency inventory must match the identical pinned lock', () => {
  const locked = JSON.stringify({ packages: {
    '': {}, 'node_modules/next': { version: '16.4.3' },
    'node_modules/react': { version: '19.2.0' }, 'node_modules/react-dom': { version: '19.2.0' },
    'node_modules/typescript': { version: '5.9.3' }, 'node_modules/@types/node': { version: '22.0.0' },
    'node_modules/@types/react': { version: '19.0.0' },
  } });
  const installed = JSON.stringify({ packages: Object.fromEntries(Object.entries(JSON.parse(locked).packages).filter(([name]) => name)) });
  assert.doesNotThrow(() => verifyLockedDependencies(locked, locked, installed));
  assert.throws(() => verifyLockedDependencies(locked, `${locked} `, installed), /locks differ/);
  const wrong = JSON.stringify({ packages: { ...JSON.parse(installed).packages, 'node_modules/react': { version: '18.0.0' } } });
  assert.throws(() => verifyLockedDependencies(locked, locked, wrong), /differs from lock/);
  assert.throws(() => verifyLockedDependencies(locked, locked, JSON.stringify({ packages: { 'node_modules/next': { version: '16.4.3' } } })), /Required locked dependency missing/);
});
