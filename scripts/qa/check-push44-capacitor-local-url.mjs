import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../../capacitor.config.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS}}).outputText;
function config(env = {}) {
  const exports = {};
  runInNewContext(compiled, {exports, process: {env}, URL});
  return exports.default;
}

test("mobile URL and profile must be explicit; web URL is never a fallback", () => {
  assert.throws(() => config(), /CAPACITOR_SERVER_URL_REQUIRED/);
  assert.throws(() => config({NEXT_PUBLIC_APP_URL: "https://ganbatuach.com"}), /CAPACITOR_SERVER_URL_REQUIRED/);
  assert.throws(() => config({CAPACITOR_BUILD_PROFILE: "unknown", CAPACITOR_SERVER_URL: "http://localhost:3000"}), /CAPACITOR_BUILD_PROFILE_INVALID/);
});

test("Development permits exact loopback HTTP only and uses separate QA identity", () => {
  for (const url of ["http://localhost:3000", "http://127.0.0.1:3000"]) {
    const actual = config({CAPACITOR_SERVER_URL: url});
    assert.equal(actual.appId, "com.ganbatuach.app.qa");
    assert.equal(actual.server.url, url);
    assert.equal(actual.server.cleartext, true);
  }
  for (const url of ["http://10.0.2.2:3000", "http://127.1:3000", "http://2130706433:3000",
    "http://localhost.evil.test", "http://user@localhost:3000", "http://localhost:bad",
    "http://evil.test", "http://localhost:3000/path", "http://localhost:3000/?token=x",
    "http://localhost:3000/#fragment", "http://localhost./", "http://localhost%2eevil.test"]) {
    assert.throws(() => config({CAPACITOR_SERVER_URL: url}), /CAPACITOR_(SERVER_URL_INVALID|HTTPS_REQUIRED)/, url);
  }
});

test("QA and release require exact approved HTTPS origin", () => {
  for (const profile of ["qa", "release"]) {
    assert.throws(() => config({CAPACITOR_BUILD_PROFILE: profile, CAPACITOR_SERVER_URL: "http://localhost:3000"}), /CAPACITOR_HTTPS_REQUIRED/);
    assert.throws(() => config({CAPACITOR_BUILD_PROFILE: profile, CAPACITOR_SERVER_URL: "https://qa.example.test"}), /CAPACITOR_SERVER_ORIGIN_NOT_APPROVED/);
    assert.throws(() => config({CAPACITOR_BUILD_PROFILE: profile, CAPACITOR_SERVER_URL: "https://other.example.test",
      CAPACITOR_ALLOWED_SERVER_ORIGIN: "https://qa.example.test"}), /CAPACITOR_SERVER_ORIGIN_NOT_APPROVED/);
    const actual = config({CAPACITOR_BUILD_PROFILE: profile, CAPACITOR_SERVER_URL: "https://qa.example.test",
      CAPACITOR_ALLOWED_SERVER_ORIGIN: "https://qa.example.test"});
    assert.equal(actual.appId, profile === "release" ? "com.ganbatuach.app" : "com.ganbatuach.app.qa");
    assert.equal(actual.server.cleartext, false);
  }
});

test("Android policy sources deny general cleartext and retain deep-link/Push boundary", () => {
  const root = new URL("../../", import.meta.url);
  const manifest = readFileSync(new URL("android/app/src/main/AndroidManifest.xml", root), "utf8");
  const release = readFileSync(new URL("android/app/src/main/res/xml/network_security_config.xml", root), "utf8");
  const debug = readFileSync(new URL("android/app/src/debug/res/xml/network_security_config.xml", root), "utf8");
  const gradle = readFileSync(new URL("android/app/build.gradle", root), "utf8");
  assert.match(manifest, /android:usesCleartextTraffic="false"/);
  assert.match(manifest, /android:networkSecurityConfig="@xml\/network_security_config"/);
  assert.match(release, /base-config cleartextTrafficPermitted="false"/);
  assert.doesNotMatch(release, /cleartextTrafficPermitted="true"/);
  assert.match(debug, /base-config cleartextTrafficPermitted="false"/);
  assert.match(debug, /<domain>localhost<\/domain>/);
  assert.match(debug, /<domain>127\.0\.0\.1<\/domain>/);
  assert.doesNotMatch(debug, /10\.0\.2\.2/);
  assert.match(gradle, /applicationIdSuffix "\.qa"/);
  assert.match(manifest, /android:scheme="\$\{mobileCallbackScheme\}"/);
  assert.match(gradle, /mobileCallbackScheme: 'observerqaandroid'/);
  assert.match(gradle, /mobileCallbackScheme: 'digitalobserver'/);
  assert.match(manifest, /android:allowBackup="false"/);
});
