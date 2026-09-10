import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { loadTs } from "./digital-guard-test-loader.mjs";

const orchestrator = loadTs("lib/domain/digital-observer/connection-orchestrator.ts");
const registry = loadTs("lib/domain/digital-observer/connectivity-registry.ts");
const intelligence = loadTs("lib/domain/digital-observer/connection-intelligence.ts");
const mobile = loadTs("lib/domain/digital-observer/mobile-camera-setup.ts");
const lifecycle = loadTs("lib/domain/digital-observer/connection-lifecycle.ts");
const now = new Date("2026-09-07T21:00:00Z");
const siteId = "00000000-0000-4000-8000-000000000001";
const proof = { strategy: "VENDOR_CLOUD", implemented: true, authorized: true, secureTransport: true,
  recoverable: true, survivesSetupDeviceDeparture: true, requiresCustomerService: false,
  requiresInboundExposure: false, privacyAllowed: true, measuredStability: 0.99 };
const input = { family: "tapo-c211", computerAvailable: "UNKNOWN", connectorOnline: false,
  nativeDiscoveryAvailable: false, persistentPaths: [] };
function sample(overrides = {}) {
  return { attemptId: randomUUID(), siteId, family: "tapo-c211", strategy: "SOFTWARE_CONNECTOR",
    registryVersion: registry.connectivityRegistryVersion, orchestratorVersion: orchestrator.connectionOrchestratorVersion,
    firmware: null, outcome: "ACTIVATED", failure: null, durationMs: 120000, interactions: 4,
    manualFields: 2, externalAppSteps: 1, installationRequired: true, manualSupportRequired: false,
    stability: null, occurredAt: now.toISOString(), provenance: "PRODUCTION", zeroInstallVerified: false, ...overrides };
}

