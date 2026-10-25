import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import ts from "typescript";

const fakeUrl = `data:text/javascript,${encodeURIComponent(`
const user = { id: "00000000-0000-4000-8000-000000000046", user_metadata: {}, app_metadata: {} };
let activeSession = true; let activeProfile = true; let bearerValid = true; let lookups = [];
export function configure({ session = true, profile = true, bearer = true } = {}) {
  activeSession = session; activeProfile = profile; bearerValid = bearer; lookups = [];
}
export function calls() { return lookups; }
function database(kind) { return {
  marker: kind,
  auth: { async getUser() { return { data: { user: kind === "bearer" && !bearerValid ? null : user }, error: null }; } },
  async rpc(name) { if (name !== "digital_observer_current_session_active") throw new Error("WRONG_RPC");
    return { data: activeSession, error: null }; },
  from(table) {
    lookups.push(table);
    const query = {
      select() { return query; }, eq() { return query; }, is() { return query; }, neq() { return query; }, limit() { return query; },
      async maybeSingle() { return { data: table === "profiles" ? { id: user.id, role: "parent", active: activeProfile } : null, error: null }; }
    };
    return query;
  }
}; }
export async function createCookieClient() { return database("cookie"); }
export function createBearerClient() { return database("bearer"); }
`)}`;
const modules = new Map([
  ["next/navigation", `data:text/javascript,${encodeURIComponent('export function redirect() { throw new Error("REDIRECT"); }')}`],
  ["@/lib/supabase/server", `data:text/javascript,${encodeURIComponent(`import { createCookieClient } from "${fakeUrl}"; export const createClient = createCookieClient;`)}`],
  ["@supabase/supabase-js", `data:text/javascript,${encodeURIComponent(`import { createBearerClient } from "${fakeUrl}"; export const createClient = createBearerClient;`)}`],
  ["@/lib/auth", `data:text/javascript,${encodeURIComponent('export function requireUser() { throw new Error("UNEXPECTED_REQUIRE_USER"); }')}`]
]);
registerHooks({
  resolve(specifier, context, next) {
    if (modules.has(specifier) && context.parentURL?.endsWith("/lib/domain/digital-observer/access.ts")) {
      return { url: modules.get(specifier), shortCircuit: true };
    }
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".ts")) return { format: "module", shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
      }).outputText };
    return next(url, context);
  }
});

const access = await import("../../lib/domain/digital-observer/access.ts");
const fake = await import(fakeUrl);
const request = (bearer = false) => new Request("http://127.0.0.1/api/push/unregister", {
  headers: bearer ? { authorization: "Bearer synthetic-session" } : {}
});

test("loss of the last Observer affiliation blocks Site access but retains own-token revocation", async () => {
  fake.configure();
  assert.equal(await access.getDigitalObserverApiUser(request()), null);
  const revocation = await access.getDigitalObserverPushRevocationUser(request());
  assert.equal(revocation?.profile.id, "00000000-0000-4000-8000-000000000046");
  fake.configure();
  await access.getDigitalObserverPushRevocationUser(request());
  assert.deepEqual(fake.calls(), ["profiles"], "revocation must not infer a new Site grant");
});

test("expired Auth session and inactive profile cannot revoke", async () => {
  fake.configure({ session: false });
  assert.equal(await access.getDigitalObserverPushRevocationUser(request()), null);
  fake.configure({ profile: false });
  assert.equal(await access.getDigitalObserverPushRevocationUser(request()), null);
});

test("invalid Bearer credential never falls back to cookie authentication", async () => {
  fake.configure({ bearer: false });
  assert.equal(await access.getDigitalObserverPushRevocationUser(request(true)), null);
});
