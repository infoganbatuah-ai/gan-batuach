import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const api = { fail: (error, status) => Response.json({ error }, { status }) };
const actorId = "00000000-0000-4000-8000-000000000001";
const gardenId = "00000000-0000-4000-8000-000000000002";
function load(file, dependencies) {
  const output = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, {
    exports: module.exports, module, Response, Buffer, console,
    require: (id) => {
      if (Object.hasOwn(dependencies, id)) return dependencies[id];
      throw new Error(`Unmocked dependency: ${id}`);
    }
  }, { filename: file });
  return module.exports;
}

function fixture(options = {}) {
  const profile = { id: actorId, role: "manager", active: true, garden_id: gardenId, ...options.profile };
  const session = options.session ?? { user: { id: actorId }, profile };
  const calls = [];
  const guard = load("lib/management/garden-context.ts", {
    "@/lib/api": api,
    "@/lib/auth": { getSessionProfile: async () => {
      if (options.authThrows) throw new Error("private auth detail");
      return session;
    } },
    "@/lib/supabase/server": { createClient: async () => ({ rpc: async (name, params) => {
      calls.push({ name, garden: params.target_garden_id });
      if (options.rpcThrows) throw new Error("private database detail");
      return options.decision ?? { data: true, error: null };
    } }) }
  });
  return { guard, calls, session };
}

for (const role of ["manager", "owner"]) {
  test(`${role}: session-scoped DB authority approves selected context`, async () => {
    const f = fixture({ profile: { role } });
    const result = await f.guard.getManagementGardenContext();
    assert.equal(result.allowed, true);
    assert.equal(result.gardenId, gardenId);
    assert.equal(result.session, f.session);
    assert.deepEqual(f.calls, [{ name: "can_manage_garden", garden: gardenId }]);
  });
}

const denials = [
  ["unauthenticated", { session: { user: null, profile: null } }, 401, 0],
  ["missing profile", { session: { user: { id: actorId }, profile: null } }, 401, 0],
  ["different profile identity", { profile: { id: "other-user" } }, 401, 0],
  ...["parent", "staff", "inspector", "admin", "network_manager", "unknown"].map(role => [
    `unsupported role ${role}`, { profile: { role } }, 403, 0
  ]),
  ...[false, null, undefined, "true"].map(active => [
    `not explicitly active: ${active}`, { profile: { active } }, 403, 0
  ]),
  ["no selected garden", { profile: { garden_id: null } }, 403, 0],
  ["empty garden", { profile: { garden_id: "" } }, 403, 0],
  ["unrelated selected garden denied by DB", { profile: { garden_id: "other-garden" }, decision: { data: false, error: null } }, 403, 1],
  ["no authority result", { decision: { data: null, error: null } }, 403, 1],
  ["truthy string is not a grant", { decision: { data: "true", error: null } }, 403, 1],
  ["RPC error overrides true", { decision: { data: true, error: { message: "private detail" } } }, 503, 1],
  ["missing RPC/schema", { decision: { data: null, error: { code: "PGRST202" } } }, 503, 1],
  ["database unavailable", { rpcThrows: true }, 503, 1],
  ["authentication unavailable", { authThrows: true }, 503, 0]
];
for (const [label, options, status, rpcCalls] of denials) {
  test(`fail closed: ${label}`, async () => {
    const f = fixture(options);
    const result = await f.guard.getManagementGardenContext();
    assert.equal(result.allowed, false);
    assert.equal(result.response.status, status);
    assert.equal(f.calls.length, rpcCalls);
    assert.equal("session" in result, false);
    assert.doesNotMatch(await result.response.text(), /private|PGRST/);
  });
}

// Fixed adoption inventory: losing a guard must break this test, not silently
// remove the endpoint from a dynamically discovered list.
const routes = [
  "child-payments", "child-transfer-requests/[id]", "children/[id]/approve",
  "children/[id]/status", "communication", "create-staff", "enrollment-requests/[id]",
  "fee-groups", "leads/[id]/convert", "leads/[id]/status", "parent-invitations",
  "payout-configuration", "pickup-events", "staff-applications/[id]",
  "staff-openings", "staff/[id]/approve", "subscription", "subscription/sandbox-checkout"
];
for (const route of routes) {
  test(`${route}: every denied actor exits before payload or operational effects`, async () => {
    for (const [, options, status] of denials) {
      let effects = 0;
      const forbidden = () => { effects++; throw new Error("Operational effect before authorization"); };
      const f = fixture(options);
      const file = `app/api/garden/${route}/route.ts`;
      const deps = {};
      for (const match of readFileSync(file, "utf8").matchAll(/from "([^"]+)"/g)) {
        deps[match[1]] = new Proxy({}, { get: () => forbidden });
      }
      deps["zod"] = require("zod");
      deps["next/server"] = { NextResponse: Response };
      deps["@/lib/api"] = { ...api, handleRouteError: forbidden, ok: forbidden };
      deps["@/lib/management/garden-context"] = f.guard;
      deps["@/lib/onboarding/user-provisioning"] = new Proxy({ provisionedUserSchema: require("zod").z.object({}) }, {
        get: (target, key) => target[key] ?? forbidden
      });
      const handler = load(file, deps);
      const result = await handler.POST({ json: forbidden }, { params: Promise.resolve({ id: "unrelated-resource" }) });
      assert.equal(result.status, status);
      assert.equal(effects, 0);
    }
  });
}

for (const role of ["manager", "owner"]) {
  test(`communication ${role}: successful write uses verified context, not payload garden`, async () => {
    const f = fixture({ profile: { role } });
    const writes = [];
    const handler = load("app/api/garden/communication/route.ts", {
      "zod": require("zod"),
      "@/lib/api": { ...api, ok: data => Response.json({ data }), handleRouteError: error => { throw error; } },
      "@/lib/management/garden-context": f.guard,
      "@/lib/supabase/server": { createClient: async () => ({ from: table => ({ upsert: row => {
        assert.equal(f.calls.length, 1, "authorization must precede write");
        writes.push({ table, garden: row.garden_id, channel: row.default_parent_channel });
        return { select: () => ({ single: async () => ({ data: row, error: null }) }) };
      } }) }) }
    });
    const result = await handler.POST({ json: async () => ({
      action: "update_settings", default_parent_channel: "in_app", garden_id: "attacker-selected-garden"
    }) });
    assert.equal(result.status, 200);
    assert.deepEqual(writes, [{ table: "kindergarten_communication_settings", garden: gardenId, channel: "in_app" }]);
  });
}
