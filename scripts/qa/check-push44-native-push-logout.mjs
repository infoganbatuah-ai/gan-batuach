import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync(new URL("../../app/api/auth/logout/route.ts", import.meta.url), "utf8");
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const deviceId = "5b72fa43-734e-4ce4-9a02-55741de7d978";

function route({ userId = "profile-a", revokeOk = true, signOutError = null } = {}) {
  const calls = [];
  const supabase = { auth: {
    getUser: async () => { calls.push("auth"); return { data: { user: userId ? { id: userId } : null }, error: null }; },
    signOut: async () => { calls.push("signOut"); return { error: signOutError }; }
  } };
  const exports = {};
  const modules = {
    "next/server": { NextResponse: { json: (payload, options = {}) => new Response(JSON.stringify(payload), { status: options.status ?? 200 }) } },
    "@/lib/supabase/server": { createClient: async () => supabase },
    "@/lib/domain/push-service": { unregisterPushDevice: async (client, profileId, token, currentDeviceId, expectedSource) => {
      assert.equal(client, supabase); calls.push(["revoke", profileId, token, currentDeviceId, expectedSource]); return { ok: revokeOk, rows: [] };
    } },
    zod: require("zod")
  };
  vm.runInNewContext(js, { exports, require: (name) => {
    assert.ok(Object.hasOwn(modules, name), name); return modules[name];
  } }, { timeout: 1000 });
  const post = (body) => exports.POST(new Request("http://localhost/api/auth/logout", {
    method: "POST", ...(body === undefined ? {} : { body: JSON.stringify(body) })
  }));
  const get = () => exports.GET(new Request("http://localhost/api/auth/logout?redirectTo=/digital-observer/dashboard"));
  return { post, get, calls };
}

test("GET cannot sign out or bypass current-device push cleanup", async () => {
  const h = route();
  assert.equal((await h.get()).status, 405);
  assert.deepEqual(h.calls, []);
});

test("current-device logout revokes only authenticated user's exact device before sign-out", async () => {
  const h = route();
  const response = await h.post({ observer_push_device_id: deviceId });
  assert.equal(response.status, 200);
  assert.deepEqual(h.calls, ["auth", ["revoke", "profile-a", null, deviceId, "digital_observer_native"], "signOut"]);
});

test("failed revocation and absent session fail closed without sign-out", async () => {
  const failure = route({ revokeOk: false });
  assert.equal((await failure.post({ observer_push_device_id: deviceId })).status, 503);
  assert.deepEqual(failure.calls, ["auth", ["revoke", "profile-a", null, deviceId, "digital_observer_native"]]);
  const unauthenticated = route({ userId: null });
  assert.equal((await unauthenticated.post({ observer_push_device_id: deviceId })).status, 401);
  assert.deepEqual(unauthenticated.calls, ["auth"]);
});

test("late logout for account A cannot revoke or sign out account B", async () => {
  const accountA = "00000000-0000-4000-8000-0000000000aa";
  const accountB = "00000000-0000-4000-8000-0000000000bb";
  const h = route({ userId: accountB });
  const response = await h.post({ observer_push_device_id: deviceId, expected_profile_id: accountA });
  assert.equal(response.status, 403);
  assert.deepEqual(h.calls, ["auth"]);
  const own = await h.post({ observer_push_device_id: deviceId, expected_profile_id: accountB });
  assert.equal(own.status, 200);
});

test("malformed and cross-device requests cannot trigger revocation", async () => {
  const h = route();
  assert.equal((await h.post({ observer_push_device_id: "not-a-uuid" })).status, 400);
  assert.equal((await h.post({ device_token: "forged" })).status, 400);
  assert.deepEqual(h.calls, []);
});

test("ordinary Management logout does not revoke any device token", async () => {
  const h = route();
  assert.equal((await h.post()).status, 200);
  assert.deepEqual(h.calls, ["signOut"]);
});

