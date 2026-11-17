import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync(new URL("../../lib/domain/digital-observer/access.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function fixture({ owner = "site-owner", member = null, observerAdmin = false, lookupFails = false } = {}) {
  const calls = [];
  const site = { id: "site-b", site_type: "home", garden_id: null, owner_profile_id: owner, digital_observer_organization_id: null };
  const db = { from(table) { return { select() { return this; }, eq() { return this; }, in() { return this; }, async maybeSingle() {
    calls.push(table);
    return { data: table === "observer_sites" ? site : table === "observer_site_memberships" ? member : null, error: null };
  } }; } };
  const access = {};
  runInNewContext(compiled, { exports: access, require(id) {
    if (id === "@/lib/domain/digital-observer/current-admin-authority") return { hasCurrentObserverAdmin: async () => {
      calls.push("current-observer-admin");
      if (lookupFails) throw Error("Auth unavailable");
      return observerAdmin;
    } };
    if (["@/lib/supabase/server", "next/navigation", "@/lib/auth", "@supabase/supabase-js"].includes(id)) return {};
    throw Error(`Unexpected import: ${id}`);
  } });
  return { access, db, site, calls };
}

test("Gan Management admin with Observer membership at another Site cannot cross into Site B", async () => {
  const { access, db, calls } = fixture();
  assert.equal(await access.getObserverSiteAccess(db, { id: "gan-admin", role: "admin" }, "site-b", { manage: true }), null);
  assert(calls.includes("observer_site_memberships"));
});

test("Observer site owner and active site member retain their scoped access", async () => {
  const owned = fixture({ owner: "owner" });
  assert.equal((await owned.access.getObserverSiteAccess(owned.db, { id: "owner", role: "parent" }, "site-b")).id, "site-b");
  const member = fixture({ member: { id: "membership", member_role: "operator" } });
  assert.equal((await member.access.getObserverSiteAccess(member.db, { id: "member", role: "admin" }, "site-b", { manage: true })).id, "site-b");
});

test("only current explicit Observer admin can use cross-Site platform access", async () => {
  const current = fixture({ observerAdmin: true });
  assert.equal((await current.access.getObserverSiteAccess(current.db, { id: "observer-admin", role: "parent" }, "site-b")).id, "site-b");
  const stale = fixture({ lookupFails: true });
  await assert.rejects(stale.access.getObserverSiteAccess(stale.db, { id: "observer-admin", role: "admin" }, "site-b"), /Auth unavailable/);
});

test("Observer routes never promote Gan Management admin role to platform privilege", () => {
  const routes = [
    "app/api/digital-observer/watch-rules/route.ts",
    "app/api/digital-observer/incidents/feedback/route.ts",
    "app/api/digital-observer/partners/route.ts",
    "app/api/digital-observer/enterprise/route.ts",
    "app/api/digital-observer/billing/route.ts",
    "app/digital-observer/incidents/page.tsx"
  ];
  for (const route of routes) {
    const content = readFileSync(new URL(`../../${route}`, import.meta.url), "utf8");
    assert(!content.includes('profile.role === "admin" || await hasCurrentObserverAdmin'), route);
  }
});
