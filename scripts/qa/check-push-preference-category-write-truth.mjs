import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z, ZodError } from "zod";

const source = readFileSync(new URL("../../app/api/profile/communication-preferences/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS }
}).outputText;

function route({ authenticated = true, rpcError = null } = {}) {
  const calls = [];
  const exports = {};
  const profile = { id: "parent-1", role: "parent" };
  const db = {
    from() { throw new Error("PATCH must not perform separate table writes"); },
    rpc(name, args) {
      calls.push([name, args]);
      return Promise.resolve({ data: rpcError ? null : { profile_id: profile.id }, error: rpcError });
    }
  };
  const require = (name) => {
    if (name === "zod") return { z };
    if (name === "@/lib/api") return {
      fail: (message, status) => Response.json({ error: message }, { status }),
      ok: (data) => Response.json(data),
      handleRouteError: (error) => error instanceof ZodError
        ? Response.json({ error: "invalid preference" }, { status: 400 })
        : (() => { throw error; })()
    };
    if (name === "@/lib/auth") return {
      getSessionProfile: async () => authenticated ? { user: { id: profile.id }, profile } : { user: null, profile: null }
    };
    if (name === "@/lib/supabase/server") return { createClient: async () => db };
    if (name === "@/lib/management/external-delivery") return { managementDeliveryCapability: () => ({}) };
    throw new Error(`unexpected import: ${name}`);
  };
  runInNewContext(compiled, { exports, require, console: { error() {} }, Date });
  const patch = (body) => exports.PATCH(new Request("http://localhost/api/profile/communication-preferences", {
    method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
  }));
  return { calls, patch };
}

test("unsupported category is rejected before any preference write", async () => {
  const h = route();
  const response = await h.patch({ receive_push: true, push_category_preferences: { task: false } });
  assert.equal(response.status, 400);
  assert.deepEqual(h.calls, []);
});

test("supported category reaches one atomic RPC with its exact setting", async () => {
  const h = route();
  const response = await h.patch({ receive_push: false, push_category_preferences: { safety: false } });
  assert.equal(response.status, 200);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0][0], "save_communication_preferences_atomic");
  assert.equal(h.calls[0][1].p_patch.receive_push, false);
  assert.deepEqual(h.calls[0][1].p_categories, { safety: false });
});

test("unauthenticated request cannot write preferences", async () => {
  const h = route({ authenticated: false });
  assert.equal((await h.patch({ push_category_preferences: { safety: true } })).status, 401);
  assert.deepEqual(h.calls, []);
});

test("client-supplied profile id never reaches the atomic RPC", async () => {
  const h = route();
  assert.equal((await h.patch({ profile_id: "other-user", push_category_preferences: { safety: true } })).status, 200);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0][1].p_patch.profile_id, undefined);
  assert.equal(h.calls[0][1].p_categories.safety, true);
});

test("missing atomic RPC fails closed without falling back to two table writes", async () => {
  const h = route({ rpcError: { message: "function unavailable" } });
  assert.equal((await h.patch({ receive_push: false, push_category_preferences: { safety: false } })).status, 500);
  assert.equal(h.calls.length, 1);
});
