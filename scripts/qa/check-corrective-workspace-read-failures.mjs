import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

// Server-component response contract only: no database, server, or business mutation.
const localRequire = createRequire(new URL('../../package.json', import.meta.url));
const ts = process.env.GB_TEST_TYPESCRIPT_PATH
  ? localRequire(process.env.GB_TEST_TYPESCRIPT_PATH)
  : localRequire('typescript');
const failure = { data: null, error: { code: 'SYNTHETIC_PRIVATE_QUERY_FAILURE' } };
const success = data => ({ data, error: null });
const violation = { id: 'violation-a', title: 'ליקוי בדיקה', status: 'open', garden_id: 'garden-a' };

async function render(role, failedTable, missingPayload = false) {
  const path = role === 'garden' ? '../../app/dashboard/garden/corrective-actions/page.tsx' : '../../app/dashboard/inspector/corrective-actions/page.tsx';
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const reads = [];
  const responses = {
    inspectors: success({ profile_photo_url: null }),
    gardens: success([{ id: 'garden-a' }]),
    violations: success([violation]),
    corrective_action_events: success([{ id: 'event-a', violation_id: violation.id, action: 'acknowledge' }])
  };
  if (failedTable) responses[failedTable] = missingPayload ? { data: null, error: null } : failure;
  const db = { from(table) {
    reads.push(table);
    const query = {
      select() { return this; }, eq() { return this; }, in() { return this; }, order() { return this; },
      limit() { return Promise.resolve(responses[table]); },
      maybeSingle() { return Promise.resolve(responses[table]); },
      then(resolve, reject) { return Promise.resolve(responses[table]).then(resolve, reject); }
    };
    return query;
  } };
  const element = (type, props) => ({ type, props: props ?? {} });
  const imports = {
    'react/jsx-runtime': { jsx: element, jsxs: element },
    '@/components/corrective-action-workspace': { CorrectiveActionWorkspace: 'CorrectiveActionWorkspace' },
    '@/components/dashboard-shell': { DashboardShell: 'DashboardShell' },
    '@/components/teacher-app-ui': { TeacherAppFrame: 'TeacherAppFrame' },
    '@/components/inspector-app-ui': { InspectorAppFrame: 'InspectorAppFrame' },
    '@/lib/management/operational-role': { requireOperationalRole: async () => ({ profile: { id: 'inspector-a', garden_id: 'garden-a' } }) },
    '@/lib/supabase/server': { createClient: async () => db }
  };
  const module = { exports: {} };
  runInNewContext(compiled, { module, exports: module.exports, require(name) {
    if (!(name in imports)) throw Error(`Unexpected import: ${name}`);
    return imports[name];
  } }, { filename: path, timeout: 1000 });
  return { tree: JSON.stringify(await module.exports.default()), reads };
}

for (const role of ['garden', 'inspector']) {
  test(`${role}: loaded rows and events render the corrective workspace`, async () => {
    const { tree } = await render(role);
    assert.match(tree, /CorrectiveActionWorkspace/);
    assert.match(tree, /ליקוי בדיקה/);
    assert.match(tree, /acknowledge/);
  });
  for (const table of role === 'garden'
    ? ['violations', 'corrective_action_events']
    : ['gardens', 'violations', 'corrective_action_events']) {
    test(`${role}: ${table} failure cannot appear as empty or complete data`, async () => {
      const { tree, reads } = await render(role, table);
      assert.match(tree, /"role":"alert"/);
      assert.doesNotMatch(tree, /CorrectiveActionWorkspace|SYNTHETIC_PRIVATE_QUERY_FAILURE/);
      if (table === 'gardens') assert.deepEqual(reads.sort(), ['gardens', 'inspectors']);
    });
  }
  test(`${role}: missing violation payload cannot appear as an empty list`, async () => {
    const { tree } = await render(role, 'violations', true);
    assert.match(tree, /"role":"alert"/);
    assert.doesNotMatch(tree, /CorrectiveActionWorkspace/);
  });
}
