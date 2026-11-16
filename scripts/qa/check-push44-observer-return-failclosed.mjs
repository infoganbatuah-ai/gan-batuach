import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../../ios/App/App/AppDelegate.swift", import.meta.url), "utf8");
const between = (start, end) => source.slice(source.indexOf(start), source.indexOf(end));
const universal = between("enum QaAccessReturnGate", "enum QaAsWebAuthReturn");
const webAuth = between("enum QaAsWebAuthReturn", "enum QaSecureEnclaveProof");

test("Observer remains a distinct native installation identity", () => {
  assert.match(source, /case "com\.digitalobserver\.app\.qa":\s*return QaBundleIdentity\(audience: "com\.digitalobserver\.app\.qa", callbackScheme: "observerqaapp"\)/);
  assert.match(source, /case "com\.ganbatuach\.app\.qa":\s*return QaBundleIdentity\(audience: "com\.ganbatuach\.app\.qa", callbackScheme: "observerqa"\)/);
});

test("Gan-only Universal Link cannot be begun or consumed by Observer", () => {
  assert.match(universal, /static let enabled = false/);
  assert.match(universal, /expectedHost = "qa-iphone-device-proof\.ganbatuach\.com"/);
  assert.match(universal, /static func begin[\s\S]*?bundle\.audience == "com\.ganbatuach\.app\.qa"/);
  assert.match(universal, /static func consume[\s\S]*?bundle\.audience == "com\.ganbatuach\.app\.qa"/);
});

test("Gan-only system-browser start cannot be prepared by Observer", () => {
  assert.match(webAuth, /static let enabled = false/);
  assert.match(webAuth, /identityProvider: \(\(\) -> Identity\?\)\? = nil/);
  assert.match(webAuth, /static func prepare[\s\S]*?bundle\.audience == "com\.ganbatuach\.app\.qa"/);
  assert.match(webAuth, /qa-iphone-device-proof\.ganbatuach\.com\/qa\/device-proof\/start/);
  assert.match(webAuth, /callback\?\.absoluteString == "\\\(bundle\.callbackScheme\):\/\/return\/qa\/device-proof\?state=/);
});
