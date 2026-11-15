import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync(new URL("../../lib/domain/push-product-audience.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const contract = {};
runInNewContext(compiled, { exports: contract, Date, Map, Set, Number, decodeURIComponent });

const now = new Date("2026-11-16T00:00:00Z");
const token = (id, platform = "ios") => ({ id, profileId: "same-profile", platform, deviceToken: `token-${id}`, isActive: true, revokedAt: null });
const binding = (id, productAudience, verifiedAppId) => ({
  deviceTokenId: id, productAudience, verifiedAppId, evidenceSha256: "a".repeat(64),
  expiresAt: "2026-11-17T00:00:00Z", revokedAt: null
});
const ganToken = token("gan");
const observerToken = token("observer");
const ganBinding = binding("gan", "gan_management", "com.ganbatuach.app");
const observerBinding = binding("observer", "digital_observer", "com.digitalobserver.app.qa");

function select(audience, destination, tokens = [ganToken, observerToken], bindings = [ganBinding, observerBinding]) {
  return Array.from(contract.selectVerifiedPushTargets({ profileId: "same-profile", audience, destination, tokens, bindings, now }), (entry) => entry.id);
}

test("same-profile tokens are separated by verified product binding", () => {
  assert.deepEqual(select("digital_observer", { category: "observer_alert", actionUrl: "/digital-observer/alerts" }), ["observer"]);
  assert.deepEqual(select("gan_management", { category: "child_approval", actionUrl: "/dashboard/parent" }), ["gan"]);
});

test("legacy, web and wrong-app tokens fail closed despite caller metadata", () => {
  const legacy = { ...token("legacy"), metadata: { source: "digital_observer_native" } };
  const web = token("web", "web");
  const wrongApp = token("wrong");
  const chosen = select("digital_observer", { category: "observer_alert", actionUrl: "/digital-observer/alerts" },
    [legacy, web, wrongApp], [binding("web", "digital_observer", "com.digitalobserver.app.qa"),
      binding("wrong", "digital_observer", "com.ganbatuach.app.qa")]);
  assert.deepEqual(chosen, []);
});

test("logout, revocation, expiry and conflicting binding deny delivery", () => {
  const destination = { category: "observer_alert", actionUrl: "/digital-observer/alerts" };
  assert.deepEqual(select("digital_observer", destination, [{ ...observerToken, isActive: false }], [observerBinding]), []);
  assert.deepEqual(select("digital_observer", destination, [{ ...observerToken, revokedAt: now.toISOString() }], [observerBinding]), []);
  assert.deepEqual(select("digital_observer", destination, [observerToken], [{ ...observerBinding, revokedAt: now.toISOString() }]), []);
  assert.deepEqual(select("digital_observer", destination, [observerToken], [{ ...observerBinding, expiresAt: now.toISOString() }]), []);
  assert.deepEqual(select("digital_observer", destination, [observerToken], [observerBinding, ganBinding, observerBinding]), []);
});

test("cross-app and malformed deep links are rejected before token selection", () => {
  const bad = ["/dashboard/parent", "https://evil.example/digital-observer/alerts", "//evil.example/alerts",
    "/digital-observer/%2e%2e/dashboard", "/digital-observer/%2f/dashboard", "/digital-observer/alerts#fragment"];
  for (const actionUrl of bad) {
    assert.deepEqual(select("digital_observer", { category: "observer_alert", actionUrl }), [], actionUrl);
  }
  assert.deepEqual(select("gan_management", { category: "observer_alert", actionUrl: "/dashboard/parent" }), []);
  assert.deepEqual(select("digital_observer", { category: "camera_alert" }), []);
  assert.deepEqual(select("unknown", { category: "observer_alert", actionUrl: "/digital-observer/alerts" }), []);
});

test("cross-profile and missing evidence cannot borrow another app binding", () => {
  const destination = { category: "observer_alert", actionUrl: "/digital-observer/alerts" };
  assert.deepEqual(select("digital_observer", destination, [{ ...observerToken, profileId: "other-profile" }], [observerBinding]), []);
  assert.deepEqual(select("digital_observer", destination, [observerToken], [{ ...observerBinding, evidenceSha256: "unverified" }]), []);
});
