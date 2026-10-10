import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, lstatSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

// Read-only Git inventory. --output writes only the explicitly requested report.
// Never reads .env contents or emits file contents, credentials, diffs or stash data.
const root = resolve(process.argv[2] || '.');
const git = (args, cwd = root) => execFileSync('git', args, {
  cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_NO_LAZY_FETCH: '1' },
  stdio: ['ignore', 'pipe', 'pipe'],
}).trimEnd();
const lines = (s) => s ? s.split('\n') : [];
const attempt = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };
const ancestor = (sha, ref) => attempt(() => { git(['merge-base', '--is-ancestor', sha, ref]); return true; }, false);
const classify = (p) => /(^|\/)\.env|credential|private.key|\.pem$|\.p12$/i.test(p) ? 'SECRET/ENV'
  : /(^|\/)(node_modules|\.next|logs|tmp|qa-evidence)\/|:memory:\.ses|\.log$/.test(p) ? 'LOCAL-ONLY'
    : /^supabase\/migrations\//.test(p) ? 'SUPABASE MIGRATION'
      : /\.md$|\.json$/.test(p) ? 'CONFIG/EVIDENCE'
        : /\.(tsx?|m?js|css|sql)$/.test(p) ? 'PRODUCT/QA — OWNER REVIEW' : 'PRESERVE — OWNER REVIEW';
const worktrees = git(['worktree', 'list', '--porcelain']).split('\n\n').filter(Boolean).map(block => {
  const data = Object.fromEntries(block.split('\n').map(l => { const i = l.indexOf(' '); return i < 0 ? [l, true] : [l.slice(0, i), l.slice(i + 1)]; }));
  const present = existsSync(data.worktree);
  const status = present ? attempt(() => git(['status', '--porcelain=v1', '-uall'], data.worktree)) : null;
  const changes = status === null ? null : lines(status).map(l => {
    const p = l.slice(3), classification = classify(p);
    const abs = resolve(data.worktree, p);
    const sha256 = classification !== 'SECRET/ENV' && existsSync(abs) && lstatSync(abs).isFile()
      ? createHash('sha256').update(readFileSync(abs)).digest('hex') : null;
    const blob = sha256 ? attempt(() => git(['hash-object', '--no-filters', '--', p], data.worktree)) : null;
    const onMain = blob && attempt(() => git(['rev-parse', `origin/main:${p}`])) === blob;
    return { status: l.slice(0, 2), path: p, classification, sha256,
      disposition: onMain ? 'EXACT_CONTENT_ALREADY_ON_REMOTE_MAIN' : 'PRESERVE_PENDING_OWNER_RECONCILIATION' };
  });
  return { ...data, present, statusReadable: status !== null, changes,
    remoteContainingHead: lines(git(['for-each-ref', `--contains=${data.HEAD}`, '--format=%(refname:short)', 'refs/remotes/'])),
    warning: !present ? 'REGISTERED_DIRECTORY_MISSING; committed objects checked, untracked/private evidence not recoverable from Git alone' : status === null ? 'WORKTREE_STATUS_UNREADABLE; preserve directory and metadata pending owner review' : null };
});
const refs = lines(git(['for-each-ref', '--format=%(refname)|%(objectname)|%(upstream:short)', 'refs/heads/', 'refs/remotes/'])).filter(l => !l.startsWith('refs/remotes/origin/HEAD|')).map(l => {
  const [ref, sha, upstream] = l.split('|');
  const containedMain = ancestor(sha, 'origin/main');
  const containedIntegration = ancestor(sha, 'integration/development');
  const commits = lines(git(['rev-list', '--reverse', `origin/main..${sha}`]));
  return { ref, sha, upstream: upstream || null, containedMain, containedIntegration,
    remoteContainingHead: lines(git(['for-each-ref', `--contains=${sha}`, '--format=%(refname:short)', 'refs/remotes/'])),
    commitsNotInMain: commits, disposition: containedMain ? 'ALREADY_IN_MAIN' : containedIntegration ? 'INTEGRATED_DEVELOPMENT' : 'PENDING_REVIEW_NOT_RELEASE_AUTHORIZED',
    deltaAgainstUpstream: upstream ? attempt(() => git(['rev-list', '--left-right', '--count', `${upstream}...${sha}`])) : null };
});
const localOnly = lines(git(['rev-list', '--branches', '--not', '--remotes']));
const stashes = lines(git(['stash', 'list', '--format=%gd|%H'])).map(l => {
  const [ref, sha] = l.split('|');
  return {ref, sha, files: lines(git(['diff-tree', '--no-commit-id', '--name-only', '-r', `${sha}^1`, sha])),
    untrackedFiles: attempt(() => lines(git(['ls-tree', '-r', '--name-only', `${sha}^3`])), []),
    disposition: 'PRESERVE; do not pop/apply automatically; semantic reconciliation pending'};
});
const migrations = new Map();
for (const sha of new Set([...refs.map(r => r.sha), ...worktrees.map(w => w.HEAD)])) {
  for (const l of lines(git(['ls-tree', '-r', sha, '--', 'supabase/migrations/']))) {
    const [meta, file] = l.split('\t'); if (!file?.endsWith('.sql')) continue;
    const blob = meta.split(' ')[2], key = `${file}|${blob}`;
    if (!migrations.has(key)) migrations.set(key, {file, blob, sourceHeads: [], productionApplied:'UNVERIFIED', localApplied:'NOT_TESTED', recovery:'Review source migration, RLS, dependencies and backward compatibility before isolated apply; no production apply authorized'});
    migrations.get(key).sourceHeads.push(sha);
  }
}
for (const wt of worktrees) for (const change of wt.changes || []) {
  if (change.classification === 'SUPABASE MIGRATION') {
    const key = `${change.path}|local:${change.sha256}`;
    migrations.set(key, {file:change.path, sha256:change.sha256, worktree:wt.worktree, sourceHeads:[], productionApplied:'UNVERIFIED', localApplied:'NOT_TESTED', recovery:'Uncommitted migration: preserve and reconcile owner before inclusion'});
  }
}
const result = {schemaVersion:1, observedAt:new Date().toISOString(), root,
  remoteMain:git(['rev-parse','origin/main']), localMain:git(['rev-parse','main']),
  integrationHead:git(['rev-parse','integration/development']), refs, localOnlyCommits:localOnly,
  worktrees, stashes, migrationVariants:[...migrations.values()].sort((a,b)=>a.file.localeCompare(b.file)),
  limitations:['Remote-tracking refs require an explicit preceding fetch.','Ancestry is not semantic equivalence or validation.','No secret values, ignored/private files or artifact contents included.','Missing worktree directories are not deleted/pruned by this audit.','Production migration state is not inferred from Git.']};
const out = process.argv.indexOf('--output');
if (out >= 0) { writeFileSync(resolve(process.argv[out+1]), JSON.stringify(result,null,2)+'\n'); console.log(JSON.stringify({output:process.argv[out+1],refs:refs.length,worktrees:worktrees.length,missingWorktrees:worktrees.filter(w=>!w.present).length,localOnlyCommits:localOnly.length,migrationVariants:migrations.size})); }
else console.log(JSON.stringify(result,null,2));
