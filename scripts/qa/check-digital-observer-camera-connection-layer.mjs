import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { loadTs } from "./digital-guard-test-loader.mjs";

const layer = loadTs("lib/domain/digital-observer/camera-connection-layer.ts");
const now = new Date();

const homeSource = {
  id: "e9f8abf3-5895-494e-b1cf-ea8818602851",
  observer_site_id: "cc1673b8-3eb0-4785-a12c-1fb88f425a41",
  camera_stream_id: "00000000-0000-4000-8000-000000000011",
  display_name: "Entrance corridor",
  connector_type: "dvr",
  connector_provider: "video_gateway",
  source_mode: "gateway_test",
  status: "connected",
  health_status: "healthy",
  stream_protocol: "rtsp_tcp",
  gateway_provider: "custom",
  capabilities: { preview: true, live_view: true, event_clips: true },
  last_health_check_at: now.toISOString(),
  last_seen_at: now.toISOString(),
  secret_reference: "video_gateway_connections:redacted",
  metadata: {
    gateway_id: "62df97e2-3c0b-427f-9108-bde029bc10e7",
    gateway_stream_id: "dvr_84e4cdf200faab18d9_11",
    dvr_channel: 11,
    credentials_server_side: true,
    private_network_only: true,
    legacy_system: true,
    gateway_outbound_only: true
  }
};

test("real home DVR maps through the canonical production adapter", () => {
  const assessment = layer.assessCameraConnection(layer.buildExistingSourceAssessmentInput(homeSource), now);
  assert.equal(assessment.recommendation, "PHYSICAL_GATEWAY_REQUIRED");
  assert.equal(assessment.preferredMethod, "PHYSICAL_GATEWAY");
  assert.equal(assessment.adapterType, "private_dvr_gateway");
  assert.equal(assessment.productionEligible, true);
  assert.ok(assessment.reasonCodes.includes("LEGACY_RECORDER_REQUIRES_LOCAL_BRIDGE"));
  assert.ok(assessment.reasonCodes.includes("OUTBOUND_AUTHENTICATED_GATEWAY_AVAILABLE"));
  assert.equal(assessment.transportProfile.relayMode, "LOCAL_GATEWAY");
  assert.equal(assessment.transportProfile.estimatedBandwidthMode, "METADATA_AND_EVENT_MEDIA");

  const source = layer.canonicalCameraSourceFromRow(homeSource);
  assert.equal(source.channel, 11);
  assert.equal(source.connectionMethod, "PHYSICAL_GATEWAY");
  assert.equal(source.health.state, "HEALTHY");
  assert.equal(source.stream.state, "STREAMING");
  assert.ok(source.capabilities.includes("LIVE_STREAM"));
  assert.ok(source.capabilities.includes("CHANNEL_DISCOVERY"));
});

test("adapter capability contract is bounded and status is honest", () => {
  const allowedCapabilities = new Set(layer.cameraConnectionCapabilities);
  for (const adapter of layer.cameraConnectionAdapters) {
    assert.ok(adapter.type);
    assert.match(adapter.version, /^\d+\.\d+\.\d+$/);
    for (const capability of adapter.capabilities) assert.ok(allowedCapabilities.has(capability));
  }
  assert.equal(layer.cameraConnectionAdapters.find((item) => item.type === "private_dvr_gateway").status, "PRODUCTION_VERIFIED");
  assert.equal(layer.cameraConnectionAdapters.find((item) => item.type === "onvif_gateway").status, "EXISTS_NEEDS_REAL_DEVICE_QA");
  assert.equal(layer.cameraConnectionAdapters.find((item) => item.type === "vendor_cloud_api").status, "FOUNDATION_READY");
});

test("resolver prefers an authorized vendor cloud path over available hardware", () => {
  const result = layer.assessCameraConnection({
    siteId: "site-a",
    connectorType: "cloud_provider",
    vendorCloudAvailable: true,
    vendorCloudAuthorized: true,
    vendorCloudTls: true,
    physicalGatewayAvailable: true,
    physicalGatewayEnrolled: true,
    physicalGatewayOutboundOnly: true,
    legacySystem: true
  }, now);
  assert.equal(result.recommendation, "DIRECT_CONNECTION_AVAILABLE");
  assert.equal(result.preferredMethod, "VENDOR_CLOUD_API");
});

