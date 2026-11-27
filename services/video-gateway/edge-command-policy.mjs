// A release may explicitly separate media/reporting from camera command authority.
// Invalid configuration fails closed; existing installations retain their default.
export function cloudCameraCommandsEnabled(env = process.env) {
  const mode = env.OBSERVER_EDGE_OPERATION_MODE || 'STANDARD';
  if (mode === 'MEDIA_ONLY') return false;
  if (mode === 'STANDARD') return true;
  throw new Error('EDGE_OPERATION_MODE_INVALID');
}

export const productOrigin = "https://ganbatuach.com";
export const productIdPattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const productOrigins = [productOrigin, "https://www.ganbatuach.com", "https://gan-batuach.vercel.app"];

// Select only the original Product enrollment. The managed profile uses a
// separate local store so that rolling back the app cannot replace its key.
export function productIdentityProfile({ env = process.env, readOriginal }) {
  const profile = env.OBSERVER_EDGE_IDENTITY_PROFILE || "INSTALLED";
  if (profile === "INSTALLED") return profile;
  if (profile !== "PRODUCT_LEGACY" && profile !== "PRODUCT_MANAGED")
    throw new Error("EDGE_IDENTITY_PROFILE_INVALID");
  if (cloudCameraCommandsEnabled(env) || env.OBSERVER_EDGE_DEVICE_IDENTITY_SECRET_DIR)
    throw new Error("PRODUCT_IDENTITY_REQUIRES_MEDIA_ONLY");
  const gateway = env.OBSERVER_EDGE_EXPECTED_GATEWAY_ID;
  const site = env.OBSERVER_EDGE_EXPECTED_SITE_ID;
  if (!productIdPattern.test(gateway || "") || !productIdPattern.test(site || ""))
    throw new Error("PRODUCT_IDENTITY_BINDING_REQUIRED");
  if (readOriginal("device_gateway_id") !== gateway || readOriginal("device_observer_site_id") !== site)
    throw new Error("PRODUCT_IDENTITY_BINDING_MISMATCH");
  const expected = env.OBSERVER_EDGE_EXPECTED_PRODUCT_ORIGIN;
  const originalOrigin = readOriginal("device_cloud_base_url");
  if (!productOrigins.includes(originalOrigin) ||
    (profile === "PRODUCT_LEGACY" ? expected !== originalOrigin : expected !== productOrigin))
    throw new Error("PRODUCT_IDENTITY_ORIGIN_MISMATCH");
  if (profile === "PRODUCT_LEGACY" &&
    (readOriginal("device_private_key_pkcs8") || !readOriginal("device_refresh_token")))
    throw new Error("PRODUCT_LEGACY_CREDENTIAL_UNAVAILABLE");
  return profile;
}
