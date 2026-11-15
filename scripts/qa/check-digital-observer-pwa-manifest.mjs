import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

function loadTypeScript(file, imports = {}) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const exports = {};
  runInNewContext(compiled, { exports, require: (name) => {
    assert.ok(Object.hasOwn(imports, name), `Unexpected import: ${name}`);
    return imports[name];
  } });
  return exports;
}

test("Observer PWA has a stable identity confined to its product scope", async () => {
  const observer = loadTypeScript("../../app/digital-observer/manifest.webmanifest/route.ts", {
    "next/server": { NextResponse: { json: (body) => ({ json: async () => body }) } }
  });
  const manifest = await observer.GET().json();
  assert.equal(manifest.id, "/digital-observer/");
  assert.equal(manifest.scope, "/digital-observer/");
  assert.equal(manifest.start_url, "/digital-observer/dashboard");
  const origin = "https://qa.example.invalid";
  assert.ok(new URL(manifest.start_url, origin).href.startsWith(new URL(manifest.scope, origin).href));
});

test("Observer PWA identity remains distinct from the unchanged Gan root manifest", () => {
  const gan = loadTypeScript("../../app/manifest.ts").default();
  assert.equal(gan.scope, "/");
  assert.equal(gan.start_url, "/");
  assert.notEqual("/digital-observer/", gan.id ?? gan.start_url);
});
