import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = new URL("../../", import.meta.url);
const compile = (path) => ts.transpileModule(readFileSync(new URL(path, root), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const mobile = {};
runInNewContext(compile("lib/domain/digital-observer/mobile-runtime.ts"), {
  exports: mobile, URL, URLSearchParams, require: (id) => { assert.equal(id, "zod"); return require("zod"); }
});
const pending = {};
runInNewContext(compile("lib/domain/digital-observer/pending-mobile-link.ts"), {
  exports: pending, URL, URLSearchParams, Date, JSON,
  require: (id) => { assert.equal(id, "./mobile-runtime"); return mobile; }
});

const site = "00000000-0000-4000-8000-000000000045";
const camera = "00000000-0000-4000-8000-000000000044";
const link = (scheme) => `${scheme}://camera/${camera}?site=${site}`;
const origin = "https://observer-qa.example.invalid";
const accepts = (scheme, appId, platform) => mobile.nativeAppAcceptsMobileLink(link(scheme), appId, platform, origin);
const store = () => {
  const entries = new Map();
  return { getItem: (key) => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: (key) => entries.delete(key) };
};

test("native QA schemes parse and survive one-use pending replay without becoming Gan links", () => {
  for (const scheme of ["observerqaapp", "observerqaandroid"]) {
    const storage = store();
    assert.equal(mobile.parseMobileLink(link(scheme)).observerSiteId, site);
    assert.equal(pending.rememberPendingMobileLink(storage, `${link(scheme)}&ignored=1`, 1_000), true);
    assert.equal(pending.takePendingMobileLink(storage, 2_000), link(scheme));
    assert.equal(pending.takePendingMobileLink(storage, 2_000), null);
    assert.equal(pending.firstLaunchOfMobileLink(storage, link(scheme), 3_000), true);
    assert.equal(pending.firstLaunchOfMobileLink(storage, link(scheme), 4_000), false);
  }
  assert.equal(mobile.authorizedMobileDestination(mobile.parseMobileLink(link("observerqaapp"))),
    mobile.authorizedMobileDestination(mobile.parseMobileLink(link("digitalobserver"))));
});

test("each native package accepts only its registered custom scheme", () => {
  assert.equal(accepts("observerqaapp", "com.digitalobserver.app.qa", "ios"), true);
  assert.equal(accepts("observerqaandroid", "com.digitalobserver.app.qa", "android"), true);
  assert.equal(accepts("digitalobserver", "com.ganbatuach.app", "android"), true);
  assert.equal(accepts("digitalobserver", "com.ganbatuach.app.qa", "ios"), true);
  for (const [scheme, appId, platform] of [
    ["digitalobserver", "com.digitalobserver.app.qa", "ios"],
    ["digitalobserver", "com.digitalobserver.app.qa", "android"],
    ["observerqaapp", "com.ganbatuach.app.qa", "ios"],
    ["observerqaandroid", "com.ganbatuach.app", "android"],
    ["observerqaandroid", "com.digitalobserver.app.qa", "ios"],
    ["observerqaapp", "com.digitalobserver.app.qa", "android"],
    ["observerqaapp", "unknown.app", "ios"]
  ]) assert.equal(accepts(scheme, appId, platform), false, `${appId}/${platform}/${scheme}`);
  assert.equal(mobile.nativeAppAcceptsMobileLink("not a URL", "com.digitalobserver.app.qa", "ios", origin), false);
});

test("native HTTPS return stays on the exact Observer origin and product path", () => {
  const appId = "com.digitalobserver.app.qa";
  assert.equal(mobile.nativeAppAcceptsMobileLink(`${origin}/digital-observer/open/camera/${camera}?site=${site}`, appId, "ios", origin), true);
  assert.equal(mobile.nativeAppAcceptsMobileLink(`https://gan-qa.example.invalid/digital-observer/open/camera/${camera}?site=${site}`, appId, "ios", origin), false);
  assert.equal(mobile.nativeAppAcceptsMobileLink(`${origin}/dashboard/parent`, appId, "ios", origin), false);
  assert.throws(() => mobile.parseMobileLink(`observerqaapp://auth/callback?code=opaque`), /MOBILE_LINK_INVALID/);
});

test("same-origin HTTPS link survives login replay, foreign origin cannot be stored or replayed", () => {
  const storage = store();
  const httpsLink = `${origin}/digital-observer/open/camera/${camera}?site=${site}`;
  assert.equal(pending.rememberPendingMobileLink(storage, `${httpsLink}&ignored=1`, 1_000, origin), true);
  assert.equal(pending.takePendingMobileLink(storage, 2_000, origin), httpsLink);
  assert.equal(pending.takePendingMobileLink(storage, 2_000, origin), null);
  assert.equal(pending.rememberPendingMobileLink(storage, httpsLink, 3_000, origin), true);
  assert.equal(pending.takePendingMobileLink(storage, 4_000, "https://other.example.invalid"), null);
  assert.equal(pending.rememberPendingMobileLink(storage, `https://other.example.invalid/digital-observer/open/camera/${camera}?site=${site}`, 5_000, origin), false);
  assert.equal(pending.firstLaunchOfMobileLink(storage, httpsLink, 6_000, origin), true);
  assert.equal(pending.firstLaunchOfMobileLink(storage, httpsLink, 7_000, origin), false);
});

test("native bundle schemes and server-side authorization remain separate gates", () => {
  const ios = readFileSync(new URL("ios/qa-observer/Info.plist", root), "utf8");
  const gradle = readFileSync(new URL("android/app/build.gradle", root), "utf8");
  const runtime = readFileSync(new URL("components/digital-observer/observer-mobile-runtime.tsx", root), "utf8");
  const server = readFileSync(new URL("app/api/digital-observer/mobile/runtime/route.ts", root), "utf8");
  assert.match(ios, /<string>observerqaapp<\/string>/);
  assert.match(gradle, /mobileCallbackScheme: 'observerqaandroid'/);
  assert.match(runtime, /nativeAppAcceptsMobileLink\(rawUrl, appId, Capacitor\.getPlatform\(\), window\.location\.origin\)/);
  assert.match(server, /getDigitalObserverApiUser\(request\)/);
  assert.match(server, /getObserverSiteAccess\(session\.supabase, session\.profile, link\.observerSiteId\)/);
  assert.match(server, /\.eq\("observer_site_id", link\.observerSiteId\)/);
});
