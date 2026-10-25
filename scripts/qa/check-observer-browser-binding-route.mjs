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
const accessUrl = `data:text/javascript,${encodeURIComponent(`
let current = null;
export function setSession(session) { current = session; }
export async function getDigitalObserverPushRevocationUser() { return current; }
`)}`;
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.endsWith("/app/api/push/browser-binding/route.ts")) {
      if (specifier === "@/lib/api") return { url: apiUrl, shortCircuit: true };
      if (specifier === "@/lib/domain/digital-observer/access") return { url: accessUrl, shortCircuit: true };
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

const route = await import("../../app/api/push/browser-binding/route.ts");
const access = await import(accessUrl);
const owner = "00000000-0000-4000-8000-000000000001";
const site = "00000000-0000-4000-8000-000000000003";
const reference = "00000000-0000-4000-8000-000000000005";
const request = (id = reference) => new Request(`http://127.0.0.1/api/push/browser-binding?device_id=${id}`);
const row = { metadata: { source: "digital_observer_fcm", observer_site_id: site } };
function session(rows, error = null) {
  const filters = [];
  const query = {
    select(value) { filters.push(["select", value]); return this; },
    eq(key, value) { filters.push(["eq", key, value]); return this; },
    contains(key, value) { filters.push(["contains", key, value]); return this; },
    limit(value) { filters.push(["limit", value]); return Promise.resolve({ data: rows, error }); }
  };
  return { filters, profile: { id: owner }, supabase: { from(table) {
    filters.push(["from", table]); return query;
  } } };
}

test("legacy lookup returns exactly one current owner's active FCM Site binding", async () => {
  const active = session([row]); access.setSession(active);
  const response = await route.GET(request());
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data, { confirmed: true, profile_id: owner,
    device_id: reference, observer_site_id: site });
  assert.deepEqual(active.filters, [["from", "push_device_tokens"], ["select", "metadata"],
    ["eq", "profile_id", owner], ["eq", "device_id", reference], ["eq", "platform", "web"], ["eq", "is_active", true],
    ["contains", "metadata", { source: "digital_observer_fcm" }], ["limit", 2]]);
});

test("no session, no exact row, ambiguity and invalid metadata all fail closed", async () => {
  access.setSession(null);
  assert.equal((await route.GET(request())).status, 401);
  access.setSession(session([]));
  assert.equal((await route.GET(request())).status, 404);
  access.setSession(session([row, row]));
  assert.equal((await route.GET(request())).status, 409);
  access.setSession(session([{ metadata: { source: "digital_observer_fcm", observer_site_id: "bad" } }]));
  assert.equal((await route.GET(request())).status, 409);
  access.setSession(session([row], { message: "offline" }));
  assert.equal((await route.GET(request())).status, 503);
  assert.equal((await route.GET(request("invalid"))).status, 400);
});
