import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../../lib/domain/digital-observer/access.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS }
}).outputText;

function sessionClient(calls, identity, kind) {
  return {
    auth: { getUser: async (token) => {
      calls.push([`${kind}-get-user`, token ?? null]);
      return { data: { user: identity ? { id: identity } : null }, error: null };
    } },
    rpc: async (name) => { calls.push([`${kind}-rpc`, name]); return { data: true, error: null }; },
    from: (table) => {
      const query = {
        select: () => query,
        eq: () => query,
        is: () => query,
        neq: () => query,
        limit: () => query,
        maybeSingle: async () => ({ data: table === "profiles" ? { id: identity, active: true } :
          table === "digital_observer_accounts" ? { profile_id: identity } : null, error: null })
      };
      return query;
    }
  };
}

function harness({ bearerIdentity = null, cookieIdentity = "cookie-user" } = {}) {
  const calls = [];
  const exports = {};
  const cookieClient = sessionClient(calls, cookieIdentity, "cookie");
  const bearerClient = sessionClient(calls, bearerIdentity, "bearer");
  const require = (name) => {
    if (name === "@/lib/supabase/server") return {
      createClient: async () => { calls.push("cookie-client"); return cookieClient; }
    };
    if (name === "@supabase/supabase-js") return {
      createClient: (_url, _key, options) => {
        calls.push(["bearer-client", options.global.headers.Authorization]);
        return bearerClient;
      }
    };
    if (name === "next/navigation") return { redirect: () => { throw new Error("unexpected redirect"); } };
    if (name === "@/lib/auth") return { requireUser: async () => { throw new Error("unexpected requireUser"); } };
    if (name === "@/lib/domain/digital-observer/current-admin-authority") return {
      hasCurrentObserverAdmin: async () => false
    };
    throw new Error(`unexpected import: ${name}`);
  };
  runInNewContext(compiled, { exports, require, process: { env: {
    NEXT_PUBLIC_SUPABASE_URL: "https://local.example.invalid",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-only"
  } }, console: { warn() {} } });
  const get = (authorization) => exports.getDigitalObserverApiUser(new Request("http://localhost/api/digital-observer/settings", {
    headers: authorization === null ? {} : { authorization }
  }));
  return { calls, get };
}

test("unsupported Authorization header cannot fall back to another cookie user", async () => {
  const h = harness();
  assert.equal(await h.get("Basic invalid"), null);
  assert.deepEqual(h.calls, []);
});

test("empty Bearer cannot fall back to another cookie user", async () => {
  const h = harness();
  assert.equal(await h.get("Bearer "), null);
  assert.deepEqual(h.calls, []);
});

test("invalid Bearer is checked only as that Bearer, never via cookie", async () => {
  const h = harness();
  assert.equal(await h.get("Bearer invalid-token"), null);
  assert.deepEqual(h.calls, [
    ["bearer-client", "Bearer invalid-token"], ["bearer-get-user", "invalid-token"]
  ]);
});

test("valid Bearer returns only its Observer identity", async () => {
  const h = harness({ bearerIdentity: "observer-user" });
  const result = await h.get("Bearer valid-token");
  assert.equal(result.user.id, "observer-user");
  assert.equal(result.accessToken, "valid-token");
  assert(!h.calls.includes("cookie-client"));
});

test("request without Authorization still uses its cookie session", async () => {
  const h = harness();
  const result = await h.get(null);
  assert.equal(result.user.id, "cookie-user");
  assert.equal(result.accessToken, null);
  assert.equal(h.calls[0], "cookie-client");
});
