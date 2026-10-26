import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const inventoryPath = resolve(root, 'review-only/push50-evidence-preparation/LICENSE-INVENTORY.json');
const sourcePaths = [
  'package.json',
  'package-lock.json',
  'vendor/braces/package.json',
  'vendor/braces/LICENSE',
  'vendor/braces/PROVENANCE.md',
  'services/connector-desktop/THIRD_PARTY_NOTICES.txt',
];

function git(...args) {
  const result = spawnSync('git', args, { cwd: root, encoding: null, maxBuffer: 2 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`git ${args[0]} failed: ${result.stderr.toString().trim()}`);
  return result.stdout;
}

function trackedBytes(path) {
  assert.match(path, /^[A-Za-z0-9][A-Za-z0-9_./-]*$/);
  assert.ok(!path.split('/').includes('..'));
  return git('show', `HEAD:${path}`);
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fromGitJson = (path) => JSON.parse(trackedBytes(path).toString('utf8'));

function packageName(path) {
  const marker = 'node_modules/';
  const at = path.lastIndexOf(marker);
  assert.ok(at >= 0, `not a locked package path: ${path}`);
  const name = path.slice(at + marker.length);
  assert.match(name, /^(@[^/]+\/)?[^/]+$/, `unexpected locked package path: ${path}`);
  return name;
}

function build(sourceCommit) {
  assert.match(sourceCommit, /^[a-f0-9]{40}$/, 'missing source commit');
  git('merge-base', '--is-ancestor', sourceCommit, 'HEAD');
  const tracked = git('ls-files', '-z').toString('utf8').split('\0').filter(Boolean);
  const lockfiles = tracked.filter((path) => /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?)$/.test(path));
  assert.deepEqual(lockfiles, ['package-lock.json'], 'additional lockfile needs explicit inventory support');
  const packageJson = fromGitJson('package.json');
  const lock = fromGitJson('package-lock.json');
  const vendor = fromGitJson('vendor/braces/package.json');
  assert.equal(lock.lockfileVersion, 3, 'unsupported npm lockfile version');
  const rootPackage = lock.packages?.[''];
  assert.ok(rootPackage, 'lockfile root package absent');
  for (const kind of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    assert.deepEqual(rootPackage[kind] ?? {}, packageJson[kind] ?? {}, `package.json ${kind} differs from lockfile`);
  }
  const sources = Object.fromEntries(sourcePaths.map((path) => [path, { sha256: sha256(trackedBytes(path)) }]));
  for (const path of sourcePaths) {
    assert.equal(sha256(git('show', `${sourceCommit}:${path}`)), sources[path].sha256, `source changed after pinned commit: ${path}`);
  }
  const packages = Object.entries(lock.packages)
    .filter(([path]) => path !== '')
    .sort(([a], [b]) => a.localeCompare(b, 'en'))
    .map(([path, metadata]) => {
      const localLinkTarget = path === 'vendor/braces';
      const name = localLinkTarget ? vendor.name : packageName(path);
      const rootPath = path === `node_modules/${name}`;
      const directness = localLinkTarget
        ? 'LOCAL_LINK_TARGET'
        : rootPath && Object.hasOwn(rootPackage.dependencies ?? {}, name)
        ? 'DIRECT_RUNTIME'
        : rootPath && Object.hasOwn(rootPackage.devDependencies ?? {}, name)
          ? 'DIRECT_DEV'
          : rootPath && Object.hasOwn(rootPackage.optionalDependencies ?? {}, name)
            ? 'DIRECT_OPTIONAL'
            : 'INDIRECT_LOCKED';
      const vendoredBraces = path === 'node_modules/braces' && metadata.link === true && metadata.resolved === 'vendor/braces';
      if (localLinkTarget) {
        assert.equal(metadata.version, vendor.version, 'vendored link target version drift');
        assert.equal(metadata.license, vendor.license, 'vendored link target license drift');
      }
      const version = vendoredBraces ? vendor.version : metadata.version ?? null;
      const licenseMetadata = vendoredBraces ? vendor.license ?? null : metadata.license ?? null;
      assert.ok(version === null || typeof version === 'string', `unexpected version: ${path}`);
      assert.ok(licenseMetadata === null || typeof licenseMetadata === 'string', `unexpected license metadata: ${path}`);
      return {
        path,
        name,
        version,
        directness,
        licenseMetadata,
        metadataSource: vendoredBraces ? 'vendor/braces/package.json' : 'package-lock.json',
        noticePath: vendoredBraces || localLinkTarget ? 'vendor/braces/LICENSE' : null,
        reviewStatus: licenseMetadata ? 'DECLARED_METADATA_NOT_LEGALLY_REVIEWED' : 'UNVERIFIED',
      };
    });
  const notices = trackedBytes('services/connector-desktop/THIRD_PARTY_NOTICES.txt').toString('utf8');
  const noticeNames = ['Node.js', 'FFmpeg / FFprobe', 'ONNX Runtime', 'ONNX Runtime JavaScript packages'];
  const connectorComponents = noticeNames.map((name) => {
    const line = notices.split('\n').find((value) => value.startsWith(`${name} — `));
    assert.ok(line, `connector notice missing ${name}`);
    return {
      name,
      version: null,
      noticePath: 'services/connector-desktop/THIRD_PARTY_NOTICES.txt',
      noticeStatement: line,
      reviewStatus: 'UNVERIFIED_EXACT_BINARY_AND_REDISTRIBUTION_TERMS',
    };
  });
  const counts = {
    lockedPackages: packages.length,
    directRuntime: packages.filter((p) => p.directness === 'DIRECT_RUNTIME').length,
    directDev: packages.filter((p) => p.directness === 'DIRECT_DEV').length,
    directOptional: packages.filter((p) => p.directness === 'DIRECT_OPTIONAL').length,
    indirectLocked: packages.filter((p) => p.directness === 'INDIRECT_LOCKED').length,
    localLinkTargets: packages.filter((p) => p.directness === 'LOCAL_LINK_TARGET').length,
    rawLockMissingLicenseMetadata: Object.entries(lock.packages).filter(([path, p]) => path && !p.license).length,
    missingLicenseMetadata: packages.filter((p) => p.licenseMetadata === null).length,
    noTrackedPerPackageNotice: packages.filter((p) => p.noticePath === null).length,
    connectorNoticeComponents: connectorComponents.length,
  };
  assert.equal(counts.directRuntime, Object.keys(rootPackage.dependencies ?? {}).length, 'runtime direct dependency not classified');
  assert.equal(counts.directDev, Object.keys(rootPackage.devDependencies ?? {}).length, 'Development direct dependency not classified');
  assert.equal(counts.directOptional, Object.keys(rootPackage.optionalDependencies ?? {}).length, 'optional direct dependency not classified');
  assert.equal(counts.directRuntime + counts.directDev + counts.directOptional + counts.indirectLocked + counts.localLinkTargets, counts.lockedPackages);
  return {
    schemaVersion: 1,
    scope: 'PUSH50_LOCAL_NPM_LOCK_AND_TRACKED_NOTICES_ONLY',
    licensingCleared: false,
    legalConclusion: 'NOT_PROVEN',
    sourceCommit,
    sources,
    counts,
    packages,
    connectorComponents,
    limitations: [
      'npm lock license fields are metadata, not a legal review or a copy of each package license',
      'INDIRECT_LOCKED includes transitive, peer and optional graph entries; the root lockfile alone does not classify each cause',
      'a null noticePath means no per-package notice is tracked here, not that the installed npm package lacks a license file',
      'exact Connector binary versions, build flags and complete redistribution notices are not established by this source set',
      'no current CVE scan, IP opinion, provider runtime inventory or legal clearance was performed',
    ],
  };
}

function validate(actual, expected) {
  assert.equal(actual.licensingCleared, false, 'LICENSING_CLEARED requires external evidence');
  assert.equal(actual.legalConclusion, 'NOT_PROVEN');
  assert.deepEqual(actual.sources, expected.sources, 'source SHA-256 mismatch');
  assert.deepEqual(actual.counts, expected.counts, 'dependency or missing-metadata count mismatch');
  assert.deepEqual(actual.packages, expected.packages, 'package, version, license or notice inventory drift');
  assert.deepEqual(actual.connectorComponents, expected.connectorComponents, 'connector notice drift');
  assert.deepEqual(actual, expected, 'inventory shape or proof boundary drift');
}

function selfTest(expected) {
  const copy = () => structuredClone(expected);
  const badSha = copy();
  badSha.sources['package-lock.json'].sha256 = '0'.repeat(64);
  assert.throws(() => validate(badSha, expected));
  const missingPackage = copy();
  missingPackage.packages.pop();
  assert.throws(() => validate(missingPackage, expected));
  const hiddenMissingLicense = copy();
  const missing = hiddenMissingLicense.packages.find((p) => p.licenseMetadata === null);
  missing.licenseMetadata = 'MIT';
  assert.throws(() => validate(hiddenMissingLicense, expected));
  const inventedNotice = copy();
  inventedNotice.packages.find((p) => p.noticePath === null).noticePath = 'unverified/NOTICE';
  assert.throws(() => validate(inventedNotice, expected));
  const falseClearance = copy();
  falseClearance.licensingCleared = true;
  assert.throws(() => validate(falseClearance, expected));
}

if (process.argv.includes('--write')) {
  const expected = build(git('rev-parse', 'HEAD').toString('utf8').trim());
  writeFileSync(inventoryPath, `${JSON.stringify(expected, null, 2)}\n`, { flag: 'wx' });
  console.log(`Wrote ${expected.counts.lockedPackages} locked packages and ${expected.counts.connectorNoticeComponents} notice-only components`);
} else {
  const actual = JSON.parse(readFileSync(inventoryPath, 'utf8'));
  const expected = build(actual.sourceCommit);
  validate(actual, expected);
  if (process.argv.includes('--self-test')) selfTest(expected);
  console.log(`PUSH50 license inventory PASS: ${expected.counts.lockedPackages} locked; ${expected.counts.missingLicenseMetadata} license metadata gaps; ${expected.counts.noTrackedPerPackageNotice} no tracked per-package notices; legal clearance NOT PROVEN`);
}
