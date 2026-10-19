import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

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
assert.equal(byName.PersonalTeamQA.APP_DISPLAY_NAME, "Digital Observer QA");
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
assert.match(script, /Delete :CFBundleURLTypes/);
assert.equal(qaConfig.appId, "com.ganbatuach.app.qa");
assert.equal(qaConfig.server.url, undefined);
assert(!qaConfig.packageClassList.includes("PushNotificationsPlugin"));
assert.match(qaPage, /Digital Observer QA/);
assert.match(qaPage, /מקומי בלבד/);
assert.match(qaPage, /APNs כבויים/);
assert(!/https?:\/\//.test(qaPage), "offline QA page must not contact an external host");

console.log("PUSH 44 Personal Team QA configuration PASS: canonical APNs preserved; QA has no APNs entitlement, Push bridge, remote URL or shared deep-link registration.");
