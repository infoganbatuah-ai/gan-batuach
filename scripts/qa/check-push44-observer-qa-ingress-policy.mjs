import assert from "node:assert/strict";
import { test } from "node:test";
import { observerQaRedirect, observerQaRouteAllowed, OBSERVER_QA_HOST } from "./push44-observer-qa-ingress-policy.mjs";

const gate = { host: OBSERVER_QA_HOST, trustedHttps: true, ownerAuthorized: true };
const allows = (method, rawUrl, overrides = {}) => observerQaRouteAllowed({ ...gate, method, rawUrl, ...overrides });

test("only the bounded Observer login, session page and static paths pass", () => {
  for (const path of ["/digital-observer/login", "/digital-observer/dashboard",
    "/digital-observer/onboarding", "/_next/static/chunk.js", "/assets/digital-observer/logo.png"]) {
    assert.equal(allows("GET", path), true, path);
  }
  assert.equal(allows("POST", "/api/digital-observer/auth/login"), true);
  assert.equal(allows("POST", "/api/auth/logout"), true);
});

test("wrong host, absent owner gate or untrusted TLS deny before route selection", () => {
  for (const override of [{ host: "ganbatuach.com" }, { host: "qa-iphone-device-proof.ganbatuach.com" },
    { ownerAuthorized: false }, { ownerAuthorized: undefined }, { trustedHttps: false }]) {
    assert.equal(allows("GET", "/digital-observer/login", override), false);
  }
});

test("cross-product, admin, media and unsupported callback routes remain closed", () => {
  for (const path of ["/dashboard", "/dashboard/parent", "/api/management/notifications",
    "/digital-observer/admin", "/digital-observer/cameras", "/digital-observer/media/live.m3u8",
    "/api/digital-observer/cameras", "/api/digital-observer/qa-device-proof/handoff",
    "/auth/callback", "/qa/device-proof/start", "/_next/image?url=/camera.jpg"])
    assert.equal(allows("GET", path), false, path);
  assert.equal(allows("POST", "/api/digital-observer/onboarding"), false);
});

test("bearer URLs, host spoofing, traversal and open redirects fail closed", () => {
  for (const path of ["//evil.test/digital-observer/login", "https://evil.test/digital-observer/login",
    "/digital-observer/login?access_token=x", "/digital-observer/login?code=x",
    "/digital-observer/login#access_token=x", "/digital-observer/%2e%2e/dashboard",
    "/digital-observer/%252e%252e/dashboard", "/digital-observer/../dashboard",
    "/digital-observer/login?next=//evil.test", "/digital-observer/login\\evil"])
    assert.equal(allows("GET", path), false, path);
  assert.equal(observerQaRedirect("/digital-observer/dashboard", gate), "/digital-observer/dashboard");
  assert.equal(observerQaRedirect("https://observer-qa.ganbatuach.com/digital-observer/dashboard", gate),
    "/digital-observer/dashboard");
  assert.equal(observerQaRedirect("https://evil.test/digital-observer/dashboard", gate), null);
  assert.equal(observerQaRedirect("https://user@observer-qa.ganbatuach.com/digital-observer/dashboard", gate), null);
  assert.equal(observerQaRedirect("/digital-observer/login?code=secret", gate), null);
});
