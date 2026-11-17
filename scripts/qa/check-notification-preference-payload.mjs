import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../../lib/management/notification-preference-payload.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
runInNewContext(compiled, { exports, FormData, Set, Object });

test("unavailable provider is omitted, preserving the user's stored consent", () => {
  const form = new FormData();
  form.set("receive_push", "on");
  form.set("receive_email", "on");
  const patch = exports.availableChannelPatch(form, new Set(["push"]));
  assert.deepEqual({ ...patch }, { receive_push: true });
  assert.equal(Object.hasOwn(patch, "receive_email"), false);
});

test("available unchecked provider is explicitly disabled", () => {
  const patch = exports.availableChannelPatch(new FormData(), new Set(["email"]));
  assert.deepEqual({ ...patch }, { receive_email: false });
});

test("unavailable external channel choices survive unrelated saves; in-app is never persisted", () => {
  const channels = exports.externalCategoryChoices({ message: ["in_app", "email", "push"], task: ["in_app"] });
  assert.deepEqual(JSON.parse(JSON.stringify(channels)), { message: ["email", "push"], task: [] });
});
