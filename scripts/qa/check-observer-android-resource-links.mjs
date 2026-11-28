import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  authorizedMobileDestination, mobileLinkKinds, nativeAppAcceptsMobileLink, parseMobileLink
} from "../../lib/domain/digital-observer/mobile-runtime.ts";

const observerApp = "com.digitalobserver.app.qa";
const origin = "https://observer-qa.ganbatuach.com";
const site = "00000000-0000-4000-8000-000000000045";
const resource = "00000000-0000-4000-8000-000000000044";
const observerManifest = readFileSync(new URL("../../android/app/src/observerObserverQa/AndroidManifest.xml", import.meta.url), "utf8");

test("all six canonical Observer resource links survive Android QA manifest and native dispatch", () => {
  assert.deepEqual(mobileLinkKinds, ["camera", "event", "incident", "evidence", "investigation", "notification"]);
  for (const kind of mobileLinkKinds) {
    const url = `observerqaandroid://${kind}${kind === "investigation" ? "" : `/${resource}`}?site=${site}`;
    assert.match(observerManifest, new RegExp(`android:host="${kind}"`));
    assert.equal(nativeAppAcceptsMobileLink(url, observerApp, "android", origin), true, kind);
    const parsed = parseMobileLink(url);
    assert.equal(parsed.kind, kind);
    assert.equal(parsed.observerSiteId, site);
    assert.match(authorizedMobileDestination(parsed), /^\/digital-observer\//);
    assert.equal(nativeAppAcceptsMobileLink(url, "com.ganbatuach.app.qa", "android", origin), false);
    assert.equal(nativeAppAcceptsMobileLink(url, observerApp, "ios", origin), false);
  }
});

test("malformed, foreign, and callback-shaped links cannot become resource destinations", () => {
  const invalid = [
    `observerqaandroid://unknown/${resource}?site=${site}`,
    `observerqaandroid://camera/not-a-uuid?site=${site}`,
    `observerqaandroid://camera/${resource}?site=wrong`,
    `observerqaandroid://camera/${resource}/extra?site=${site}`,
    `observerqaandroid://camera/${resource}?site=${site}&site=${site}`,
    `observerqaandroid://camera/${resource}?site=${site}&token=secret`,
    `observerqaandroid://return/qa/device-proof?state=${"a".repeat(64)}`,
    `observerqaapp://camera/${resource}?site=${site}`
  ];
  for (const url of invalid) {
    assert.equal(nativeAppAcceptsMobileLink(url, observerApp, "android", origin), false, url);
  }
});
