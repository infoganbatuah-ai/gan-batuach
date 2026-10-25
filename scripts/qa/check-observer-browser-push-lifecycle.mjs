import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import ts from "typescript";

const runtimeUrl = `data:text/javascript,${encodeURIComponent('export const DIGITAL_OBSERVER_MOBILE_RUNTIME_CONTRACT = "digital-observer-mobile-runtime-v1";')}`;
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "./mobile-runtime" && context.parentURL?.endsWith("/browser-push-lifecycle.ts")) {
      return { url: runtimeUrl, shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".ts")) return { format: "module", shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
      }).outputText };
    return next(url, context);
  }
});

const lifecycle = await import("../../lib/domain/digital-observer/browser-push-lifecycle.ts");
const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const oldSite = "00000000-0000-4000-8000-000000000003";
const nextSite = "00000000-0000-4000-8000-000000000004";
const binding = { version: 1, profileId: owner, siteId: oldSite,
  deviceReference: "00000000-0000-4000-8000-000000000005" };
const runtime = (profileId, siteIds) => ({ profileId, siteIds });
const response = (profileId = owner, confirmed = true) => ({ data: { profile_id: profileId, confirmed, devices: [] } });
function storage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key) };
}
function saved() {
  const store = storage();
  lifecycle.saveBrowserPushBinding(store, binding);
  return store;
}

test("lost Site revokes exact old binding before clearing local target", async () => {
  const store = saved();
  const calls = [];
  const result = await lifecycle.reconcileBrowserPushBinding(binding, runtime(owner, []), null, async (target) => {
    calls.push(target);
    assert.equal(lifecycle.confirmedBrowserPushRevocation(response(), target), true);
    lifecycle.clearConfirmedBrowserPushBinding(store, target);
  });
  assert.deepEqual(calls, [binding]);
  assert.deepEqual(result, { revoked: true, binding: null });
  assert.equal(lifecycle.readBrowserPushBinding(store), null);
});

test("explicit Site switch revokes old binding but never silently selects another Site", async () => {
  const store = saved();
  const result = await lifecycle.reconcileBrowserPushBinding(binding, runtime(owner, [oldSite, nextSite]), nextSite,
    async (target) => lifecycle.clearConfirmedBrowserPushBinding(store, target));
  assert.equal(result.revoked, true);
  assert.equal(result.binding, null);
  assert.equal(lifecycle.readBrowserPushBinding(store), null);
  assert.deepEqual(await lifecycle.reconcileBrowserPushBinding(null, runtime(owner, [nextSite]), null, async () => {
    throw new Error("unexpected revoke");
  }), { revoked: false, binding: null });
});

test("same authorized Site retains its exact installation without an extra revocation", async () => {
  const result = await lifecycle.reconcileBrowserPushBinding(binding, runtime(owner, [oldSite]), oldSite,
    async () => { throw new Error("unexpected revoke"); });
  assert.deepEqual(result, { revoked: false, binding });
});

test("profile switch cannot revoke or register using previous owner's binding", async () => {
  let calls = 0;
  await assert.rejects(lifecycle.reconcileBrowserPushBinding(binding, runtime(other, [oldSite]), oldSite,
    async () => { calls++; }), /PUSH_OWNER_CHANGED/);
  assert.equal(calls, 0);
  assert.equal(lifecycle.confirmedBrowserPushRevocation(response(other), binding), false);
});

test("failed and unconfirmed cancellation retain exact target for idempotent retry", async () => {
  const store = saved();
  let attempts = 0;
  const revoke = async (target) => {
    attempts++;
    if (attempts === 1) throw new Error("OFFLINE");
    assert.equal(lifecycle.confirmedBrowserPushRevocation(response(owner, false), target), false);
    if (attempts === 2) throw new Error("PUSH_REVOCATION_UNCONFIRMED");
    assert.equal(lifecycle.confirmedBrowserPushRevocation(response(), target), true);
    lifecycle.clearConfirmedBrowserPushBinding(store, target);
  };
  for (const reason of [/OFFLINE/, /PUSH_REVOCATION_UNCONFIRMED/]) {
    await assert.rejects(lifecycle.reconcileBrowserPushBinding(binding, runtime(owner, []), null, revoke), reason);
    assert.deepEqual(lifecycle.readBrowserPushBinding(store), binding);
  }
  assert.equal((await lifecycle.reconcileBrowserPushBinding(binding, runtime(owner, []), null, revoke)).revoked, true);
  assert.equal(attempts, 3);
  assert.equal(lifecycle.readBrowserPushBinding(store), null);
});

test("a missing owner session cannot clear the binding and requires owner reauthentication", async () => {
  const store = saved();
  await assert.rejects(lifecycle.reconcileBrowserPushBinding(binding, runtime(owner, []), null,
    async () => { throw new Error("SESSION_REVALIDATION_REQUIRED"); }), /SESSION_REVALIDATION_REQUIRED/);
  assert.deepEqual(lifecycle.readBrowserPushBinding(store), binding);
});

test("untrusted runtime and legacy unscoped identifiers fail closed", () => {
  assert.throws(() => lifecycle.verifiedBrowserPushRuntime({ data: { contract: "wrong" } }), /RUNTIME_RESPONSE_UNTRUSTED/);
  const legacy = storage();
  legacy.setItem("digital_observer_device_reference", binding.deviceReference);
  assert.throws(() => lifecycle.readBrowserPushBinding(legacy), /PUSH_LEGACY_BINDING_UNSCOPED/);
  assert.equal(legacy.getItem("digital_observer_device_reference"), binding.deviceReference);
  assert.throws(() => lifecycle.recoverLegacyBrowserPushBinding(legacy, { data: { confirmed: true,
    profile_id: owner, device_id: "00000000-0000-4000-8000-000000000099", observer_site_id: oldSite } }),
  /PUSH_LEGACY_BINDING_UNTRUSTED/);
  assert.equal(legacy.getItem(lifecycle.browserPushBindingKey), null);
  assert.deepEqual(lifecycle.recoverLegacyBrowserPushBinding(legacy, { data: { confirmed: true,
    profile_id: owner, device_id: binding.deviceReference, observer_site_id: oldSite } }), binding);
  assert.equal(legacy.getItem("digital_observer_device_reference"), null);
  assert.deepEqual(lifecycle.readBrowserPushBinding(legacy), binding);
});

test("valid runtime and exact authenticated owner response are required", () => {
  const payload = { data: { contract: "digital-observer-mobile-runtime-v1",
    session: { active: true, profile_id: owner }, sites: [{ id: oldSite }] } };
  assert.deepEqual(lifecycle.verifiedBrowserPushRuntime(payload), runtime(owner, [oldSite]));
  assert.equal(lifecycle.confirmedBrowserPushRevocation(response(), binding), true);
  assert.equal(lifecycle.confirmedBrowserPushRevocation({ data: { confirmed: true, profile_id: owner,
    devices: [{ id: "still-active", is_active: true }] } }, binding), false);
});
