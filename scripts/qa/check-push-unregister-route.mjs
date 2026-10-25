import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import ts from "typescript";

const apiUrl = `data:text/javascript,${encodeURIComponent(`
export const fail = (message, status) => Response.json({ error: message }, { status });
export const ok = (data) => Response.json({ data });
export const handleRouteError = () => Response.json({ error: "unexpected" }, { status: 500 });
`)}`;
const authUrl = `data:text/javascript,${encodeURIComponent(`
export async function requireUser() { return { profile: { id: "owner-a", role: "parent" } }; }
`)}`;
const supabaseUrl = `data:text/javascript,${encodeURIComponent(`
export async function createClient() { return { marker: "cookie-client" }; }
`)}`;
const pushUrl = `data:text/javascript,${encodeURIComponent(`
let calls = [];
let failed = false;
let confirmed = true;
export function reset() { calls = []; failed = false; confirmed = true; }
export function setFailure(value) { failed = value; }
export function setConfirmed(value) { confirmed = value; }
export function writes() { return calls; }
export async function unregisterPushDevice(...args) {
  calls.push(args);
  return failed ? { ok: false, rows: [], error: "DB_FAILED" }
    : { ok: true, rows: [{ id: "synthetic-row", is_active: false }], confirmed, error: null };
}
`)}`;
const accessUrl = `data:text/javascript,${encodeURIComponent(`
let observer = { profile: { id: "owner-a", role: "parent" }, supabase: { marker: "bearer-client" } };
let revocation = observer;
export function configure(value, revocationValue = value) { observer = value; revocation = revocationValue; }
export async function getDigitalObserverApiUser() { return observer; }
export async function getDigitalObserverPushRevocationUser() { return revocation; }
`)}`;
const aliases = new Map([
  ["@/lib/api", apiUrl], ["@/lib/auth", authUrl],
  ["@/lib/supabase/server", supabaseUrl], ["@/lib/domain/push-service", pushUrl],
  ["@/lib/domain/digital-observer/access", accessUrl]
]);
registerHooks({
  resolve(specifier, context, next) {
    if (aliases.has(specifier) && context.parentURL?.endsWith("/app/api/push/unregister/route.ts")) {
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

const route = await import("../../app/api/push/unregister/route.ts");
const push = await import(pushUrl);
const access = await import(accessUrl);
const siteId = "00000000-0000-4000-8000-000000000044";
const observer = { profile: { id: "owner-a", role: "parent" }, supabase: { marker: "bearer-client" } };
const request = (body, bearer = false) => new Request("http://127.0.0.1/api/push/unregister", {
  method: "POST", headers: { "content-type": "application/json", ...(bearer ? { authorization: "Bearer synthetic-session" } : {}) },
  body: JSON.stringify(body)
});
const scoped = { device_id: "installation-a", source: "digital_observer_native", observer_site_id: siteId };

test("valid Observer revocation uses exact scope and authenticated bearer client", async () => {
  push.reset(); access.configure(observer);
  const response = await route.POST(request(scoped, true));
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.data.confirmed, true);
  assert.equal(payload.data.profile_id, "owner-a");
  assert.equal(push.writes().length, 1);
  assert.equal(push.writes()[0][0].marker, "bearer-client");
  assert.deepEqual(push.writes()[0].slice(1), ["owner-a", null, "installation-a",
    { source: "digital_observer_native", siteId }]);
});

test("revoked Site can still revoke own token; no Site authorization lookup is required", async () => {
  push.reset(); access.configure(null, observer);
  assert.equal((await route.POST(request(scoped))).status, 200);
  assert.equal(push.writes().length, 1);
  assert.equal(push.writes()[0][0].marker, "bearer-client");
});

test("invalid bearer never falls back to a cookie", async () => {
  push.reset(); access.configure(null);
  assert.equal((await route.POST(request(scoped, true))).status, 401);
  assert.equal(push.writes().length, 0);
});

test("Observer account cannot send empty or unscoped revocation", async () => {
  push.reset(); access.configure(observer);
  for (const body of [{}, { device_id: "installation-a" },
    { device_id: "installation-a", source: "digital_observer_native" }]) {
    assert.equal((await route.POST(request(body))).status, 400);
  }
  assert.equal(push.writes().length, 0);
});

test("generic targeted revocation remains available to non-Observer users", async () => {
  push.reset(); access.configure(null);
  assert.equal((await route.POST(request({ device_token: "synthetic-token-a" }))).status, 200);
  assert.deepEqual(push.writes()[0].slice(1), ["owner-a", "synthetic-token-a", null, undefined]);
});

test("database failure does not claim successful revocation", async () => {
  push.reset(); access.configure(observer); push.setFailure(true);
  assert.equal((await route.POST(request(scoped))).status, 500);
  assert.equal(push.writes().length, 1);
});

test("Observer response without read-back confirmation is not a success", async () => {
  push.reset(); access.configure(observer); push.setConfirmed(false);
  assert.equal((await route.POST(request(scoped))).status, 500);
  assert.equal(push.writes().length, 1);
});

test("web and native consumers use their existing installation identity for scoped revocation", () => {
  const web = readFileSync(new URL("../../components/digital-observer/observer-fcm-push-registration.tsx", import.meta.url), "utf8");
  const native = readFileSync(new URL("../../components/digital-observer/observer-mobile-runtime.tsx", import.meta.url), "utf8");
  assert.match(web, /postJson\("\/api\/push\/unregister"/);
  assert.match(web, /device_id: binding\.deviceReference, source: "digital_observer_fcm", observer_site_id: binding\.siteId/);
  assert.match(native, /Preferences\.get\(\{ key: deviceReferenceKey \}\)/);
  assert.match(native, /device_id: reference, source: "digital_observer_native", observer_site_id: siteId/);
  assert.match(native, /digital-observer:disable-native-push/);
  assert.match(native, /response\.status === 409/);
});
