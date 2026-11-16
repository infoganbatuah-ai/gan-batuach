import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const root = new URL("../../", import.meta.url);
const source = readFileSync(new URL("lib/domain/digital-observer/native-push-availability.ts", root), "utf8");
const exports = {};
runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports });
const available = exports.observerNativePushAvailable;

test("offline Observer Android QA denies prompt and provider registration even with common plugin", () => {
  assert.equal(available({ appId: "com.digitalobserver.app.qa", platform: "android", pluginAvailable: true }), false);
  assert.equal(available({ appId: "com.digitalobserver.app.qa", platform: "android", pluginAvailable: false }), false);
  assert.equal(available({ appId: "unknown", platform: "android", pluginAvailable: true }), false);
  assert.equal(available({ appId: null, platform: "android", pluginAvailable: true }), false);
  assert.equal(available({ appId: "com.digitalobserver.app", platform: "android", pluginAvailable: true }), true);
  assert.equal(available({ appId: "com.digitalobserver.app", platform: "android", pluginAvailable: false }), false);
});

test("Observer runtime gates every native Push path after app identity lookup", () => {
  const runtime = readFileSync(new URL("components/digital-observer/observer-mobile-runtime.tsx", root), "utf8");
  assert.match(runtime, /App\.getInfo\(\)\.then\(\(info\) => info\.id\)/);
  assert.match(runtime, /pushEnabled = observerNativePushAvailable/);
  assert.match(runtime, /if \(pushEnabled && pending\.some/);
  assert.match(runtime, /if \(!pushEnabled\)/);
  assert.match(runtime, /if \(pushEnabled\) \{/);
  assert.doesNotMatch(runtime, /if \(pushAvailable\)/);
});

test("only Observer QA overlay removes inherited notification and FCM entry points", () => {
  const overlay = readFileSync(new URL("android/app/src/observerObserverQa/AndroidManifest.xml", root), "utf8");
  const main = readFileSync(new URL("android/app/src/main/AndroidManifest.xml", root), "utf8");
  for (const name of ["POST_NOTIFICATIONS", "WAKE_LOCK", "com.google.android.c2dm.permission.RECEIVE",
    "com.capacitorjs.plugins.pushnotifications.MessagingService", "com.google.firebase.iid.FirebaseInstanceIdReceiver",
    "com.google.firebase.messaging.FirebaseMessagingService", "com.google.firebase.components.ComponentDiscoveryService",
    "com.google.firebase.provider.FirebaseInitProvider"]) {
    assert.ok(overlay.includes(name), name);
  }
  assert.equal((overlay.match(/tools:node="remove"/g) ?? []).length, 8);
  assert.match(main, /android\.permission\.POST_NOTIFICATIONS/);
});
