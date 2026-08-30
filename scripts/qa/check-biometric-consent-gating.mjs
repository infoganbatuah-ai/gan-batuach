import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const route = read("app/api/digital-observer/biometric-settings/route.ts");
const knownPeople = read("app/api/digital-observer/known-people/route.ts");
const dashboard = read("app/digital-observer/dashboard/page.tsx");
const rules = read("app/digital-observer/rules/page.tsx");

assert.match(route, /explicit_consent/, "Site biometric setup must require explicit consent");
assert.match(route, /per_person_consent_required: true/, "Site consent must not replace per-person consent");
assert.match(route, /local_verified_model_required: true/, "Matching must require a verified local model");
assert.match(route, /biometric_matching_active: false/, "Setup must not claim biometric matching is active");
assert.match(route, /vision_privacy_mode === "skeleton_only"/, "Child privacy mode must block face setup");
assert.match(knownPeople, /camera_source_ids: z\.array/, "Known-person consent must be camera scoped");
assert.match(knownPeople, /consent_confirmed/, "Known-person creation must require explicit consent");
assert.match(knownPeople, /metadata\?\.biometric_setup_consent !== true/, "Known-person creation must require site biometric setup consent");
assert.match(dashboard, /ObserverBiometricSetupAction/, "Dashboard must expose biometric setup consent");
assert.match(rules, /ObserverBiometricSetupAction/, "My Observer must expose biometric setup consent");
assert.doesNotMatch(route, /recognition_status:\s*"active"/, "Consent alone must not activate recognition");

console.log("Biometric consent and readiness gating checks passed.");
