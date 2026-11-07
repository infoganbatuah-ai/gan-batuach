import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

// Render the real Server Component against bounded in-memory query responses.
// No Next server, provider, database, browser, or project fixture is started.
const projectRequire = createRequire(new URL('../../package.json', import.meta.url));
const ts = projectRequire('typescript');
const source = readFileSync(new URL('../../app/dashboard/inspector/page.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

const element = (type, props) => ({ type, props: props ?? {} });
function descendants(node) {
  if (Array.isArray(node)) return node.flatMap(descendants);
  if (!node || typeof node !== 'object') return [];
  if (typeof node.type === 'function') return descendants(node.type(node.props));
  return [node, ...['children', 'action', 'actions', 'meta', 'status'].flatMap(key => descendants(node.props?.[key]))];
}
function visibleText(node) {
  if (Array.isArray(node)) return node.map(visibleText).join(' ');
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node !== 'object') return String(node);
  return [node.props?.title, node.props?.subtitle, node.props?.text, node.props?.hint, node.props?.value, node.props?.children, node.props?.action, node.props?.actions].map(visibleText).join(' ');
}

const success = data => ({ data, error: null });
const failed = { data: null, error: { code: 'SYNTHETIC_PRIVATE_QUERY_FAILURE' } };
const garden = { id: 'garden-a', name: 'גן בדיקה', city: 'חיפה', last_inspection_score: 8 };
const populated = {
  gardens: success([garden]),
  required_inspections: success([{ id: 'required-a', garden_id: garden.id, due_at: '2026-11-15T09:00:00Z', gardens: garden }]),
  inspections: success([{ id: 'inspection-a', weighted_score: 9, gardens: garden }]),
  violations: success([{ id: 'violation-a', garden_id: garden.id, title: 'ליקוי בדיקה', severity: 'high', gardens: garden }]),
  complaints: success([{ id: 'complaint-a', garden_id: garden.id, subject: 'תלונת בדיקה', gardens: garden }]),
  tasks: success([{ id: 'task-a', garden_id: garden.id, title: 'משימת בדיקה', status: 'open' }])
};

async function renderCase({ responses = {}, deny = false } = {}) {
  const observed = { clientCreates: 0, queries: [] };
  const reply = { inspectors: success({ id: 'inspector-a', profile_photo_url: null }), gardens: success([]), ...responses };
  const supabase = {
    from(table) {
      const operations = [];
      observed.queries.push({ table, operations });
      const query = {
        select(...args) { operations.push(['select', ...args]); return this; },
        eq(...args) { operations.push(['eq', ...args]); return this; },
        in(...args) { operations.push(['in', ...args]); return this; },
        neq(...args) { operations.push(['neq', ...args]); return this; },
        or(...args) { operations.push(['or', ...args]); return this; },
        order(...args) { operations.push(['order', ...args]); return this; },
        maybeSingle() { operations.push(['maybeSingle']); return Promise.resolve(reply[table]); },
        limit(...args) { operations.push(['limit', ...args]); return Promise.resolve(reply[table] ?? success([])); },
        then(resolve, reject) { return Promise.resolve(reply[table] ?? success([])).then(resolve, reject); }
      };
      return query;
    }
  };
  const componentNames = [
    'InspectorActionCard', 'InspectorActions', 'InspectorAppFrame', 'InspectorEmpty',
    'InspectorHero', 'InspectorList', 'InspectorMetricCard', 'InspectorMetricGrid',
    'InspectorRow', 'InspectorScoreRing', 'InspectorSection', 'InspectorStatePanel', 'InspectorStatus'
  ];
  const components = Object.fromEntries(componentNames.map(name => [name, name]));
  const icons = Object.fromEntries(['AlertTriangle', 'BarChart3', 'CalendarCheck', 'ClipboardCheck', 'FileText', 'Home', 'MapPin', 'Navigation', 'ShieldCheck'].map(name => [name, name]));
  const imports = {
    'react/jsx-runtime': { jsx: element, jsxs: element, Fragment: 'Fragment' },
    'next/link': { __esModule: true, default: 'Link' },
    'lucide-react': icons,
    '@/components/inspector-app-ui': components,
    '@/lib/management/operational-role': { requireApprovedInspector: async () => {
      if (deny) throw new Error('INSPECTOR_ACCESS_DENIED');
      return { profile: { id: 'inspector-a', full_name: 'מפקחת בדיקה', profile_image_url: null } };
    } },
    '@/lib/supabase/server': { createClient: async () => { observed.clientCreates += 1; return supabase; } }
  };
  const compiledModule = { exports: {} };
  runInNewContext(compiled, {
    module: compiledModule, exports: compiledModule.exports,
    require: specifier => {
      if (!(specifier in imports)) throw new Error(`Unexpected import: ${specifier}`);
      return imports[specifier];
    }
  }, { timeout: 1000, filename: 'inspector-dashboard.fixture.js' });
  const page = compiledModule.exports.default;
  if (deny) {
    await assert.rejects(page(), /INSPECTOR_ACCESS_DENIED/);
    return { observed, nodes: [] };
  }
  return { observed, nodes: descendants(await page()) };
}

const typeNodes = (nodes, type) => nodes.filter(node => node.type === type);
const labels = (nodes, type) => typeNodes(nodes, type).map(node => visibleText(node));

test('verified empty assignment remains the approved-unassigned state without secondary reads', async () => {
  const { observed, nodes } = await renderCase();
  assert.match(labels(nodes, 'InspectorHero').join(' '), /טרם הוקצו לך גנים/);
  assert.equal(typeNodes(nodes, 'InspectorStatePanel').length, 0);
  assert.deepEqual(observed.queries.map(query => query.table), ['inspectors', 'gardens']);
  assert.ok(typeNodes(nodes, 'Link').some(link => link.props.href === '/dashboard/inspector/preliminary-gardens'));
});

test('populated assignment preserves scoped operational data and actions', async () => {
  const { observed, nodes } = await renderCase({ responses: populated });
  assert.match(labels(nodes, 'InspectorHero').join(' '), /גן בדיקה/);
  assert.match(labels(nodes, 'InspectorRow').join(' '), /ליקוי בדיקה|תלונת בדיקה|משימת בדיקה/);
  assert.equal(typeNodes(nodes, 'InspectorStatePanel').length, 0);
  assert.equal(typeNodes(nodes, 'InspectorEmpty').length, 0);
  assert.deepEqual(observed.queries.map(query => query.table), ['inspectors', 'gardens', 'required_inspections', 'inspections', 'violations', 'complaints', 'tasks']);
  assert.ok(observed.queries.find(query => query.table === 'gardens').operations.some(([op, field, id]) => op === 'eq' && field === 'inspector_id' && id === 'inspector-a'));
  for (const table of ['required_inspections', 'violations', 'complaints']) {
    assert.ok(observed.queries.find(query => query.table === table).operations.some(([op, field, ids]) => op === 'in' && field === 'garden_id' && Array.from(ids).join(',') === garden.id));
  }
  assert.ok(typeNodes(nodes, 'Link').some(link => link.props.href === '/dashboard/inspector/inspections?required=required-a'));
});

test('assignment read failure is unavailable, not an approved account with no Gardens', async () => {
  const { observed, nodes } = await renderCase({ responses: { gardens: failed } });
  assert.equal(typeNodes(nodes, 'InspectorStatePanel').length, 1);
  assert.equal(typeNodes(nodes, 'InspectorHero').length, 0);
  assert.equal(typeNodes(nodes, 'InspectorMetricCard').length, 0);
  assert.equal(typeNodes(nodes, 'InspectorActionCard').length, 0);
  assert.deepEqual(observed.queries.map(query => query.table), ['inspectors', 'gardens']);
  assert.match(visibleText(nodes), /לא ניתן לטעון את הגנים המשויכים/);
  assert.doesNotMatch(visibleText(nodes), /טרם הוקצו לך גנים|SYNTHETIC_PRIVATE_QUERY_FAILURE/);
  assert.equal(nodes.filter(node => node.props?.role === 'alert').length, 1);
});

test('missing assignment payload also refuses an unverifiable empty state', async () => {
  const { nodes } = await renderCase({ responses: { gardens: { data: null, error: null } } });
  assert.equal(typeNodes(nodes, 'InspectorStatePanel').length, 1);
  assert.equal(typeNodes(nodes, 'InspectorHero').length, 0);
});

for (const [table, unavailable, falseEmpty] of [
  ['required_inspections', 'יומן הביקורות אינו זמין', 'אין ביקורות פתוחות'],
  ['inspections', 'מידע לא זמין', '0/'],
  ['violations', 'נתוני הליקויים אינם זמינים', 'אין התראות פתוחות'],
  ['complaints', 'נתוני התלונות אינם זמינים', 'אין התראות פתוחות'],
  ['tasks', 'נתוני המשימות אינם זמינים', 'אין משימות פתוחות']
]) {
  test(`${table} failure stays partial, preserving other loaded data`, async () => {
    const { nodes } = await renderCase({ responses: { ...populated, [table]: failed } });
    const all = visibleText(nodes);
    assert.match(all, new RegExp(unavailable));
    assert.doesNotMatch(all, new RegExp(falseEmpty));
    assert.doesNotMatch(all, /SYNTHETIC_PRIVATE_QUERY_FAILURE/);
    assert.match(all, /גן בדיקה|ליקוי בדיקה|תלונת בדיקה|משימת בדיקה/);
    assert.ok(nodes.some(node => node.props?.role === 'alert') || table === 'inspections');
    if (table === 'required_inspections') {
      assert.equal(typeNodes(nodes, 'Link').some(link => String(link.props.href).startsWith('/dashboard/inspector/inspections?required=')), false);
    }
  });
}

test('unauthorized or inactive inspector denial occurs before any database read', async () => {
  const { observed } = await renderCase({ deny: true });
  assert.equal(observed.clientCreates, 0);
  assert.deepEqual(observed.queries, []);
});
