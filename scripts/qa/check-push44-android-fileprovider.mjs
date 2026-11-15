import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../../", import.meta.url);
const source = (path) => readFileSync(new URL(path, root), "utf8");

test("Android does not publish an unused external-storage FileProvider", () => {
  const manifest = source("android/app/src/main/AndroidManifest.xml");
  const packageJson = source("package.json");
  const nativeActivity = source("android/app/src/main/java/com/ganbatuach/app/MainActivity.java");
  const cordovaManifest = source("android/capacitor-cordova-android-plugins/src/main/AndroidManifest.xml");

  assert.doesNotMatch(manifest, /androidx\.core\.content\.FileProvider|FILE_PROVIDER_PATHS|\.fileprovider/);
  assert.equal(existsSync(new URL("android/app/src/main/res/xml/file_paths.xml", root)), false);
  assert.doesNotMatch(packageJson, /"@capacitor\/(share|filesystem|camera)"/);
  assert.doesNotMatch(nativeActivity, /FileProvider|getUriForFile|ACTION_SEND/);
  assert.doesNotMatch(cordovaManifest, /FileProvider|FILE_PROVIDER_PATHS/);
});
