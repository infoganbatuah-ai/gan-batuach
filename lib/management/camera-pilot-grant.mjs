import { randomBytes, sign } from "node:crypto";

// Development-only boundary. Production routes do not import this module.
const maxTtlMs = 45_000;
const identifierPattern = /^[A-Za-z0-9_-]{1,128}$/;
const eligibleRoles = new Set(["owner", "manager", "parent", "staff"]);
const handlePattern = /^[A-Za-z0-9_-]{32,128}$/;

function validHandle(handle) {
  return typeof handle === "string" && handlePattern.test(handle);
}

/**
 * Inputs come from trusted server context. authorize must check current access
 * for this exact binding. The provider must authenticate its transport and
 * atomically consume an unexpired, unrevoked handle for the supplied binding.
 * A provider result is a receipt, never a browser URL or camera credential.
 */
export async function cameraPilotGrant({
  environment, viewer, camera, operation, handle, authorize, provider, now = Date.now
}) {
  if (environment !== "development" || viewer?.active !== true || camera?.active !== true) return null;
  if (!eligibleRoles.has(viewer.role) || ![viewer.id, camera.id, camera.gardenId, camera.siteId]
    .every(value => typeof value === "string" && identifierPattern.test(value))) return null;
  if (operation !== "issue" && operation !== "redeem") return null;
  if (operation === "redeem" && !validHandle(handle)) return null;

  const binding = Object.freeze({
    viewerId: viewer.id,
    role: viewer.role,
    gardenId: camera.gardenId,
    siteId: camera.siteId,
    cameraId: camera.id,
    protocol: "WebRTC"
  });

  try {
    if (await authorize(binding) !== true) return null;
    const receipt = operation === "issue"
      ? await provider.issue(binding)
      : await provider.consume(binding, handle);
    if (receipt?.version !== 1 || receipt.environment !== environment ||
        receipt.capability !== "live_playback" || receipt.recording !== false ||
        receipt.operation !== operation) return null;
    if (!Object.entries(binding).every(([key, value]) => receipt[key] === value)) return null;
    const ttl = receipt.expiresAtMs - now();
    if (!Number.isSafeInteger(receipt.expiresAtMs) || !(ttl > 0 && ttl <= maxTtlMs)) return null;
    if (!validHandle(receipt.handle) || (operation === "redeem" && receipt.handle !== handle)) return null;
    return { handle: receipt.handle, expiresAtMs: receipt.expiresAtMs };
  } catch {
    return null;
  }
}

// Creates a fresh assertion for one provider operation after Gan authorization.
export function signCameraPilotAssertion({
  environment, qaGardenId, binding, sessionId, operation, handle, privateKey, now = Date.now
}) {
  if (environment !== "development" || !binding || binding.gardenId !== qaGardenId ||
      !eligibleRoles.has(binding.role) || binding.protocol !== "WebRTC" ||
      ![sessionId, binding.viewerId, binding.gardenId, binding.siteId, binding.cameraId]
        .every(value => typeof value === "string" && identifierPattern.test(value))) return null;
  if (privateKey?.type !== "private" || privateKey.asymmetricKeyType !== "ed25519") return null;
  if (operation !== "issue" && operation !== "redeem") return null;
  if (operation === "redeem" ? !validHandle(handle) : handle !== undefined) return null;

  try {
    const issuedAtMs = now();
    const expiresAtMs = issuedAtMs + maxTtlMs;
    if (!Number.isSafeInteger(issuedAtMs) || issuedAtMs < 0 || !Number.isSafeInteger(expiresAtMs)) return null;
    const { viewerId, role, gardenId, siteId, cameraId, protocol } = binding;
    const assertion = {
      version: 1, issuer: "gan_batuach", audience: "digital_observer:gan_camera_pilot",
      environment, operation, binding: { viewerId, role, gardenId, siteId, cameraId, protocol },
      sessionId, jti: randomBytes(32).toString("base64url"), issuedAtMs, expiresAtMs,
      ...(operation === "redeem" ? { handle } : {})
    };
    const payload = Buffer.from(JSON.stringify(assertion)).toString("base64url");
    return payload + "." + sign(null, Buffer.from(payload), privateKey).toString("base64url");
  } catch {
    return null;
  }
}
