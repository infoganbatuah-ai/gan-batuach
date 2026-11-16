import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const native = source("ios/App/App/AppDelegate.swift");
const project = source("ios/App/App.xcodeproj/project.pbxproj");

test("QA Universal Link entrypoint is default-off and retains Capacitor behavior", () => {
  assert.match(native, /#if PERSONAL_TEAM_QA\s+if QaAccessReturnGate\.enabled/);
  assert.match(native, /static let enabled = false/);
  assert.match(native, /return ApplicationDelegateProxy\.shared\.application\(application, continue: userActivity/);
  assert.match(native, /userActivity\.activityType == NSUserActivityTypeBrowsingWeb/);
});

test("only exact HTTPS state can pass the dormant native parser", () => {
  assert.match(native, /qa-iphone-device-proof\.ganbatuach\.com/);
  assert.match(native, /\/qa\/device-proof\/return/);
  assert.match(native, /parts\.scheme == "https"/);
  assert.match(native, /parts\.host == expectedHost/);
  assert.match(native, /items\.count == 1/);
  assert.match(native, /items\[0\]\.name == "state"/);
  assert.match(native, /pending = nil \/\/ A callback attempt cannot be replayed/);
  assert.match(native, /now < expected\.expires, account == expected\.account/);
  assert.match(native, /bundle\.audience == "com\.ganbatuach\.app\.qa"/);
  assert.match(native, /installation == expected\.installation, bundle\.audience == expected\.audience/);
  assert.match(native, /case "com\.digitalobserver\.app\.qa":/);
  assert.match(native, /callbackScheme: "observerqaapp"/);
  assert.match(native, /case "com\.ganbatuach\.app\.qa":/);
  assert.match(native, /callbackScheme: "observerqa"/);
  assert.match(native, /SecRandomCopyBytes\(kSecRandomDefault/);
  assert.doesNotMatch(native, /print\(.*(?:url|state)|NSLog\(.*(?:url|state)/);
});

test("QA callback source selection remains default-off and native exchange dormant", () => {
  assert.match(project, /CODE_SIGN_ENTITLEMENTS = "";/);
  assert.match(project, /PUSH44_QA_CALLBACK_SCHEME = off/);
  assert.match(project, /Info-\$\(PUSH44_QA_CALLBACK_SCHEME\)\.plist/);
  assert.match(project, /prepare-push44-qa-callback\.mjs/);
  assert.match(native, /static let identityProvider: \(\(\) -> Identity\?\)\? = nil/);
  assert.match(native, /return ASWebAuthenticationSession\(url: startURL, callbackURLScheme: bundle\.callbackScheme\)/);
  assert.match(native, /QaBundleIdentity\.current\(\) == bundle/);
  assert.match(native, /callback\?\.absoluteString == "\\?\(bundle\.callbackScheme\):\/\/return\/qa\/device-proof\?state=/);
  assert.match(native, /identityProvider\?\(\) == identity/);
  assert.match(native, /consumed = true \/\/ A failed return also burns this local one-use attempt/);
  assert.doesNotMatch(native, /\.start\(\)|URLSession\.shared|exchangeCodeForSession/);
});
