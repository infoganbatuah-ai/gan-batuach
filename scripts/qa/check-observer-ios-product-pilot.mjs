import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, sep } from "node:path";
import test from "node:test";
import { finalizeProductPilot } from "./finalize-observer-ios-product-pilot.mjs";

const disk = "/Volumes/DIGITAL_OBSERVER";
const requestedRoot = process.env.OBSERVER_PILOT_TEST_ROOT;
if (!requestedRoot || !isAbsolute(requestedRoot)) {
  throw new Error("OBSERVER_PILOT_TEST_ROOT must be an existing absolute directory under " + disk);
}
const testRoot = realpathSync(requestedRoot);
const relativeRoot = relative(disk, testRoot);
if (!relativeRoot || relativeRoot === ".." || relativeRoot.startsWith(".." + sep) || isAbsolute(relativeRoot)) {
  throw new Error("OBSERVER_PILOT_TEST_ROOT must resolve beneath " + disk);
}

const appId = "com.digitalobserver.app.pilot";
const template = readFileSync(new URL("../../ios/observer-product-pilot/Info.plist", import.meta.url), "utf8");
function bundle(t, id = appId, extraInfo = "") {
  const root = mkdtempSync(join(testRoot, "observer-pilot-source-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const app = join(root, "App.app");
  mkdirSync(join(app, "public"), { recursive: true });
  writeFileSync(join(app, "Info.plist"), template.replace("$(PRODUCT_BUNDLE_IDENTIFIER)", id)
    .replace("$(APP_DISPLAY_NAME)", "תצפיתן דיגיטלי פיילוט").replace("</dict>\n</plist>", extraInfo + "</dict>\n</plist>"));
  writeFileSync(join(app, "public", "legacy.html"), "synthetic inherited content");
  return app;
}

test("pilot replaces inherited web resources and opens only the fixed Product login origin", t => {
  const app = bundle(t);
  writeFileSync(join(app, "capacitor.config.json"), JSON.stringify({ server: {
    url: "https://observer-qa.ganbatuach.com", allowNavigation: ["*"]
  } }));
  finalizeProductPilot(app);
  const config = JSON.parse(readFileSync(join(app, "capacitor.config.json"), "utf8"));
  assert.equal(config.appId, appId);
  assert.equal(new URL(config.server.appStartPath, config.server.url).href,
    "https://gan-batuach.vercel.app/digital-observer/login");
  assert.equal(config.server.cleartext, false);
  assert.equal(config.server.allowNavigation, undefined);
  assert.deepEqual(config.packageClassList, ["AppPlugin"]);
  assert.equal(existsSync(join(app, "public", "legacy.html")), false);
  for (const file of ["index.html", "offline.html", config.server.appStartPath]) {
    assert.doesNotMatch(readFileSync(join(app, "public", file), "utf8"), /https?:|<script|observerqa/i);
  }
});

test("QA and Gan package identities are rejected before resources change", t => {
  for (const id of ["com.digitalobserver.app.qa", "com.ganbatuach.app.qa", "com.ganbatuach.app"]) {
    const app = bundle(t, id);
    assert.throws(() => finalizeProductPilot(app), /PRODUCT_PILOT_IDENTITY_OR_CAPABILITIES_INVALID/);
    assert.ok(existsSync(join(app, "public", "legacy.html")));
  }
});

test("callback, transport exception and signature assets block finalization", t => {
  for (const key of ["CFBundleURLTypes", "NSAppTransportSecurity", "aps-environment"]) {
    assert.throws(() => finalizeProductPilot(bundle(t, appId, "<key>" + key + "</key><true/>")),
      /PRODUCT_PILOT_IDENTITY_OR_CAPABILITIES_INVALID/);
  }
  for (const file of ["_CodeSignature", "embedded.mobileprovision", "GoogleService-Info.plist"]) {
    const app = bundle(t);
    writeFileSync(join(app, file), "synthetic");
    assert.throws(() => finalizeProductPilot(app), /PRODUCT_PILOT_UNSIGNED_ONLY/);
  }
});

test("Product override excludes QA Swift bridges without changing the QA origin contract", () => {
  const config = readFileSync(new URL("../../ios/observer-product-pilot/ObserverProductPilot.xcconfig", import.meta.url), "utf8");
  assert.match(config, /^PRODUCT_BUNDLE_IDENTIFIER = com\.digitalobserver\.app\.pilot$/m);
  assert.match(config, /^SWIFT_ACTIVE_COMPILATION_CONDITIONS = OBSERVER_PRODUCT_PILOT$/m);
  assert.match(config, /^CODE_SIGNING_ALLOWED = NO$/m);
  const qaFinalizer = readFileSync(new URL("./finalize-observer-ios-qa.swift", import.meta.url), "utf8");
  assert.doesNotMatch(qaFinalizer, /gan-batuach\.vercel\.app/);
  assert.match(qaFinalizer, /observer-qa\.ganbatuach\.com/);
});
