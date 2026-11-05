import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const requireProject = createRequire(resolve(root, "package.json"));
const ts = requireProject("typescript");
const source = readFileSync(resolve(root, "components/settings-primary-profile-form.tsx"), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

function mount(profile, requests) {
  const module = { exports: {} };
  const jsx = (type, props) => ({ type, props: props ?? {} });
  const mocks = {
    react: { useState: (value) => [value, () => {}] },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "@/components/upload-image-field": { UploadImageField: () => null }
  };
  const context = {
    module,
    exports: module.exports,
    require: (name) => {
      assert.ok(name in mocks, `unexpected import: ${name}`);
      return mocks[name];
    },
    FormData: class {
      constructor(form) { this.fields = form.fields; }
      get(name) { return this.fields[name] ?? null; }
    },
    fetch: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, json: async () => ({ profile: { id: "test-profile" } }) };
    }
  };
  runInNewContext(compiled, context, { filename: "settings-primary-profile-form.js", timeout: 1000 });
  const form = module.exports.SettingsPrimaryProfileForm({ profile, email: "owner@example.test", roleLabel: "מנהלת גן" });
  assert.equal(form.type, "form");
  return form;
}

test("primary Settings saves an account without requiring an uploaded photo", async () => {
  const requests = [];
  const form = mount({ full_name: "Owner", phone: "0500000000", profile_image_url: null }, requests);
  let prevented = false;
  await form.props.onSubmit({
    preventDefault() { prevented = true; },
    currentTarget: { fields: { full_name: "Owner Updated", phone: "0501111111" } }
  });
  assert.equal(prevented, true);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "/api/profile/settings");
  assert.equal(requests[0].options.method, "PATCH");
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    full_name: "Owner Updated",
    phone: "0501111111"
  });
});

test("primary Settings retains an existing photo reference when saving other fields", async () => {
  const requests = [];
  const url = "https://example.test/private/profile.jpg";
  const form = mount({ full_name: "Owner", profile_image_url: url }, requests);
  await form.props.onSubmit({
    preventDefault() {},
    currentTarget: { fields: { full_name: "Owner Updated", phone: "" } }
  });
  assert.equal(requests.length, 1);
  assert.equal(JSON.parse(requests[0].options.body).profile_image_url, url);
});