test("secure persistent cloud outranks an available local bridge", () => {
  const result = orchestrator.planCameraConnection({ ...input, connectorOnline: true, persistentPaths: [proof] }, now);
  assert.equal(result.preferredStrategy, "VENDOR_CLOUD");
  assert.equal(result.zeroInstall, true);
});
test("security, authorization and persistence cannot be traded for ranking", () => {
  for (const field of ["implemented", "authorized", "secureTransport", "recoverable", "survivesSetupDeviceDeparture", "privacyAllowed"]) {
    assert.equal(orchestrator.rankPersistentPaths([{ ...proof, [field]: false, measuredStability: 100000 }]).length, 0, field);
  }
  for (const field of ["requiresCustomerService", "requiresInboundExposure"]) {
    assert.equal(orchestrator.isZeroInstallPath({ ...proof, [field]: true }), false, field);
  }
});
test("mobile discovery alone is not zero-install persistence", () => {
  const result = orchestrator.planCameraConnection({ ...input, nativeDiscoveryAvailable: true,
    persistentPaths: [{ ...proof, strategy: "MOBILE_PROVISIONED", survivesSetupDeviceDeparture: false }] }, now);
  assert.equal(result.zeroInstall, false);
  assert.equal(result.mobile.temporaryOnly, true);
});
test("vendor documentation without our adapter yields integration pending, never hardware required", () => {
  const result = orchestrator.planCameraConnection({ ...input, family: "nest-wired", computerAvailable: "NO" }, now);
  assert.equal(result.classification, "ZERO_INSTALL_INTEGRATION_NOT_YET_AVAILABLE");
  assert.equal(result.preferredStrategy, null);
});
test("unknown recorder is not automatically classified hardware-required", () => {
  for (const family of ["unknown", "generic-recorder"]) {
    const result = orchestrator.planCameraConnection({ ...input, family, computerAvailable: "NO" }, now);
    assert.equal(result.classification, "IDENTIFICATION_REQUIRED");
    assert.equal(result.hardwareReason, null);
  }
});
test("available connector is reused; computer question precedes hardware fallback", () => {
  assert.equal(orchestrator.planCameraConnection({ ...input, connectorOnline: true }, now).nextAction, "DISCOVER");
  assert.equal(orchestrator.planCameraConnection(input, now).nextAction, "ASK_COMPUTER");
  assert.equal(orchestrator.planCameraConnection({ ...input, computerAvailable: "YES" }, now).preferredStrategy, "SOFTWARE_CONNECTOR");
  const noComputer = orchestrator.planCameraConnection({ ...input, computerAvailable: "NO" }, now);
  assert.equal(noComputer.hardwareReason, "NO_ALWAYS_ON_HOST_FOR_VERIFIED_LOCAL_PATH");
  assert.equal(noComputer.persistentMonitoringVerified, false);
});
test("generic protocol is a candidate, not proof of connected monitoring", () => {
  const result = orchestrator.planCameraConnection({ ...input, family: "generic-onvif", connectorOnline: true }, now);
  assert.equal(result.nextAction, "DISCOVER");
  assert.equal(result.persistentMonitoringVerified, false);
  assert.equal(result.zeroInstall, false);
});
test("old capability knowledge is revalidated and cannot authorize a path", () => {
  const result = orchestrator.planCameraConnection(input, new Date("2027-03-01T00:00:00Z"));
  assert.equal(result.classification, "IDENTIFICATION_REQUIRED");
  assert.ok(result.limitations.includes("CAPABILITY_REVALIDATION_REQUIRED"));
});
test("public plan input cannot inject authorization, network destinations or security flags", () => {
  const request = { action: "plan", observer_site_id: siteId, family: "tapo-c211" };
  assert.equal(orchestrator.connectionPlanRequestSchema.safeParse(request).success, true);
  for (const key of ["persistentPaths", "vendorCloudAuthorized", "rtsp_url", "password", "tenant_id"]) {
    assert.equal(orchestrator.connectionPlanRequestSchema.safeParse({ ...request, [key]: "untrusted" }).success, false);
  }
});
test("sanitizer rejects secret and network keys and enforces site scope", () => {
  for (const key of ["password", "ip", "hostname", "cameraName", "siteName", "url", "token", "notes"]) {
    assert.throws(() => intelligence.sanitizeConnectivityObservation(sample({ [key]: "not-for-learning" }), siteId));
  }
  assert.throws(() => intelligence.sanitizeConnectivityObservation(sample(), randomUUID()), /SCOPE_DENIED/);
  assert.throws(() => intelligence.sanitizeConnectivityObservation(sample({ firmware: "private-host.local" }), siteId));
});
test("zero-install outcome requires matching server persistence proof", () => {
  const value = sample({ strategy: "VENDOR_CLOUD", installationRequired: false, zeroInstallVerified: true });
  assert.throws(() => intelligence.sanitizeConnectivityObservation(value, siteId), /PERSISTENCE_PROOF_REQUIRED/);
  assert.equal(intelligence.sanitizeConnectivityObservation(value, siteId, proof).zeroInstallVerified, true);
  assert.throws(() => intelligence.sanitizeConnectivityObservation(sample({ zeroInstallVerified: true }), siteId, proof));
});
test("one success and repeated delivery cannot promote global knowledge", () => {
  const value = sample();
  const [group] = intelligence.aggregateConnectivity([value, value], now);
  assert.equal(group.sampleCount, 1);
  assert.equal(group.maturity, "INSUFFICIENT_SAMPLES");
  assert.equal(group.autoApply, false);
  assert.equal(group.promotion, "HUMAN_VALIDATION_REQUIRED");
  assert.equal(JSON.stringify(group).includes(siteId), false);
  assert.equal(JSON.stringify(group).includes(value.attemptId), false);
});
test("version/model groups, failures and stability stay bounded; test and stale data excluded", () => {
  const values = [sample({ stability: { observedSeconds: 100, progressingSeconds: 80, reconnects: 2, authFailures: 0 } }),
    sample({ outcome: "FAILED", failure: "CREDENTIALS_INVALID" }), sample({ firmware: "2.0.1" }),
    sample({ provenance: "TEST" }), sample({ occurredAt: "2025-01-01T00:00:00Z" })];
  const groups = intelligence.aggregateConnectivity(values, now);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].sampleCount, 2);
  assert.equal(groups[0].successRate, 0.5);
  assert.equal(groups[0].failureRate, 0.5);
  assert.equal(groups[0].availability, 0.8);
  assert.equal(groups[0].failureCategories.CREDENTIALS_INVALID, 1);
});
test("recovery instructions have bounded retries and no raw provider output", () => {
  assert.equal(orchestrator.connectionRecovery("CREDENTIALS_INVALID").automaticRetries, 0);
  assert.equal(orchestrator.connectionRecovery("NETWORK_UNREACHABLE").automaticRetries, 2);
  for (const category of orchestrator.connectionFailureCategories) {
    assert.ok(orchestrator.connectionRecovery(category).message.length < 250);
  }
});

