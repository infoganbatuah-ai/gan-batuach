import { HOME_LEGACY_MATCH_BINDINGS } from "./home-legacy-match-service.mjs";

const PRODUCTION_HOSTS = new Set(["gan-batuach.vercel.app", "ganbatuach.com"]);

function isProductionUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && PRODUCTION_HOSTS.has(url.hostname) &&
      !url.username && !url.password && !url.port &&
      (url.pathname === "/" || url.pathname === "") && !url.search && !url.hash;
  } catch { return false; }
}

// The existing macOS Keychain namespace is selected by a trusted operator at
// deployment time. No Keychain read occurs when this factory is constructed.
// Synthetic tests inject in-memory stores with the same read-only contract.
export function createHomeLegacyKeychainCredentialSource({ gatewayStore, connectorStore }) {
  if (!gatewayStore || !connectorStore ||
    [gatewayStore, connectorStore].some(store => typeof store.read !== "function" ||
      store.kind !== "macos_keychain")) throw new TypeError("KEYCHAIN_SOURCE_REQUIRED");

  return async ({ deviceId, deploymentProfile }) => {
    const binding = HOME_LEGACY_MATCH_BINDINGS[deviceId];
    if (!binding || binding.deploymentProfile !== deploymentProfile) return "";
    const store = deploymentProfile === "PHYSICAL_GATEWAY" ? gatewayStore : connectorStore;
    // Fail before credential read if the selected namespace is QA, managed
    // Ed25519, another device, another Site, or another endpoint.
    if (await store.read("device_gateway_id") !== binding.deviceId ||
      await store.read("device_observer_site_id") !== binding.siteId ||
      !isProductionUrl(await store.read("device_cloud_base_url")) ||
      await store.read("device_credential_version") ||
      await store.read("device_public_key_spki")) return "";
    const credential = await store.read("device_refresh_token");
    return typeof credential === "string" && credential.length >= 32 &&
      credential.length <= 512 ? credential : "";
  };
}
