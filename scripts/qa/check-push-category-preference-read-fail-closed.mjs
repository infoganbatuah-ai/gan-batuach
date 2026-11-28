import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";

const source = readFileSync(new URL("../../app/api/profile/communication-preferences/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS }
}).outputText;

function route({ authenticated = true, categoryError = null, categoryRows = [] } = {}) {
  const calls = [];
  const exports = {};
  const profile = { id: "parent-1", role: "parent" };
  const db = {
    from(table) {
      calls.push(table);
      const query = {
        select: () => query,
        eq: () => query,
        in: async () => ({ data: categoryRows, error: categoryError }),
        maybeSingle: async () => ({ data: { profile_id: profile.id, receive_push: false }, error: null })
      };
      return query;
    }
  };
  const require = (name) => {
    if (name === "zod") return { z };
    if (name === "@/lib/api") return {
      fail: (message, status) => Response.json({ error: message }, { status }),
      ok: (data) => Response.json(data),
      handleRouteError: (error) => { throw error; }
    };
    if (name === "@/lib/auth") return {
      getSessionProfile: async () => authenticated ? { user: { id: profile.id }, profile } : { user: null, profile: null }
    };
    if (name === "@/lib/supabase/server") return { createClient: async () => db };
    if (name === "@/lib/management/external-delivery") return {
      managementDeliveryCapability: () => ({ push: "not_configured" })
    };
    throw new Error(`unexpected import: ${name}`);
  };
  runInNewContext(compiled, { exports, require, console: { error() {} } });
  return { calls, get: () => exports.GET() };
}

test("category read error returns 500 instead of guessed enabled categories", async () => {
  const h = route({ categoryError: { message: "read unavailable" } });
  const response = await h.get();
  assert.equal(response.status, 500);
  assert.equal((await response.json()).push_category_preferences, undefined);
  assert.deepEqual(h.calls, ["communication_preferences", "push_category_preferences"]);
});

test("a stored disabled category remains disabled on successful read", async () => {
  const h = route({ categoryRows: [{ category: "safety", enabled: false, critical_only: false }] });
  const response = await h.get();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.push_category_preferences.safety, false);
  assert.equal(body.preferences.receive_push, false);
});

test("unauthenticated read cannot query either preference table", async () => {
  const h = route({ authenticated: false });
  assert.equal((await h.get()).status, 401);
  assert.deepEqual(h.calls, []);
});
