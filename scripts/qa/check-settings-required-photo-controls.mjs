import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";

// Compile the actual TSX components, then render their element trees with
// isolated in-memory hooks. No application, upload, HTTP, or database runs.
const modulesRoot = path.resolve(process.env.GB_QA_MODULES_ROOT ?? "node_modules");
const ts = createRequire(import.meta.url)(path.join(modulesRoot, "typescript"));
const photoUrl = "https://example.invalid/profile.jpg";
const replacementUrl = "https://example.invalid/replacement.jpg";
const fields = {
  full_name: "Test Owner",
  phone: "0500000000",
  address: "",
  emergency_contact: "",
};

function nodes(tree, predicate) {
  const found = [];
  function visit(value) {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    if (predicate(value)) found.push(value);
    visit(value.props?.children);
  }
  visit(tree);
  return found;
}

function labelText(tree) {
  if (typeof tree === "string") return tree;
  if (Array.isArray(tree)) return tree.map(labelText).join("");
  return tree?.props ? labelText(tree.props.children) : "";
}

function formOf(tree) {
  const form = nodes(tree, (node) => node.type === "form")[0];
  assert.ok(form, "component must render a form");
  return form;
}

function uploadOf(tree) {
  const field = nodes(tree, (node) => node.type === uploadStub && node.props.bucket === "profile-photos")[0];
  assert.ok(field, "profile photo upload must remain available");
  return field;
}

function removeButtons(tree) {
  return nodes(tree, (node) => node.type === "button" && /הסר/.test(labelText(node)));
}

function uploadStub() {}

function renderActual(relativePath, exportName, props) {
  const source = readFileSync(path.resolve(relativePath), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: relativePath,
    reportDiagnostics: true,
  });
  assert.deepEqual(compiled.diagnostics ?? [], [], "TSX transpilation must succeed");
  const hooks = [];
  const requests = [];
  let hookIndex = 0;
  const exports = {};
  const jsx = (type, props) => ({ type, props: props ?? {} });
  const requireMock = (name) => {
    if (name === "react") return { useState };
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
    if (name === "next/link") return { default: function Link() {} };
    if (name === "@/components/upload-image-field") return { UploadImageField: uploadStub };
    throw new Error("Unexpected import: " + name);
  };
  function useState(initial) {
    const slot = hookIndex++;
    if (!(slot in hooks)) hooks[slot] = initial;
    return [hooks[slot], (next) => { hooks[slot] = typeof next === "function" ? next(hooks[slot]) : next; }];
  }
  class FakeFormData {
    constructor(target) { this.values = target.fields; }
    get(key) { return this.values[key] ?? null; }
    entries() { return Object.entries(this.values)[Symbol.iterator](); }
  }
  const context = {
    module: { exports },
    exports,
    require: requireMock,
    FormData: FakeFormData,
    fetch: async (url, options) => {
      requests.push({ url, options, payload: JSON.parse(options.body) });
      return { ok: true, json: async () => ({}) };
    },
  };
  vm.runInNewContext(compiled.outputText, context, { filename: relativePath, timeout: 1000 });
  const Component = context.module.exports[exportName];
  assert.equal(typeof Component, "function");
  return {
    requests,
    render() { hookIndex = 0; return Component(props); },
  };
}

async function submit(tree) {
  let prevented = false;
  await formOf(tree).props.onSubmit({
    preventDefault() { prevented = true; },
    currentTarget: { fields },
  });
  assert.equal(prevented, true);
}

const primary = "components/settings-primary-profile-form.tsx";
const generic = "components/profile-settings-form.tsx";

test("primary Settings keeps replacement, never offers removal, and saves the existing photo", async () => {
  const app = renderActual(primary, "SettingsPrimaryProfileForm", {
    profile: { full_name: fields.full_name, profile_image_url: photoUrl },
    email: "test@example.invalid",
    roleLabel: "Owner",
  });
  const tree = app.render();
  assert.equal(removeButtons(tree).length, 0);
  assert.equal(uploadOf(tree).props.label, "החלפת תמונה");
  await submit(tree);
  assert.equal(app.requests.length, 1);
  assert.equal(app.requests[0].payload.profile_image_url, photoUrl);
});

test("primary Settings saves other profile fields without a photo and accepts a later upload", async () => {
  const app = renderActual(primary, "SettingsPrimaryProfileForm", {
    profile: { full_name: fields.full_name, profile_image_url: null },
    email: "test@example.invalid",
    roleLabel: "Manager",
  });
  let tree = app.render();
  assert.equal(uploadOf(tree).props.label, "העלאת תמונה");
  await submit(tree);
  assert.equal(app.requests.length, 1);
  assert.equal("profile_image_url" in app.requests[0].payload, false);
  uploadOf(tree).props.onUploaded(replacementUrl);
  tree = app.render();
  assert.equal(uploadOf(tree).props.label, "החלפת תמונה");
  assert.equal(removeButtons(tree).length, 0);
  await submit(tree);
  assert.equal(app.requests.length, 2);
  assert.equal(app.requests[1].payload.profile_image_url, replacementUrl);
});

test("generic required-photo form hides removal but still allows replacement", async () => {
  const app = renderActual(generic, "ProfileSettingsForm", {
    profile: { full_name: fields.full_name, profile_image_url: photoUrl },
    roleLabel: "Owner",
    requireProfilePhoto: true,
  });
  let tree = app.render();
  assert.equal(removeButtons(tree).length, 0);
  assert.equal(uploadOf(tree).props.label, "החלפת תמונה");
  uploadOf(tree).props.onUploaded(replacementUrl);
  tree = app.render();
  await submit(tree);
  assert.equal(app.requests.length, 1);
  assert.equal(app.requests[0].payload.profile_image_url, replacementUrl);
});

test("generic required-photo form refuses a no-photo save", async () => {
  const app = renderActual(generic, "ProfileSettingsForm", {
    profile: { full_name: fields.full_name, profile_image_url: null },
    roleLabel: "Staff",
    requireProfilePhoto: true,
  });
  const tree = app.render();
  assert.equal(removeButtons(tree).length, 0);
  await submit(tree);
  assert.equal(app.requests.length, 0);
});

test("generic optional-photo form preserves a working remove-and-clear path", async () => {
  const app = renderActual(generic, "ProfileSettingsForm", {
    profile: { full_name: fields.full_name, profile_image_url: photoUrl },
    roleLabel: "Parent",
    requireProfilePhoto: false,
  });
  let tree = app.render();
  const remove = removeButtons(tree);
  assert.equal(remove.length, 1);
  remove[0].props.onClick();
  tree = app.render();
  assert.equal(removeButtons(tree).length, 0);
  await submit(tree);
  assert.equal(app.requests.length, 1);
  assert.equal(app.requests[0].payload.profile_image_url, "");
});

test("generic optional-photo form without a photo has no removal control", () => {
  const app = renderActual(generic, "ProfileSettingsForm", {
    profile: { full_name: fields.full_name, profile_image_url: null },
    roleLabel: "Admin",
    requireProfilePhoto: false,
  });
  const tree = app.render();
  assert.equal(removeButtons(tree).length, 0);
  assert.equal(uploadOf(tree).props.label, "העלאת תמונה");
});