test("actual unregister query resolves one active device row before exact-id revocation", async () => {
  const serviceSource = readFileSync(new URL("../../lib/domain/push-service.ts", import.meta.url), "utf8");
  const serviceJs = ts.transpileModule(serviceSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  const filters = [];
  const query = {
    select: () => query,
    eq: (name, value) => { filters.push([name, value]); return query; },
    contains: (name, value) => { filters.push([name, value]); return query; },
    limit: async () => ({ data: [{ id: "token-row-1" }], error: null }),
    update: (value) => { assert.equal(value.is_active, false); return query; }
  };
  query.select = () => {
    if (filters.length >= 3) return Promise.resolve({ data: [{ id: "token-row-1" }], error: null });
    return query;
  };
  vm.runInNewContext(serviceJs, { exports, require: (name) => {
    if (name === "crypto") return require("node:crypto");
    if (name === "./push-provider") return { getPushProviderForPlatform: () => ({ name: "mock" }) };
    assert.fail(`unexpected dependency: ${name}`);
  } }, { timeout: 1000 });
  const result = await exports.unregisterPushDevice({ from: (table) => {
    assert.equal(table, "push_device_tokens"); return query;
  } }, "profile-a", null, deviceId);
  assert.equal(result.ok, true);
  assert.deepEqual(filters, [
    ["profile_id", "profile-a"], ["device_id", deviceId], ["is_active", true],
    ["profile_id", "profile-a"], ["id", "token-row-1"], ["is_active", true]
  ]);
});

test("duplicate active tokens sharing a device id fail closed without revoking either", async () => {
  const serviceSource = readFileSync(new URL("../../lib/domain/push-service.ts", import.meta.url), "utf8");
  const serviceJs = ts.transpileModule(serviceSource, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS
  } }).outputText;
  const exports = {};
  const filters = [];
  const lookup = {
    select: () => lookup,
    eq: (name, value) => { filters.push([name, value]); return lookup; },
    limit: async (count) => {
      assert.equal(count, 2);
      return { data: [{ id: "old-token" }, { id: "replacement-token" }], error: null };
    }
  };
  let updates = 0;
  vm.runInNewContext(serviceJs, { exports, require: (name) => {
    if (name === "crypto") return require("node:crypto");
    if (name === "./push-provider") return { getPushProviderForPlatform: () => ({ name: "mock" }) };
    assert.fail(`unexpected dependency: ${name}`);
  } }, { timeout: 1000 });
  const result = await exports.unregisterPushDevice({ from: (table) => {
    assert.equal(table, "push_device_tokens");
    return updates++ === 0 ? lookup : { update: () => assert.fail("ambiguous device must not update") };
  } }, "profile-a", null, deviceId);
  assert.equal(result.ok, false);
  assert.equal(result.error, "push_device_id_ambiguous");
  assert.equal(updates, 1);
  assert.deepEqual(filters, [
    ["profile_id", "profile-a"], ["device_id", deviceId], ["is_active", true]
  ]);
});

test("Observer logout cannot revoke a sole Gan token sharing profile and device id", async () => {
  const serviceSource = readFileSync(new URL("../../lib/domain/push-service.ts", import.meta.url), "utf8");
  const serviceJs = ts.transpileModule(serviceSource, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS
  } }).outputText;
  const exports = {};
  vm.runInNewContext(serviceJs, { exports, require: (name) => {
    if (name === "crypto") return require("node:crypto");
    if (name === "./push-provider") return { getPushProviderForPlatform: () => ({ name: "mock" }) };
    assert.fail(`unexpected dependency: ${name}`);
  } }, { timeout: 1000 });

  for (const { source, changeDuringUpdate, expectedOk } of [
    { source: "fcm_web", changeDuringUpdate: false, expectedOk: false },
    { source: "digital_observer_native", changeDuringUpdate: false, expectedOk: true },
    { source: "digital_observer_native", changeDuringUpdate: true, expectedOk: false }
  ]) {
    const row = { id: "token-row", profile_id: "profile-a", device_id: deviceId,
      is_active: true, metadata: { source } };
    let updates = 0;
    const query = {
      filters: [],
      select() { return this; },
      eq(name, value) { this.filters.push([name, value]); return this; },
      contains(name, value) { this.filters.push([name, value]); return this; },
      async limit() { this.filters = []; return { data: [{ id: row.id, metadata: { ...row.metadata } }], error: null }; },
      update(values) { updates++; this.values = values; this.filters = []; return this; },
      then(resolve) {
        if (changeDuringUpdate) row.metadata.source = "fcm_web";
        const matches = this.filters.every(([name, value]) => name === "metadata"
          ? row.metadata.source === value.source : row[name] === value);
        if (matches) Object.assign(row, this.values);
        resolve({ data: matches ? [{ id: row.id, is_active: row.is_active }] : [], error: null });
      }
    };
    const result = await exports.unregisterPushDevice({ from: (table) => {
      assert.equal(table, "push_device_tokens"); return query;
    } }, "profile-a", null, deviceId, "digital_observer_native");
    assert.equal(result.ok, expectedOk);
    assert.equal(updates, source === "fcm_web" ? 0 : 1);
    assert.equal(row.is_active, !expectedOk);
  }
});

