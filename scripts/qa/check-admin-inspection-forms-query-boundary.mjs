import fs from 'node:fs';
import vm from 'node:vm';
import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

// Optional exact-ID selection for a recorded failed-only local harness repair.
const onlyCases = process.env.DO_QA_ONLY_CASES ? new Set(JSON.parse(process.env.DO_QA_ONLY_CASES)) : null;
function test(name, body) { if (!onlyCases || onlyCases.has(name)) nodeTest(name, body); }

// Actual page + both unchanged-action clients + safeAdminData, readonly synthetic render.
const read = path => { assert.equal(fs.statSync(path).flags & 0x40000000, 0); return fs.readFileSync(path, 'utf8'); };
const source = read(new URL('../../app/dashboard/admin/inspection-forms/page.tsx', import.meta.url));
function compile(value) { const r = ts.transpileModule(value, {reportDiagnostics: true, compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX}}); assert.equal(r.diagnostics.length, 0); return r.outputText; }
const pageCode = compile(source), builderCode = compile(read(new URL('../../components/inspection-form-builder.tsx', import.meta.url))), supervisionCode = compile(read(new URL('../../components/inspection-supervision-center.tsx', import.meta.url))), helperCode = compile(read(new URL('../../lib/admin-safe.ts', import.meta.url)));
const jsx = (type, props, key) => ({type, props: props ?? {}, key});
const plain = value => JSON.parse(JSON.stringify(value));
function nodes(v, type) { if (!v || typeof v !== 'object') return []; if (Array.isArray(v)) return v.flatMap(x => nodes(x, type)); return [...(v.type === type ? [v] : []), ...Object.values(v.props ?? {}).flatMap(x => nodes(x, type))]; }
function text(v) { if (v == null || typeof v === 'boolean' || typeof v === 'function') return ''; if (typeof v !== 'object') return String(v); return Array.isArray(v) ? v.map(text).join('') : text(v.props?.children); }
const keys = ['forms', 'questions', 'inspectors', 'gardens', 'dueSoon', 'late', 'history'];
const tables = ['inspection_forms', 'inspection_form_questions', 'profiles', 'gardens', 'required_inspections', 'required_inspections', 'inspections'];
const stamp = '2026-11-05T12:00:00.000Z', now = Date.parse(stamp);
const form = (x = {}) => ({id: 'SYNTHETIC_FORM', name: 'SYNTHETIC_FORM_NAME', active: false, frequency_months: 0, ...x});
const question = (x = {}) => ({id: 'SYNTHETIC_QUESTION', form_id: 'SYNTHETIC_FORM', category: 'SYNTHETIC_CATEGORY', question_text: 'SYNTHETIC_QUESTION_TEXT', question_type: 'text_note', weight: 0, sort_order: 0, ...x});
const demand = (x = {}) => ({id: 'SYNTHETIC_DEMAND', garden_id: 'SYNTHETIC_GARDEN', due_at: '2026-11-06T12:00:00.000Z', gardens: {name: 'SYNTHETIC_GARDEN_NAME', last_inspection_score: 0}, inspectors: {full_name: 'SYNTHETIC_INSPECTOR_NAME'}, ...x});
function fixture() { return {forms: [form(), form({id: 'SYNTHETIC_SECOND', name: 'SECOND_FORM'})], questions: [question({id: 'Q2', sort_order: 20}), question({id: 'Q1', sort_order: -1, critical: true}), question({id: 'OTHER', form_id: 'OTHER', question_text: 'EXCLUDED_QUESTION'})], inspectors: [{id: 'SYNTHETIC_INSPECTOR', full_name: 'SYNTHETIC_INSPECTOR_NAME'}], gardens: [{id: 'SYNTHETIC_GARDEN', name: 'SYNTHETIC_GARDEN_NAME'}], dueSoon: [demand()], late: [demand({due_at: '2026-11-04T12:00:00.000Z'})], history: [{id: 'SYNTHETIC_REPORT', garden_id: 'SYNTHETIC_GARDEN', gardens: {name: 'SYNTHETIC_HISTORY_GARDEN'}, completed_at: '2026-11-04T12:00:00.000Z', weighted_score: 0, status: 'completed'}]}; }
const selections = ['id, name, description, active, frequency_months', 'id, form_id, category, question_text, question_type, weight, critical, required, sort_order', 'id, full_name, role', 'id, name, city', '*, gardens(name,last_inspection_score), inspectors:inspector_id(full_name)', '*, gardens(name,last_inspection_score), inspectors:inspector_id(full_name)', 'id, garden_id, inspector_id, completed_at, status, weighted_score, signature_image, gardens(name), inspectors:inspector_id(full_name)'];
function expectedChain(i) { const a = [['from', tables[i]], ['select', selections[i]]]; if (i === 0) a.push(['order', 'created_at', {ascending: false}]); if (i === 1) a.push(['order', 'sort_order', {ascending: true}]); if (i === 2) a.push(['eq', 'role', 'inspector'], ['eq', 'active', true]); if (i === 3) a.push(['eq', 'status', 'active']); if (i === 4 || i === 5) a.push(['in', 'status', i === 4 ? ['required', 'open'] : ['required', 'open', 'late']], [i === 4 ? 'gte' : 'lt', 'due_at', stamp], ['order', 'due_at'], ['limit', 50]); if (i === 6) a.push(['order', 'completed_at', {ascending: false}], ['limit', 50]); return a; }
const known = mode => !mode || mode === 'empty' || mode === 'null';
async function setup(options = {}) {
  const {modes = {}, rows = {}, clientThrows = false, deniedRole = false, direct = false, flags = {}, retained} = options;
  const data = {...fixture(), ...rows}, calls = [], logs = [], counts = {InspectionFormBuilder: 0, InspectionSupervisionCenter: 0};
  let clients = 0, admissions = 0, effects = 0, routerReads = 0, stateIndex = 0, current = '';
  const deny = () => { effects++; throw Error('UNEXPECTED_EFFECT_OR_STALE_DATE'); };
  class FixedDate extends Date { constructor(value = stamp) { if (value === 'INVALID_DATE') deny(); super(value); } static now() { return now; } }
  function load(code, require) { const exports = {}; vm.runInNewContext(code, {exports, require, Date: FixedDate, fetch: deny, FormData: deny, window: {prompt: deny}, process: {env: {}}, console: {warn: (...args) => logs.push(args)}}); return exports; }
  const react = {useState: initial => { const index = stateIndex++; return [current === 'InspectionFormBuilder' && retained && index < 3 ? retained[index] : initial, deny]; }, useMemo: fn => fn()};
  const common = id => { if (id === 'react/jsx-runtime') return {jsx, jsxs: jsx, Fragment: 'Fragment'}; if (id === 'react') return react; if (id === 'next/link') return {__esModule: true, default: 'Link'}; if (id === 'next/navigation') return {useRouter: () => { routerReads++; return {refresh: deny, push: deny, replace: deny}; }}; return deny(); };
  const builder = load(builderCode, common), supervision = load(supervisionCode, common), helper = load(helperCode, deny);
  function fold(v) { if (!v || typeof v !== 'object') return v; if (Array.isArray(v)) return v.map(fold); if (typeof v.type === 'function') { current = v.type.name; assert.ok(Object.hasOwn(counts, current)); counts[current]++; stateIndex = 0; return fold(v.type(v.props)); } return {...v, props: {...v.props, children: fold(v.props?.children)}}; }
  const client = {from(table) { const i = calls.length, key = keys[i], mode = modes[key], chain = [['from', table]]; calls.push(chain); assert.equal(table, tables[i]); if (mode === 'factory') throw Error('PRIVATE_FACTORY'); const q = {}; for (const method of ['select', 'order', 'eq', 'in', 'gte', 'lt', 'limit']) q[method] = (...args) => { chain.push([method, ...args]); if (mode === 'chain') throw Error('PRIVATE_CHAIN'); return q; }; q.then = (resolve, reject) => (mode === 'reject' ? Promise.reject(Error('PRIVATE_REJECTION')) : mode === 'reject-null' ? Promise.reject(null) : Promise.resolve({data: mode?.endsWith('empty') || mode === 'empty' ? [] : mode?.endsWith('null') || mode === 'null' ? null : data[key], error: mode?.startsWith('error') ? {message: 'PRIVATE_MESSAGE', details: 'PRIVATE_DETAILS'} : null})).then(resolve, reject); return q; }};
  let builderProps, supervisionProps, tree;
  if (direct) {
    builderProps = {forms: data.forms, questions: data.questions, inspectors: data.inspectors, gardens: data.gardens, ...flags}; supervisionProps = {dueSoon: data.dueSoon, late: data.late, history: data.history, ...flags};
    tree = fold([jsx(builder.InspectionFormBuilder, builderProps), jsx(supervision.InspectionSupervisionCenter, supervisionProps)]);
  } else {
    const page = load(pageCode, id => { if (id === 'react/jsx-runtime') return {jsx, jsxs: jsx}; if (id === 'lucide-react') return {ClipboardCheck: 'ClipboardCheck'}; if (id === '@/components/dashboard-shell') return {DashboardShell: 'DashboardShell'}; if (id === '@/components/admin-data-state') return {AdminDataError: 'AdminDataError'}; if (id === '@/components/inspection-form-builder') return builder; if (id === '@/components/inspection-supervision-center') return supervision; if (id === '@/lib/admin-safe') return helper; if (id === '@/lib/auth') return {requireRole: async roles => { assert.deepEqual(plain(roles), ['admin']); assert.equal(clients, 0); admissions++; if (deniedRole) throw Error('DENIED'); }}; if (id === '@/lib/supabase/server') return {createClient: async () => { assert.equal(admissions, 1); clients++; if (clientThrows) throw Error('PRIVATE_CLIENT'); return client; }}; return deny(); });
    if (deniedRole) { await assert.rejects(page.default(), /DENIED/); assert.equal(clients, 0); assert.equal(calls.length, 0); assert.deepEqual(Object.values(counts), [0, 0]); assert.equal(routerReads, 0); assert.equal(effects, 0); assert.deepEqual(logs, []); return null; }
    const raw = await page.default(); builderProps = nodes(raw, builder.InspectionFormBuilder)[0].props; supervisionProps = nodes(raw, supervision.InspectionSupervisionCenter)[0].props; tree = fold(raw);
    assert.equal(clients, 1); assert.equal(calls.length, clientThrows ? 0 : 7);
    if (!clientThrows) for (let i = 0; i < 7; i++) { const expected = expectedChain(i), mode = modes[keys[i]]; assert.deepEqual(plain(calls[i]), mode === 'factory' ? expected.slice(0, 1) : mode === 'chain' ? expected.slice(0, 2) : expected); }
    const unavailable = keys.filter(key => clientThrows || !known(modes[key]));
    assert.equal(logs.length, clientThrows ? 1 : unavailable.length); assert.deepEqual(plain(logs), clientThrows ? [['Admin page data unavailable:', 'inspection forms']] : unavailable.map(key => ['Admin Supabase query unavailable:', `inspection forms ${keys.indexOf(key)}`]));
    assert.equal(Boolean(nodes(tree, 'AdminDataError')[0].props.message), unavailable.length > 0); assert.ok(!JSON.stringify(tree).includes('PRIVATE_')); assert.ok(!JSON.stringify(logs).includes('PRIVATE_'));
    assert.equal(nodes(tree, 'DashboardShell')[0].props.role, 'admin'); assert.equal(nodes(tree, 'DashboardShell')[0].props.title, 'ניהול טפסי פיקוח');
    assert.ok(text(tree).includes('בונה טפסי פיקוח ברור, דינמי ומוכן לשימוש פקחים.')); assert.ok(text(tree).includes('ציון 1-10, כן/לא, טקסט, צילום, מסמך, משקל, שאלה קריטית, פרסום ושיוך לפיקוח חודשי.'));
    const pill = nodes(tree, 'span').find(n => text(n).includes('מנוע ניקוד מחובר')); assert.equal(pill.props.className, unavailable.length ? 'pill' : 'pill good'); assert.equal(nodes(pill, 'ClipboardCheck')[0].props.size, 15);
    for (const key of keys) { const props = keys.indexOf(key) < 4 ? builderProps : supervisionProps; assert.equal(props[`${key}Available`], !unavailable.includes(key)); assert.deepEqual(plain(props[key]), unavailable.includes(key) || ['null', 'empty'].includes(modes[key]) ? [] : plain(data[key])); }
  }
  assert.deepEqual(Object.values(counts), [1, 1]); assert.equal(routerReads, 1);
  const btree = Array.isArray(tree) ? tree[0] : nodes(tree, 'div').find(n => n.props.className === 'builder-layout');
  const stree = Array.isArray(tree) ? tree[1] : nodes(tree, 'section').find(n => n.props.className === 'dashboard-section');
  const available = key => (keys.indexOf(key) < 4 ? builderProps : supervisionProps)[`${key}Available`] !== false;
  const allForms = retained?.[0] ?? builderProps.forms, allQuestions = retained?.[1] ?? builderProps.questions, selectedId = retained?.[2] ?? (builderProps.forms[0]?.id || ''), selected = allForms.find(f => f.id === selectedId);
  const creation = available('forms'), questionsEnabled = creation && available('questions') && Boolean(selected), assignment = creation && available('inspectors') && available('gardens') && Boolean(selected);
  const forms = nodes(btree, 'form'); assert.deepEqual(forms.map(n => n.props.onSubmit.name), [...(creation ? ['createForm'] : []), ...(questionsEnabled ? ['addQuestion'] : []), ...(assignment ? ['assignForm'] : [])]);
  const selectors = nodes(btree, 'button').filter(n => String(n.props.className).startsWith('quick-action'));
  assert.deepEqual(selectors.map(n => n.key), creation ? plain(allForms.map(f => f.id)) : []); if (creation) assert.deepEqual(selectors.map(n => text(nodes(n, 'strong')[0])), plain(allForms.map(f => f.name)));
  const publish = nodes(btree, 'button').filter(n => n.props.onClick?.name === 'publishForm'); assert.equal(publish.length, questionsEnabled ? 1 : 0);
  const progress = nodes(btree, 'div').filter(n => n.props.className === 'progress-bar'), previews = nodes(btree, 'div').filter(n => n.props.className === 'inspection-preview-question');
  const selectedQuestions = allQuestions.filter(q => q.form_id === selectedId).sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0));
  assert.equal(progress.length, questionsEnabled ? 1 : 0); assert.equal(previews.length, questionsEnabled ? selectedQuestions.length : 0);
  if (questionsEnabled) { assert.equal(nodes(progress[0], 'span')[0].props.style.width, selectedQuestions.length ? '38%' : '8%'); assert.deepEqual(previews.map(n => n.key), plain(selectedQuestions.map(q => q.id))); assert.deepEqual(previews.map(n => text(nodes(n, 'p')[0])), plain(selectedQuestions.map(q => q.question_text))); for (const [i, q] of selectedQuestions.entries()) { assert.ok(text(previews[i]).includes(`משקל ${q.weight || 1}`)); assert.equal(text(nodes(previews[i], 'span')[0]), q.critical ? 'קריטי' : q.question_type || 'score'); } assert.equal(text(btree).includes('אין שאלות בטופס עדיין.'), selectedQuestions.length === 0); }
  else { assert.ok(!text(btree).includes('אין שאלות בטופס עדיין.')); if (creation && selected && !available('questions')) assert.ok(text(btree).includes('נתוני השאלות אינם זמינים')); }
  if (!creation) { assert.ok(text(btree).includes('נתוני הטפסים אינם זמינים')); assert.ok(!text(btree).includes('טפסים קיימים')); }
  const assignmentForm = forms.find(n => n.props.onSubmit.name === 'assignForm');
  if (assignment) { for (const [name, items, title] of [['inspector_id', builderProps.inspectors, 'כל פקח לפי שיוך גן'], ['garden_id', builderProps.gardens, 'כל הגנים הרלוונטיים']]) { const select = nodes(assignmentForm, 'select').find(n => n.props.name === name); assert.deepEqual(nodes(select, 'option').map(n => [n.props.value, text(n)]), [['', title], ...items.map(x => [x.id, x.full_name ?? x.name ?? ''])]); } assert.equal(nodes(assignmentForm, 'input')[0].props.defaultChecked, true); }
  else { assert.equal(nodes(btree, 'select').filter(n => ['garden_id', 'inspector_id'].includes(n.props.name)).length, 0); if (creation && selected && (!available('inspectors') || !available('gardens'))) assert.ok(text(btree).includes('נתוני יעדי השיוך אינם זמינים')); }
  const children = stree.props.children, section = title => children[children.findIndex(n => n?.type === 'h3' && text(n) === title) + 1];
  for (const [key, title, lateMode] of [['dueSoon', 'גנים שצריכים לבצע פיקוח בקרוב', false], ['late', 'גנים שמאחרים בביצוע פיקוח', true]]) {
    const view = section(title), records = supervisionProps[key], cards = nodes(view, 'article');
    if (!available(key)) { assert.ok(text(view).includes('אינם זמינים')); assert.ok(!text(view).includes('אין רשומות להצגה')); assert.equal(cards.length, 0); assert.equal(nodes(view, 'button').length, 0); }
    else if (!records.length) assert.ok(text(view).includes('אין רשומות להצגההמערכת תציג כאן גנים לפי תאריך הפיקוח הבא.'));
    else { assert.equal(cards.length, records.length); for (const [i, row] of records.entries()) { const due = new Date(row.due_at ?? row.next_inspection_at), days = Math.ceil((due.getTime() - now) / 86400000); assert.equal(cards[i].key, row.id ?? row.garden_id); assert.equal(text(nodes(cards[i], 'span')[0]), lateMode ? `${Math.abs(days)} ימים איחור` : `${days} ימים נותרו`); assert.equal(text(nodes(cards[i], 'h3')[0]), String(row.gardens?.name ?? row.name ?? 'גן')); assert.equal(text(nodes(cards[i], 'p')[0]), `פקח: ${row.inspectors?.full_name ?? row.gardens?.inspectors?.full_name ?? '-'}`); assert.equal(text(nodes(cards[i], 'small')[0]), `תאריך יעד: ${due.toLocaleDateString('he-IL')} · ציון אחרון: ${row.gardens?.last_inspection_score ?? row.last_inspection_score ?? '-'}`); assert.equal(nodes(cards[i], 'button').length, lateMode ? 5 : 3); } }
  }
  const history = section('היסטוריית דוחות ביקורת'), reports = nodes(history, 'article');
  if (!available('history')) { assert.ok(text(history).includes('אינם זמינים')); assert.ok(!text(history).includes('אין דוחות עדיין.')); assert.equal(reports.length, 0); assert.equal(nodes(history, 'Link').length, 0); }
  else if (!supervisionProps.history.length) assert.equal(text(history), 'אין דוחות עדיין.');
  else { assert.equal(reports.length, supervisionProps.history.length); for (const [i, row] of supervisionProps.history.entries()) { assert.equal(reports[i].key, row.id); assert.equal(text(nodes(reports[i], 'strong')[0]), row.gardens?.name ?? row.garden_id); assert.equal(text(nodes(reports[i], 'span')[0]), `${row.completed_at ? new Date(row.completed_at).toLocaleString('he-IL') : row.status} · ציון ${row.weighted_score ?? '-'}`); assert.deepEqual(nodes(reports[i], 'Link').map(n => n.props.href), Array(2).fill(`/dashboard/admin/inspections/${row.id}/report`)); } }
  assert.equal(effects, 0); return {tree, btree, stree};
}
test('actual complete page + both actual clients healthy', () => setup());
test('role denial does not render clients or read router', () => setup({deniedRole: true}));
test('outer client failure marks all seven unavailable', () => setup({clientThrows: true}));
for (const key of keys) for (const mode of ['error-stale', 'error-empty', 'error-null', 'reject', 'factory', 'chain', 'reject-null']) test(`${key} ${mode} independently unavailable`, () => setup({modes: {[key]: mode}}));
for (const key of keys) for (const mode of ['empty', 'null']) test(`${key} healthy ${mode} retains legitimate fallback`, () => setup({modes: {[key]: mode}}));
for (const [a, b] of [['forms', 'history'], ['questions', 'dueSoon'], ['inspectors', 'late'], ['gardens', 'questions'], ['dueSoon', 'late'], ['history', 'questions']]) test(`paired ${a}/${b} only removes dependent controls`, () => setup({modes: {[a]: 'error-stale', [b]: 'reject'}}));
test('known-empty all seven retains legitimate creation/empty supervision', () => setup({modes: Object.fromEntries(keys.map(k => [k, 'empty']))}));
test('direct callers omit optional flags and keep all original behavior', () => setup({direct: true}));
for (const key of keys) test(`direct stale ${key} props obey explicit false flag`, () => setup({direct: true, flags: {[`${key}Available`]: false}}));
for (const flags of [{formsAvailable: false}, {questionsAvailable: false}, {inspectorsAvailable: false}, {gardensAvailable: false}, {questionsAvailable: false, inspectorsAvailable: false}]) test(`retained state cannot bypass ${JSON.stringify(flags)}`, () => setup({direct: true, flags, retained: [[form()], [question()], 'SYNTHETIC_FORM']}));
test('retained selected second form filters/sorts only its questions', () => setup({direct: true, retained: [[form(), form({id: 'SECOND'})], [question(), question({id: 'B', form_id: 'SECOND', sort_order: 10}), question({id: 'A', form_id: 'SECOND', sort_order: 0})], 'SECOND']}));
test('selected stale ID absent from known forms does not mount selected controls', () => setup({direct: true, retained: [[form()], [question()], 'ABSENT']}));
test('known empty questions retain original 8 percent/publish behavior', () => setup({rows: {questions: []}}));
test('known empty targets retain original all-target options', () => setup({rows: {inspectors: [], gardens: []}}));
test('unknown questions do not hide eligible assignment or creation', () => setup({modes: {questions: 'error-stale', dueSoon: 'reject', late: 'reject', history: 'reject'}}));
for (const key of ['dueSoon', 'late', 'history']) test(`stale invalid date in failed ${key} never formatted`, () => setup({modes: {[key]: 'error-stale'}, rows: {[key]: key === 'history' ? [{id: 'STALE_REPORT', completed_at: 'INVALID_DATE'}] : [demand({due_at: 'INVALID_DATE'})]}}));
for (const offset of [-86400001, -1, 0, 1, 86400001]) test(`unchanged ceil/abs deadline arithmetic ${offset}`, () => setup({rows: {dueSoon: [demand({due_at: new Date(now + offset).toISOString()})], late: [demand({due_at: new Date(now + offset).toISOString()})]}}));
for (const value of [null, '', 0]) test(`unchanged false/nullish demand and report metadata ${String(value)}`, () => setup({rows: {dueSoon: [demand({id: value, gardens: {name: value, last_inspection_score: value, inspectors: {full_name: value}}, inspectors: null})], history: [{id: 'SYNTHETIC_REPORT', garden_id: 'SYNTHETIC_GARDEN', gardens: null, completed_at: null, status: 'pending', weighted_score: value}]}}));
test('raw order/duplicate IDs/over-cap server results not locally clamped', () => setup({rows: {forms: [form(), form({name: 'DUPLICATE_FORM'})], questions: [question({id: 'DUP', sort_order: null}), question({id: 'DUP', sort_order: -2})], dueSoon: Array.from({length: 51}, (_, i) => demand({id: 'DUPLICATE', name: `SYNTHETIC_${i}`}))}}));
test('single portable hook and seven independent thunks', () => { assert.ok(source.indexOf('await requireRole(["admin"])') < source.indexOf('await safeAdminData(')); assert.equal((source.match(/readSource\(\(\) => supabase\.from\(/g) ?? []).length, 7); const config = JSON.parse(read(new URL('../../config/digital-observer-ci-gates.json', import.meta.url))); assert.deepEqual(config.domain.filter(x => x.name === 'admin-inspection-forms-query-boundary'), [{name: 'admin-inspection-forms-query-boundary', args: ['--test', 'scripts/qa/check-admin-inspection-forms-query-boundary.mjs']}]); });
