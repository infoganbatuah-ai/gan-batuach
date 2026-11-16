import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, join, sep } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { nestedCodePaths, verifyObserverQaSignatures } from "./sign-observer-ios-qa.mjs";

const repoRoot = realpathSync(fileURLToPath(new URL("../../", import.meta.url)));
assert.ok(repoRoot.startsWith("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/"));
const cacheRoot = join(repoRoot, ".dev-cache", "tmp");
mkdirSync(cacheRoot, { recursive: true });
const temporary = mkdtempSync(join(cacheRoot, "observer-qa-nested-sign-"));
after(() => {
  const root = realpathSync(cacheRoot);
  const target = realpathSync(temporary);
  assert.ok(target.startsWith(`${root}${sep}`) && basename(target).startsWith("observer-qa-nested-sign-"));
  rmSync(target, { recursive: true });
});
const app = join(temporary, "Observer.app");
mkdirSync(app);
writeFileSync(join(app, "Info.plist"), `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict><key>CFBundleIdentifier</key><string>com.digitalobserver.app.qa</string></dict></plist>`);
const dylib = join(app, "App.debug.dylib");
execFileSync("/usr/bin/clang", ["-dynamiclib", "-x", "c", "-", "-o", dylib],
  { input: "int observer_qa_fixture(void) { return 1; }\n" });

test("unsigned nested debug dylib fails even if outer app signature appears valid", () => {
  assert.deepEqual(nestedCodePaths(app), [dylib]);
  const unsigned = join(temporary, "unsigned.debug.dylib");
  copyFileSync(dylib, unsigned);
  execFileSync("/usr/bin/codesign", ["--force", "--sign", "-", app]);
  copyFileSync(unsigned, dylib);
  execFileSync("/usr/bin/codesign", ["--remove-signature", dylib]);
  assert.throws(() => verifyObserverQaSignatures(app), /OBSERVER_QA_NESTED_SIGNATURE_INVALID/);
});

test("nested-first recipe and no-Push guard are retained", () => {
  const source = readFileSync(new URL("./sign-observer-ios-qa.mjs", import.meta.url), "utf8");
  const nestedSign = source.indexOf("for (const path of nestedCodePaths(app))");
  const outerSign = source.indexOf('"--generate-entitlement-der", app]');
  assert.ok(nestedSign >= 0 && outerSign > nestedSign);
  assert.match(source, /OBSERVER_QA_PUSH_ENTITLEMENT_FORBIDDEN/);
  assert.match(source, /OBSERVER_QA_BUNDLE_MISMATCH/);
});

test("symlinked nested code is rejected instead of silently skipped", () => {
  const link = join(app, "Linked.debug.dylib");
  symlinkSync(dylib, link);
  try { assert.throws(() => nestedCodePaths(app), /OBSERVER_QA_SYMLINK_FORBIDDEN/); }
  finally { unlinkSync(link); }
});

test("unexpected nested Mach-O executable is rejected", () => {
  const unexpected = join(app, "UnlistedHelper");
  execFileSync("/usr/bin/clang", ["-x", "c", "-", "-o", unexpected],
    { input: "int main(void) { return 0; }\n" });
  assert.throws(() => nestedCodePaths(app), /OBSERVER_QA_UNEXPECTED_EXECUTABLE/);
});
