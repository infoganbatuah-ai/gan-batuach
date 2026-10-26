import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import ts from "typescript";

// This harness replaces only the route's server dependencies. It never opens
// a Supabase connection or registers a real Push token.
const apiUrl = `data:text/javascript,${encodeURIComponent(`
export const fail = (message, status) => Response.json({ error: message }, { status });
export const ok = (data) => Response.json({ data });
export const handleRouteError = () => Response.json({ error: "unexpected" }, { status: 500 });
`)}`;
const authUrl = `data:text/javascript,${encodeURIComponent(`
export async function requireUser() { return { profile: { id: "owner-a", role: "parent" } }; }
`)}`;
const supabaseUrl = `data:text/javascript,${encodeURIComponent(`
export async function createClient() { return {}; }
`)}`;
const pushUrl = `data:text/javascript,${encodeURIComponent(`
let writes = [];
export function reset() { writes = []; }
export function calls() { return writes; }
export async function registerPushDevice(_db, input) {
  writes.push(input);
  return { ok: true, device: { id: "synthetic-token-row" }, error: null };
}
`)}`;
const accessUrl = `data:text/javascript,${encodeURIComponent(`
let session = { profile: { id: "owner-a", role: "parent", active: true }, supabase: {} };
export function configure(nextSession) { session = nextSession; }
export async function getDigitalObserverApiUser() { return session; }
`)}`;
const registrationAccessUrl = `data:text/javascript,${encodeURIComponent(`
let site = { id: "00000000-0000-4000-8000-000000000044", active: true };
let checks = [];
export function configure(nextSite) { site = nextSite; checks = []; }
export function siteChecks() { return checks; }
export async function getObserverPushRegistrationSite(_db, profileId, siteId) {
  checks.push({ profileId, siteId });
  return site?.id === siteId && site.active === true ? site : null;
}
`)}`;
const aliases = new Map([
  ["@/lib/api", apiUrl], ["@/lib/auth", authUrl],
  ["@/lib/supabase/server", supabaseUrl], ["@/lib/domain/push-service", pushUrl],
  ["@/lib/domain/digital-observer/access", accessUrl],
  ["@/lib/domain/digital-observer/push-registration-access", registrationAccessUrl]
]);
registerHooks({
  resolve(specifier, context, next) {
    if (aliases.has(specifier) && context.parentURL?.endsWith("/app/api/push/register/route.ts")) {
      return { url: aliases.get(specifier), shortCircuit: true };
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

const route = await import("../../app/api/push/register/route.ts");
const push = await import(pushUrl);
const access = await import(accessUrl);
const registrationAccess = await import(registrationAccessUrl);
const { getObserverPushRegistrationSite } = await import("../../lib/domain/digital-observer/push-registration-access.ts");
const { selectCurrentPushSite } = await import("../../lib/domain/digital-observer/mobile-runtime.ts");
const { registerObserverPushAfterSiteGate } = await import("../../lib/domain/digital-observer/push-registration-order.ts");
const siteId = "00000000-0000-4000-8000-000000000044";
const otherSiteId = "00000000-0000-4000-8000-000000000045";
const session = { profile: { id: "owner-a", role: "parent", active: true }, supabase: {} };
const metadata = { source: "digital_observer_native", observer_site_id: siteId };
const request = (suppliedMetadata) => new Request("http://127.0.0.1/api/push/register", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ platform: "ios", device_token: "synthetic-token", device_id: "device-a", metadata: suppliedMetadata })
});

test("stale saved or requested Site is rejected against the current server list", () => {
  assert.equal(selectCurrentPushSite([siteId], otherSiteId), null);
  assert.equal(selectCurrentPushSite([siteId], null, otherSiteId), null);
  assert.equal(selectCurrentPushSite([siteId], siteId, otherSiteId), siteId);
  assert.equal(selectCurrentPushSite([siteId]), siteId);
});

test("rejected Site registration never calls the Push token route", async () => {
  const calls = [];
  await assert.rejects(registerObserverPushAfterSiteGate({ siteId, deviceLabel: "QA", deviceReference: "device-a",
    platform: "ios", deviceToken: "synthetic-token", source: "digital_observer_native" }, async (path) => {
    calls.push(path);
    if (path.endsWith("access-settings")) throw new Error("SITE_REVOKED");
  }), /SITE_REVOKED/);
  assert.deepEqual(calls, ["/api/digital-observer/access-settings"]);
});

test("partial Push failure leaves only the site operation; retry preserves order", async () => {
  const calls = [];
  const input = { siteId, deviceLabel: "QA", deviceReference: "device-a", platform: "ios",
    deviceToken: "synthetic-token", source: "digital_observer_native" };
  await assert.rejects(registerObserverPushAfterSiteGate(input, async (path) => {
    calls.push(path);
    if (path === "/api/push/register") throw new Error("PUSH_DOWN");
  }), /PUSH_DOWN/);
  assert.deepEqual(calls, ["/api/digital-observer/access-settings", "/api/push/register"]);
  calls.length = 0;
  await registerObserverPushAfterSiteGate(input, async (path) => { calls.push(path); });
  assert.deepEqual(calls, ["/api/digital-observer/access-settings", "/api/push/register"]);
});

test("server denies unauthorized and inactive Site before token upsert", async () => {
  for (const unavailable of [null, { id: siteId, active: false }, { id: otherSiteId, active: true }]) {
    push.reset(); access.configure(session); registrationAccess.configure(unavailable);
    const result = await route.POST(request(metadata));
    assert.equal(result.status, 403);
    assert.equal(push.calls().length, 0);
    assert.deepEqual(registrationAccess.siteChecks()[0], { profileId: "owner-a", siteId });
  }
});

test("global or organization-only Observer identity receives 403 without a direct Site binding", async () => {
  for (const profile of [
    { id: "global-admin", role: "admin", active: true },
    { id: "org-only", role: "parent", active: true }
  ]) {
    push.reset(); access.configure({ profile, supabase: {} }); registrationAccess.configure(null);
    const response = await route.POST(new Request("http://127.0.0.1/api/push/register", {
      method: "POST", headers: { "content-type": "application/json", authorization: "Bearer synthetic-session" },
      body: JSON.stringify({ platform: "ios", device_token: "synthetic-token", device_id: "device-a", metadata })
    }));
    assert.equal(response.status, 403);
    assert.equal(push.calls().length, 0);
    assert.deepEqual(registrationAccess.siteChecks()[0], { profileId: profile.id, siteId });
  }
});

test("revoked Development session and invalid Site claims cannot register", async () => {
  push.reset(); access.configure(null); registrationAccess.configure(null);
  assert.equal((await route.POST(request(metadata))).status, 401);
  assert.equal(push.calls().length, 0);
  access.configure(session); registrationAccess.configure({ id: siteId, active: true });
  for (const bad of [{ source: "other", observer_site_id: siteId },
    { source: "digital_observer_native", observer_site_id: "wrong" }]) {
    assert.equal((await route.POST(request(bad))).status, 400);
  }
  assert.equal(push.calls().length, 0);
});

test("current authorized Site registers, while generic products remain compatible", async () => {
  push.reset(); access.configure(session); registrationAccess.configure({ id: siteId, active: true });
  assert.equal((await route.POST(request(metadata))).status, 200);
  assert.equal(push.calls().length, 1);
  assert.deepEqual(push.calls()[0].metadata, metadata);
  assert.equal((await route.POST(request({ source: "digital_observer_fcm", observer_site_id: siteId }))).status, 200);
  assert.equal(push.calls().length, 2);
  push.reset(); access.configure(null); registrationAccess.configure(null);
  assert.equal((await route.POST(request({ source: "fcm_web" }))).status, 200);
  assert.equal(push.calls().length, 1);
  assert.equal(registrationAccess.siteChecks().length, 0);
});

test("Observer registration rejects missing installation identity before a write", async () => {
  push.reset(); access.configure(session); registrationAccess.configure({ id: siteId, active: true });
  const response = await route.POST(new Request("http://127.0.0.1/api/push/register", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ platform: "ios", device_token: "synthetic-token", metadata })
  }));
  assert.equal(response.status, 400);
  assert.equal(push.calls().length, 0);
});

