import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";

const source = readFileSync(new URL("../../app/api/push/register/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS }
}).outputText;

const payload = { platform: "ios", device_token: "test-token-12345678" };

function route({ observer = null, cookie = { profile: { id: "cookie-user", role: "parent" } } } = {}) {
  const calls = [];
  const exports = {};
  const db = { source: "test-only" };
  const require = (name) => {
    if (name === "zod") return { z };
    if (name === "@/lib/api") return {
      fail: (message, status) => Response.json({ error: message }, { status }),
      ok: (data) => Response.json({ data }),
      handleRouteError: (error) => { throw error; }
    };
    if (name === "@/lib/auth") return {
      requireUser: async () => { calls.push("cookie-auth"); return cookie; }
    };
    if (name === "@/lib/supabase/server") return {
      createClient: async () => { calls.push("cookie-db"); return db; }
    };
    if (name === "@/lib/domain/digital-observer/access") return {
      getDigitalObserverApiUser: async () => { calls.push("bearer-auth"); return observer; }
    };
    if (name === "@/lib/domain/push-service") return {
      registerPushDevice: async (_client, input) => {
        calls.push(["register", _client, input.profileId]);
        return { ok: true, device: { id: "registered" } };
      }
    };
    throw new Error(`unexpected import: ${name}`);
  };
  runInNewContext(compiled, { exports, require });
  const post = (authorization, body = payload) => exports.POST(new Request("http://localhost/api/push/register", {
    method: "POST", headers: authorization === null ? {} : { authorization },
    body: JSON.stringify(body)
  }));
  return { calls, db, post };
}

test("invalid Bearer cannot fall back to a valid different cookie account", async () => {
  const h = route();
  const response = await h.post("Bearer invalid-token");
  assert.equal(response.status, 401);
  assert.deepEqual(h.calls, ["bearer-auth"]);
});

test("unsupported Authorization scheme also cannot fall back to cookies", async () => {
  const h = route();
  const response = await h.post("Basic wrong-scheme");
  assert.equal(response.status, 401);
  assert.deepEqual(h.calls, []);
});

test("valid Observer Bearer registers only to verified Observer identity", async () => {
  const observerDb = { source: "observer-test-only" };
  const h = route({ observer: {
    profile: { id: "observer-user", role: "owner" }, supabase: observerDb
  } });
  const response = await h.post("Bearer valid-token");
  assert.equal(response.status, 200);
  assert.deepEqual(h.calls, ["bearer-auth", ["register", observerDb, "observer-user"]]);
});

test("cookie-only registration retains its existing account path", async () => {
  const h = route();
  const response = await h.post(null);
  assert.equal(response.status, 200);
  assert.deepEqual(h.calls, ["cookie-auth", "cookie-db", ["register", h.db, "cookie-user"]]);
});

test("late native callback cannot register account A token under account B session", async () => {
  const accountA = "00000000-0000-4000-8000-0000000000aa";
  const accountB = "00000000-0000-4000-8000-0000000000bb";
  const h = route({ cookie: { profile: { id: accountB, role: "parent" } } });
  const response = await h.post(null, { ...payload, expected_profile_id: accountA });
  assert.equal(response.status, 403);
  assert.deepEqual(h.calls, ["cookie-auth"]);
  const own = await h.post(null, { ...payload, expected_profile_id: accountB });
  assert.equal(own.status, 200);
});
