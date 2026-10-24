import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
assert.equal(byName.PersonalTeamQA.APP_DISPLAY_NAME, "Digital Observer QA");
assert.match(byName.PersonalTeamQA.SWIFT_ACTIVE_COMPILATION_CONDITIONS, /PERSONAL_TEAM_QA/);

const normalEntitlements = readFileSync(new URL("ios/App/App/App.entitlements", root), "utf8");
const nativeDelegate = readFileSync(new URL("ios/App/App/AppDelegate.swift", root), "utf8");
const plist = readFileSync(new URL("ios/App/App/Info.plist", root), "utf8");
const script = object.objects["A14400032026102000000003"].shellScript;
const qaConfig = JSON.parse(readFileSync(new URL("ios/qa-personal-team/capacitor.config.json", root), "utf8"));
const qaPage = readFileSync(new URL("ios/qa-personal-team/index.html", root), "utf8");
const deviceBridge = readFileSync(new URL("ios/App/App/Push44QaDeviceProof.swift", root), "utf8");

assert.match(normalEntitlements, /aps-environment/);
assert.match(nativeDelegate, /#if !PERSONAL_TEAM_QA/);
assert.match(nativeDelegate, /capacitorDidRegisterForRemoteNotifications/);
assert.match(plist, /\$\(APP_DISPLAY_NAME\)/);
assert.match(script, /\$CONFIGURATION.*PersonalTeamQA/);
assert.match(script, /Delete :CFBundleURLTypes/);
assert.match(script, /Print :CFBundleURLTypes/);
assert.equal(qaConfig.appId, "com.ganbatuach.app.qa");
assert.equal(qaConfig.server.url, undefined);
assert(!qaConfig.packageClassList.includes("PushNotificationsPlugin"));
assert.match(qaPage, /Digital Observer QA/);
assert.match(qaPage, /מקומי בלבד/);
assert.match(qaPage, /APNs כבויים/);
assert(!/https?:\/\//.test(qaPage), "offline QA page must not contact an external host");
assert.match(deviceBridge, /host == "qa-iphone-device-proof\.ganbatuach\.com"/);
assert.doesNotMatch(deviceBridge, /host\.hasPrefix\("qa-iphone-"\)/);

// The future control-only binary is prepared without the old bearer-token URL.
// No route is opened by generating this config.
const controlFixture = mkdtempSync(join(tmpdir(), "push44-control-config-"));
try {
  const output = join(controlFixture, "capacitor.config.json");
  const prepare = fileURLToPath(new URL("scripts/qa/prepare-push44-iphone-qa-config.mjs", root));
  const template = fileURLToPath(new URL("ios/qa-personal-team/capacitor.config.json", root));
  const host = "qa-iphone-device-proof.ganbatuach.com";
  const env = { ...process.env, PUSH44_QA_CONTROL_ONLY: "1", PUSH44_QA_HOST: host,
    PUSH44_QA_TOKEN_FILE: "" };
  const generate = (url, override = {}) => execFileSync(process.execPath,
    [prepare, template, output, url], { env: { ...env, ...override }, stdio: "pipe" });
  generate(`https://${host}/`);
  const control = JSON.parse(readFileSync(output, "utf8"));
  assert.equal(control.server.url, `https://${host}/`);
  assert.equal(control.server.cleartext, false);
  assert.deepEqual(control.server.allowNavigation, [host]);
  assert.doesNotMatch(JSON.stringify(control), /__push44\/bootstrap|[?&]t=/);
  assert(!control.packageClassList.includes("PushNotificationsPlugin"));
  for (const invalid of [`http://${host}/`, `https://${host}/digital-observer`,
    `https://${host}/?token=bad`, "https://qa-iphone-other.ganbatuach.com/"]) {
    assert.throws(() => generate(invalid));
  }
  assert.throws(() => generate(`https://${host}/`, { PUSH44_QA_TOKEN_FILE: "/private/tmp/not-read" }));
  assert.throws(() => generate(`https://${host}/digital-observer`,
    { PUSH44_QA_CONTROL_ONLY: "", PUSH44_QA_TOKEN_FILE: "/private/tmp/not-read" }));
} finally { rmSync(controlFixture, { recursive: true }); }

// Xcode may reuse the already-transformed Info.plist on incremental builds.
// Only an absent optional key may be ignored; other script failures still fail.
const fixture = mkdtempSync(join(tmpdir(), "push44-qa-incremental-"));
try {
  const bundle = join(fixture, "App.app");
  mkdirSync(bundle);
  const info = join(bundle, "Info.plist");
  writeFileSync(info, '<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>com.ganbatuach.app.qa</string><key>CFBundleURLTypes</key><array><dict><key>CFBundleURLSchemes</key><array><string>digitalobserver</string></array></dict></array></dict></plist>');
  for (let attempt = 0; attempt < 2; attempt++) {
    execFileSync("/bin/sh", ["-c", script], {
      env: { ...process.env, CONFIGURATION: "PersonalTeamQA",
        SRCROOT: fileURLToPath(new URL("ios/App", root)),
        TARGET_BUILD_DIR: fixture, UNLOCALIZED_RESOURCES_FOLDER_PATH: "App.app",
        PUSH44_QA_HTTPS_URL: "" }, stdio: "pipe"
    });
    const transformed = JSON.parse(execFileSync("plutil", ["-convert", "json", "-o", "-", info], { encoding: "utf8" }));
    assert.equal(transformed.CFBundleIdentifier, "com.ganbatuach.app.qa");
    assert.equal(transformed.CFBundleURLTypes, undefined);
    const config = JSON.parse(readFileSync(join(bundle, "capacitor.config.json"), "utf8"));
    assert.equal(config.server.url, undefined);
    assert(!config.packageClassList.includes("PushNotificationsPlugin"));
  }
} finally { rmSync(fixture, { recursive: true }); }

console.log("PUSH 44 Personal Team QA configuration PASS: canonical APNs preserved; QA has no APNs entitlement, Push bridge, remote URL or shared deep-link registration.");
