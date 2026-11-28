import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync(new URL("../../lib/domain/digital-observer/admin-access.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const authoritySource = readFileSync(new URL("../../lib/domain/digital-observer/current-admin-authority.ts", import.meta.url), "utf8");
const authorityCompiled = ts.transpileModule(authoritySource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function fixture({ currentClaim = false, lookupError = false, configured = true, returnedId = "user-1", sessionActive = true } = {}) {
  const calls = [];
  const redirects = [];
  const access = {};
  const authority = {};
  const adminClient = {
    isAdminClientConfigured: () => configured,
    createAdminClient: () => ({ auth: { admin: { getUserById: async (id) => {
      calls.push(id);
      return { data: { user: { id: returnedId, app_metadata: { digital_observer_admin: currentClaim } } },
        error: lookupError ? new Error("lookup failed") : null };
    } } } })
  };
  runInNewContext(authorityCompiled, { exports: authority, require(id) {
    if (id === "@/lib/supabase/admin") return adminClient;
    throw new Error(`Unexpected authority import: ${id}`);
  } });
  runInNewContext(compiled, {
    exports: access,
    require(id) {
      if (id === "next/navigation") return { redirect: (path) => { redirects.push(path); throw new Error("redirect"); } };
      if (id === "@/lib/auth") return { requireUser: async () => ({ user: { id: "user-1", app_metadata: { digital_observer_admin: true } } }) };
      if (id === "@/lib/domain/digital-observer/access") return { getDigitalObserverApiUser: async () => sessionActive ? { user: { id: "user-1" } } : null };
      if (id === "@/lib/supabase/admin") return adminClient;
      if (id === "@/lib/domain/digital-observer/current-admin-authority") return authority;
      throw new Error(`Unexpected import: ${id}`);
    }
  });
  return { access, calls, redirects };
}

test("stale signed JWT admin claim is denied after current Auth revocation", async () => {
  const { access, calls, redirects } = fixture();
  assert.equal(await access.hasCurrentObserverAdmin("user-1"), false);
  await assert.rejects(access.requireDigitalObserverAdmin(), /redirect/);
  assert.deepEqual(calls, ["user-1", "user-1"]);
  assert.deepEqual(redirects, ["/digital-observer/dashboard?error=observer_admin_required"]);
});

test("current server-owned Observer admin is still authorized", async () => {
  const { access, calls } = fixture({ currentClaim: true });
  assert.equal(await access.hasCurrentObserverAdmin("user-1"), true);
  assert.equal((await access.requireDigitalObserverAdmin()).observerAdmin.scope, "digital_observer_only");
  assert.deepEqual(calls, ["user-1", "user-1"]);
});

test("lookup failure, missing admin setup and mismatched Auth user fail closed", async () => {
  for (const options of [{ lookupError: true }, { configured: false }, { returnedId: "other-user" }]) {
    const { access } = fixture({ ...options, currentClaim: true });
    assert.equal(await access.hasCurrentObserverAdmin("user-1"), false);
  }
});

test("revoked Observer session denies page even when current admin claim remains", async () => {
  const { access, calls, redirects } = fixture({ currentClaim: true, sessionActive: false });
  await assert.rejects(access.requireDigitalObserverAdmin(), /redirect/);
  assert.deepEqual(calls, []);
  assert.deepEqual(redirects, ["/digital-observer/login?error=session_expired"]);
});

test("privileged cost route denies stale JWT before any admin data read", async () => {
  const routeSource = readFileSync(new URL("../../app/api/digital-observer/admin/costs/route.ts", import.meta.url), "utf8");
  const route = {};
  let privilegedReads = 0;
  runInNewContext(ts.transpileModule(routeSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports: route, Request, URL,
    require(id) {
      if (id === "next/server") return { NextResponse: { json: () => { privilegedReads++; return new Response(); } } };
      if (id === "@/lib/api") return { fail: (_message, status) => new Response("denied", { status }), handleSafeRouteError: (error) => { throw error; } };
      if (id === "@/lib/domain/digital-observer/access") return { getDigitalObserverApiUser: async () => ({ user: { id: "user-1", app_metadata: { digital_observer_admin: true } } }) };
      if (id === "@/lib/domain/digital-observer/admin-access") return { hasCurrentObserverAdmin: async () => false };
      if (id === "@/lib/domain/digital-observer/cost-intelligence-data") return {
        loadCostIntelligence: () => { privilegedReads++; throw new Error("UNEXPECTED_ADMIN_READ"); }, formatCostCsv: () => ""
      };
      throw new Error(`Unexpected import: ${id}`);
    }
  });
  const response = await route.GET(new Request("https://observer.example.invalid/api/digital-observer/admin/costs"));
  assert.equal(response.status, 403);
  assert.equal(privilegedReads, 0);
});
