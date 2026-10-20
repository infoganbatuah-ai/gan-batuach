import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";
import { createEdgeSecretStoreSync } from "./edge-secret-store-sync.mjs";

const QA_URL = "https://127.0.0.1:3101";
const PRODUCTION_HOSTS = new Set(["gan-batuach.vercel.app", "ganbatuach.com"]);

function fail(code) { throw Object.assign(new Error(code), { code }); }

function ownerOnly(path, kind) {
  if (!isAbsolute(path)) fail("TELEMETRY_PROFILE_PATH_INVALID");
  const info = lstatSync(path);
  if (info.isSymbolicLink() || info.uid !== process.getuid() || (info.mode & 0o077) !== 0 ||
    (kind === "directory" ? !info.isDirectory() : !info.isFile())) fail("TELEMETRY_PROFILE_PERMISSIONS_INVALID");
  return info;
}

export function resolveHomeTelemetryProfile({ deviceType, legacyStore, homeQaIdentityDir,
  configuredIdentityDir = "", profile = "", authorizationFile = "", connectorCloudUrl = "", now = Date.now() }) {
  if (!["PHYSICAL_GATEWAY", "SOFTWARE_CONNECTOR"].includes(deviceType)) fail("TELEMETRY_DEVICE_TYPE_INVALID");
  if (!legacyStore || typeof legacyStore.read !== "function") fail("TELEMETRY_LEGACY_STORE_MISSING");
  // An OTA-managed home Edge must never fall through to its old Production
  // Keychain merely because the QA identity directory is temporarily absent.
  const selected = profile || (existsSync(dirname(homeQaIdentityDir)) ? "QA" : "LEGACY_EXISTING");
  if (!new Set(["QA", "PRODUCTION", "LEGACY_EXISTING"]).has(selected) ||
    (selected === "LEGACY_EXISTING" && profile)) fail("TELEMETRY_PROFILE_INVALID");

  if (selected === "QA") {
    const actual = realpathSync(configuredIdentityDir || homeQaIdentityDir);
    if (actual !== realpathSync(homeQaIdentityDir)) fail("TELEMETRY_QA_IDENTITY_MISMATCH");
    ownerOnly(actual, "directory");
    const store = createEdgeSecretStoreSync({ secretDir: actual });
    if (store.read("device_credential_version") !== "1" || !store.read("device_private_key_pkcs8") ||
      store.read("device_cloud_base_url") !== QA_URL) fail("TELEMETRY_QA_IDENTITY_INVALID");
    if (connectorCloudUrl && connectorCloudUrl !== QA_URL) fail("TELEMETRY_CONNECTOR_DESTINATION_MISMATCH");
    return { profile: "QA", identityDir: actual, cloudUrl: QA_URL };
  }

  if (selected === "LEGACY_EXISTING") {
    if (configuredIdentityDir || authorizationFile) fail("TELEMETRY_LEGACY_PROFILE_CONFLICT");
    return { profile: selected, identityDir: "", cloudUrl: legacyStore.read("device_cloud_base_url") || "" };
  }

  // A Production selection is deliberately impossible with the QA identity,
  // an implicit fallback, a stale approval, or an unverified legacy token.
  if (configuredIdentityDir || !existsSync(homeQaIdentityDir) || !authorizationFile) fail("TELEMETRY_PRODUCTION_GATE_MISSING");
  ownerOnly(homeQaIdentityDir, "directory");
  ownerOnly(dirname(authorizationFile), "directory");
  const info = ownerOnly(authorizationFile, "file");
  if (info.size < 2 || info.size > 4096) fail("TELEMETRY_PRODUCTION_AUTHORIZATION_INVALID");
  const approval = JSON.parse(readFileSync(authorizationFile, "utf8"));
  const gatewayId = legacyStore.read("device_gateway_id");
  const siteId = legacyStore.read("device_observer_site_id");
  const cloudUrl = legacyStore.read("device_cloud_base_url").replace(/\/$/, "");
  const url = new URL(cloudUrl);
  const issued = Date.parse(approval.approved_at);
  const expires = Date.parse(approval.expires_at);
  if (approval.contract !== "observer-home-production-telemetry-authorization-v1" ||
    approval.device_type !== deviceType || approval.gateway_id !== gatewayId ||
    approval.observer_site_id !== siteId || approval.production_cloud_url !== cloudUrl ||
    !approval.approval_reference || approval.legacy_auth_proof !== "VERIFIED" ||
    approval.backup_proof !== "VERIFIED" || approval.rollback_proof !== "VERIFIED" ||
    !gatewayId || !siteId || !legacyStore.read("device_refresh_token") ||
    legacyStore.read("device_private_key_pkcs8") ||
    url.protocol !== "https:" || url.username || url.password || url.port ||
    url.pathname !== "/" || url.search || url.hash || !PRODUCTION_HOSTS.has(url.hostname) ||
    !Number.isFinite(issued) || !Number.isFinite(expires) || issued > now ||
    expires <= now || expires - issued > 30 * 60_000 ||
    (connectorCloudUrl && connectorCloudUrl !== cloudUrl)) fail("TELEMETRY_PRODUCTION_AUTHORIZATION_INVALID");
  return { profile: "PRODUCTION", identityDir: "", cloudUrl };
}
