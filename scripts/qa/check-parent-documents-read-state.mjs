import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

// Exercise the actual Server Component with synthetic, in-memory query results.
// Imports and JSX are replaced at the boundary; no Next server, database,
// provider, browser, project cache or fixture file is started or written.
const projectRequire = createRequire(new URL('../../package.json', import.meta.url));
const ts = projectRequire('typescript');
const source = readFileSync(new URL('../../app/dashboard/parent/documents/page.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

const element = (type, props) => ({ type, props: props ?? {} });
function descendants(node) {
  if (Array.isArray(node)) return node.flatMap(descendants);
  if (!node || typeof node !== 'object') return [];
  return [node, ...descendants(node.props?.children)];
}
function visibleText(node) {
  if (Array.isArray(node)) return node.map(visibleText).join(' ');
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node !== 'object') return String(node);
  return visibleText(node.props?.children);
}

const familyReady = {
  sourceUnavailable: false,
  children: [{ id: 'child-a', full_name: 'ילד בדיקה', garden_id: 'garden-a' }],
  gardens: [{ id: 'garden-a', name: 'גן בדיקה' }],
  gardenIds: ['garden-a']
};

async function renderCase({ documents = { data: [], error: null }, family = familyReady, deny = false } = {}) {
  const observed = { queries: [], familyReads: 0, clientCreates: 0 };
  const query = {
    select(fields) { observed.queries.push(['select', fields]); return this; },
    is(field, value) { observed.queries.push(['is', field, value]); return this; },
    order(field, options) { observed.queries.push(['order', field, options]); return this; },
    limit(value) { observed.queries.push(['limit', value]); return Promise.resolve(documents); }
  };
  const supabase = {
    from(table) { observed.queries.push(['from', table]); return query; }
  };
  const imports = {
    'react/jsx-runtime': { jsx: element, jsxs: element, Fragment: 'Fragment' },
    '@/components/dashboard-shell': { DashboardShell: 'DashboardShell' },
    'lucide-react': { AlertTriangle: 'AlertTriangle' },
    '@/components/documents-platform': { DocumentsPlatform: 'DocumentsPlatform' },
    '@/components/parent-app-ui': { ParentAppFrame: 'ParentAppFrame' },
    '@/lib/auth': { requireRole: async roles => {
      assert.deepEqual(Array.from(roles), ['parent']);
      if (deny) throw new Error('ROLE_DENIED');
      return { profile: { id: 'parent-a', full_name: 'הורה בדיקה', profile_image_url: null } };
    } },
    '@/lib/domain/parent-family': { getParentFamilyContext: async () => { observed.familyReads += 1; return family; } },
    '@/lib/management/document-policy': { effectiveDocumentStatus: row => row.status },
    '@/lib/supabase/server': { createClient: async () => { observed.clientCreates += 1; return supabase; } }
  };
  const module = { exports: {} };
  runInNewContext(compiled, {
    module, exports: module.exports,
    require: specifier => {
      if (!(specifier in imports)) throw new Error(`Unexpected import: ${specifier}`);
      return imports[specifier];
    }
  }, { timeout: 1000, filename: 'parent-documents-page.fixture.js' });
  const page = module.exports.default;
  if (deny) {
    await assert.rejects(page(), /ROLE_DENIED/);
    return { observed, nodes: [] };
  }
  const nodes = descendants(await page());
  return { observed, nodes };
}

function platform(nodes) { return nodes.find(node => node.type === 'DocumentsPlatform'); }
function alerts(nodes) { return nodes.filter(node => node.props?.role === 'alert'); }

test('a valid empty family document read keeps the normal empty-state workspace and upload capabilities', async () => {
  const { observed, nodes } = await renderCase();
  assert.equal(platform(nodes)?.props.rows.length, 0);
  assert.equal(platform(nodes)?.props.uploadTargets.length, 2);
  assert.equal(alerts(nodes).length, 0);
  assert.deepEqual(observed.queries.filter(([operation]) => operation === 'from').map(([, table]) => table), ['documents']);
  assert.deepEqual(observed.queries.filter(([operation]) => operation === 'limit').map(([, value]) => value), [100]);
});

test('a populated read preserves family scope and protected file links', async () => {
  const { nodes } = await renderCase({ documents: { data: [
    { id: 'doc-a', child_id: 'child-a', garden_id: 'garden-a', status: 'valid', file_url: '/api/documents/doc-a/file' },
    { id: 'doc-b', child_id: null, garden_id: 'garden-a', owner_type: 'guardian', status: 'pending', file_url: 'https://untrusted.example/doc-b' }
  ], error: null } });
  const rows = platform(nodes)?.props.rows;
  assert.equal(rows.length, 2);
  assert.equal(rows[0].file_url, '/api/documents/doc-a/file');
  assert.equal(rows[1].file_url, null);
  assert.equal(rows[0].can_review, false);
  assert.equal(rows[1].can_review, false);
  assert.equal(platform(nodes)?.props.uploadTargets.length, 2);
});

test('a failed document read shows an accessible unavailable state, never a verified empty workspace', async () => {
  const { nodes } = await renderCase({ documents: { data: null, error: { code: 'SYNTHETIC_READ_FAILURE' } } });
  assert.equal(platform(nodes), undefined);
  assert.equal(alerts(nodes).length, 1);
  assert.match(visibleText(alerts(nodes)[0]), /לא ניתן לטעון את מסמכי המשפחה/);
  assert.doesNotMatch(visibleText(alerts(nodes)[0]), /אין מסמכים|SYNTHETIC_READ_FAILURE/);
});

test('an unavailable family context keeps readable document rows but refuses upload targets', async () => {
  const { nodes } = await renderCase({
    documents: { data: [{ id: 'doc-a', child_id: 'child-a', status: 'valid', file_url: null }], error: null },
    family: { ...familyReady, sourceUnavailable: true }
  });
  assert.equal(platform(nodes)?.props.rows.length, 1);
  assert.equal(platform(nodes)?.props.uploadTargets.length, 0);
  assert.equal(alerts(nodes).length, 1);
  assert.match(visibleText(alerts(nodes)[0]), /העלאת מסמך אינה זמינה/);
});

test('a denied role performs no document or family read', async () => {
  const { observed } = await renderCase({ deny: true });
  assert.equal(observed.clientCreates, 0);
  assert.equal(observed.familyReads, 0);
  assert.deepEqual(observed.queries, []);
});
