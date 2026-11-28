import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync(new URL("../../lib/domain/digital-observer/access.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function fixture({ userMetadata = {}, appMetadata = {}, account = false, ownedSite = false, sessionActive = true } = {}) {
  const user = { id: "user-1", user_metadata: userMetadata, app_metadata: appMetadata };
  const rows = {
    profiles: { id: user.id, role: "parent", active: true },
    digital_observer_accounts: account ? { profile_id: user.id } : null,
    observer_sites: ownedSite ? { id: "site-1" } : null,
    observer_site_memberships: null,
    digital_observer_organization_memberships: null
  };
  const supabase = {
    auth: { getUser: async () => ({ data: { user }, error: null }) },
    rpc: async () => ({ data: sessionActive, error: null }),
    from(table) {
      const query = { select: () => query, eq: () => query, is: () => query,
        neq: () => query, limit: () => query,
        maybeSingle: async () => ({ data: rows[table] ?? null, error: null }) };
      return query;
    }
  };
  const redirects = [];
  const access = {};
  runInNewContext(compiled, {
    exports: access, process: { env: {} }, console: { warn: () => {} },
    require(id) {
      if (id === "@/lib/supabase/server") return { createClient: async () => supabase };
      if (id === "@supabase/supabase-js") return { createClient: () => supabase };
      if (id === "next/navigation") return { redirect: (path) => { redirects.push(path); throw new Error("redirect"); } };
      if (id === "@/lib/auth") return { requireUser: async () => ({ user, profile: rows.profiles }) };
      if (id === "@/lib/domain/digital-observer/current-admin-authority") return {
        hasCurrentObserverAdmin: async () => false
      };
      throw new Error(`Unexpected import: ${id}`);
    }
  });
  return { access, redirects };
}

test("editable product metadata alone cannot authorize Observer page or API", async () => {
  const { access, redirects } = fixture({ userMetadata: { product: "digital_observer" } });
  assert.equal(await access.getDigitalObserverApiUser(), null);
  await assert.rejects(access.requireDigitalObserverUser(), /redirect/);
  assert.deepEqual(redirects, ["/digital-observer/login?error=not_observer_account"]);
});

test("current server-side account or owned Site still authorizes a live session", async () => {
  for (const options of [{ account: true }, { ownedSite: true }]) {
    const { access } = fixture(options);
    assert.equal((await access.getDigitalObserverApiUser())?.user.id, "user-1");
    assert.equal((await access.requireDigitalObserverUser())?.user.id, "user-1");
  }
});

test("stale app admin JWT claim alone cannot replace a current server-side association", async () => {
  const { access, redirects } = fixture({ appMetadata: { digital_observer_admin: true } });
  assert.equal(await access.getDigitalObserverApiUser(), null);
  await assert.rejects(access.requireDigitalObserverUser(), /redirect/);
  assert.deepEqual(redirects, ["/digital-observer/login?error=not_observer_account"]);
});

test("revoked session denies API and page regardless of editable product label", async () => {
  const { access, redirects } = fixture({ account: true, userMetadata: { product: "digital_observer" }, sessionActive: false });
  assert.equal(await access.getDigitalObserverApiUser(), null);
  await assert.rejects(access.requireDigitalObserverUser(), /redirect/);
  assert.deepEqual(redirects, ["/digital-observer/login?error=session_expired"]);
});
