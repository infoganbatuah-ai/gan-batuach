// A bounded, local-only preview of one clean feature commit. It is never the
// canonical Development Product and must not be used for release evidence.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';
import { integrationEnvironment } from './integration-environment.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const projectRoot = resolve(root, '../..');
const canonicalRoot = resolve(projectRoot, 'worktrees/development-integration');
const port = 3100;
const fullSha = /^[0-9a-f]{40}$/;

export function featureRuntimePaths(head) {
  const runtimeRoot = resolve('/Volumes/DIGITAL_OBSERVER/Development/gan-batuach', 'feature-qa', head);
  const home = resolve(runtimeRoot, 'home');
  return { runtimeRoot, home, temp: resolve(home, 'tmp') };
}

function inside(parent, child) {
  const path = relative(parent, child);
  return path !== '' && path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

function assertUnaliasedAncestors(path) {
  let current = path;
  while (current !== dirname(current)) {
    try {
      if (lstatSync(current).isSymbolicLink()) throw Error('Feature QA path has a symbolic-link ancestor.');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    current = dirname(current);
  }
}

export function validateFeatureQaIdentity({ expectedSha, head, branch, dirty, sparse, featureRoot, project, canonical, output, home, temp }) {
  if (!fullSha.test(expectedSha ?? '') || head !== expectedSha) throw Error('Expected full feature SHA does not equal HEAD.');
  if (!/^codex\/[a-z0-9][a-z0-9._/-]*$/.test(branch ?? '') || branch.includes('..') || branch.endsWith('/')) {
    throw Error('Feature QA requires one codex/ branch.');
  }
  if (dirty || sparse) throw Error('Feature QA requires a clean, complete owned worktree.');
  if (!inside(resolve(project, 'worktrees'), featureRoot) || featureRoot === canonical) throw Error('Feature QA must use an isolated project worktree.');
  if (output !== resolve(featureRoot, '.next') || inside(canonical, output) || output === resolve(canonical, '.next')) {
    throw Error('Feature QA output must be the feature worktree cache only.');
  }
  if (!inside(resolve('/Volumes/DIGITAL_OBSERVER/Development/gan-batuach'), home)
    || !inside(home, temp) || inside(canonical, home) || inside(featureRoot, home)) {
    throw Error('Feature QA home/temp must be isolated on the external Development volume.');
  }
}

export function validateFeatureQaPreflight(input) {
  validateFeatureQaIdentity(input);
  const { local, head } = input;
  if (local.PRODUCTION_ACTIVATION_APPROVED || local.LIVE_ACTIVATION_CONFIRM || local.NODE_OPTIONS) {
    throw Error('Live activation or arbitrary Node options are forbidden.');
  }
  // The shared canonical helper rejects unapproved variables and non-loopback URLs.
  integrationEnvironment(local, { sha: head, timestamp: 'preflight', system: {} });
}

export function verifyLockedDependencies(featureLock, canonicalLock, installedLock) {
  if (featureLock !== canonicalLock) throw Error('Feature and canonical package locks differ.');
  const expected = JSON.parse(featureLock).packages;
  const installed = JSON.parse(installedLock).packages;
  if (!expected || !installed || !installed['node_modules/next']) throw Error('Locked Next dependency is unavailable.');
  for (const [name, metadata] of Object.entries(installed)) {
    if (!name || !name.startsWith('node_modules/')) continue;
    if (!expected[name] || expected[name].version !== metadata.version) throw Error(`Installed dependency differs from lock: ${name}`);
  }
  for (const name of ['next', 'react', 'react-dom', 'typescript', '@types/node', '@types/react']) {
    if (!installed[`node_modules/${name}`] || !expected[`node_modules/${name}`]) throw Error(`Required locked dependency missing: ${name}`);
  }
  for (const name of Object.keys({ ...expected['']?.dependencies, ...expected['']?.devDependencies })) {
    if (!installed[`node_modules/${name}`]) throw Error(`Required locked dependency missing: ${name}`);
  }
}

export function assertOwnedDependencyDirectory(featureRoot, dependencyRoot) {
  if (dependencyRoot !== resolve(featureRoot, 'node_modules')
    || !lstatSync(dependencyRoot).isDirectory()
    || realpathSync(dependencyRoot) !== dependencyRoot) {
    throw Error('Feature dependencies must be an ordinary directory owned by this worktree.');
  }
}

export function validateDatabaseConfig(databaseConfig) {
  const isolatedRoot = resolve('/Volumes/DIGITAL_OBSERVER/Development/gan-batuach');
  if (databaseConfig.environment !== 'DEVELOPMENT / INTEGRATION'
    || databaseConfig.productionAllowed !== false
    || databaseConfig.projectId !== 'gan-batuach-integration'
    || (databaseConfig.runtimeRoot !== isolatedRoot && !inside(isolatedRoot, databaseConfig.runtimeRoot))) {
    throw Error('Canonical configuration does not identify the isolated local Development database.');
  }
}

export function selectFeatureBackendConfig(configured) {
  const approvedConfigKeys = new Set(['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'MANAGEMENT_INVITATION_SECRET']);
  if (Object.keys(configured).some(key => !approvedConfigKeys.has(key))) throw Error('Development configuration contains an unapproved variable.');
  return {
    NEXT_PUBLIC_SUPABASE_URL: configured.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: configured.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

function git(...args) {
  return execFileSync('git', args, {
    cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
  }).trim();
}

function assertOrdinaryFile(path) {
  if (!lstatSync(path).isFile()) throw Error(`Expected an ordinary local configuration file: ${path}`);
}

async function assertPortFree() {
  await new Promise((accept, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => server.close(accept));
  });
}

async function main() {
  const expectedSha = process.argv[2];
  const expectedBranch = process.argv[3];
  const head = git('rev-parse', 'HEAD');
  const branch = git('branch', '--show-current');
  if (branch !== expectedBranch) throw Error('Expected feature branch does not equal checked-out branch.');
  if (realpathSync(root) !== root || realpathSync(canonicalRoot) !== canonicalRoot) throw Error('Worktree path alias is forbidden.');
  if (git('rev-parse', '--show-toplevel') !== root) throw Error('Feature worktree root mismatch.');
  if (git('branch', '--show-current') === 'integration/development') throw Error('Use dev:integration for the canonical Product.');
  const dirty = Boolean(git('status', '--porcelain=v1', '-uall'));
  const sparse = git('ls-files', '-v').split('\n').some(line => line.startsWith('S '));
  const output = resolve(root, '.next');
  const { runtimeRoot, home, temp } = featureRuntimePaths(head);
  validateFeatureQaIdentity({ expectedSha, head, branch, dirty, sparse, featureRoot: root,
    project: projectRoot, canonical: canonicalRoot, output, home, temp });
  for (const path of [root, canonicalRoot, output, runtimeRoot, home, temp]) assertUnaliasedAncestors(path);
  const canonicalConfig = resolve(canonicalRoot, 'config/integration.local.env');
  const databaseConfigPath = resolve(canonicalRoot, 'development/database/environment.json');
  assertUnaliasedAncestors(databaseConfigPath);
  assertUnaliasedAncestors(canonicalConfig);
  assertOrdinaryFile(databaseConfigPath);
  const databaseConfig = JSON.parse(readFileSync(databaseConfigPath, 'utf8'));
  validateDatabaseConfig(databaseConfig);
  if (!existsSync(canonicalConfig)) throw Error('Verified isolated Development configuration is unavailable.');
  assertOrdinaryFile(canonicalConfig);
  if (statSync(canonicalConfig).mode & 0o077) throw Error('Development private configuration must be owner-only.');
  const configured = parseEnv(readFileSync(canonicalConfig, 'utf8'));
  const local = selectFeatureBackendConfig(configured);
  validateFeatureQaPreflight({ expectedSha, head, branch, dirty, sparse, featureRoot: root,
    project: projectRoot, canonical: canonicalRoot, output, home, temp, local });
  for (const name of ['.env', '.env.local', '.env.development', '.env.development.local', '.env.production', '.env.production.local']) {
    if (existsSync(resolve(root, name))) throw Error(`Feature tree contains forbidden ${name}.`);
  }
  if (existsSync(output) && !lstatSync(output).isDirectory()) throw Error('Feature output cache is not a directory.');
  const featureModules = resolve(root, 'node_modules');
  assertOwnedDependencyDirectory(root, featureModules);
  verifyLockedDependencies(readFileSync(resolve(root, 'package-lock.json'), 'utf8'),
    readFileSync(resolve(canonicalRoot, 'package-lock.json'), 'utf8'),
    readFileSync(resolve(featureModules, '.package-lock.json'), 'utf8'));
  if (existsSync(runtimeRoot) && !lstatSync(runtimeRoot).isDirectory()) throw Error('Feature runtime path is not a directory.');
  mkdirSync(home, { recursive: true, mode: 0o700 });
  mkdirSync(temp, { recursive: true, mode: 0o700 });
  if (realpathSync(home) !== home || realpathSync(temp) !== temp) throw Error('Feature runtime path alias is forbidden.');
  if ((statSync(home).mode & 0o077) || (statSync(temp).mode & 0o077)) throw Error('Feature runtime home and temp must be owner-only.');
  const env = integrationEnvironment(local, { sha: head, timestamp: new Date().toISOString(), system: process.env });
  env.GB_FEATURE_QA = 'true';
  env.HOME = home;
  env.TMPDIR = temp;
  try {
    execFileSync(process.execPath, [resolve(root, 'scripts/development/check-baseline-drift.mjs')], {
      cwd: root, stdio: 'pipe', timeout: 30_000, env,
    });
  } catch {
    throw Error('Local Development schema/history drift verification failed.');
  }
  const health = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`, {
    headers: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }, signal: AbortSignal.timeout(5000), redirect: 'error',
  });
  if (!health.ok) throw Error('Isolated local Supabase health failed.');
  await assertPortFree();
  console.log(`FEATURE QA / NOT CANONICAL PRODUCT ${head}\nhttp://127.0.0.1:${port}\nBackend: LOCAL_SUPABASE`);
  // --webpack is the installed Next CLI's explicit non-Turbopack dev mode.
  const child = spawn(process.execPath, [resolve(featureModules, 'next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: root, env, stdio: 'inherit', detached: true,
  });
  let stopping = false;
  const stop = () => {
    if (stopping || !child.pid) return;
    stopping = true;
    try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); }
    const force = setTimeout(() => { try { process.kill(-child.pid, 'SIGKILL'); } catch {} }, 5000);
    force.unref();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  child.once('error', error => { console.error(`Feature QA startup failed: ${error.message}`); process.exitCode = 1; });
  child.once('exit', code => { process.exitCode = code ?? 1; });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error(`Feature QA BLOCKED: ${error.message}`); process.exitCode = 1; });
}
