import { mkdirSync } from "node:fs";
import { resolveSoftwareConnectorStartupConfiguration, softwareConnectorSecretStore } from "../services/video-gateway/software-connector-cloud.mjs";
import { resolveEdgeRuntimePaths } from "../services/video-gateway/runtime-paths.mjs";

process.env.OBSERVER_EDGE_DEVICE_TYPE = "SOFTWARE_CONNECTOR";
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
// A verified local profile is sufficient to start the camera-side process.
// Cloud refresh must never sit in front of local liveness: the managed runtime
// can authenticate and reconcile after launch, while a cloud/network stall
// must not prevent /health or the signed OTA health gate from coming up.
const { configured } = await resolveSoftwareConnectorStartupConfiguration({ store });
process.env.GAN_BATUACH_GATEWAY_DISCOVERY = configured ? "1" : "0";
process.env.OBSERVER_EDGE_STREAM_NAMESPACE ||= store.read("connector_stream_namespace") || "software_connector";

await import("./run-persistent-home-gateway.mjs");
