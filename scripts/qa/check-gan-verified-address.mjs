import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync(new URL("../../lib/management/verified-address.ts", import.meta.url), "utf8");
const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function loadPolicy({ resolved = null, suggestions = [], configured = true } = {}) {
  const calls = [];
  const providerCalls = [];
  const exports = {};
  const dependencies = {
    "server-only": {},
    "@/lib/domain/digital-observer/address-provider": {
      autocompleteObserverAddress: async () => ({ configured, suggestions }),
      resolveObserverAddress: async (...args) => { providerCalls.push(args); return resolved; }
    },
    "@/lib/security/rate-limit": {
      assertRateLimit: async (...args) => { calls.push(args); }
    }
  };
  vm.runInNewContext(javascript, { exports, require: (name) => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency ${name}`);
    return dependencies[name];
  } }, { timeout: 1000 });
  return { policy: exports, calls, providerCalls };
}

const place = {
  placeId: "israeli-place", formattedAddress: "הרצל 4, חיפה, ישראל", city: "חיפה", street: "הרצל",
  buildingNumber: "4", postalCode: "", countryCode: "IL", latitude: 32.81, longitude: 34.99, provider: "google_places"
};

test("verified selection requires a real Israeli provider result matching submitted fields", async () => {
  const { policy, providerCalls } = loadPolicy({ resolved: place });
  const valid = await policy.verifyGanAddressSelection({ placeId: place.placeId, city: "חיפה", street: "הרצל", buildingNumber: "4" }, "full");
  assert.equal(valid.status, "verified");
  assert.equal(valid.address.formattedAddress, place.formattedAddress);
  assert.equal(providerCalls[0][0], place.placeId);
  assert.equal(providerCalls[0][1], undefined, "final verification must not reuse the completed session token");
  assert.equal((await policy.verifyGanAddressSelection({ placeId: place.placeId, city: "אילת" }, "city")).status, "unverified");
  assert.equal((await policy.verifyGanAddressSelection({ placeId: place.placeId, city: "חיפה", street: "הרצל", buildingNumber: "9" }, "full")).status, "unverified");
});

test("manual addresses, missing building and foreign or implausible coordinates never become verified", async () => {
  assert.equal((await loadPolicy().policy.verifyGanAddressSelection({ city: "חיפה" }, "city")).status, "unverified");
  for (const resolved of [{ ...place, buildingNumber: "" }, { ...place, countryCode: "US" }, { ...place, latitude: 40 }, { ...place, longitude: Number.NaN }]) {
    assert.equal((await loadPolicy({ resolved }).policy.verifyGanAddressSelection({ placeId: place.placeId }, "full")).status, "unverified");
  }
});

test("all provider operations share a durable global daily budget", async () => {
  const { policy, calls } = loadPolicy();
  await policy.assertGanAddressProviderBudget("client-identity");
  assert.equal(calls.length, 2);
  assert.deepEqual(Array.from(calls[0]), ["client-identity", "gan:google-places-client", 8, 60]);
  assert.deepEqual(Array.from(calls[1]), ["gan:google-places-global", "gan:google-places-global", 50, 86400]);
});

test("autocomplete returns at most five suggestions", async () => {
  const suggestions = Array.from({ length: 8 }, (_, index) => ({ placeId: String(index), label: String(index) }));
  const { policy } = loadPolicy({ suggestions });
  assert.equal((await policy.searchGanAddresses("חיפה הרצל")).suggestions.length, 5);
});