test("missing device selector cannot revoke all tokens for a profile", async () => {
  const serviceSource = readFileSync(new URL("../../lib/domain/push-service.ts", import.meta.url), "utf8");
  const serviceJs = ts.transpileModule(serviceSource, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS
  } }).outputText;
  const exports = {};
  vm.runInNewContext(serviceJs, { exports, require: (name) => {
    if (name === "crypto") return require("node:crypto");
    if (name === "./push-provider") return { getPushProviderForPlatform: () => ({ name: "mock" }) };
    assert.fail(`unexpected dependency: ${name}`);
  } }, { timeout: 1000 });
  const result = await exports.unregisterPushDevice({ from: () => assert.fail("empty selector must not query tokens") }, "profile-a");
  assert.equal(result.ok, false);
  assert.equal(result.error, "push_device_selector_required");
});

test("client only supplies native current-device id and does not navigate on failed logout", () => {
  const component = readFileSync(new URL("../../components/logout-button.tsx", import.meta.url), "utf8");
  const helper = readFileSync(new URL("../../lib/domain/digital-observer/native-push-logout.ts", import.meta.url), "utf8");
  assert.match(component, /redirectTo === "\/digital-observer\/login" \? await currentNativePushDeviceId\(\)/);
  assert.match(component, /currentNativePushOwnerId\(\)/);
  assert.match(component, /expected_profile_id: expectedOwnerId/);
  assert.match(component, /if \(!response\.ok\) \{/);
  assert.match(component, /throw new Error\("LOGOUT_FAILED"\)/);
  assert.match(helper, /if \(!Capacitor\.isNativePlatform\(\)\) return null/);
  assert.match(helper, /if \(!site\.value\) return null/);
  assert.match(helper, /if \(!device\.value\) throw/);
  assert.match(helper, /digital_observer_native_push_owner_v1/);
});

test("actual logout button keeps the session on an offline request failure", async () => {
  const component = readFileSync(new URL("../../components/logout-button.tsx", import.meta.url), "utf8");
  const componentJs = ts.transpileModule(component, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX
  } }).outputText;
  const calls = [];
  const exports = {};
  const jsx = (type, props) => ({ type, props });
  const modules = {
    react: { useState: (initial) => [initial, () => {}] },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "lucide-react": { LogOut: () => null },
    "next/navigation": { useRouter: () => ({ replace: () => calls.push("replace"), refresh: () => calls.push("refresh") }) },
    "@/lib/domain/digital-observer/native-push-logout": { currentNativePushDeviceId: async () => deviceId,
      currentNativePushOwnerId: async () => null }
  };
  vm.runInNewContext(componentJs, {
    exports,
    require: (name) => { assert.ok(Object.hasOwn(modules, name), name); return modules[name]; },
    fetch: async () => { calls.push("fetch"); throw new Error("OFFLINE"); },
    window: { sessionStorage: { removeItem: () => calls.push("clear") } }
  }, { timeout: 1000 });
  const tree = exports.LogoutButton({ redirectTo: "/digital-observer/login" });
  const button = tree.props.children[0];
  await button.props.onClick();
  assert.deepEqual(calls, ["fetch"]);
});

test("Observer QA explains failed push revocation and remains signed in", async () => {
  const component = readFileSync(new URL("../../components/logout-button.tsx", import.meta.url), "utf8");
  const componentJs = ts.transpileModule(component, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX
  } }).outputText;
  const calls = [];
  const messages = [];
  const exports = {};
  const jsx = (type, props) => ({ type, props });
  const modules = {
    react: { useState: (initial) => [initial, (value) => {
      if (typeof value === "string") messages.push(value);
    }] },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "lucide-react": { LogOut: () => null },
    "next/navigation": { useRouter: () => ({
      replace: () => calls.push("replace"), refresh: () => calls.push("refresh")
    }) },
    "@/lib/domain/digital-observer/native-push-logout": {
      currentNativePushDeviceId: async () => deviceId, currentNativePushOwnerId: async () => null
    }
  };
  vm.runInNewContext(componentJs, {
    exports,
    require: (name) => { assert.ok(Object.hasOwn(modules, name), name); return modules[name]; },
    fetch: async () => ({
      ok: false, status: 503, json: async () => ({ error: "PUSH_REVOCATION_FAILED" })
    }),
    window: { sessionStorage: { removeItem: () => calls.push("clear") } }
  }, { timeout: 1000 });
  const tree = exports.LogoutButton({ redirectTo: "/digital-observer/login" });
  await tree.props.children[0].props.onClick();
  assert.deepEqual(calls, []);
  assert.ok(messages.some((message) => message.includes("נשארת מחובר/ת") &&
    message.includes("נסה להתנתק שוב") && message.includes("פנה לתמיכה")));
});