test("resolver prefers a secure outbound direct path when available", () => {
  const result = layer.assessCameraConnection({
    siteId: "site-a",
    connectorType: "ip_camera",
    directSecureAvailable: true,
    directSecureReachable: true,
    directSecureTls: true,
    directSecureOutboundOnly: true,
    physicalGatewayAvailable: true,
    physicalGatewayEnrolled: true,
    physicalGatewayOutboundOnly: true,
    privateNetworkOnly: true
  }, now);
  assert.equal(result.preferredMethod, "DIRECT_SECURE");
});

test("LAN ONVIF and RTSP recommend software connector before physical hardware", () => {
  for (const protocol of ["onvif", "rtsp"]) {
    const result = layer.assessCameraConnection({
      siteId: "site-a",
      connectorType: protocol,
      onvifAvailable: protocol === "onvif",
      rtspAvailable: protocol === "rtsp",
      privateNetworkOnly: true,
      softwareConnectorAvailable: true,
      softwareConnectorInstalled: false,
      softwareConnectorOutboundOnly: true,
      physicalGatewayAvailable: true,
      physicalGatewayEnrolled: true,
      physicalGatewayOutboundOnly: true
    }, now);
    assert.equal(result.recommendation, "SOFTWARE_CONNECTOR_REQUIRED");
    assert.equal(result.preferredMethod, "SOFTWARE_CONNECTOR");
    assert.ok(result.missingRequirements.includes("INSTALL_AND_ENROLL_SOFTWARE_CONNECTOR"));
  }
});

test("physical Gateway cannot be selected without an explicit local, legacy or privacy reason", () => {
  const result = layer.assessCameraConnection({
    siteId: "site-a",
    connectorType: "ip_camera",
    physicalGatewayAvailable: true,
    physicalGatewayEnrolled: true,
    physicalGatewayOutboundOnly: true
  }, now);
  assert.notEqual(result.preferredMethod, "PHYSICAL_GATEWAY");
  assert.equal(result.recommendation, "UNSUPPORTED_SYSTEM");
});

test("insecure internet RTSP is rejected and no automatic downgrade is enabled", () => {
  const result = layer.assessCameraConnection({
    siteId: "site-a",
    connectorType: "rtsp",
    rtspAvailable: true,
    rtspReachable: true,
    rtspTls: false,
    rtspInternetExposed: true
  }, now);
  assert.equal(result.recommendation, "UNSUPPORTED_SYSTEM");
  assert.ok(result.securityNotes.includes("INTERNET_EXPOSED_PLAINTEXT_RTSP_REJECTED"));
  assert.equal(result.automaticFallbackEnabled, false);
  assert.ok(result.alternatives.every((item) => item.automaticFallbackAllowed === false));
});

test("direct ONVIF requires an explicitly secure transport", () => {
  const insecure = layer.assessCameraConnection({
    siteId: "site-a",
    connectorType: "onvif",
    onvifAvailable: true,
    onvifReachable: true,
    onvifTls: false
  }, now);
  const secure = layer.assessCameraConnection({
    siteId: "site-a",
    connectorType: "onvif",
    onvifAvailable: true,
    onvifReachable: true,
    onvifTls: true
  }, now);
  assert.notEqual(insecure.preferredMethod, "ONVIF");
  assert.equal(secure.preferredMethod, "ONVIF");
  assert.equal(secure.recommendation, "DIRECT_CONNECTION_AVAILABLE");
});

test("normalized connection health represents auth, no-frame, latency and reconnect failures", () => {
  assert.equal(layer.normalizeCameraConnectionHealth({ authFailed: true }).state, "AUTH_FAILED");
  assert.equal(layer.normalizeCameraConnectionHealth({ status: "connected", lastFrameAt: new Date(now.getTime() - 30_000).toISOString(), now }).state, "NO_FRAMES");
  assert.equal(layer.normalizeCameraConnectionHealth({ status: "connected", lastFrameAt: now.toISOString(), now, latencyMs: 6000 }).state, "HIGH_LATENCY");
  assert.equal(layer.normalizeCameraConnectionHealth({ status: "connected", lastFrameAt: now.toISOString(), now, reconnectCount: 5 }).state, "UNSTABLE");
  assert.equal(layer.normalizeCameraConnectionHealth({ status: "connected", lastFrameAt: now.toISOString(), now }).state, "HEALTHY");
});

