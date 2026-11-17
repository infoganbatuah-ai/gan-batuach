import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const requirePackage = createRequire(new URL("../../package.json", import.meta.url));
const ts = requirePackage("typescript");
const pagePath = new URL("../../app/dashboard/staff/notifications/page.tsx", import.meta.url);
const compiled = ts.transpileModule(readFileSync(pagePath, "utf8"), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

async function render(failedTable) {
  const ok = (data) => ({ data, error: null });
  const rows = {
    notifications: ok([]),
    communication_preferences: ok({ receive_push: false }),
    push_category_preferences: ok([{ category: "important", enabled: false }])
  };
  if (failedTable) rows[failedTable] = { data: null, error: { code: "SYNTHETIC_READ_FAILURE" } };
  const query = (table) => ({
    select() { return this; }, or() { return this; }, order() { return this; },
    limit() { return Promise.resolve(rows[table]); }, eq() { return this; },
    maybeSingle() { return Promise.resolve(rows[table]); },
    then(resolve, reject) { return Promise.resolve(rows[table]).then(resolve, reject); }
  });
  const element = (type, props) => ({ type, props: props ?? {} });
  const imports = {
    "react/jsx-runtime": { jsx: element, jsxs: element },
    "lucide-react": { Bell: "Bell" },
    "@/components/notification-center": { NotificationCenter: "NotificationCenter" },
    "@/components/parent-notification-preferences": { NotificationPreferencesPanel: "NotificationPreferencesPanel" },
    "@/components/gan-batuach-design-system": { StatusChip: "StatusChip" },
    "@/components/staff-app-ui": { StaffAppFrame: "StaffAppFrame", StaffPageHero: "StaffPageHero", StaffSection: "StaffSection" },
    "@/lib/management/operational-role": { requireOperationalRole: async () => ({ profile: { id: "staff-a" } }) },
    "@/lib/supabase/server": { createClient: async () => ({ from: query }) },
    "@/lib/management/external-delivery": { managementDeliveryCapability: () => ({ in_app: "available" }) }
  };
  const fixtureModule = { exports: {} };
  runInNewContext(compiled, { module: fixtureModule, exports: fixtureModule.exports, require(name) {
    if (!(name in imports)) throw Error(`Unexpected import: ${name}`);
    return imports[name];
  } }, { filename: pagePath.pathname, timeout: 1000 });
  return JSON.stringify(await fixtureModule.exports.default());
}

test("successful reads preserve actual staff preference values", async () => {
  const tree = await render();
  assert.match(tree, /NotificationPreferencesPanel/);
  assert.match(tree, /"receive_push":false/);
  assert.match(tree, /"important":false/);
  assert.doesNotMatch(tree, /לא ניתן לטעון/);
});

for (const table of ["communication_preferences", "push_category_preferences"]) {
  test(`${table} failure cannot render editable consent defaults`, async () => {
    const tree = await render(table);
    assert.match(tree, /"role":"alert"/);
    assert.doesNotMatch(tree, /NotificationPreferencesPanel|SYNTHETIC_READ_FAILURE/);
  });
}
