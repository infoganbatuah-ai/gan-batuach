import { randomBytes, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { createEdgeSecretStoreSync } from "./edge-secret-store-sync.mjs";
import { createManagedDeviceProofHeaders } from "./managed-device-auth.mjs";

const runtimeInstanceId = `connector:${randomUUID()}`;
let deviceSequence = 0;

function cloudUrl(store) {
  const value = String(process.env.OBSERVER_CONNECTOR_CLOUD_URL || store.read("device_cloud_base_url") || "https://ganbatuach.com").replace(/\/$/, "");
  if (!value.startsWith("https://") && !(process.env.NODE_ENV === "development" && value.startsWith("http://127.0.0.1"))) throw new Error("CONNECTOR_CLOUD_URL_INVALID");
  return value;
}

export function softwareConnectorSecretStore() {
  if (process.env.OBSERVER_CONNECTOR_KEYCHAIN_SERVICE) return createEdgeSecretStoreSync({ keychainService: process.env.OBSERVER_CONNECTOR_KEYCHAIN_SERVICE });
  const dataRoot = resolve(process.env.OBSERVER_CONNECTOR_DATA_DIR || ".observer-connector");
  const secretDir = resolve(process.env.OBSERVER_CONNECTOR_SECRET_DIR || `${dataRoot}/secrets`);
  return createEdgeSecretStoreSync({ secretDir });
}

export async function softwareConnectorDeviceSession(store = softwareConnectorSecretStore()) {
  const gatewayId = store.read("device_gateway_id");
  const observerSiteId = store.read("device_observer_site_id");
  const privateKeyPkcs8 = store.read("device_private_key_pkcs8");
  const credentialVersion = Number(store.read("device_credential_version") || 0);
  if (privateKeyPkcs8 && credentialVersion > 0) {
    const body = JSON.stringify({ action: "authenticate", gateway_id: gatewayId });
    const path = "/api/digital-observer/gateway-enrollment";
    const response = await fetch(`${cloudUrl(store)}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...createManagedDeviceProofHeaders({ method: "POST", pathname: path,
        body, deviceId: gatewayId, credentialVersion, privateKeyPkcs8, runtimeInstanceId, sequence: ++deviceSequence }) },
      body,
      redirect: "error",
      signal: AbortSignal.timeout(15_000)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.data?.authentication_protocol !== "ED25519_V1" || !result.data?.access_token) {
      throw new Error(`CONNECTOR_DEVICE_AUTH_FAILED_${response.status}`);
    }
    return { gatewayId, observerSiteId, accessToken: result.data.access_token, baseUrl: cloudUrl(store), authMode: "ED25519_V1" };
  }
  const refreshToken = store.read("device_refresh_token");
  if (!gatewayId || !observerSiteId || !refreshToken) throw new Error("CONNECTOR_DEVICE_IDENTITY_REQUIRED");
  const nextRefreshToken = randomBytes(48).toString("base64url");
  const response = await fetch(`${cloudUrl(store)}/api/digital-observer/gateway-enrollment`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "refresh", gateway_id: gatewayId, refresh_token: refreshToken, next_refresh_token: nextRefreshToken }),
    redirect: "error",
    signal: AbortSignal.timeout(15_000)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.data?.access_token) throw new Error(`CONNECTOR_DEVICE_REFRESH_FAILED_${response.status}`);
  store.write("device_refresh_token", body.data.refresh_token || nextRefreshToken);
  return { gatewayId, observerSiteId, accessToken: body.data.access_token, baseUrl: cloudUrl(store), authMode: "LEGACY_HMAC" };
}

export async function connectorCloudRequest(path, init = {}, store = softwareConnectorSecretStore()) {
  const session = await softwareConnectorDeviceSession(store);
  const response = await fetch(`${session.baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      "x-video-gateway-device-token": session.accessToken,
      "x-video-gateway-id": session.gatewayId,
      ...(init.headers || {})
    },
    redirect: "error",
    signal: AbortSignal.timeout(20_000)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`CONNECTOR_CLOUD_REQUEST_FAILED_${response.status}`);
  return { data: body.data, session };
}

export async function syncSoftwareConnectorConfiguration(store = softwareConnectorSecretStore()) {
  const result = await connectorCloudRequest("/api/digital-observer/software-connector", { method: "GET" }, store);
  const cameras = Array.isArray(result.data?.cameras) ? result.data.cameras : [];
  if (!cameras.length) return { configured: false, cameraCount: 0 };
  if (cameras.length > 32) throw new Error("CONNECTOR_CAMERA_LIMIT_EXCEEDED");
  const profiles = cameras.map((camera, index) => {
    if (!camera?.endpoint || !camera?.username || !camera?.password || !camera?.stream_namespace
      || !camera?.credential_id) throw new Error("CONNECTOR_CAMERA_CONFIG_INCOMPLETE");
    return {
      credential_id: camera.credential_id,
      camera_source_id: camera.camera_source_id || null,
      gateway_stream_id: camera.gateway_stream_id || null,
      connection_type: "rtsp",
      endpoint: camera.endpoint,
      port: Number(camera.port || 554),
      username: camera.username,
      password: camera.password,
      vendor: camera.vendor || "generic",
      channel_count: Number(camera.channel_count || 1),
      stream_namespace: camera.stream_namespace,
      ordinal: index + 1
    };
  });
  // The complete profile set is one Keychain/secure-volume secret. It never
  // enters process arguments, environment variables, config files or logs.
  store.write("connector_profiles_json", JSON.stringify(profiles));
  // Keep the original one-camera accounts for in-place compatibility with the
  // already deployed Tapo Connector while the shared core learns the array.
  const first = profiles[0];
  store.write("dvr_profile_json", JSON.stringify({ connection_type: first.connection_type,
    endpoint: first.endpoint, port: first.port, username: first.username,
    vendor: first.vendor, channel_count: first.channel_count }));
  store.write("dvr_password", first.password);
  store.write("connector_stream_namespace", first.stream_namespace);
  if (first.camera_source_id) store.write("connector_camera_source_id", first.camera_source_id);
  if (first.gateway_stream_id) store.write("connector_gateway_stream_id", first.gateway_stream_id);
  return { configured: true, cameraCount: profiles.length, configVersion: Number(result.data?.version || 1),
    cameraSourceIds: profiles.map(profile => profile.camera_source_id).filter(Boolean) };
}