test("mobile metadata is permission-, time- and site-bound with no LAN upload", () => {
  const sessionId = randomUUID();
  const receipt = { version: mobile.mobileSetupVersion, sessionId, siteId, issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 60000).toISOString(), permission: "GRANTED",
    candidates: [{ reference: randomUUID(), family: "tapo-c211", protocols: ["ONVIF"], registryVersion: registry.connectivityRegistryVersion }] };
  const scope = { siteId, sessionId, nativeCapabilityAvailable: true };
  assert.equal(mobile.validateMobileSetupReceipt(receipt, scope, now.getTime()).persistentMonitoringVerified, false);
  assert.throws(() => mobile.validateMobileSetupReceipt(receipt, { ...scope, siteId: randomUUID() }, now.getTime()), /SCOPE_DENIED/);
  assert.throws(() => mobile.validateMobileSetupReceipt(receipt, { ...scope, nativeCapabilityAvailable: false }, now.getTime()), /NOT_AUTHORIZED/);
  assert.throws(() => mobile.validateMobileSetupReceipt({ ...receipt, permission: "DENIED" }, scope, now.getTime()), /NOT_AUTHORIZED/);
  assert.throws(() => mobile.validateMobileSetupReceipt(receipt, scope, now.getTime() + 120000), /EXPIRED/);
  assert.throws(() => mobile.validateMobileSetupReceipt({ ...receipt, candidates: [{ ...receipt.candidates[0], ip: "192.0.2.1" }] }, scope, now.getTime()));
  assert.equal(mobile.mobilePermissionPresentation(false, "UNKNOWN").supported, false);
});

test("activation lifecycle requires fresh scoped runtime proof and explicit confirmation", () => {
  const session = { version: lifecycle.connectionLifecycleVersion, id: randomUUID(), siteId, state: "TEST",
    configurationVersion: 1, registryVersion: registry.connectivityRegistryVersion, expiresAt: new Date(now.getTime() + 60000).toISOString() };
  const runtime = { siteId, configurationVersion: 1, authenticated: true, framesFresh: true,
    codecSupported: true, aiReady: true, observedAt: now.getTime(), revoked: false };
  const scope = { siteId, proof: runtime };
  assert.throws(() => lifecycle.advanceConnectionSession(session, "ACTIVE", scope, now.getTime()), /TRANSITION/);
  assert.throws(() => lifecycle.advanceConnectionSession(session, "CONFIRM", { ...scope, proof: { ...runtime, revoked: true } }, now.getTime()), /PROOF/);
  assert.throws(() => lifecycle.advanceConnectionSession(session, "CONFIRM", { ...scope, proof: { ...runtime, siteId: randomUUID() } }, now.getTime()), /PROOF/);
  assert.throws(() => lifecycle.advanceConnectionSession(session, "CONFIRM", { ...scope, proof: { ...runtime, observedAt: now.getTime() - 130000 } }, now.getTime()), /PROOF/);
  const confirmed = lifecycle.advanceConnectionSession(session, "CONFIRM", scope, now.getTime());
  assert.throws(() => lifecycle.advanceConnectionSession(confirmed, "ACTIVE", scope, now.getTime()), /CONFIRMATION/);
  const active = lifecycle.advanceConnectionSession(confirmed, "ACTIVE", { ...scope, userConfirmed: true }, now.getTime());
  assert.equal(active.state, "ACTIVE");
  assert.deepEqual(lifecycle.advanceConnectionSession(active, "ACTIVE", scope, now.getTime()), active);
});

test("missing effort measurements stay unknown rather than becoming zero friction", () => {
  const [group] = intelligence.aggregateConnectivity([sample({ interactions: null, manualFields: null, externalAppSteps: null, manualSupportRequired: null })], now);
  assert.equal(group.meanEffort, null);
  assert.equal(group.effortSamples, 0);
});

