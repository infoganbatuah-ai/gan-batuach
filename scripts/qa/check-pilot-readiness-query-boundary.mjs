import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const sourcePath = fileURLToPath(new URL("../../app/dashboard/admin/pilot-readiness/page.tsx", import.meta.url));
statSync(sourcePath);
const flags = process.platform === "darwin" ? Number(execFileSync("/usr/bin/stat", ["-f", "%f", sourcePath], { encoding: "utf8" }).trim()) : 0;
if ((flags & 0x40000000) !== 0) throw Error("Source is dataless; refusing to read");
const source = ts.transpileModule(readFileSync(sourcePath, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
}).outputText;
const privateError = "SYNTHETIC_PRIVATE_ERROR_DO_NOT_DISPLAY";
const missing = "לא זמין כרגע";
const labels = ["קל מול מבלבל", "משובים פתוחים", "השלמת קליטה", "משתמשים פעילים"];

async function render({ failures = [], stale = false, empty = false, reject = false, throwClient = false, deny = false } = {}) {
  const order = [], calls = [];
  const responses = [
    { data: empty ? [] : [{ id: "1", category: "FEEDBACK_MARKER", sentiment: "easy", rating: 5 }], count: null },
    { data: null, count: empty ? 0 : 2 },
    { data: empty ? [] : [{ id: "2", setup_completed: true, progress_percent: 100 }], count: empty ? 0 : 1 },
    { data: null, count: empty ? 0 : 8 }
  ];
  const client = { from(table) {
    const index = calls.length;
    const trace = { table, operations: [] }; calls.push(trace);
    const builder = {};
    for (const method of ["select", "order", "limit", "in", "eq"]) builder[method] = (...args) => { trace.operations.push([method, ...args]); return builder; };
    builder.then = (ok, bad) => {
      if (reject && index === 1) return Promise.reject(Error(privateError)).then(ok, bad);
      const result = failures.includes(index)
        ? { data: stale ? responses[index].data : null, count: stale ? responses[index].count : null, error: { message: privateError } }
        : { ...responses[index], error: null };
      return Promise.resolve(result).then(ok, bad);
    };
    return builder;
  } };
  const jsx = { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
  const noop = () => null;
  const require = (id) => {
    if (id === "react/jsx-runtime") return jsx;
    if (id === "lucide-react") return new Proxy({}, { get: () => noop });
    if (id.endsWith("/admin-app-ui")) return { AdminAppFrame: "AdminAppFrame" };
    if (id.endsWith("/admin-data-state")) return { AdminDataError: "AdminDataError" };
    if (id.endsWith("/stat-card")) return { StatCard: "StatCard" };
    if (id.endsWith("/auth")) return { requireRole: async (roles) => { order.push("admin"); assert.deepEqual(Array.from(roles), ["admin"]); if (deny) throw Error("DENIED"); return { profile: { role: "admin" } }; } };
    if (id.endsWith("/supabase/server")) return { createClient: async () => { order.push("client"); if (throwClient) throw Error(privateError); return client; } };
    throw Error(`unexpected import ${id}`);
  };
  const exports = {};
  runInNewContext(source, { exports, require, console: { warn() {} }, Date, Intl, fetch() { throw Error("NETWORK_FORBIDDEN"); } });
  if (deny) { await assert.rejects(exports.default(), /DENIED/); return { order, calls }; }
  const tree = await exports.default(), nodes = [];
  function walk(value) { if (Array.isArray(value)) return value.forEach(walk); if (value && typeof value === "object") { nodes.push(value); walk(value.props?.children); } }
  walk(tree);
  const metric = (label) => nodes.find((node) => node.type === "StatCard" && node.props.label === label)?.props;
  const card = (title) => nodes.find((node) => node.type === "article" && JSON.stringify(node.props.children).includes(`"${title}"`));
  const banner = nodes.find((node) => node.type === "AdminDataError")?.props.message ?? null;
  return { order, calls, tree: JSON.stringify(tree), metric, card, banner };
}

for (let index = 0; index < 4; index++) {
  test(`query ${index} failure hides its stale data and preserves other metrics`, async () => {
    const result = await render({ failures: [index], stale: true });
    assert.ok(result.banner);
    assert.equal(result.metric(labels[index]).value, missing);
    assert.notEqual(result.metric(labels[index]).tone, "good");
    assert.ok(!result.tree.includes(privateError));
    assert.deepEqual(result.order, ["admin", "client"]);
    assert.equal(result.calls.length, 4);
    for (let other = 0; other < 4; other++) if (other !== index) assert.notEqual(result.metric(labels[other]).value, missing);
    if (index === 0) {
      assert.ok(!result.tree.includes("FEEDBACK_MARKER"));
      assert.ok(JSON.stringify(result.card("מוכנות שימוש")).includes(missing));
      assert.ok(result.tree.includes("ציון מדדים זמינים 100%"));
      assert.ok(!result.tree.includes("עדיין אין משוב פיילוט"));
    }
    if (index === 2) {
      assert.ok(JSON.stringify(result.card("מוכנות קליטה")).includes(missing));
      assert.ok(result.tree.includes("ציון מדדים זמינים 100%"));
    }
  });
}
test("both derived sources failing produces no measured readiness", async () => {
  const result = await render({ failures: [0, 2], stale: true });
  assert.ok(result.tree.includes("טרם חושב ציון"));
  assert.ok(!result.tree.includes("FEEDBACK_MARKER"));
  assert.equal(result.metric(labels[1]).value, 2);
  assert.equal(result.metric(labels[3]).value, 8);
});
test("genuine empty success retains zero and empty semantics", async () => {
  const result = await render({ empty: true });
  assert.equal(result.banner, null);
  assert.equal(result.metric(labels[0]).value, "0/0");
  assert.equal(result.metric(labels[1]).value, 0);
  assert.equal(result.metric(labels[2]).value, "0%");
  assert.equal(result.metric(labels[3]).value, 0);
  assert.ok(result.tree.includes("עדיין אין משוב פיילוט"));
  assert.ok(result.tree.includes("נדרש אימות"));
});
test("all-success nonempty metrics and query contracts remain intact", async () => {
  const result = await render();
  assert.equal(result.banner, null);
  assert.equal(result.metric(labels[0]).value, "1/0");
  assert.equal(result.metric(labels[1]).value, 2);
  assert.equal(result.metric(labels[2]).value, "100%");
  assert.equal(result.metric(labels[3]).value, 8);
  assert.ok(result.tree.includes("FEEDBACK_MARKER"));
  assert.deepEqual(result.calls.map((x) => x.table), ["pilot_feedback", "pilot_feedback", "onboarding_progress", "profiles"]);
  assert.deepEqual(result.calls[0].operations.map((x) => x[0]), ["select", "order", "limit"]);
  assert.deepEqual(JSON.parse(JSON.stringify(result.calls[1].operations[1])), ["in", "status", ["open", "in_progress"]]);
  assert.deepEqual(result.calls[3].operations[1], ["eq", "active", true]);
});
for (const mode of ["reject", "throwClient"]) test(`${mode} safely renders unavailable without sensitive errors`, async () => {
  const result = await render({ [mode]: true });
  assert.ok(result.banner);
  for (const label of labels) assert.equal(result.metric(label).value, missing);
  assert.ok(result.tree.includes("טרם חושב ציון"));
  assert.ok(!result.tree.includes(privateError));
});
test("denied admin admission prevents client and all queries", async () => {
  const result = await render({ deny: true });
  assert.deepEqual(result.order, ["admin"]);
  assert.equal(result.calls.length, 0);
});
