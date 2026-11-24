import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const form = read("components/digital-observer/observer-action-forms.tsx");
const fields = read("components/digital-observer/observer-address-fields.tsx");
const autocomplete = read("app/api/digital-observer/address/autocomplete/route.ts");
const onboarding = read("app/api/digital-observer/onboarding/route.ts");
const provider = read("lib/domain/digital-observer/address-provider.ts");

test("onboarding cannot advance on a manually typed, unverified address", () => {
  assert.match(form, /form\.address_verification_status === "suggested"/);
  assert.match(form, /form\.address_place_id\.trim\(\)\.length >= 4/);
  assert.match(fields, /הזנה ידנית בלבד אינה מספיקה להפעלת ההגנה/);
  assert.doesNotMatch(fields, /אפשר להקים את החשבון/);
});

test("server requires a provider place id and resolves it again", () => {
  assert.match(onboarding, /address_place_id: z\.string\(\)\.trim\(\)\.min\(4\)/);
  assert.match(onboarding, /await resolveObserverAddress\(payload\.address_place_id/);
  assert.match(onboarding, /!resolvedAddress\.city \|\| !resolvedAddress\.street \|\| !resolvedAddress\.buildingNumber/);
});

test("address provider remains server-only and Israel-scoped", () => {
  assert.match(provider, /import "server-only"/);
  assert.match(provider, /GOOGLE_MAPS_PLATFORM_API_KEY/);
  assert.match(provider, /includedRegionCodes: \["il"\]/);
  assert.match(provider, /latitude/);
  assert.match(provider, /longitude/);
  assert.doesNotMatch(form, /GOOGLE_MAPS_PLATFORM_API_KEY|GOOGLE_MAPS_API_KEY/);
});

test("provider outage fails closed instead of accepting free text", () => {
  assert.match(autocomplete, /לא ניתן להשלים הקמת אתר בלי כתובת מאומתת/);
  assert.match(autocomplete, /לא ניתן להמשיך עם כתובת לא מאומתת/);
});
