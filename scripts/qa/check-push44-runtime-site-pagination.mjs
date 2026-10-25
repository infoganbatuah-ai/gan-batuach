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
let rows = []; let allowed = new Set(); let failAt = -1; let ranges = [];
export function configure(nextRows, nextAllowed, nextFailAt = -1) {
  rows = nextRows; allowed = new Set(nextAllowed); failAt = nextFailAt; ranges = [];
}
export function requestedRanges() { return ranges; }
export async function getDigitalObserverApiUser() { return { profile: { id: "owner-a" }, supabase: {
  from(table) {
    if (table !== "observer_sites") throw new Error("WRONG_TABLE");
    const builder = {
      select() { return builder; }, is() { return builder; }, neq() { return builder; },
      eq() { return builder; }, order() { return builder; },
      async range(from, to) {
        ranges.push([from, to]);
        if (from === failAt) return { data: null, error: { message: "synthetic failure" } };
        return { data: rows.slice(from, to + 1), error: null };
      }
    };
    return builder;
  }
} }; }
export async function getObserverSiteAccess(_db, _profile, id) { return allowed.has(id) ? { id } : null; }
`)}`;
const mobileUrl = `data:text/javascript,${encodeURIComponent(`
export const DIGITAL_OBSERVER_MOBILE_RUNTIME_CONTRACT = "digital-observer-mobile-runtime-v1";
export const authorizedMobileDestination = () => "";
export const parseMobileLink = () => ({});
`)}`;
const aliases = new Map([["@/lib/api", apiUrl],
  ["@/lib/domain/digital-observer/access", accessUrl],
  ["@/lib/domain/digital-observer/mobile-runtime", mobileUrl]]);
registerHooks({
  resolve(specifier, context, next) {
    if (aliases.has(specifier) && context.parentURL?.endsWith("/app/api/digital-observer/mobile/runtime/route.ts")) {
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

const route = await import("../../app/api/digital-observer/mobile/runtime/route.ts");
const access = await import(accessUrl);
const site = (index) => ({ id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
  name: `Synthetic ${index}`, timezone: null });
const request = () => new Request("http://127.0.0.1/api/digital-observer/mobile/runtime");

test("authorized Site after the former 25-row cutoff remains visible; other Sites never leak", async () => {
  const rows = Array.from({ length: 30 }, (_, index) => site(index + 1));
  access.configure(rows, [rows[28].id]);
  const response = await route.GET(request());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body.data.sites, [rows[28]]);
  assert.deepEqual(access.requestedRanges(), [[0, 24], [25, 49]]);
});

test("over-ceiling list fails closed instead of claiming a missing Site was revoked", async () => {
  const rows = Array.from({ length: 101 }, (_, index) => site(index + 1));
  access.configure(rows, [rows[100].id]);
  const response = await route.GET(request());
  assert.equal(response.status, 503);
  assert.equal(JSON.stringify(await response.json()).includes(rows[100].id), false);
  assert.deepEqual(access.requestedRanges().at(-1), [100, 100]);
});

test("pagination failure does not return a partial authorization set", async () => {
  const rows = Array.from({ length: 30 }, (_, index) => site(index + 1));
  access.configure(rows, [rows[0].id], 25);
  const response = await route.GET(request());
  assert.equal(response.status, 503);
  assert.equal(JSON.stringify(await response.json()).includes(rows[0].id), false);
});
