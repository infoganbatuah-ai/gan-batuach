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

function route({ authenticated = true } = {}) {
  const writes = [];
  const exports = {};
  const profile = { id: "parent-1", role: "parent" };
  const db = {
    from(table) {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => ({ data: { profile_id: profile.id, receive_push: false }, error: null }),
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
  return { writes, patch };
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
