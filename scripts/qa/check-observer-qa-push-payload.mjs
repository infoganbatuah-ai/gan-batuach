import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
function load(path, dependencies, activated = false) {
  const raw = source(path).replace("const OBSERVER_QA_PUSH_PAYLOAD_ACTIVATED = false;",
    `const OBSERVER_QA_PUSH_PAYLOAD_ACTIVATED = ${activated};`);
  const code = ts.transpileModule(raw, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022
  } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, URL, URLSearchParams, Date, Map, Set, Number, decodeURIComponent,
    require: (id) => {
      if (id === "zod") return require("zod");
      assert.ok(Object.hasOwn(dependencies, id), `unexpected dependency ${id}`);
      return dependencies[id];
    }
  }, { filename: path });
  return exports;
}
const audience = load("lib/domain/push-product-audience.ts", {});
const mobile = load("lib/domain/digital-observer/mobile-runtime.ts", {});
const dependencyMap = {
  "@/lib/domain/push-product-audience": audience,
  "./mobile-runtime": mobile
};
const closed = load("lib/domain/digital-observer/observer-qa-push-payload.ts", dependencyMap);
const qualified = load("lib/domain/digital-observer/observer-qa-push-payload.ts", dependencyMap, true);
const site = "00000000-0000-4000-8000-000000000045";
const event = "00000000-0000-4000-8000-000000000044";
const now = new Date("2026-11-16T00:00:00Z");
const link = (scheme) => `${scheme}://event/${event}?site=${site}`;
const destination = {
  category: "observer_alert", deepLinkType: "observer_event",
  actionUrl: `/digital-observer/incidents?site=${site}&selected=${event}`
};
function input(platform = "ios") {
  return {
    profileId: "qa-profile", platform, destination, now,
    deepLink: link(platform === "ios" ? "observerqaapp" : "observerqaandroid"),
    token: { id: "qa-token", profileId: "qa-profile", platform, deviceToken: "synthetic-token", isActive: true },
    binding: { deviceTokenId: "qa-token", productAudience: "digital_observer",
      verifiedAppId: "com.digitalobserver.app.qa", evidenceSha256: "a".repeat(64),
      expiresAt: "2026-11-17T00:00:00Z" }
  };
}
const accepted = (value) => qualified.prepareObserverQaPushPayload(value)?.deep_link ?? null;

test("QA payload is default-off even with structurally valid input", () => {
  assert.equal(closed.prepareObserverQaPushPayload(input()), null);
  assert.match(source("lib/domain/digital-observer/observer-qa-push-payload.ts"),
    /const OBSERVER_QA_PUSH_PAYLOAD_ACTIVATED = false;/);
});

test("isolated contract accepts exact Observer QA iOS and Android links", () => {
  const sample = input("ios");
  // The active sender intentionally has no qualified Observer QA app ID.
  assert.equal(audience.selectVerifiedPushTargets({ profileId: sample.profileId, audience: "digital_observer",
    destination: sample.destination, tokens: [sample.token], bindings: [sample.binding], now }).length, 0);
  assert.equal(mobile.nativeAppAcceptsMobileLink(sample.deepLink, "com.digitalobserver.app.qa", "ios", ""), true);
  assert.equal(mobile.authorizedMobileDestination(mobile.parseMobileLink(sample.deepLink)), sample.destination.actionUrl);
  assert.equal(accepted(input("ios")), link("observerqaapp"));
  assert.equal(accepted(input("android")), link("observerqaandroid"));
});

test("Gan, other-app and mismatched notification destinations are denied", () => {
  for (const patch of [
    { binding: { ...input().binding, productAudience: "gan_management" } },
    { binding: { ...input().binding, verifiedAppId: "com.ganbatuach.app" } },
    { deepLink: link("digitalobserver") },
    { deepLink: link("observerqaandroid") },
    { deepLink: `https://ganbatuach.com/digital-observer/incidents?site=${site}` },
    { destination: { ...destination, actionUrl: "/dashboard/parent" } },
    { destination: { ...destination, actionUrl: "/digital-observer/alerts" } },
    { deepLink: `${link("observerqaapp")}&token=secret` },
    { deepLink: `${link("observerqaapp")}&site=${site}` }
  ]) assert.equal(accepted({ ...input(), ...patch }), null, JSON.stringify(patch));
});

test("binding, ownership, expiry and revocation failures deny payload construction", () => {
  const base = input();
  for (const patch of [
    { profileId: "other-profile" },
    { token: { ...base.token, isActive: false } },
    { binding: { ...base.binding, deviceTokenId: "other-token" } },
    { binding: { ...base.binding, evidenceSha256: "unverified" } },
    { binding: { ...base.binding, expiresAt: now.toISOString() } },
    { binding: { ...base.binding, revokedAt: now.toISOString() } }
  ]) assert.equal(accepted({ ...base, ...patch }), null, JSON.stringify(patch));
});
