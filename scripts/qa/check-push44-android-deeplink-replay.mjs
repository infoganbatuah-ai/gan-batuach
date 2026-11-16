import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = new URL("../../", import.meta.url);
const compile = (path) => ts.transpileModule(readFileSync(new URL(path, root), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText;
const mobile = {};
vm.runInNewContext(compile("lib/domain/digital-observer/mobile-runtime.ts"), {
  exports: mobile, URL, URLSearchParams, require: (id) => { assert.equal(id, "zod"); return require("zod"); }
}, { timeout: 5000 });
const pending = {};
vm.runInNewContext(compile("lib/domain/digital-observer/pending-mobile-link.ts"), {
  exports: pending, URL, URLSearchParams, Date, JSON, require: (id) => { assert.equal(id, "./mobile-runtime"); return mobile; }
}, { timeout: 5000 });
const site = "00000000-0000-4000-8000-000000000045";
const camera = "00000000-0000-4000-8000-000000000044";
const link = `digitalobserver://camera/${camera}?site=${site}`;
const store = () => {
  const values = new Map();
  return { values, getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
};

test("cold-start link is canonicalized, replayed once after login and still needs server authorization", () => {
  const storage = store();
  assert.equal(pending.rememberPendingMobileLink(storage, `${link}&ignored=1`, 1_000), true);
  const replay = pending.takePendingMobileLink(storage, 2_000);
  assert.equal(replay, link);
  assert.equal(pending.takePendingMobileLink(storage, 2_000), null);
  assert.equal(mobile.parseMobileLink(replay).observerSiteId, site);
  assert.match(mobile.authorizedMobileDestination(mobile.parseMobileLink(replay)), /\/digital-observer\/sites\//);
  const route = readFileSync(new URL("app/api/digital-observer/mobile/runtime/route.ts", root), "utf8");
  assert.match(route, /getDigitalObserverApiUser\(request\)/);
  assert.match(route, /getObserverSiteAccess\(session\.supabase, session\.profile, link\.observerSiteId\)/);
  assert.match(route, /\.eq\("observer_site_id", link\.observerSiteId\)/);
});

test("pending link expires and malformed or external links are never stored", () => {
  const storage = store();
  for (const invalid of ["https://attacker.invalid/x", `digitalobserver://camera/${camera}?site=wrong`,
    `digitalobserver://camera/${camera}/extra?site=${site}`, `digitalobserver://camera/${camera}?site=${site}&token=${"x".repeat(3000)}`]) {
    assert.equal(pending.rememberPendingMobileLink(storage, invalid, 1_000), false);
  }
  assert.equal(pending.rememberPendingMobileLink(storage, link, 1_000), true);
  assert.equal(pending.takePendingMobileLink(storage, 301_000), null);
});

test("initial launch URL is suppressed across login reload, but can be retried after expiry", () => {
  const storage = store();
  assert.equal(pending.firstLaunchOfMobileLink(storage, link, 1_000), true);
  assert.equal(pending.firstLaunchOfMobileLink(storage, link, 2_000), false);
  assert.equal(pending.firstLaunchOfMobileLink(storage, link, 301_000), true);
  storage.values.set("digital_observer_launch_link_seen_v1", "damaged marker");
  assert.equal(pending.firstLaunchOfMobileLink(storage, link, 302_000), true);
});

test("native runtime queues only a 401 link and replays after authenticated bootstrap", () => {
  const runtime = readFileSync(new URL("components/digital-observer/observer-mobile-runtime.tsx", root), "utf8");
  assert.match(runtime, /response\.status === 401 && Capacitor\.isNativePlatform\(\)/);
  assert.match(runtime, /rememberPendingMobileLink\(window\.sessionStorage, rawUrl, Date\.now\(\), window\.location\.origin\)/);
  assert.match(runtime, /takePendingMobileLink\(window\.sessionStorage, Date\.now\(\), window\.location\.origin\)/);
  assert.match(runtime, /if \(pendingLink\) \{/);
  assert.match(runtime, /firstLaunchOfMobileLink\(window\.sessionStorage, launch\.url, Date\.now\(\), window\.location\.origin\)/);
});

async function authorizeLink({ session = true, siteAllowed = true, resourceAllowed = true } = {}) {
  const exports = {};
  const calls = [];
  const supabase = { from: (table) => {
    calls.push(["table", table]);
    const query = { select: () => query, eq: (field, value) => { calls.push([field, value]); return query; },
      maybeSingle: async () => ({ data: resourceAllowed ? { id: camera, observer_site_id: site } : null, error: null }) };
    return query;
  } };
  const modules = {
    zod: require("zod"),
    "@/lib/api": {
      fail: (_message, status) => new Response("denied", { status }),
      ok: (value) => new Response(JSON.stringify(value), { status: 200 }),
      handleRouteError: (error) => { throw error; }
    },
    "@/lib/domain/digital-observer/access": {
      getDigitalObserverApiUser: async () => session ? { supabase, profile: { id: "qa-owner" } } : null,
      getObserverSiteAccess: async (_client, _profile, siteId) => siteAllowed && siteId === site ? { id: site } : null
    },
    "@/lib/domain/digital-observer/mobile-runtime": mobile
  };
  vm.runInNewContext(compile("app/api/digital-observer/mobile/runtime/route.ts"), {
    exports, URL, Response, Date, process: { env: {} },
    require: (id) => { assert.ok(Object.hasOwn(modules, id), id); return modules[id]; }
  }, { timeout: 5000 });
  const response = await exports.POST(new Request("https://qa.invalid/api/digital-observer/mobile/runtime", {
    method: "POST", body: JSON.stringify({ url: link }), headers: { "content-type": "application/json" }
  }));
  return { status: response.status, calls };
}

test("replayed link cannot bypass logged-out or cross-Site authorization", async () => {
  assert.equal((await authorizeLink({ session: false })).status, 401);
  assert.equal((await authorizeLink({ siteAllowed: false })).status, 403);
  assert.equal((await authorizeLink({ resourceAllowed: false })).status, 404);
  const allowed = await authorizeLink();
  assert.equal(allowed.status, 200);
  assert.ok(allowed.calls.some(([name, value]) => name === "observer_site_id" && value === site));
});
