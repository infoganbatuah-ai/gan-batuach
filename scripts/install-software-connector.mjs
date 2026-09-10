import { createHash } from "node:crypto";
import { hostname, platform, release } from "node:os";
import { resolve } from "node:path";
import { createEdgeSecretStoreSync } from "../services/video-gateway/edge-secret-store-sync.mjs";
import { createInstallationId } from "../services/video-gateway/edge-runtime-contract.mjs";
import { generateManagedDeviceKeyPair } from "../services/video-gateway/managed-device-auth.mjs";

const action = process.argv[2] || "status";
const dataRoot = resolve(process.env.OBSERVER_CONNECTOR_DATA_DIR || ".observer-connector");
const secretDir = resolve(process.env.OBSERVER_CONNECTOR_SECRET_DIR || `${dataRoot}/secrets`);
const store = createEdgeSecretStoreSync({ secretDir });
const cloudBaseUrl = String(process.env.OBSERVER_CONNECTOR_CLOUD_URL || store.read("device_cloud_base_url") || "https://ganbatuach.com").replace(/\/$/, "");
if (!cloudBaseUrl.startsWith("https://") && !(process.env.NODE_ENV === "development" && cloudBaseUrl.startsWith("http://127.0.0.1"))) {
  throw new Error("Connector cloud URL must use HTTPS");
}

function installationId() {
  let value = store.read("device_installation_id");
  if (!value) {
    value = createInstallationId();
    store.write("device_installation_id", value);
  }
  return value;
}

async function post(body) {
  const response = await fetch(`${cloudBaseUrl}/api/digital-observer/gateway-enrollment`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    redirect: "error",
    signal: AbortSignal.timeout(15_000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Connector enrollment failed (${response.status})`);
  return payload.data;
}

if (action === "request") {
  if (store.read("device_gateway_id") || store.read("device_refresh_token")) throw new Error("Connector is already enrolled; revoke it before creating another identity");
  const id = installationId();
  let publicKeySpki = store.read("device_public_key_spki");
  if (!publicKeySpki) {
    const keyPair = generateManagedDeviceKeyPair();
    store.write("device_private_key_pkcs8", keyPair.privateKeyPkcs8);
    store.write("device_public_key_spki", keyPair.publicKeySpki);
    publicKeySpki = keyPair.publicKeySpki;
  }
  const data = await post({
    action: "create_request",
    device_name: String(process.env.OBSERVER_CONNECTOR_NAME || hostname() || "Observer Connector").slice(0, 80),
    device_platform: `${platform()}-${release()}`.slice(0, 40),
    device_fingerprint: createHash("sha256").update(`${id}:${platform()}:${hostname()}`).digest("hex"),
    device_type: "SOFTWARE_CONNECTOR",
    installation_id: id,
    software_version: String(process.env.OBSERVER_EDGE_VERSION || "development").slice(0, 80),
    build_sha: String(process.env.OBSERVER_EDGE_BUILD_SHA || "unknown").slice(0, 80),
    credential_algorithm: "Ed25519",
    credential_public_key_spki: publicKeySpki
  });
  store.write("enrollment_request_id", data.enrollment_request_id);
  store.write("enrollment_poll_token", data.poll_token);
  store.write("device_cloud_base_url", cloudBaseUrl);
  console.log(JSON.stringify({ status: "approval_required", verification_url: `${cloudBaseUrl}${data.verification_path}`, expires_at: data.expires_at }));
} else if (action === "complete") {
  const enrollmentRequestId = store.read("enrollment_request_id");
  const pollToken = store.read("enrollment_poll_token");
  if (!enrollmentRequestId || !pollToken) throw new Error("No pending Connector enrollment request");
  const data = await post({ action: "poll", enrollment_request_id: enrollmentRequestId, poll_token: pollToken });
  if (data.status === "pending") {
    console.log(JSON.stringify({ status: "approval_required" }));
  } else if (data.status === "expired") {
    store.remove("enrollment_request_id");
    store.remove("enrollment_poll_token");
    console.log(JSON.stringify({ status: "expired" }));
  } else if (data.status === "linked") {
    if (data.identity_scheme !== "ED25519_V1" || data.credential_version !== 1) throw new Error("Connector identity protocol mismatch");
    store.write("device_gateway_id", data.gateway_id);
    store.write("device_observer_site_id", data.observer_site_id);
    store.write("device_credential_version", String(data.credential_version));
    store.remove("enrollment_request_id");
    store.remove("enrollment_poll_token");
    console.log(JSON.stringify({ status: "linked", device_type: "SOFTWARE_CONNECTOR", site_bound: true, credentials_printed: false }));
  } else throw new Error("Unexpected Connector enrollment state");
} else if (action === "uninstall-local") {
  for (const account of ["device_gateway_id", "device_observer_site_id", "device_refresh_token", "device_refresh_pending", "device_private_key_pkcs8", "device_public_key_spki", "device_credential_version", "device_rotation_pending", "device_cloud_base_url", "gateway_signing_secret", "dvr_profile_json", "dvr_password", "enrollment_request_id", "enrollment_poll_token"]) store.remove(account);
  console.log(JSON.stringify({ status: "local_credentials_removed", cloud_revocation_required: true }));
} else if (action === "status") {
  console.log(JSON.stringify({
    status: store.read("device_gateway_id") && (store.read("device_private_key_pkcs8") || store.read("device_refresh_token")) ? "enrolled" : store.read("enrollment_request_id") ? "approval_required" : "not_enrolled",
    device_type: "SOFTWARE_CONNECTOR",
    installation_id_present: Boolean(store.read("device_installation_id")),
    credentials_printed: false
  }));
} else {
  throw new Error("Usage: install-software-connector.mjs request|complete|status|uninstall-local");
}
