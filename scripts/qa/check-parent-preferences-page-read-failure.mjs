import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const requirePackage = createRequire(new URL("../../package.json", import.meta.url));
const ts = requirePackage("typescript");
const pagePath = new URL("../../app/dashboard/parent/notifications/page.tsx", import.meta.url);
const compiled = ts.transpileModule(readFileSync(pagePath, "utf8"), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const success = (data) => ({ data, error: null });
const failure = { data: null, error: { code: "SYNTHETIC_READ_FAILURE" } };

async function pageWith(failedTable) {
  const reads = {
    notifications: success([]),
    communication_preferences: success({ receive_push: false }),
    push_category_preferences: success([{ category: "important", enabled: false }])
  };
  if (failedTable) reads[failedTable] = failure;
  const query = (table) => ({
    select() { return this; }, or() { return this; }, order() { return this; },
    limit() { return Promise.resolve(reads[table]); }, eq() { return this; }, in() { return this; },
    maybeSingle() { return Promise.resolve(reads[table]); },
    then(resolve, reject) { return Promise.resolve(reads[table]).then(resolve, reject); }
  });
  const element = (type, props) => ({ type, props: props ?? {} });
  const imports = {
    "react/jsx-runtime": { jsx: element, jsxs: element },
    "@/components/dashboard-shell": { DashboardShell: "DashboardShell" },
    "@/components/notification-center": { NotificationCenter: "NotificationCenter" },
    "@/components/parent-app-ui": {
      ParentAppFrame: "ParentAppFrame", ParentHero: "ParentHero", ParentSection: "ParentSection"
    },
    "@/components/parent-notification-preferences": { ParentNotificationPreferences: "ParentNotificationPreferences" },
    "@/lib/auth": { requireRole: async () => ({ profile: { id: "parent-a", full_name: "QA" } }) },
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

test("successful reads render the actual parent preference values", async () => {
  const tree = await pageWith();
  assert.match(tree, /ParentNotificationPreferences/);
  assert.match(tree, /"receive_push":false/);
  assert.match(tree, /"important":false/);
  assert.doesNotMatch(tree, /לא ניתן לטעון/);
});

for (const table of ["communication_preferences", "push_category_preferences"]) {
  test(`${table} read failure displays an error instead of editable consent`, async () => {
    const tree = await pageWith(table);
    assert.match(tree, /"role":"alert"/);
    assert.match(tree, /לא ניתן לטעון את העדפות ההתראות/);
    assert.doesNotMatch(tree, /ParentNotificationPreferences|SYNTHETIC_READ_FAILURE/);
  });
}