test("Observer bearer cannot downgrade to generic registration or cookie fallback", async () => {
  const bearerRequest = (suppliedMetadata) => new Request("http://127.0.0.1/api/push/register", {
    method: "POST", headers: { "content-type": "application/json", authorization: "Bearer synthetic-session" },
    body: JSON.stringify({ platform: "ios", device_token: "synthetic-token", device_id: "device-a", metadata: suppliedMetadata })
  });
  push.reset(); access.configure(null); registrationAccess.configure(null);
  assert.equal((await route.POST(bearerRequest(metadata))).status, 401);
  access.configure(session); registrationAccess.configure({ id: siteId, active: true });
  assert.equal((await route.POST(bearerRequest({ source: "fcm_web" }))).status, 400);
  assert.equal(push.calls().length, 0);
});

function registrationDatabase(site, memberships = [], options = {}) {
  const calls = [];
  const tables = { observer_sites: site ? [site] : [], observer_site_memberships: memberships };
  return { calls, from(table) {
    assert.ok(Object.hasOwn(tables, table));
    const filters = [];
    const builder = {
      select() { return builder; },
      eq(column, value) { calls.push([table, "eq", column, value]); filters.push((row) => row[column] === value); return builder; },
      in(column, values) { calls.push([table, "in", column, values]); filters.push((row) => values.includes(row[column])); return builder; },
      async maybeSingle() {
        if (options.errorTable === table) return { data: null, error: { message: "synthetic read error" } };
        return { data: tables[table].find((row) => filters.every((filter) => filter(row))) ?? null, error: null };
      }
    };
    return builder;
  } };
}

