import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const plist = (path) => JSON.parse(execFileSync("plutil", ["-convert", "json", "-o", "-", new URL(path, root).pathname], { encoding: "utf8" }));

test("Observer iOS QA source has separate identity, callback and offline launch surface", () => {
  const config = JSON.parse(read("ios/qa-observer/capacitor.config.json"));
  const info = plist("ios/qa-observer/Info.plist");
  const settings = read("ios/qa-observer/ObserverQA.xcconfig");
  assert.equal(config.appId, "com.digitalobserver.app.qa");
  assert.equal(config.appName, "תצפיתן דיגיטלי");
  assert.equal(config.server.url, "https://observer-qa.example.invalid/digital-observer/dashboard");
  assert.ok(!config.packageClassList.includes("PushNotificationsPlugin"));
  assert.deepEqual(info.CFBundleURLTypes[0].CFBundleURLSchemes, ["observerqaapp"]);
  assert.equal(info.CFBundleURLTypes[0].CFBundleURLName, "com.digitalobserver.app.qa.auth");
  assert.ok(!Object.hasOwn(info, "aps-environment"));
  assert.ok(!Object.hasOwn(info, "com.apple.developer.associated-domains"));
  assert.match(settings, /^PRODUCT_BUNDLE_IDENTIFIER = com\.digitalobserver\.app\.qa$/m);
  assert.match(settings, /^APP_DISPLAY_NAME = תצפיתן דיגיטלי$/m);
  assert.match(settings, /^ASSETCATALOG_COMPILER_APPICON_NAME = ObserverQAIcon$/m);
  assert.match(settings, /^CODE_SIGNING_ALLOWED = NO$/m);
  assert.match(settings, /^CODE_SIGN_ENTITLEMENTS =$/m);
  assert.equal(info.UILaunchStoryboardName, "ObserverQALaunch");
  const icon = JSON.parse(read("ios/App/App/Assets.xcassets/ObserverQAIcon.appiconset/Contents.json"));
  const launchMark = JSON.parse(read("ios/App/App/Assets.xcassets/ObserverQALaunchMark.imageset/Contents.json"));
  const launch = read("ios/qa-observer/ObserverQALaunch.storyboard");
  assert.equal(icon.images[0].filename, "ObserverQAIcon.png");
  assert.equal(launchMark.images[0].filename, "ObserverQALaunchMark.png");
  assert.match(launch, /image="ObserverQALaunchMark"/);
  assert.doesNotMatch(launch, /image="Splash"/);
});

test("Existing PersonalTeamQA and Gan release identities remain separate", () => {
  const ganConfig = JSON.parse(read("ios/qa-personal-team/capacitor.config.json"));
  const project = read("ios/App/App.xcodeproj/project.pbxproj");
  assert.equal(ganConfig.appId, "com.ganbatuach.app.qa");
  assert.notEqual(ganConfig.appId, "com.digitalobserver.app.qa");
  assert.match(project, /PRODUCT_BUNDLE_IDENTIFIER = com\.ganbatuach\.app\.qa;/);
  assert.match(project, /PRODUCT_BUNDLE_IDENTIFIER = com\.ganbatuach\.app;/);
  assert.doesNotMatch(project, /com\.digitalobserver\.app\.qa/);
});
