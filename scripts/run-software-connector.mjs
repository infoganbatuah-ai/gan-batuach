import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveSoftwareConnectorStartupConfiguration, softwareConnectorSecretStore } from "../services/video-gateway/software-connector-cloud.mjs";
import { resolveHomeTelemetryProfile } from "../services/video-gateway/home-telemetry-profile.mjs";
import { preferPackagedObjectModel, resolveEdgeRuntimePaths } from "../services/video-gateway/runtime-paths.mjs";

process.env.OBSERVER_EDGE_DEVICE_TYPE = "SOFTWARE_CONNECTOR";
// OTA Connector bundles keep immutable model bytes inside the signed app while
// mutable camera state stays in the legacy-compatible data directory. Prefer
// the bundled model when present, but preserve an explicit managed override.
preferPackagedObjectModel(fileURLToPath(new URL("../../models", import.meta.url)));
const paths = resolveEdgeRuntimePaths();
const dataRoot = paths.dataDir;
const keychainService = process.env.OBSERVER_CONNECTOR_KEYCHAIN_SERVICE || "";
const secretDir = keychainService ? "" : paths.secretDir;
mkdirSync(dataRoot, { recursive: true, mode: 0o700 });
if (secretDir) mkdirSync(secretDir, { recursive: true, mode: 0o700 });

process.env.OBSERVER_EDGE_DATA_DIR = dataRoot;
process.env.GAN_BATUACH_GATEWAY_SECRET_DIR = secretDir;
if (keychainService) {
  process.env.GAN_BATUACH_GATEWAY_KEYCHAIN_SERVICE = keychainService;
  process.env.GAN_BATUACH_GATEWAY_DVR_KEYCHAIN_SERVICE = keychainService;
}
process.env.GAN_BATUACH_GATEWAY_DVR_SECRET_DIR ||= secretDir;
process.env.VIDEO_GATEWAY_PORT ||= "18083";
process.env.GAN_BATUACH_JOURNAL_OWNER_LOCK_PATH ||= `${dataRoot}/journal-owner.lock`;
const store = softwareConnectorSecretStore();
const homeQaIdentityDir = join(homedir(), "Library/Application Support/Digital Observer/observer-connector/ota/home-qa-device-secrets");
const telemetryProfile = resolveHomeTelemetryProfile({ deviceType: "SOFTWARE_CONNECTOR", legacyStore: store,
  homeQaIdentityDir, configuredIdentityDir: process.env.OBSERVER_EDGE_DEVICE_IDENTITY_SECRET_DIR || "",
  profile: process.env.OBSERVER_EDGE_TELEMETRY_PROFILE || "",
  authorizationFile: process.env.OBSERVER_EDGE_PRODUCTION_AUTHORIZATION_FILE || "",
  connectorCloudUrl: process.env.OBSERVER_CONNECTOR_CLOUD_URL || "" });
if (telemetryProfile.profile !== "LEGACY_EXISTING") process.env.OBSERVER_CONNECTOR_CLOUD_URL = telemetryProfile.cloudUrl;
// A verified local profile is sufficient to start the camera-side process.
// Cloud refresh must never sit in front of local liveness: the managed runtime
// can authenticate and reconcile after launch, while a cloud/network stall
// must not prevent /health or the signed OTA health gate from coming up.
const { configured } = await resolveSoftwareConnectorStartupConfiguration({ store });
process.env.GAN_BATUACH_GATEWAY_DISCOVERY = configured ? "1" : "0";
process.env.OBSERVER_EDGE_STREAM_NAMESPACE ||= store.read("connector_stream_namespace") || "software_connector";

await import("./run-persistent-home-gateway.mjs");
