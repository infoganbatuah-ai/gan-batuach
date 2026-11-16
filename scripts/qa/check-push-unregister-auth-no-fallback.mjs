import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";

const source = readFileSync(new URL("../../app/api/push/unregister/route.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS }
}).outputText;

function route({ observer = null } = {}) {
  const calls = [];
  const exports = {};
  const cookieDb = { source: "cookie-test-only" };
  const require = (name) => {
    if (name === "zod") return { z };
    if (name === "@/lib/api") return {
      fail: (message, status) => Response.json({ error: message }, { status }),
      ok: (data) => Response.json({ data }),
      handleRouteError: (error) => { throw error; }
    };
    if (name === "@/lib/auth") return {
      requireUser: async () => { calls.push("cookie-auth"); return { profile: { id: "cookie-user", role: "parent" } }; }
    };
    if (name === "@/lib/supabase/server") return {
      createClient: async () => { calls.push("cookie-db"); return cookieDb; }
    };
    if (name === "@/lib/domain/digital-observer/access") return {
      getDigitalObserverApiUser: async () => { calls.push("bearer-auth"); return observer; }
    };
    if (name === "@/lib/domain/push-service") return {
      unregisterPushDevice: async (client, profileId, token, deviceId) => {
        calls.push(["unregister", client, profileId, token, deviceId]);
        return { ok: true, rows: [{ id: "exact-device" }] };
      }
    };
    throw new Error(`unexpected import: ${name}`);
  };
  runInNewContext(compiled, { exports, require });
  const post = (authorization) => exports.POST(new Request("http://localhost/api/push/unregister", {
    method: "POST", headers: authorization === null ? {} : { authorization },
    body: JSON.stringify({ device_id: "device-123" })
  }));
  return { calls, cookieDb, post };
}

test("invalid Bearer cannot revoke under a different cookie account", async () => {
  const h = route();
  assert.equal((await h.post("Bearer invalid-token")).status, 401);
  assert.deepEqual(h.calls, ["bearer-auth"]);
});

test("unsupported Authorization scheme cannot revoke under cookies", async () => {
  const h = route();
  assert.equal((await h.post("Basic wrong-scheme")).status, 401);
  assert.deepEqual(h.calls, []);
});

test("valid Observer Bearer revokes only its verified profile", async () => {
  const observerDb = { source: "observer-test-only" };
  const h = route({ observer: { profile: { id: "observer-user", role: "owner" }, supabase: observerDb } });
  assert.equal((await h.post("Bearer valid-token")).status, 200);
  assert.deepEqual(h.calls, ["bearer-auth", ["unregister", observerDb, "observer-user", null, "device-123"]]);
});

test("cookie-only revocation retains its existing profile-scoped path", async () => {
  const h = route();
  assert.equal((await h.post(null)).status, 200);
  assert.deepEqual(h.calls, ["cookie-auth", "cookie-db", ["unregister", h.cookieDb, "cookie-user", null, "device-123"]]);
});
