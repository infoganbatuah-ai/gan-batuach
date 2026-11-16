import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("../../", import.meta.url);
const project = fileURLToPath(new URL("ios/App/App.xcodeproj/project.pbxproj", root));
const object = JSON.parse(execFileSync("plutil", ["-convert", "json", "-o", "-", project], { encoding: "utf8" }));
const configurations = object.objects["504EC3161FED79650016851F"].buildConfigurations
  .map((id) => object.objects[id]);
const byName = Object.fromEntries(configurations.map((configuration) => [configuration.name, configuration.buildSettings]));

assert.deepEqual(configurations.map((configuration) => configuration.name), ["Debug", "Release", "PersonalTeamQA"]);
assert.equal(byName.Debug.CODE_SIGN_ENTITLEMENTS, "App/App.entitlements");
assert.equal(byName.Release.CODE_SIGN_ENTITLEMENTS, "App/App.entitlements");
assert.equal(byName.Debug.APS_ENVIRONMENT, "development");
assert.equal(byName.Release.APS_ENVIRONMENT, "production");
assert.equal(byName.PersonalTeamQA.CODE_SIGN_ENTITLEMENTS, "");
assert.equal(byName.PersonalTeamQA.APS_ENVIRONMENT, undefined);
assert.equal(byName.PersonalTeamQA.CODE_SIGN_STYLE, "Automatic");
assert.equal(byName.PersonalTeamQA.PRODUCT_BUNDLE_IDENTIFIER, "com.ganbatuach.app.qa");
assert.equal(byName.PersonalTeamQA.APP_DISPLAY_NAME, "גן בטוח QA");
assert.equal(byName.PersonalTeamQA.PUSH44_QA_CALLBACK_SCHEME, "off");
assert.equal(byName.PersonalTeamQA.INFOPLIST_FILE,
  "../qa-personal-team/Info-$(PUSH44_QA_CALLBACK_SCHEME).plist");
assert.match(byName.PersonalTeamQA.SWIFT_ACTIVE_COMPILATION_CONDITIONS, /PERSONAL_TEAM_QA/);

const normalEntitlements = readFileSync(new URL("ios/App/App/App.entitlements", root), "utf8");
const nativeDelegate = readFileSync(new URL("ios/App/App/AppDelegate.swift", root), "utf8");
const plist = readFileSync(new URL("ios/App/App/Info.plist", root), "utf8");
const script = object.objects["A14400032026102000000003"].shellScript;
const qaConfig = JSON.parse(readFileSync(new URL("ios/qa-personal-team/capacitor.config.json", root), "utf8"));
const qaPage = readFileSync(new URL("ios/qa-personal-team/index.html", root), "utf8");

assert.match(normalEntitlements, /aps-environment/);
assert.match(nativeDelegate, /#if !PERSONAL_TEAM_QA/);
assert.match(nativeDelegate, /capacitorDidRegisterForRemoteNotifications/);
assert.match(plist, /\$\(APP_DISPLAY_NAME\)/);
assert.match(script, /\$CONFIGURATION.*PersonalTeamQA/);
assert.match(script, /prepare-push44-qa-callback\.mjs/);
assert.doesNotMatch(script, /Delete :CFBundleURLTypes/);
const qaInfo = (name) => JSON.parse(execFileSync("plutil", ["-convert", "json", "-o", "-",
  fileURLToPath(new URL(`ios/qa-personal-team/Info-${name}.plist`, root))], { encoding: "utf8" }));
const offInfo = qaInfo("off");
const optInInfo = qaInfo("observerqa");
assert.equal(offInfo.CFBundleURLTypes, undefined);
assert.deepEqual(optInInfo.CFBundleURLTypes, [{
  CFBundleURLName: "com.ganbatuach.app.qa.auth", CFBundleURLSchemes: ["observerqa"]
}]);
assert.equal(offInfo.CFBundleIdentifier, "$(PRODUCT_BUNDLE_IDENTIFIER)");
assert.equal(optInInfo.CFBundleIdentifier, offInfo.CFBundleIdentifier);
assert.equal(qaConfig.appId, "com.ganbatuach.app.qa");
assert.equal(qaConfig.server.url, undefined);
assert(!qaConfig.packageClassList.includes("PushNotificationsPlugin"));
assert.equal(qaConfig.appName, "גן בטוח QA");
assert.match(qaPage, /גן בטוח QA/);
assert.match(qaPage, /מקומי בלבד/);
assert.match(qaPage, /APNs כבויים/);
assert(!/https?:\/\//.test(qaPage), "offline QA page must not contact an external host");

// The build phase validates a named source-plist mode and never mutates a
// generated Info.plist, whose processing order Xcode may change incrementally.
const fixture = mkdtempSync(join(tmpdir(), "push44-qa-incremental-"));
try {
  const bundle = join(fixture, "App.app");
  mkdirSync(bundle);
  const baseEnv = { ...process.env };
  delete baseEnv.PUSH44_QA_CALLBACK_SCHEME;
  for (let attempt = 0; attempt < 2; attempt++) {
    execFileSync("/bin/sh", ["-c", script], {
      env: { ...baseEnv, CONFIGURATION: "PersonalTeamQA",
        SRCROOT: fileURLToPath(new URL("ios/App", root)),
        TARGET_BUILD_DIR: fixture, UNLOCALIZED_RESOURCES_FOLDER_PATH: "App.app",
        PUSH44_QA_HTTPS_URL: "", PUSH44_QA_CALLBACK_SCHEME: "off" }, stdio: "pipe"
    });
    const config = JSON.parse(readFileSync(join(bundle, "capacitor.config.json"), "utf8"));
    assert.equal(config.server.url, undefined);
    assert(!config.packageClassList.includes("PushNotificationsPlugin"));
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    execFileSync("/bin/sh", ["-c", script], {
      env: { ...baseEnv, CONFIGURATION: "PersonalTeamQA",
        SRCROOT: fileURLToPath(new URL("ios/App", root)),
        TARGET_BUILD_DIR: fixture, UNLOCALIZED_RESOURCES_FOLDER_PATH: "App.app",
        PUSH44_QA_HTTPS_URL: "", PUSH44_QA_CALLBACK_SCHEME: "observerqa" }, stdio: "pipe"
    });
  }
  for (const invalid of ["", "digitalobserver", "observerqa://evil", "ObserverQA"]) {
    assert.throws(() => execFileSync("/bin/sh", ["-c", script], {
      env: { ...baseEnv, CONFIGURATION: "PersonalTeamQA",
        SRCROOT: fileURLToPath(new URL("ios/App", root)),
        TARGET_BUILD_DIR: fixture, UNLOCALIZED_RESOURCES_FOLDER_PATH: "App.app",
        PUSH44_QA_HTTPS_URL: "", PUSH44_QA_CALLBACK_SCHEME: invalid }, stdio: "pipe"
    }));
  }
} finally { rmSync(fixture, { recursive: true }); }

console.log("PUSH 44 Personal Team QA configuration PASS: default callback off, exact observerqa opt-in only; canonical APNs preserved, no Push bridge or remote URL.");