test("outcome persistence is sanitized and telemetry failure cannot break the caller", async () => {
  const writes = [];
  const service = loadTs("lib/domain/digital-observer/connection-outcome-service.ts", {
    "@/lib/security/audit-log-service": { writeAuditEvent: async value => { writes.push(value); } }
  });
  await service.recordConnectivityOutcome(sample(), { siteId, actorId: randomUUID() });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].eventType, "connectivity_outcome");
  const failedSink = loadTs("lib/domain/digital-observer/connection-outcome-service.ts", {
    "@/lib/security/audit-log-service": { writeAuditEvent: async () => { throw new Error("fixture sink unavailable"); } }
  });
  await assert.doesNotReject(() => failedSink.recordConnectivityOutcome(sample(), { siteId, actorId: randomUUID() }));
  await service.recordConnectivityOutcome(sample({ password: "fixture-forbidden" }), { siteId, actorId: randomUUID() });
  assert.equal(writes.length, 1);
});

test("product never auto-selects discovery and resolves installer availability server-side", () => {
  const ui = readFileSync("components/digital-observer/software-connector-onboarding.tsx", "utf8");
  assert.doesNotMatch(ui, /candidates\?\.\[0\]/);
  assert.match(ui, /selectedIds/);
  assert.match(ui, /username: "", password: ""/);
  const route = readFileSync("app/api/digital-observer/connection-assessment/route.ts", "utf8");
  assert.match(route, /installer_delivery: "PLATFORM_CHECK_REQUIRED"/);
  const release = readFileSync("lib/domain/digital-observer/connector-release.ts", "utf8");
  assert.match(release, /MACOS_DISTRIBUTION_NOT_CONFIGURED/);
  assert.match(release, /WINDOWS_DISTRIBUTION_NOT_CONFIGURED/);
  assert.ok(route.indexOf('if (!site)') < route.indexOf('await assessAuthorizedCameraSystem('));
  const assessment = readFileSync("lib/domain/digital-observer/connection-assessment-service.ts", "utf8");
  assert.ok(assessment.includes('.eq("observer_site_id", siteId)'));
  assert.ok(assessment.includes('.eq("status", "delivered")'));
  assert.match(route, /writeAuditEvent/);
});

test("plan API rejects wrong site and privilege injection before any enrollment read", async () => {
  let privilegedReads = 0;
  const route = loadTs("app/api/digital-observer/connection-assessment/route.ts", {
    "@/lib/api": { fail: (error, status) => Response.json({ error }, { status }), ok: data => Response.json({ data }),
      handleSafeRouteError: () => Response.json({ error: "INVALID_REQUEST" }, { status: 400 }) },
    "@/lib/domain/digital-observer/access": {
      getDigitalObserverApiUser: async () => ({ profile: { id: randomUUID(), role: "operator" }, user: { app_metadata: {} }, supabase: {} }),
      getObserverSiteAccess: async () => null
    },
    "@/lib/domain/digital-observer/admin-access": { hasObserverAdminClaim: () => false, createDigitalObserverAdminDataClient: () => { throw new Error("UNEXPECTED_ADMIN"); } },
    "@/lib/security/rate-limit": { assertRateLimit: async () => {} },
    "@/lib/security/request-guards": { assertTrustedMutationOrigin: () => {}, parseBoundedJson: request => request.json(), privateRateLimitIdentifier: () => "fixture-rate-key" },
    "@/lib/supabase/admin": { createAdminClient: () => { privilegedReads++; throw new Error("UNEXPECTED_PRIVILEGED_READ"); } },
    "@/lib/security/audit-log-service": { writeAuditEvent: async () => {} }
  });
  const request = body => new Request("https://example.invalid/api/digital-observer/connection-assessment", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
  const body = { action: "plan", observer_site_id: siteId, family: "tapo-c211" };
  assert.equal((await route.POST(request(body))).status, 403);
  assert.equal((await route.POST(request({ ...body, persistentPaths: [proof] }))).status, 400);
  assert.equal(privilegedReads, 0);
});
