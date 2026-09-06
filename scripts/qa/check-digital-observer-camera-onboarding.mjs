import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { loadTs } from "./digital-guard-test-loader.mjs";

const onboarding = loadTs("lib/domain/digital-observer/camera-onboarding.ts");
const route = readFileSync("app/api/digital-observer/camera-onboarding/route.ts", "utf8");
const wizard = readFileSync("components/digital-observer/observer-action-forms.tsx", "utf8");
const existingSourcePanel = readFileSync("components/digital-observer/camera-onboarding-status.tsx", "utf8");
const addPage = readFileSync("app/digital-observer/cameras/add/page.tsx", "utf8");

test("onboarding lifecycle permits only safe, resumable transitions", () => {
  assert.doesNotThrow(() => onboarding.assertCameraOnboardingTransition("START", "SYSTEM_IDENTIFICATION"));
  assert.doesNotThrow(() => onboarding.assertCameraOnboardingTransition("CAMERA_MAPPING", "TESTING"));
  assert.doesNotThrow(() => onboarding.assertCameraOnboardingTransition("READY_TO_ACTIVATE", "ACTIVE"));
  assert.throws(() => onboarding.assertCameraOnboardingTransition("START", "ACTIVE"), /INVALID_CAMERA_ONBOARDING_TRANSITION/);
});

test("digital-first recommendations drive truthful customer states", () => {
  const direct = { recommendation: "DIRECT_CONNECTION_AVAILABLE", preferredMethod: "DIRECT_SECURE", productionEligible: true };
  const connector = { recommendation: "SOFTWARE_CONNECTOR_REQUIRED", preferredMethod: "SOFTWARE_CONNECTOR", productionEligible: false };
  const unsupported = { recommendation: "UNSUPPORTED_SYSTEM", preferredMethod: null, productionEligible: false };
  assert.equal(onboarding.onboardingStateForAssessment(direct), "CREDENTIALS_REQUIRED");
  assert.equal(onboarding.onboardingStateForAssessment(connector), "CONNECTION_RECOMMENDED");
  assert.equal(onboarding.onboardingStateForAssessment(unsupported), "UNSUPPORTED");
  assert.match(onboarding.simpleConnectionReason("PHYSICAL_GATEWAY_REQUIRED", []), /Gateway/);
});

test("discovered, configured and active monitoring remain distinct", () => {
  assert.equal(onboarding.isActiveMonitoringSource({ status: "draft", health_status: "unknown", source_mode: "readiness" }), false);
  assert.equal(onboarding.isActiveMonitoringSource({ status: "connected", health_status: "healthy", source_mode: "gateway_test" }), false);
  assert.equal(onboarding.isActiveMonitoringSource({ status: "connected", health_status: "healthy", source_mode: "gateway_test", last_seen_at: new Date().toISOString() }), true);
});

test("server onboarding route is tenant/site scoped, resumable and does not accept secrets", () => {
  assert.match(route, /getObserverSiteAccess\(session\.supabase, session\.profile, payload\.observer_site_id/);
  assert.match(route, /camera_connection_onboarding/);
  assert.match(route, /camera_connection_onboarding_audit/);
  assert.match(route, /assertSafeCameraConnectionAssessmentPayload/);
  assert.match(route, /source\.status === "draft" \? "TESTING"/);
  assert.match(route, /RUNTIME_STREAM_NOT_HEALTHY/);
  assert.doesNotMatch(route, /rtsp_url|source_url|credential_value/);
});

test("wizard supports unknown-system guidance, safer connection recommendation and explicit handoffs", () => {
  assert.match(wizard, /אני לא יודע\/ת איזו מערכת יש לי/);
  assert.match(wizard, /SOFTWARE_CONNECTOR_REQUIRED/);
  assert.match(wizard, /PHYSICAL_GATEWAY_REQUIRED/);
  assert.match(wizard, /DIRECT_CONNECTION_AVAILABLE/);
  assert.match(wizard, /camera-onboarding/);
  assert.match(wizard, /do-stepper-mobile/);
  assert.doesNotMatch(wizard, /rtsp:\/\/.*@/);
});

test("existing real source is reassessed non-destructively without re-enrollment", () => {
  assert.match(existingSourcePanel, /persist: false/);
  assert.match(existingSourcePanel, /assess_existing/);
  assert.match(addPage, /CameraOnboardingStatus/);
  assert.match(existingSourcePanel, /לא ניצור מקור נוסף/);
});

test("safe session projection bounds mapping data and never stores credential material", () => {
  const session = onboarding.safeOnboardingSession({
    observerSiteId: "site-1", diagnosticId: "diagnostic-1", state: "CAMERA_MAPPING",
    mappings: [{ stableChannelReference: "11", suggestedName: "Entrance", locationLabel: null, selected: true, duplicateCandidate: false }]
  });
  assert.equal(session.mappings.length, 1);
  assert.equal(session.credentialState, "NOT_REQUIRED");
  assert.equal(JSON.stringify(session).includes("secret_reference"), false);
});

console.log("Digital Observer zero-touch onboarding QA passed: state machine, tenant scope, safe resume, truthful activation and Digital-First UX.");
