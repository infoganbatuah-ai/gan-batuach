import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../../lib/domain/push-service.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS
} }).outputText;
const exports = {};
vm.runInNewContext(compiled, { exports, require: (name) => {
  if (name === "crypto") return require("node:crypto");
  if (name === "./push-provider") return { getPushProviderForPlatform: () => ({ name: "mock" }) };
  assert.fail("unexpected import: " + name);
} }, { timeout: 1000 });

const baseInput = {
  profileId: "owner", role: "parent", platform: "ios",
  deviceToken: "token-12345678", deviceId: "new-installation",
  metadata: { source: "digital_observer_native" }
};

function fakeClient(initial, beforeUpdate) {
  let row = initial && { ...initial };
  const actions = [];
  const table = {
    select() { if (!this.pendingUpdate && !this.pendingInsert) actions.push("read"); return this; },
    eq(column, value) { (this.filters ??= []).push([column, value]); return this; },
    is(column, value) { (this.filters ??= []).push([column, value]); return this; },
    contains(column, value) { (this.filters ??= []).push([column, value]); return this; },
    async maybeSingle() {
      const filters = this.filters ?? [];
      this.filters = [];
      if (this.pendingUpdate) {
        beforeUpdate?.(row);
        const values = this.pendingUpdate;
        this.pendingUpdate = null;
        const match = row && filters.every(([key, value]) => key === "metadata"
          ? Object.entries(value).every(([field, expected]) => row.metadata?.[field] === expected)
          : row[key] === value);
        if (!match) return { data: null, error: null };
        row = { ...row, ...values };
        return { data: { ...row }, error: null };
      }
      return { data: row && filters.every(([key, value]) => row[key] === value) ? { ...row } : null, error: null };
    },
    update(values) { actions.push("update"); this.pendingUpdate = values; return this; },
    insert(values) { actions.push("insert"); this.pendingInsert = values; return this; },
    async single() {
      if (row) return { data: null, error: { message: "duplicate token" } };
      row = { id: "new-row", ...this.pendingInsert };
      return { data: { ...row }, error: null };
    }
  };
  return { client: { from: (name) => {
    assert.equal(name, "push_device_tokens"); return table;
  } }, actions, row: () => row };
}

const inherited = fakeClient({ id: "same-row", profile_id: "owner", device_token: baseInput.deviceToken,
  platform: "ios", device_id: "new-installation", device_trust_status: "trusted",
  app_channel: "android_app", metadata: { source: "digital_observer_native", priorProduct: "gan_management" } });
const changed = await exports.registerPushDevice(inherited.client, baseInput);
assert.equal(changed.ok, true);
assert.equal(inherited.row().device_trust_status, "unknown");
assert.equal(inherited.row().app_channel, "unknown");
assert.equal(inherited.row().device_id, "new-installation");
assert.equal(inherited.row().metadata.priorProduct, undefined);
assert.deepEqual(inherited.actions, ["read", "update"]);

for (const conflict of [
  { platform: "ios", device_id: "other-installation", metadata: { source: "digital_observer_native" } },
  { platform: "web", device_id: null, metadata: { source: "fcm_web" } }
]) {
  const takeover = fakeClient({ id: "gan-row", profile_id: "owner", device_token: baseInput.deviceToken,
    device_trust_status: "unknown", ...conflict });
  const result = await exports.registerPushDevice(takeover.client, {
    ...baseInput, metadata: { source: "digital_observer_native" }
  });
  assert.equal(result.ok, false, "cross-product token takeover must fail closed");
  assert.deepEqual(takeover.actions, ["read"]);
  assert.equal(takeover.row().device_id, conflict.device_id);
  assert.deepEqual(takeover.row().metadata, conflict.metadata);
}

const webTakeover = fakeClient({ id: "gan-web", profile_id: "owner", device_token: baseInput.deviceToken,
  platform: "web", device_id: null, device_trust_status: "unknown", metadata: { source: "fcm_web" } });
assert.equal((await exports.registerPushDevice(webTakeover.client, {
  ...baseInput, platform: "web", deviceId: null, metadata: { source: "digital_observer_fcm" }
})).ok, false);
assert.deepEqual(webTakeover.actions, ["read"]);

for (const deniedStatus of ["blocked", "revoked"]) {
  const denied = fakeClient({ id: "same-row", profile_id: "owner",
    device_token: baseInput.deviceToken, device_trust_status: deniedStatus });
  assert.equal((await exports.registerPushDevice(denied.client, baseInput)).ok, false);
  assert.deepEqual(denied.actions, ["read"]);
  assert.equal(denied.row().device_trust_status, deniedStatus);
}
const otherAccount = fakeClient({ id: "same-row", profile_id: "other",
  device_token: baseInput.deviceToken, device_trust_status: "unknown" });
assert.equal((await exports.registerPushDevice(otherAccount.client, baseInput)).ok, false);
assert.deepEqual(otherAccount.actions, ["read"]);

const race = fakeClient({ id: "same-row", profile_id: "owner",
  device_token: baseInput.deviceToken, platform: "ios", device_id: "new-installation",
  device_trust_status: "trusted", metadata: { source: "digital_observer_native" } },
  (row) => { row.device_trust_status = "blocked"; });
assert.equal((await exports.registerPushDevice(race.client, baseInput)).ok, false);
assert.equal(race.row().device_trust_status, "blocked");

const sourceRace = fakeClient({ id: "same-row", profile_id: "owner",
  device_token: baseInput.deviceToken, platform: "ios", device_id: "new-installation",
  device_trust_status: "unknown", metadata: { source: "digital_observer_native" } },
  (row) => { row.metadata = { source: "fcm_web" }; });
assert.equal((await exports.registerPushDevice(sourceRace.client, {
  ...baseInput, metadata: { source: "digital_observer_native" }
})).ok, false, "a concurrent registration cannot overwrite a changed source");
assert.equal(sourceRace.row().metadata.source, "fcm_web");

const legacy = fakeClient({ id: "same-row", profile_id: "owner",
  device_token: baseInput.deviceToken, platform: "web", device_id: null,
  metadata: { source: "fcm_web" }, device_trust_status: "unknown" });
assert.equal((await exports.registerPushDevice(legacy.client, {
  ...baseInput, platform: "web", metadata: { source: "fcm_web" }
})).ok, true);
assert.equal(legacy.row().app_channel, "web");
assert.equal(legacy.row().is_active, true);

const fresh = fakeClient(null);
assert.equal((await exports.registerPushDevice(fresh.client, baseInput)).ok, true);
assert.equal(fresh.row().device_trust_status, "unknown");
assert.deepEqual(fresh.actions, ["read", "insert"]);

for (const bad of [undefined, {}, { source: "unexpected" }, { source: "fcm_web" }]) {
  const unlabeled = fakeClient(null);
  assert.equal((await exports.registerPushDevice(unlabeled.client, { ...baseInput, metadata: bad })).ok, false);
  assert.deepEqual(unlabeled.actions, []);
}
const unlabeledExisting = fakeClient({ id: "legacy-unlabelled", profile_id: "owner",
  device_token: baseInput.deviceToken, platform: "ios", device_id: "new-installation",
  device_trust_status: "unknown", metadata: {} });
assert.equal((await exports.registerPushDevice(unlabeledExisting.client, baseInput)).ok, false);
assert.deepEqual(unlabeledExisting.actions, ["read"]);

console.log("Push re-registration trust reset, deny and compare-and-update: PASS (synthetic adapter)");
