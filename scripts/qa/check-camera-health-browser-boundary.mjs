import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { cameraOperationalStatuses, normalizeCameraStatus } from "../../lib/domain/camera-status.ts";

const modules = ["camera-status", "camera-safe-columns", "camera-health"];
const source = name => readFileSync(`lib/domain/${name}.ts`, "utf8");
const transpile = (text, module = ts.ModuleKind.ESNext) => ts.transpileModule(text, {
  compilerOptions: { module, target: ts.ScriptTarget.ES2022 }
}).outputText;

// Inspect runtime imports, not erased type imports, before building for the browser.
function assertBrowserImports(name, text) {
  const ast = ts.createSourceFile(`${name}.ts`, text, ts.ScriptTarget.Latest, true);
  for (const node of ast.statements) {
    if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly) {
      assert.ok(modules.some(allowed => node.moduleSpecifier.text === `@/lib/domain/${allowed}`),
        `Unexpected runtime dependency in ${name}`);
    }
  }
}
for (const name of modules) assertBrowserImports(name, source(name));
for (const path of ["node:crypto", "@/lib/domain/video-gateway", "@/lib/supabase/admin", "@/lib/security/encryption"]) {
  assert.throws(() => assertBrowserImports("negative-control", `import { unsafe } from "${path}"; unsafe();`), /Unexpected runtime dependency/);
}
const gatewayAst = ts.createSourceFile("video-gateway.ts", source("video-gateway"), ts.ScriptTarget.Latest, true);
const forwarded = gatewayAst.statements.filter(node => ts.isExportDeclaration(node)
  && node.moduleSpecifier?.text === "@/lib/domain/camera-status")
  .flatMap(node => node.exportClause?.elements?.map(item => item.name.text) ?? []);
assert.deepEqual(forwarded.sort(), ["CameraOperationalStatus", "cameraOperationalStatuses", "normalizeCameraStatus"].sort());
assert.equal(gatewayAst.statements.some(node => ts.isFunctionDeclaration(node) && node.name?.text === "normalizeCameraStatus"), false,
  "Server and browser must not maintain separate status implementations");

const statuses = [
  [undefined, "pending"], [null, "pending"], ["", "pending"], ["unknown", "pending"],
  ["connected", "connected"], [" ONLINE ", "connected"], ["connecting", "connecting"],
  ["offline", "offline"], ["FAILED", "offline"], ["error", "error"], ["disabled", "disabled"]
];
assert.deepEqual(cameraOperationalStatuses, ["connected", "connecting", "pending", "offline", "error", "disabled"]);
for (const [input, expected] of statuses) {
  assert.equal(normalizeCameraStatus(input), expected);
  assert.equal(normalizeCameraStatus(input, false), "disabled");
}

const constants = {};
runInNewContext(transpile(source("camera-safe-columns"), ts.ModuleKind.CommonJS), { exports: constants });
const health = {};
runInNewContext(transpile(source("camera-health"), ts.ModuleKind.CommonJS), {
  exports: health, require: name => {
    if (name === "@/lib/domain/camera-status") return { normalizeCameraStatus };
    if (name === "@/lib/domain/camera-safe-columns") return constants;
    assert.fail("Health module attempted to load a server dependency");
  }
});
const cases = [
  [{ status: "online", health_status: "healthy" }, "online"],
  [{ status: "connected", health_status: "degraded" }, "warning"],
  [{ status: "connected", health_status: "offline" }, "offline"],
  [{ status: "connected", active: false }, "disabled"],
  [{ status: "online", stream_status: "offline" }, "offline"],
  [{ status: "connecting" }, "pending"], [{}, "pending"]
];
for (const [camera, expected] of cases) assert.equal(health.getCameraHealthStatus(camera), expected);
const expectedSummary = { total: 7, online: 1, offline: 2, warning: 1, pending: 2, disabled: 1 };
assert.equal(JSON.stringify(health.summarizeCameraHealth(cases.map(([camera]) => camera))), JSON.stringify(expectedSummary));

// Use the already-installed Next webpack compiler, without polyfills, externals or network.
const require = createRequire(import.meta.url);
const { webpack } = require("next/dist/compiled/webpack/webpack");
const dir = mkdtempSync(join(tmpdir(), "observer-camera-health-browser-"));
let compiler;
try {
  for (const name of modules) writeFileSync(join(dir, `${name}.js`), transpile(source(name)));
  writeFileSync(join(dir, "entry.js"), 'export { getCameraHealthStatus, summarizeCameraHealth } from "./camera-health.js";');
  compiler = webpack({ mode: "production", target: ["web", "es2022"], context: dir, entry: "./entry.js",
    output: { path: join(dir, "output"), filename: "health.js", library: { type: "commonjs2" } },
    cache: false, devtool: false, optimization: { minimize: false },
    resolve: { alias: Object.fromEntries(modules.map(name => [`@/lib/domain/${name}`, join(dir, `${name}.js`)])) }
  });
  const stats = await new Promise((resolve, reject) => compiler.run((error, result) => error ? reject(error) : resolve(result)));
  assert.equal(stats.hasErrors(), false, stats.toString({ all: false, errors: true }));
  const bundle = readFileSync(join(dir, "output", "health.js"), "utf8");
  assert.equal(/node:crypto|createAdminClient|encryptField|SUPABASE_SERVICE_ROLE|GATEWAY_SECRET/.test(bundle), false);
  const output = { exports: {} };
  runInNewContext(bundle, { module: output });
  assert.equal(JSON.stringify(output.exports.summarizeCameraHealth(cases.map(([camera]) => camera))), JSON.stringify(expectedSummary));
  console.log("PASS: shared status compatibility, server re-exports, health semantics and browser-target webpack bundle without server dependencies (synthetic only)");
} finally {
  if (compiler) await new Promise((resolve, reject) => compiler.close(error => error ? reject(error) : resolve()));
  rmSync(dir, { recursive: true, force: true });
}
