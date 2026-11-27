import { createPrivateKey, createPublicKey } from "node:crypto";
import { lstatSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { productIdPattern, productOrigin } from "./edge-command-policy.mjs";
import { createEdgeSecretStoreSync } from "./edge-secret-store-sync.mjs";

export const productDeviceStoreName = "product-device-secrets";

export function openProductDeviceIdentity(installedIdentityRoot) {
  // The installation root can be linked to an external volume. The Product
  // directory itself must be a private, direct child of the resolved root.
  const directory = join(realpathSync(installedIdentityRoot), productDeviceStoreName);
  const info = lstatSync(directory);
  if (!info.isDirectory() || info.isSymbolicLink() || info.uid !== process.getuid() ||
    (info.mode & 0o777) !== 0o700 || realpathSync(directory) !== directory) {
    throw new Error("PRODUCT_DEVICE_STORE_UNSAFE");
  }
  return { directory, store: createEdgeSecretStoreSync({ secretDir: directory }) };
}

export function productPublicKey(privateKeyPkcs8) {
  const value = Buffer.from(privateKeyPkcs8, "base64url");
  if (value.toString("base64url") !== privateKeyPkcs8) throw new Error("PRODUCT_DEVICE_KEY_INVALID");
  const key = createPrivateKey({ key: value, format: "der", type: "pkcs8" });
  if (key.asymmetricKeyType !== "ed25519") throw new Error("PRODUCT_DEVICE_KEY_INVALID");
  return createPublicKey(key).export({ format: "der", type: "spki" }).toString("base64url");
}

export function verifyProductDeviceIdentity(store, { gatewayId, siteId }) {
  if (!productIdPattern.test(gatewayId || "") || !productIdPattern.test(siteId || "") ||
    store.read("device_gateway_id") !== gatewayId || store.read("device_observer_site_id") !== siteId ||
    store.read("device_cloud_base_url") !== productOrigin) {
    throw new Error("PRODUCT_DEVICE_STORE_BINDING_MISMATCH");
  }
  const version = Number(store.read("device_credential_version"));
  if (!Number.isSafeInteger(version) || version < 1 || store.read("device_refresh_token") ||
    store.read("device_refresh_pending") ||
    productPublicKey(store.read("device_private_key_pkcs8")) !== store.read("device_public_key_spki")) {
    throw new Error("PRODUCT_DEVICE_CREDENTIAL_UNAVAILABLE");
  }
}
