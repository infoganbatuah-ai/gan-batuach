import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { OBSERVER_QA_BUNDLE_ID, OBSERVER_QA_CALLBACK, OBSERVER_QA_ORIGIN,
  prepareObserverQaAuthConfig, validateObserverQaAuthBuild } from "../../lib/domain/digital-observer/observer-qa-auth-build.mjs";

const valid = {
  optIn: "1", bundleId: OBSERVER_QA_BUNDLE_ID,
  origin: OBSERVER_QA_ORIGIN,
  launchUrl: `${OBSERVER_QA_ORIGIN}/digital-observer/dashboard`,
  callback: OBSERVER_QA_CALLBACK
};

test("exact preparatory Observer QA contract accepts one candidate without activation", () => {
  assert.deepEqual(validateObserverQaAuthBuild(valid), {
    bundleId: OBSERVER_QA_BUNDLE_ID, origin: OBSERVER_QA_ORIGIN,
    launchUrl: valid.launchUrl, callback: OBSERVER_QA_CALLBACK
  });
});

test("absent opt-in, Gan origin, wrong bundle, and callback mismatch fail closed", () => {
  for (const override of [
    { optIn: undefined }, { origin: "https://ganbatuach.com" },
    { origin: "https://qa-iphone-device-proof.ganbatuach.com" },
    { bundleId: "com.ganbatuach.app.qa" },
    { callback: "observerqa://return/qa/device-proof" },
    { callback: "observerqaapp://return/auth/callback" }
  ]) assert.throws(() => validateObserverQaAuthBuild({ ...valid, ...override }));
});

test("non-HTTPS, non-exact, and URL injection attempts fail closed", () => {
  for (const launchUrl of [
    "http://observer-qa.ganbatuach.com/digital-observer/dashboard",
    "https://observer-qa.ganbatuach.com.evil.test/digital-observer/dashboard",
    "https://observer-qa.ganbatuach.com/digital-observer/login",
    "https://observer-qa.ganbatuach.com/digital-observer/dashboard?token=x",
    "https://observer-qa.ganbatuach.com/digital-observer/dashboard#x",
    "https://user@observer-qa.ganbatuach.com/digital-observer/dashboard",
    "https://observer-qa.ganbatuach.com:443/digital-observer/dashboard"
  ]) assert.throws(() => validateObserverQaAuthBuild({ ...valid, launchUrl }));
});

test("opt-in config derives only from existing offline Observer templates", () => {
  for (const platform of ["ios", "android"]) {
    const path = new URL(`../../${platform}/qa-observer/capacitor.config.json`, import.meta.url);
    const offline = JSON.parse(readFileSync(path, "utf8"));
    const prepared = prepareObserverQaAuthConfig({ ...valid, platform }, offline);
    assert.equal(prepared.appId, OBSERVER_QA_BUNDLE_ID);
    assert.equal(prepared.server.url, valid.launchUrl);
    assert.equal(prepared.server.cleartext, false);
    assert.equal(offline.server.url, undefined);
    assert.equal(prepared.plugins?.PushNotifications, undefined);
    assert.ok(!prepared.packageClassList?.includes("PushNotificationsPlugin"));
    assert.throws(() => prepareObserverQaAuthConfig({ ...valid, platform },
      { ...offline, appId: "com.ganbatuach.app.qa" }));
    assert.throws(() => prepareObserverQaAuthConfig({ ...valid, platform },
      { ...offline, server: { ...offline.server, url: "https://ganbatuach.com" } }));
  }
});

test("native build paths opt in without weakening offline or Gan variants", () => {
  const root = new URL("../../", import.meta.url);
  const ios = readFileSync(new URL("scripts/qa/finalize-observer-ios-qa.swift", root), "utf8");
  const android = readFileSync(new URL("android/app/build.gradle", root), "utf8");
  assert.match(ios, /environment\["OBSERVER_QA_AUTH_BUILD"\] == "1"/);
  assert.match(ios, /OBSERVER_QA_OFFLINE_URL_FORBIDDEN/);
  assert.match(ios, /OBSERVER_QA_AUTH_BUILD_BOUNDARY_INVALID/);
  assert.match(android, /CAPACITOR_OBSERVER_OFFLINE_URL_FORBIDDEN/);
  assert.match(android, /CAPACITOR_OBSERVER_AUTH_BOUNDARY_INVALID/);
  assert.match(android, /prepare-observer-qa-auth-config\.mjs/);
  assert.match(android, /CAPACITOR_PRODUCT_VARIANT_MISMATCH/);
  assert.match(android, /CAPACITOR_OBSERVER_GAN_PUSH_CONFIG_FORBIDDEN/);
});
