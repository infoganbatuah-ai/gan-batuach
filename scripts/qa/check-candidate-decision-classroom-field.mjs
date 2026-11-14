import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';

const requireProject = createRequire(resolve('package.json'));
const ts = requireProject('typescript');
const zod = requireProject('zod');
const classroomId = '00000000-0000-4000-8000-000000000701';
const applicationId = '704025c7-724e-4156-8f99-7a9ebd991bc8';

function loadTsx(path, dependencies, globals = {}) {
  const source = readFileSync(path, 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022
  } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => {
      if (name in dependencies) return dependencies[name];
      throw Error(`Unexpected dependency ${name}`);
    },
    ...globals
  }, { filename: path, timeout: 2_000 });
  return exports;
}

function tree(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) {
    const found = tree(child, predicate);
    if (found) return found;
  }
  return null;
}

async function submitForm(classroomFieldName) {
  const calls = [];
  const jsx = (type, props) => ({ type, props });
  class FixtureFormData {
    constructor(form) { this.values = form.values; }
    get(name) { return this.values.get(name) ?? null; }
  }
  const { ApplicationDecisionForm } = loadTsx('components/self-service-forms.tsx', {
    'react/jsx-runtime': { jsx, jsxs: jsx },
    react: { useState: (value) => [value, () => {}], useEffect: () => {} },
    'next/link': { default: () => null },
    'next/navigation': { useRouter: () => ({ refresh: () => {} }) },
    'lucide-react': new Proxy({}, { get: () => () => null }),
    '@/components/gan-batuach-design-system': {},
    '@/lib/domain/kindergarten-onboarding': { knownKindergartenCities: () => [] }
  }, {
    FormData: FixtureFormData,
    fetch: async (url, options) => { calls.push({ url, body: JSON.parse(options.body) }); return { ok: true, json: async () => ({ data: {} }) }; }
  });
  const element = ApplicationDecisionForm({
    endpoint: `/api/garden/${classroomFieldName === 'classroom_id' ? 'staff-applications' : 'enrollment-requests'}/${applicationId}`,
    actions: [{ value: 'approve', label: 'Approve' }],
    classrooms: [{ id: classroomId, name: 'Class A' }],
    ...(classroomFieldName === 'classroom_id' ? { classroomFieldName } : {})
  });
  const form = tree(element, (item) => item.type === 'form');
  const select = tree(form, (item) => item.type === 'select' && item.props?.name === classroomFieldName);
  assert.ok(form && select, 'the selected classroom control uses the route field name');
  await form.props.onSubmit({ preventDefault() {}, currentTarget: { values: new Map([
    ['action', 'approve'], [classroomFieldName, classroomId]
  ]) } });
  assert.equal(calls.length, 1);
  return calls[0];
}

test('Manager-selected classroom reaches the staff decision API under its accepted key', async () => {
  const request = await submitForm('classroom_id');
  assert.equal(request.body.classroom_id, classroomId);
  assert.equal(request.body.assigned_classroom_id, undefined);

  const rpcCalls = [];
  const scoped = [];
  const { POST } = loadTsx('app/api/garden/staff-applications/[id]/route.ts', {
    zod: { z: zod.z },
    '@/lib/api': { fail: (message, status) => ({ status, message }), ok: (value) => ({ status: 200, value }), handleSafeRouteError: (error) => { throw error; } },
    '@/lib/management/garden-context': { getManagementGardenContext: async () => ({ allowed: true, gardenId: 'garden-1' }) },
    '@/lib/supabase/server': { createClient: async () => ({
      from: () => ({ select: () => ({ eq: (key, value) => { scoped.push([key, value]); return { eq: (nextKey, nextValue) => {
        scoped.push([nextKey, nextValue]); return { maybeSingle: async () => ({ data: { id: applicationId } }) };
      } }; } }) }),
      rpc: async (name, args) => { rpcCalls.push({ name, args }); return { data: { id: applicationId }, error: null }; }
    }) }
  });
  const result = await POST(new Request(`http://localhost${request.url}`, { method: 'POST', body: JSON.stringify(request.body) }), { params: Promise.resolve({ id: applicationId }) });
  assert.equal(result.status, 200);
  assert.deepEqual(scoped.map(([key]) => key), ['id', 'garden_id']);
  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0].name, 'decide_staff_job_application');
  assert.equal(rpcCalls[0].args.target_classroom_id, classroomId);
});

test('Enrollment keeps its existing classroom field contract', async () => {
  const request = await submitForm('assigned_classroom_id');
  assert.equal(request.body.assigned_classroom_id, classroomId);
  assert.equal(request.body.classroom_id, undefined);
});

test('Staff decision API rejects an out-of-scope application before any RPC call', async () => {
  let rpcCalls = 0;
  const { POST } = loadTsx('app/api/garden/staff-applications/[id]/route.ts', {
    zod: { z: zod.z },
    '@/lib/api': { fail: (message, status) => ({ status, message }), ok: () => ({ status: 200 }), handleSafeRouteError: (error) => { throw error; } },
    '@/lib/management/garden-context': { getManagementGardenContext: async () => ({ allowed: true, gardenId: 'other-garden' }) },
    '@/lib/supabase/server': { createClient: async () => ({
      from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }),
      rpc: async () => { rpcCalls++; return { data: null, error: null }; }
    }) }
  });
  const result = await POST(new Request('http://localhost/decision', { method: 'POST', body: JSON.stringify({ action: 'approve', classroom_id: classroomId }) }), { params: Promise.resolve({ id: applicationId }) });
  assert.equal(result.status, 404);
  assert.equal(rpcCalls, 0);
});
