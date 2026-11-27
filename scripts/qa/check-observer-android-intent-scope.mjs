import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../../", import.meta.url);
const shared = readFileSync(new URL("android/app/src/main/AndroidManifest.xml", root), "utf8");
const observer = readFileSync(new URL("android/app/src/observerObserverQa/AndroidManifest.xml", root), "utf8");

test("Observer QA replaces only its inherited broad filters", () => {
  assert.match(shared, /<data android:scheme="\$\{mobileCallbackScheme\}"\s*\/>/);
  assert.match(observer, /<intent-filter tools:node="removeAll"\s*\/>/);
  assert.match(observer, /android\.intent\.action\.MAIN/);
  assert.match(observer, /android\.intent\.category\.LAUNCHER/);
  assert.doesNotMatch(observer, /<data android:scheme="observerqaandroid"\s*\/>/);
});

test("Observer resource hosts and one exact control return are separate filters", () => {
  for (const host of ["camera", "event", "incident", "evidence", "investigation", "notification"]) {
    assert.match(observer, new RegExp(`<data android:scheme="observerqaandroid" android:host="${host}" \\/>`));
  }
  assert.match(observer, /android:scheme="observerqaandroid" android:host="return"\s+android:path="\/qa\/device-proof"/);
  assert.equal((observer.match(/android:host="return"/g) ?? []).length, 1);
});
