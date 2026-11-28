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
  deviceToken: "token-12345678", deviceId: "new-installation"
};

function fakeClient(initial, beforeUpdate) {
  let row = initial && { ...initial };
  const actions = [];
  const table = {
    select() { if (!this.pendingUpdate && !this.pendingInsert) actions.push("read"); return this; },
    eq(column, value) { (this.filters ??= []).push([column, value]); return this; },
    async maybeSingle() {
      const filters = this.filters ?? [];
      this.filters = [];
      if (this.pendingUpdate) {
        beforeUpdate?.(row);
        const values = this.pendingUpdate;
        this.pendingUpdate = null;
        const match = row && filters.every(([key, value]) => row[key] === value);
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
  platform: "android", device_id: "old-installation", device_trust_status: "trusted",
  app_channel: "android_app", metadata: { priorProduct: "gan_management" } });
const changed = await exports.registerPushDevice(inherited.client, baseInput);
assert.equal(changed.ok, true);
assert.equal(inherited.row().device_trust_status, "unknown");
assert.equal(inherited.row().app_channel, "unknown");
assert.equal(inherited.row().device_id, "new-installation");
assert.equal(inherited.row().metadata.priorProduct, undefined);
assert.deepEqual(inherited.actions, ["read", "update"]);

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
  device_token: baseInput.deviceToken, device_trust_status: "trusted" },
  (row) => { row.device_trust_status = "blocked"; });
assert.equal((await exports.registerPushDevice(race.client, baseInput)).ok, false);
assert.equal(race.row().device_trust_status, "blocked");

const legacy = fakeClient({ id: "same-row", profile_id: "owner",
  device_token: baseInput.deviceToken, device_trust_status: "unknown" });
assert.equal((await exports.registerPushDevice(legacy.client, { ...baseInput, platform: "web" })).ok, true);
assert.equal(legacy.row().app_channel, "web");
assert.equal(legacy.row().is_active, true);

const fresh = fakeClient(null);
assert.equal((await exports.registerPushDevice(fresh.client, baseInput)).ok, true);
assert.equal(fresh.row().device_trust_status, "unknown");
assert.deepEqual(fresh.actions, ["read", "insert"]);

console.log("Push re-registration trust reset, deny and compare-and-update: PASS (synthetic adapter)");
