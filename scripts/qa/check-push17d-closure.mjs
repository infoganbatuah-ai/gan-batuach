import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { loadTs } from "./digital-guard-test-loader.mjs";

const source = path => readFileSync(path, "utf8");
const orchestrator = loadTs("lib/domain/digital-observer/connection-orchestrator.ts");
const local = { family: "tapo-c211", connectorOnline: false, nativeDiscoveryAvailable: false, persistentPaths: [], computerAvailable: "UNKNOWN" };
const remoteProof = { strategy: "ACCOUNT_LINK", implemented: true, authorized: true, secureTransport: true, recoverable: true,
  survivesSetupDeviceDeparture: true, requiresCustomerService: false, requiresInboundExposure: false, privacyAllowed: true, measuredStability: 0.8 };

test("all normal Product camera creation enters the universal orchestrator", () => {
  const page = source("app/digital-observer/cameras/add/page.tsx");
  const wizard = source("components/digital-observer/universal-camera-onboarding.tsx");
  const legacy = source("app/api/digital-observer/camera-onboarding/route.ts");
  const cameraCreate = source("app/api/digital-observer/cameras/route.ts");
  const directConnector = source("app/digital-observer/cameras/connector/page.tsx");
  assert.match(page, /<UniversalCameraOnboarding/);
  assert.match(page, /advanced === "1" && profile\.role === "admin"/);
  assert.match(wizard, /\/api\/digital-observer\/connection-assessment/);
  assert.match(legacy, /payload\.action !== "get" && !observerAdmin/);
  assert.match(cameraCreate, /payload\.connector_type !== "demo" && profile\.role !== "admin"/);
  assert.match(directConnector, /profile\.role !== "admin"\) redirect\(`\/digital-observer\/cameras\/add/);
});

test("zero-install and Gateway-last policies execute, not merely document", () => {
  assert.equal(orchestrator.planCameraConnection({ ...local, persistentPaths: [remoteProof] }).preferredStrategy, "ACCOUNT_LINK");
  assert.equal(orchestrator.planCameraConnection({ ...local, computerAvailable: "YES" }).preferredStrategy, "SOFTWARE_CONNECTOR");
  const noComputer = orchestrator.planCameraConnection({ ...local, computerAvailable: "NO" });
  assert.equal(noComputer.preferredStrategy, "PHYSICAL_GATEWAY");
  assert.equal(noComputer.requirementBasis, "NO_SUITABLE_HOST");
  assert.equal(orchestrator.planCameraConnection({ ...local, family: "nest-wired", computerAvailable: "NO" }).preferredStrategy, null);
});

test("macOS builder emits a sealed graphical DMG with bundled dependencies", () => {
  const build = source("scripts/build-connector-macos.mjs"), host = source("services/connector-desktop/macos/DesktopHost.swift");
  for (const expected of ["Digital Observer Connector.dmg", "hdiutil", "codesign", "onnxruntime-node", "ffmpeg", "THIRD_PARTY_NOTICES"])
    assert.match(build, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.ok(build.indexOf("InferenceSession.create") < build.lastIndexOf("codesign"));
  for (const expected of ["RunAtLoad", "KeepAlive", "ensureInstalledAndRunning", "openFile", "--service", "--document"])
    assert.match(host, new RegExp(expected));
  assert.doesNotMatch(host, /\/bin\/sh|Terminal\.app/);
});

test("Windows package is graphical, self-contained and auto-starting", () => {
  const build = source("scripts/build-connector-windows.mjs"), host = source("services/connector-desktop/windows/Program.cs");
  for (const expected of ["Digital Observer Connector.msi", "dotnet", "wix", "ServiceInstall", "Start=\\\"auto\\\"", "onnxruntime-node", "ffmpeg"])
    assert.match(build, new RegExp(expected));
  for (const expected of ["ServiceBase.Run", "NamedPipeServerStream", "ProtectedData.Protect", "DataProtectionScope.LocalMachine", "--document", "--service"])
    assert.match(host, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(host, /powershell|cmd\.exe/i);
});

test("automatic enrollment and same-session dashboard continuation are wired", () => {
  const handoff = source("components/digital-observer/connector-install-handoff.tsx");
  const route = source("app/api/digital-observer/connector-installation/route.ts");
  const native = source("services/video-gateway/desktop-enrollment.mjs");
  const product = source("components/digital-observer/software-connector-onboarding.tsx");
  assert.match(route, /10 \* 60000/); assert.match(route, /claim_observer_connector_install_intent/);
  assert.match(route, /actor_profile_id/); assert.match(native, /desktop_enrollment_pending/);
  assert.match(handoff, /setInterval/); assert.match(handoff, /CONNECTOR_FOUND/); assert.match(handoff, /onOnline\(intent\)/);
  assert.match(product, /install_intent_id/); assert.match(product, /configure_batch/); assert.match(product, /activate_batch/);
  const csp = source("vercel.json");
  assert.match(csp, /127\.0\.0\.1:18084/);
});

test("discovery retries and multi-camera results use one shared runtime", () => {
  const service = source("scripts/connector-desktop-service.mjs"), cloud = source("services/video-gateway/software-connector-cloud.mjs");
  const runner = source("scripts/run-persistent-home-gateway.mjs"), ui = source("components/digital-observer/software-connector-onboarding.tsx");
  assert.match(service, /nextDiscoveryAt/); assert.match(service, /CAMERA_DISCOVERY_RETRY/);
  assert.match(service, /latest\.configVersion > synced\.configVersion/); assert.match(service, /APPLYING_CAMERA_CONFIGURATION/);
  assert.match(cloud, /connector_profiles_json/); assert.doesNotMatch(cloud, /MULTI_CAMERA_RUNTIME_PENDING/);
  assert.match(runner, /for \(const profile of configurations\)/); assert.match(ui, /בחר הכול/); assert.match(ui, /selectedIds/);
});

test("mobile contract is temporary, scoped and continues into the same planner", () => {
  const route = source("app/api/digital-observer/mobile-camera-setup/route.ts"), contract = source("lib/domain/digital-observer/mobile-camera-setup.ts");
  const ui = source("components/digital-observer/universal-camera-onboarding.tsx"), handoff = source("components/digital-observer/connector-install-handoff.tsx");
  assert.match(route, /validateMobileSetupReceipt/); assert.match(route, /assessAuthorizedCameraSystem/);
  assert.match(route, /persistent_monitoring_verified: false/); assert.match(contract, /MOBILE_SETUP_SCOPE_DENIED/);
  assert.match(ui, /DigitalObserverCameraDiscovery/); assert.match(handoff, /detectedPlatform === "MOBILE"/);
  assert.match(handoff, /שליחה ל‑Mac/); assert.match(handoff, /שליחה ל‑Windows/);
});

test("commercial learning is written by authenticated real activation without private data", () => {
  const route = source("app/api/digital-observer/software-connector/route.ts"), intelligence = source("lib/domain/digital-observer/connection-intelligence.ts");
  assert.match(route, /recordConnectivityOutcome/); assert.match(route, /productActions/); assert.match(route, /technicalActions/);
  assert.match(route, /installerActions/); assert.match(route, /elapsed_ms/); assert.match(route, /support_required/);
  assert.match(intelligence, /connectivityObservationSchema = z\.object/); assert.match(intelligence, /\}\)\.strict\(\)\.superRefine/);
  assert.match(intelligence, /No attempt\/site\/user\/network identifiers survive/);
});
