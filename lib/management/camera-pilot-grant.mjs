// Development-only boundary. Production routes do not import this module.
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
    .every(value => typeof value === "string" && value.length > 0)) return null;
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
    if (!Number.isSafeInteger(receipt.expiresAtMs) || !(ttl > 0 && ttl <= 60_000)) return null;
    if (!validHandle(receipt.handle) || (operation === "redeem" && receipt.handle !== handle)) return null;
    return { handle: receipt.handle, expiresAtMs: receipt.expiresAtMs };
  } catch {
    return null;
  }
}
