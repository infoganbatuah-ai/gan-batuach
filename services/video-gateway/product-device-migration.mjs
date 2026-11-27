import { mkdirSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { productIdPattern, productOrigin } from "./edge-command-policy.mjs";
import { generateManagedDeviceKeyPair } from "./managed-device-auth.mjs";
import { signManagedDeviceRotation } from "./managed-device-rotation.mjs";
import { openProductDeviceIdentity, productDeviceStoreName, productPublicKey, verifyProductDeviceIdentity } from "./product-device-identity.mjs";

const journalAccount = "product_migration_journal";
const identityPath = "/api/video-gateway/device-identity";

// Stage the private key before the owner starts the server-side prepare.
// Leave an existing directory intact if staging is run twice.
export function stageProductDeviceMigration(installedIdentityRoot, { gatewayId, siteId }) {
  if (!productIdPattern.test(gatewayId || "") || !productIdPattern.test(siteId || "")) {
    throw new Error("PRODUCT_MIGRATION_BINDING_REQUIRED");
  }
  const directory = join(realpathSync(installedIdentityRoot), productDeviceStoreName);
  mkdirSync(directory, { mode: 0o700 });
  const { store } = openProductDeviceIdentity(installedIdentityRoot);
  const pair = generateManagedDeviceKeyPair();
  store.write(journalAccount, JSON.stringify({ gatewayId, siteId, ...pair }));
  return productDeviceMigrationRequest(store);
}

function readJournal(store) {
  const journal = JSON.parse(store.read(journalAccount));
  if (!productIdPattern.test(journal.gatewayId || "") || !productIdPattern.test(journal.siteId || "") ||
    productPublicKey(journal.privateKeyPkcs8) !== journal.publicKeySpki) {
    throw new Error("PRODUCT_MIGRATION_JOURNAL_INVALID");
  }
  return journal;
}

// Only this public payload should be passed to the authenticated owner session.
export function productDeviceMigrationRequest(store) {
  const { gatewayId, siteId, publicKeySpki } = readJournal(store);
  return { action: "legacy_migration_prepare", gateway_id: gatewayId, observer_site_id: siteId,
    new_credential_algorithm: "Ed25519", new_public_key_spki: publicKeySpki };
}

// Persist the exact challenge before sending a proof. If prepare's response was
// lost, stop and reconcile the pending server request before another prepare.
export function recordProductDeviceMigrationChallenge(store, response, now = Date.now()) {
  const journal = readJournal(store);
  const expiresAt = Date.parse(response?.expires_at);
  if (journal.challenge || response?.status !== "MIGRATION_PREPARED" ||
    response.gateway_id !== journal.gatewayId || response.new_credential_version !== 1 ||
    !productIdPattern.test(response.rotation_id || "") || !/^[A-Za-z0-9_-]{43}$/.test(response.challenge || "") ||
    !Number.isFinite(expiresAt) || expiresAt <= now || expiresAt > now + 6 * 60_000) {
    throw new Error("PRODUCT_MIGRATION_CHALLENGE_INVALID");
  }
  store.write(journalAccount, JSON.stringify({ ...journal,
    rotationId: response.rotation_id, challenge: response.challenge, expiresAt }));
}

// One explicit invocation per device. A lost confirm response can be recovered
// with the exact same proof. A successful retry never creates a new enrollment.
export async function confirmProductDeviceMigration(store, binding, { fetcher = fetch, now = Date.now() } = {}) {
  if (store.read("device_credential_version")) {
    verifyProductDeviceIdentity(store, binding);
    return { status: "ROTATED", locallyComplete: true };
  }
  const journal = readJournal(store);
  if (journal.gatewayId !== binding.gatewayId || journal.siteId !== binding.siteId || !journal.challenge ||
    (!journal.confirmAttempted && journal.expiresAt <= now)) {
    throw new Error("PRODUCT_MIGRATION_CONFIRMATION_NOT_READY");
  }
  const { gatewayId, siteId, rotationId, challenge, privateKeyPkcs8, publicKeySpki } = journal;
  const signature = signManagedDeviceRotation({ deviceId: gatewayId, credentialVersion: 1,
    rotationId, challenge, privateKeyPkcs8 });
  store.write(journalAccount, JSON.stringify({ ...journal, confirmAttempted: true }));
  const response = await fetcher(`${productOrigin}${identityPath}`, {
    method: "POST", headers: { "content-type": "application/json" }, redirect: "error",
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({ action: "rotate_confirm", gateway_id: gatewayId, rotation_id: rotationId,
      new_credential_version: 1, challenge, signature })
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.data?.status !== "ROTATED" || result.data.credential_version !== 1) {
    throw new Error("PRODUCT_MIGRATION_CONFIRMATION_FAILED");
  }
  store.write("device_gateway_id", gatewayId);
  store.write("device_observer_site_id", siteId);
  store.write("device_cloud_base_url", productOrigin);
  store.write("device_private_key_pkcs8", privateKeyPkcs8);
  store.write("device_public_key_spki", publicKeySpki);
  // Write the readiness marker last, after a confirmed server response.
  store.write("device_credential_version", "1");
  verifyProductDeviceIdentity(store, binding);
  store.remove(journalAccount);
  return { status: "ROTATED", locallyComplete: true };
}
