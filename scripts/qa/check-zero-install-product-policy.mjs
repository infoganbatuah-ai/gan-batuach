import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./digital-guard-test-loader.mjs";
const { planCameraConnection, connectionPlanRequestSchema } = loadTs("lib/domain/digital-observer/connection-orchestrator.ts");
const base = { family: "tapo-c211", connectorOnline: false, nativeDiscoveryAvailable: false, persistentPaths: [], computerAvailable: "UNKNOWN" };
const proof = { strategy: "DIRECT_SECURE", implemented: true, authorized: true, secureTransport: true, recoverable: true,
  survivesSetupDeviceDeparture: true, requiresCustomerService: false, requiresInboundExposure: false, privacyAllowed: true, measuredStability: null };
test("phone-only customer with persistent path is never asked for a computer", () => {
  for (const computerAvailable of ["NO", "UNKNOWN", "YES"]) {
    const plan = planCameraConnection({ ...base, computerAvailable, persistentPaths: [proof] });
    assert.equal(plan.nextAction, "CONNECT"); assert.equal(plan.requirementBasis, "NONE");
    assert.equal(plan.technicalCapability, "PERSISTENT_PATH_VERIFIED");
  }
});
test("local coverage never becomes globally proven technical necessity", () => {
  const plan = planCameraConnection(base);
  assert.equal(plan.technicalCapability, "LOCAL_CAPABILITY_ONLY");
  assert.equal(plan.productCoverage, "LOCAL_ADAPTER_AVAILABLE");
  assert.equal(plan.observedSuccess, "NOT_VERIFIED_FOR_THIS_SYSTEM");
  assert.equal(plan.requirementBasis, "CURRENT_SUPPORTED_PATH");
});
test("documented remote integration gap blocks misleading computer/hardware recommendation", () => {
  const plan = planCameraConnection({ ...base, family: "nest-wired", computerAvailable: "NO", connectorOnline: true });
  assert.equal(plan.productCoverage, "REMOTE_INTEGRATION_MISSING");
  assert.equal(plan.preferredStrategy, null); assert.equal(plan.hardwareReason, null);
});
test("no-computer flow proposes local appliance only for current local coverage, not unknown systems", () => {
  assert.equal(planCameraConnection({ ...base, computerAvailable: "NO" }).requirementBasis, "NO_SUITABLE_HOST");
  assert.equal(planCameraConnection({ ...base, family: "unknown", computerAvailable: "NO" }).preferredStrategy, null);
});
test("mobile discovery cannot manufacture persistence and may remain unavailable", () => {
  const plan = planCameraConnection({ ...base, nativeDiscoveryAvailable: true, persistentPaths: [{ ...proof, strategy: "MOBILE_PROVISIONED", survivesSetupDeviceDeparture: false }] });
  assert.equal(plan.zeroInstall, false); assert.equal(plan.mobile.temporaryOnly, true);
});
test("installation and new source configuration re-evaluate canonical server assessment", () => {
  const install = readFileSync("app/api/digital-observer/connector-installation/route.ts", "utf8");
  assert.ok(install.indexOf("await assessAuthorizedCameraSystem") < install.indexOf('admin.from("observer_connector_install_intents").insert'));
  assert.ok(install.includes('plan.nextAction !== "INSTALL_CONNECTOR"'));
  const configure = readFileSync("app/api/digital-observer/software-connector/route.ts", "utf8");
  assert.ok(configure.includes('plan.preferredStrategy !== "SOFTWARE_CONNECTOR"'));
  assert.ok(configure.includes('connection_product_coverage: plan.productCoverage'));
});
test("legacy technical camera creation is not a normal customer bypass", () => {
  const route = readFileSync("app/api/digital-observer/cameras/route.ts", "utf8");
  assert.ok(route.includes('payload.connector_type !== "demo" && profile.role !== "admin"'));
  assert.ok(route.indexOf('profile.role !== "admin"') < route.indexOf('.insert({'));
  const enroll = readFileSync("app/api/digital-observer/gateway-enrollment/route.ts", "utf8");
  assert.ok(enroll.includes('!pending.data.metadata?.install_intent_id && session.profile.role !== "admin"'));
});
test("reported effort is bounded, never network data or authorization", () => {
  const request = { action: "plan", observer_site_id: "00000000-0000-4000-8000-000000000001", family: "unknown",
    effort: { product_actions: 2, technical_actions: 0, elapsed_ms: 500 } };
  assert.equal(connectionPlanRequestSchema.safeParse(request).success, true);
  assert.equal(connectionPlanRequestSchema.safeParse({ ...request, effort: { ...request.effort, password: "no" } }).success, false);
  assert.equal(connectionPlanRequestSchema.safeParse({ ...request, effort: { ...request.effort, product_actions: -1 } }).success, false);
});
