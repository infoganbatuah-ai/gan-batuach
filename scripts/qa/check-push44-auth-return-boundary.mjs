import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { needsExplicitObserverOptIn, safeAuthNextPath, verifiedCallbackProduct } from "../../lib/domain/auth-flow.ts";

test("Observer callback keeps only canonical Observer-local return paths", () => {
  assert.equal(safeAuthNextPath("/digital-observer/dashboard?tab=sites", "digital_observer"), "/digital-observer/dashboard?tab=sites");
  for (const value of [
    "/digital-observer/../dashboard",
    "/digital-observerevil/dashboard",
    "/digital-observer/%2e%2e/dashboard",
    "/digital-observer/%252e%252e/dashboard",
    "/digital-observer%2fdashboard",
    "/digital-observer\\evil.example/dashboard",
    "//evil.example/digital-observer",
    "https://evil.example/digital-observer/dashboard",
    "/dashboard"
  ]) {
    assert.equal(safeAuthNextPath(value, "digital_observer"), "/digital-observer/login?verified=1", value);
  }
});

test("Gan callback cannot be redirected into the Observer authorization domain", () => {
  assert.equal(safeAuthNextPath("/dashboard", "gan_batuach"), "/dashboard");
  assert.equal(safeAuthNextPath("/digital-observer/dashboard", "gan_batuach"), "/dashboard");
  assert.equal(safeAuthNextPath("/digital-observer/dashboard", "gan_batuach", "recovery"), "/reset-password");
});

test("server callback product ignores untrusted URL hints and pending-registration cookies", () => {
  const gan = { email: "gan@example.invalid", user_metadata: { product: "gan_batuach" }, app_metadata: {} };
  assert.equal(verifiedCallbackProduct(gan), "gan_batuach");
  assert.equal(verifiedCallbackProduct({ ...gan, user_metadata: { product: "digital_observer" } }), "digital_observer");
  assert.equal(verifiedCallbackProduct({ ...gan, app_metadata: { digital_observer_admin: true } }), "digital_observer");
});

test("OTP route uses verified product selection after token verification", () => {
  const route = readFileSync(new URL("../../app/auth/confirm/route.ts", import.meta.url), "utf8");
  assert.match(route, /verifiedCallbackProduct\(data\.user\)/);
  assert.doesNotMatch(route, /confirmedObserver\s*=\s*observerRequest/);
  assert.doesNotMatch(route, /verifiedCallbackProduct\(data\.user,\s*pendingEmail\)/);
  const client = readFileSync(new URL("../../components/auth/auth-callback-client.tsx", import.meta.url), "utf8");
  assert.match(client, /observer = verifiedCallbackProduct\(user\) === "digital_observer"/);
  assert.doesNotMatch(client, /observer = observer\s*\|\| user\.user_metadata/);
});

test("existing Gan identity needs explicit Observer sign-in; signup and recovery do not auto-promote", () => {
  const gan = { email: "gan@example.invalid", user_metadata: { product: "gan_batuach" }, app_metadata: {} };
  const observer = { ...gan, user_metadata: { product: "digital_observer" } };
  assert.equal(needsExplicitObserverOptIn(gan, true), true);
  assert.equal(needsExplicitObserverOptIn(gan, false), false);
  assert.equal(needsExplicitObserverOptIn(observer, true), false);
  assert.equal(verifiedCallbackProduct(gan), "gan_batuach");
  assert.equal(verifiedCallbackProduct(observer), "digital_observer");
  const route = readFileSync(new URL("../../app/auth/confirm/route.ts", import.meta.url), "utf8");
  assert.match(route, /!recovery && needsExplicitObserverOptIn/);
  assert.match(route, /pendingEmail === data\.user\.email\?\.toLowerCase\(\)/);
  assert.match(route, /await supabase\.auth\.signOut\(\)/);
  const client = readFileSync(new URL("../../components/auth/auth-callback-client.tsx", import.meta.url), "utf8");
  assert.match(client, /!recovery && needsExplicitObserverOptIn/);
  assert.match(client, /await supabase\.auth\.signOut\(\)/);
  const login = readFileSync(new URL("../../app/api/digital-observer/auth/login/route.ts", import.meta.url), "utf8");
  assert.ok(login.indexOf("supabase.auth.signInWithPassword") < login.indexOf('supabase.rpc("ensure_digital_observer_account"'));
});