const site = (overrides = {}) => ({ id: siteId, active: true, site_type: "home", garden_id: null,
  owner_profile_id: "owner-a", ...overrides });
const member = (role, overrides = {}) => ({ id: `membership-${role}`, observer_site_id: siteId,
  profile_id: "member-a", active: true, member_role: role, ...overrides });

test("exact Site owner or active owner/admin/operator membership may register; no global/org shortcut", async () => {
  assert.ok(await getObserverPushRegistrationSite(registrationDatabase(site()), "owner-a", siteId));
  for (const role of ["owner", "admin", "operator"]) {
    assert.ok(await getObserverPushRegistrationSite(registrationDatabase(site(), [member(role)]), "member-a", siteId));
  }
  for (const role of ["viewer", "billing"]) {
    assert.equal(await getObserverPushRegistrationSite(registrationDatabase(site(), [member(role)]), "member-a", siteId), null);
  }
  const globalAdmin = registrationDatabase(site());
  assert.equal(await getObserverPushRegistrationSite(globalAdmin, "global-admin", siteId), null);
  assert.equal(await getObserverPushRegistrationSite(registrationDatabase(site(), []), "org-only", siteId), null);
  assert.equal(globalAdmin.calls.some(([table]) => table === "digital_observer_organization_memberships"), false);
});

test("inactive, Garden-linked, wrong Site and revoked membership fail closed", async () => {
  for (const invalidSite of [site({ active: false }), site({ site_type: "kindergarten" }),
    site({ garden_id: "garden-a" }), site({ id: otherSiteId }), site({ site_type: null })]) {
    assert.equal(await getObserverPushRegistrationSite(registrationDatabase(invalidSite), "owner-a", siteId), null);
  }
  assert.equal(await getObserverPushRegistrationSite(registrationDatabase(site(), [member("operator", { active: false })]), "member-a", siteId), null);
  assert.equal(await getObserverPushRegistrationSite(registrationDatabase(site(), [member("operator", { observer_site_id: otherSiteId })]), "member-a", siteId), null);
  assert.equal(await getObserverPushRegistrationSite(registrationDatabase(site(), [member("operator")], { errorTable: "observer_site_memberships" }), "member-a", siteId), null);
  assert.equal(await getObserverPushRegistrationSite(registrationDatabase(site(), [], { errorTable: "observer_sites" }), "owner-a", siteId), null);
});

test("inactive or changed Observer session cannot reach registration write", async () => {
  push.reset(); registrationAccess.configure({ id: siteId, active: true });
  access.configure({ profile: { id: "owner-a", role: "parent", active: false }, supabase: {} });
  assert.equal((await route.POST(request(metadata))).status, 401);
  assert.equal(push.calls().length, 0);
  assert.equal(registrationAccess.siteChecks().length, 0);
});

test("consumer wiring uses the ordered site gate; token metadata is not delivery authority", () => {
  const native = readFileSync(new URL("../../components/digital-observer/observer-mobile-runtime.tsx", import.meta.url), "utf8");
  const web = readFileSync(new URL("../../components/digital-observer/observer-fcm-push-registration.tsx", import.meta.url), "utf8");
  const delivery = readFileSync(new URL("../../lib/domain/push-service.ts", import.meta.url), "utf8");
  const observerDelivery = readFileSync(new URL("../../lib/domain/digital-observer/notification-delivery-service.ts", import.meta.url), "utf8");
  const slotRoute = readFileSync(new URL("../../app/api/digital-observer/access-settings/route.ts", import.meta.url), "utf8");
  const runtimeRoute = readFileSync(new URL("../../app/api/digital-observer/mobile/runtime/route.ts", import.meta.url), "utf8");
  assert.match(native, /registerObserverPushAfterSiteGate/);
  assert.match(native, /verifiedSites\(AbortSignal\.timeout\(10_000\)\)/);
  assert.match(native, /credentials: "same-origin", cache: "no-store", signal/);
  assert.match(web, /registerObserverPushAfterSiteGate/);
  assert.match(delivery, /\.eq\("profile_id", input\.profileId\)/);
  const managementDelivery = delivery.slice(delivery.indexOf("export async function preparePushForNotification"));
  assert.match(managementDelivery, /\.contains\("metadata", \{ source: MANAGEMENT_PUSH_TOKEN_SOURCE \}\)/);
  assert.match(managementDelivery, /\.is\("metadata->observer_site_id", null\)/);
  assert.match(managementDelivery, /isManagementPushTokenMetadata\(token\.metadata\)/);
  assert.match(observerDelivery, /loadRecipientAuthorization\(admin, \{ siteId: delivery\.observer_site_id/);
  assert.match(observerDelivery, /assertRecipientAuthorization\(recipient\.authorization/);
  assert.match(slotRoute, /getObserverSiteAccess\(supabase, profile, payload\.observer_site_id, \{ manage: true \}\)/);
  assert.match(slotRoute, /payload\.action === "register_device" && site\.active !== true/);
  assert.match(runtimeRoute, /\.eq\("active", true\)/);
});
