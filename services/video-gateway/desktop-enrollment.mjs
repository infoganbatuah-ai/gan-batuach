import { randomBytes, randomUUID } from "node:crypto";
import { createInstallationId } from "./edge-runtime-contract.mjs";
import { generateManagedDeviceKeyPair } from "./managed-device-auth.mjs";

export function validateInstallDocument(input, now = Date.now()) {
  const keys = ["version", "intent_id", "observer_site_id", "secret", "expires_at", "origin"];
  if (!input || typeof input !== "object" || Object.keys(input).length !== keys.length || Object.keys(input).some(key => !keys.includes(key))
    || input.version !== "connector-install-v1" || input.origin !== "https://ganbatuach.com"
    || ![input.intent_id, input.observer_site_id].every(id => typeof id === "string" && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id))
    || !/^[A-Za-z0-9_-]{43}$/.test(input.secret)) throw new Error("INSTALL_DOCUMENT_INVALID");
  const expires = Date.parse(input.expires_at);
  if (!Number.isFinite(expires) || expires <= now || expires - now > 15 * 60000) throw new Error("INSTALL_INTENT_EXPIRED");
  return input;
}

export async function claimDesktopInstallation({ document, store, platform, version, build, post }) {
  validateInstallDocument(document);
  if (store.read("device_gateway_id")) throw new Error("INSTALLATION_ALREADY_ENROLLED");
  const pending = store.read("desktop_enrollment_pending");
  if (pending) {
    const previous = JSON.parse(pending);
    if (previous.document.intent_id !== document.intent_id) {
      // Expired unapproved requests may be replaced, but preserve installation
      // identity so the server can reject duplication of a delivered device.
      if (Date.parse(previous.document.expires_at) > Date.now()) throw new Error("PENDING_INSTALLATION_EXISTS");
      store.remove("desktop_enrollment_pending");
    } else {
      await submitPreparedClaim(previous, post);
      return { status: "WAITING_FOR_APPROVAL" };
    }
  }
  const installationId = store.read("device_installation_id") || createInstallationId();
  store.write("device_installation_id", installationId);
  let publicKeySpki = store.read("device_public_key_spki");
  if (!publicKeySpki) {
    const keyPair = generateManagedDeviceKeyPair();
    store.write("device_private_key_pkcs8", keyPair.privateKeyPkcs8);
    store.write("device_public_key_spki", keyPair.publicKeySpki);
    publicKeySpki = keyPair.publicKeySpki;
  }
  const enrollment = { document, enrollment_id: randomUUID(), poll_token: randomBytes(32).toString("base64url"),
    installation_id: installationId, platform, software_version: version, build_sha: build,
    credential_algorithm: "Ed25519", credential_public_key_spki: publicKeySpki };
  // Prepared before transport: restart or lost acknowledgment cannot create
  // another device or discard the proof needed to recover credential delivery.
  store.write("desktop_enrollment_pending", JSON.stringify(enrollment));
  await submitPreparedClaim(enrollment, post);
  return { status: "WAITING_FOR_APPROVAL" };
}

async function submitPreparedClaim(enrollment, post) {
  const claim = { document: enrollment.document, enrollment_id: enrollment.enrollment_id, poll_token: enrollment.poll_token,
    installation_id: enrollment.installation_id, platform: enrollment.platform, software_version: enrollment.software_version,
    build_sha: enrollment.build_sha, credential_algorithm: enrollment.credential_algorithm,
    credential_public_key_spki: enrollment.credential_public_key_spki };
  try { await post("/api/digital-observer/connector-installation", { action: "claim", ...claim }); }
  catch (error) {
    // A lost claim acknowledgement is recoverable only with the ORIGINAL
    // durable poll proof. Conflict alone never means this computer is enrolled.
    if (error.message !== "INSTALL_REQUEST_409") throw error;
    await post("/api/digital-observer/gateway-enrollment", { action: "poll", enrollment_request_id: enrollment.enrollment_id,
      poll_token: enrollment.poll_token });
  }
}

export async function pollDesktopInstallation({ store, post }) {
  if (store.read("device_gateway_id")) return { status: "ENROLLED" };
  const raw = store.read("desktop_enrollment_pending");
  if (!raw) return { status: "WAITING_FOR_INSTALL" };
  const pending = JSON.parse(raw);
  validateInstallDocument(pending.document);
  const data = await post("/api/digital-observer/gateway-enrollment", { action: "poll", enrollment_request_id: pending.enrollment_id,
    poll_token: pending.poll_token });
  if (data.status !== "linked") return { status: "WAITING_FOR_APPROVAL" };
  if (data.observer_site_id !== pending.document.observer_site_id || data.identity_scheme !== "ED25519_V1"
    || data.credential_version !== 1 || !/^[a-f0-9-]{36}$/i.test(data.gateway_id)) throw new Error("INSTALL_SCOPE_MISMATCH");
  store.write("device_credential_version", String(data.credential_version));
  store.write("device_observer_site_id", data.observer_site_id);
  store.write("device_cloud_base_url", pending.document.origin);
  store.write("device_gateway_id", data.gateway_id); // Commit marker last.
  store.remove("desktop_enrollment_pending");
  return { status: "ENROLLED" };
}
