import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import ts from "typescript";

const require = createRequire(import.meta.url);
// Test-only loader. Execute real TypeScript while explicitly replacing I/O boundaries.
export function loadTs(file, mocks = {}, cache = new Map()) {
  file = resolve(file);
  if (cache.has(file)) return cache.get(file);
  const loadedModule = { exports: {} };
  cache.set(file, loadedModule.exports);
  const localRequire = (name) => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name === "server-only") return {};
    if (name.startsWith(".") || name.startsWith("@/")) {
      const path = name.startsWith("@/") ? resolve(name.slice(2)) : resolve(dirname(file), name);
      return loadTs(`${path}.ts`, mocks, cache);
    }
    return require(name);
  };
  const js = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const noNetwork = () => { throw new Error("Unexpected network access in unit test"); };
  new Function("require", "module", "exports", "fetch", "process", js)(localRequire, loadedModule, loadedModule.exports, mocks.fetch ?? noNetwork, mocks.process ?? process);
  return loadedModule.exports;
}
