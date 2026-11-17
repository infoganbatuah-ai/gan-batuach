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

function route({ authenticated = true, atomic = false, rpcError = false, profileMismatch = false, existingPreferences } = {}) {
  const writes = [];
  const rpcCalls = [];
  const exports = {};
  const profile = { id: "parent-1", role: "parent" };
  const db = {
    rpc: async (name, args) => {
      rpcCalls.push([name, args]);
      return rpcError ? { data: null, error: { message: "synthetic RPC failure" } }
        : { data: { profile_id: profile.id, receive_push: false }, error: null };
    },
    from(table) {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: existingPreferences ?? { profile_id: profile.id, receive_push: false }, error: null }),
        upsert: (values) => { writes.push([table, values]); return query; },
        single: async () => ({ data: { profile_id: profile.id }, error: null })
      };
      if (table === "push_category_preferences") query.then = (resolve) => resolve({ error: null });
      return query;
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
      getSessionProfile: async () => authenticated ? { user: { id: profileMismatch ? "different-user" : profile.id }, profile } : { user: null, profile: null }
    };
    if (name === "@/lib/supabase/server") return { createClient: async () => db };
    if (name === "@/lib/management/external-delivery") return { managementDeliveryCapability: () => ({}) };
    throw new Error(`unexpected import: ${name}`);
  };
  runInNewContext(compiled, { exports, require, console: { error() {} }, Date,
    process: { env: atomic === null ? {} : { PUSH44_ATOMIC_PREFERENCES_RPC: atomic ? "enabled" : "disabled" } } });
  const patch = (body) => exports.PATCH(new Request("http://localhost/api/profile/communication-preferences", {
    method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
  }));
  return { writes, rpcCalls, patch };
}

test("unsupported category is rejected before any preference write", async () => {
  const h = route();
  const response = await h.patch({ receive_push: true, push_category_preferences: { task: false } });
  assert.equal(response.status, 400);
  assert.deepEqual(h.writes, []);
});

test("supported category persists the authenticated profile's exact setting", async () => {
  const h = route();
  const response = await h.patch({ receive_push: false, push_category_preferences: { safety: false } });
  assert.equal(response.status, 200);
  assert.equal(h.writes.length, 2);
  assert.equal(h.writes[0][0], "communication_preferences");
  assert.equal(h.writes[0][1].profile_id, "parent-1");
  assert.equal(h.writes[1][0], "push_category_preferences");
  assert.equal(h.writes[1][1][0].profile_id, "parent-1");
  assert.equal(h.writes[1][1][0].category, "safety");
  assert.equal(h.writes[1][1][0].enabled, false);
});

test("absent atomic flag preserves the legacy route and its historical half-populated quiet hours", async () => {
  const h = route({ atomic: null, existingPreferences: { profile_id: "parent-1", receive_push: true, quiet_hours_start: "22:00", quiet_hours_end: null } });
  assert.equal((await h.patch({ receive_push: false })).status, 200);
  assert.deepEqual(h.rpcCalls, []);
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0][1].quiet_hours_start, "22:00");
  assert.equal(h.writes[0][1].quiet_hours_end, null);
});

test("unauthenticated request cannot write preferences", async () => {
  const h = route({ authenticated: false });
  assert.equal((await h.patch({ push_category_preferences: { safety: true } })).status, 401);
  assert.deepEqual(h.writes, []);
});

test("client-supplied profile id cannot change the authenticated write owner", async () => {
  const h = route();
  assert.equal((await h.patch({ profile_id: "other-user", push_category_preferences: { safety: true } })).status, 200);
  assert.equal(h.writes[0][1].profile_id, "parent-1");
  assert.equal(h.writes[1][1][0].profile_id, "parent-1");
});

test("enabled atomic path sends only validated fields to one RPC", async () => {
  const h = route({ atomic: true });
  const response = await h.patch({ receive_push: false, push_category_preferences: { safety: false } });
  assert.equal(response.status, 200);
  assert.deepEqual(h.writes, []);
  assert.equal(h.rpcCalls.length, 1);
  assert.equal(h.rpcCalls[0][0], "save_communication_preferences_atomic");
  assert.equal(h.rpcCalls[0][1].p_patch.receive_push, false);
  assert.equal(h.rpcCalls[0][1].p_categories.safety, false);
  assert.equal(h.rpcCalls[0][1].p_patch.profile_id, undefined);
});

test("atomic PATCH does not invent an omitted unavailable channel setting", async () => {
  const h = route({ atomic: true });
  assert.equal((await h.patch({ receive_push: false, quiet_hours_timezone: "UTC" })).status, 200);
  assert.equal(h.rpcCalls.length, 1);
  assert.equal(h.rpcCalls[0][1].p_patch.receive_push, false);
  assert.equal(Object.hasOwn(h.rpcCalls[0][1].p_patch, "receive_email"), false);
  assert.equal(h.rpcCalls[0][1].p_categories, null);
});

test("RPC failure fails closed without a legacy first-table write", async () => {
  const h = route({ atomic: true, rpcError: true });
  assert.equal((await h.patch({ receive_push: false, push_category_preferences: { safety: false } })).status, 500);
  assert.equal(h.rpcCalls.length, 1);
  assert.deepEqual(h.writes, []);
});

test("atomic mode rejects unauthenticated and ignores forged profile ownership", async () => {
  const anonymous = route({ atomic: true, authenticated: false });
  assert.equal((await anonymous.patch({ receive_push: false })).status, 401);
  assert.deepEqual(anonymous.rpcCalls, []);
  const owner = route({ atomic: true });
  assert.equal((await owner.patch({ profile_id: "other-user", receive_push: false })).status, 200);
  assert.equal(owner.rpcCalls.length, 1);
  assert.equal(owner.rpcCalls[0][1].p_patch.profile_id, undefined);
});

test("mismatched authenticated user and profile cannot reach either write path", async () => {
  for (const atomic of [false, true]) {
    const h = route({ atomic, profileMismatch: true });
    assert.equal((await h.patch({ receive_push: false })).status, 401);
    assert.deepEqual(h.writes, []);
    assert.deepEqual(h.rpcCalls, []);
  }
});