test("client camera source view exposes only credential/reference presence", () => {
  const safe = layer.cameraSourceClientView(layer.canonicalCameraSourceFromRow(homeSource));
  const serialized = JSON.stringify(safe);
  assert.equal(safe.credential_reference_configured, true);
  assert.equal(safe.endpoint_reference_configured, true);
  assert.equal(serialized.includes("video_gateway_connections:redacted"), false);
  assert.equal(serialized.includes("dvr_84e4cdf200faab18d9_11"), false);
  assert.equal(serialized.includes("secret_reference"), false);
});

test("discovery deduplicates only stable device/channel identity and remains tenant scoped", () => {
  const first = layer.buildCameraDiscoveryIdentity({ tenantId: "tenant-a", siteId: "site-a", adapterType: "onvif_gateway", stableDeviceReference: "opaque-device-1", channel: 1 });
  const same = layer.buildCameraDiscoveryIdentity({ tenantId: "tenant-a", siteId: "site-a", adapterType: "onvif_gateway", stableDeviceReference: "opaque-device-1", channel: 1 });
  const otherTenant = layer.buildCameraDiscoveryIdentity({ tenantId: "tenant-b", siteId: "site-a", adapterType: "onvif_gateway", stableDeviceReference: "opaque-device-1", channel: 1 });
  const ambiguous = layer.buildCameraDiscoveryIdentity({ tenantId: "tenant-a", siteId: "site-a", adapterType: "rtsp_gateway", vendor: "generic", model: "camera" });
  assert.equal(first.autoMergeAllowed, true);
  assert.equal(first.identityKey, same.identityKey);
  assert.notEqual(first.identityKey, otherTenant.identityKey);
  assert.equal(ambiguous.autoMergeAllowed, false);
});

test("new recorder assessment does not assume physical hardware by default", () => {
  const input = layer.buildPairingConnectionAssessmentInput({ siteId: "site-a", connectorType: "nvr", pairingMethod: "recorder", pairingPayloadKind: "unknown" });
  const result = layer.assessCameraConnection(input, now);
  assert.equal(result.recommendation, "SOFTWARE_CONNECTOR_REQUIRED");
  assert.equal(result.preferredMethod, "SOFTWARE_CONNECTOR");
});

test("unsafe assessment payload fields and credentialed URLs are rejected", () => {
  assert.throws(() => layer.assertSafeCameraConnectionAssessmentPayload({ password: "not-allowed" }), /UNSAFE_CAMERA_ASSESSMENT_FIELD/);
  assert.throws(() => layer.assertSafeCameraConnectionAssessmentPayload({ note: "rtsp://fixture-user:fixture-value@example.invalid/stream" }), /UNSAFE_CAMERA_ASSESSMENT_VALUE/);
  assert.doesNotThrow(() => layer.assertSafeCameraConnectionAssessmentPayload({ credential_reference_configured: true, private_network_only: true }));
});

test("assessment route enforces site authorization and source scope", () => {
  const route = readFileSync("app/api/digital-observer/connection-assessment/route.ts", "utf8");
  assert.match(route, /requiresManageAccess = payload\.action === "assess_new" \|\| payload\.persist/);
  assert.match(route, /requiresManageAccess \? \{ manage: true \} : \{\}/);
  assert.match(route, /\.eq\("observer_site_id", payload\.observer_site_id\)/);
  assert.doesNotMatch(route, /password|rtsp_url|source_url/);
});

test("Observer event, Incident, Risk, Verification and Investigation remain vendor agnostic", () => {
  const downstream = [
    "lib/domain/digital-observer/incident-correlation.ts",
    "lib/domain/digital-observer/risk-decision-engine.ts",
    "lib/domain/digital-observer/incident-verification-engine.ts",
    "lib/domain/digital-observer/investigation-query.ts",
    "lib/domain/digital-observer/watch-rule-compiler.ts"
  ].map((file) => readFileSync(file, "utf8")).join("\n");
  assert.doesNotMatch(downstream, /private_dvr|manufacturer_api|dvr_channel|hikvision|dahua/i);
});
