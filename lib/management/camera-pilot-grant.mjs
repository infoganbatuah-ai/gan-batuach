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

/**
 * Server-side orchestration for a configured Development pilot. The transport
 * must authenticate Observer and return its verified receipt. It receives no
 * browser-controlled destination. Context and authorization are server-owned.
 */
export async function requestCameraPilotPlayback({
  context, config, operation, handle, authorize, transport, now = Date.now
}) {
  if (config?.environment !== "development" || !config.qaGardenId ||
      !context?.sessionId || context.camera?.gardenId !== config.qaGardenId ||
      typeof authorize !== "function" || typeof transport !== "function") return null;

  const { sessionId, viewer, camera } = context;
  const send = async (binding, operation, handle) => {
    const assertion = signCameraPilotAssertion({
      environment: config.environment, qaGardenId: config.qaGardenId,
      binding, sessionId, operation, handle, privateKey: config.privateKey, now
    });
    if (!assertion) return null;
    return transport({ operation, assertion, signal: AbortSignal.timeout(5_000) });
  };

  return cameraPilotGrant({
    environment: config.environment, viewer, camera, operation, handle, now,
    authorize: binding => authorize({ binding, sessionId }),
    provider: {
      issue: binding => send(binding, "issue"),
      consume: (binding, handle) => send(binding, "redeem", handle)
    }
  });
}

/** Read the synthetic WHEP offer without accepting a browser-selected source. */
export async function readCameraPilotOffer(request) {
  if (request.method !== "POST" || request.headers.get("content-type") !== "application/sdp" ||
      !request.body) return null;
  const reader = request.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 16_384) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const offer = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
    if (!offer.startsWith("v=0") || /^a=(?:candidate|remote-candidates):/m.test(offer) ||
        !/^a=recvonly\r?$/m.test(offer) || !/^m=video /m.test(offer) ||
        (offer.match(/^m=/gm) ?? []).length !== 1) return null;
    return offer;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

async function readPilotResponse(body, limit) {
  const reader = body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
  } finally {
    reader.releaseLock();
  }
}

function validSignedAssertion(assertion) {
  return typeof assertion === "string" && assertion.length <= 4096 &&
    /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{86}$/.test(assertion);
}

/** This transport targets only the single configured local Observer QA listener. */
export function createCameraPilotLoopbackTransport({ origin, serviceToken, fetcher = fetch }) {
  if (typeof origin !== "string" || !/^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}$/.test(origin) ||
      typeof serviceToken !== "string" || !handlePattern.test(serviceToken)) return null;
  let base;
  try { base = new URL(origin); } catch { return null; }
  if (!base.port) return null;
  const authorization = "Bearer " + serviceToken;
  async function post(path, headers, body) {
    return fetcher(new URL(path, base), {
      method: "POST", headers: { Authorization: authorization, ...headers },
      body, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(5_000)
    });
  }
  return {
    async issue(assertion) {
      if (!validSignedAssertion(assertion)) return null;
      try {
        const response = await post("/pilot/issue", { "X-Gan-Pilot-Assertion": assertion });
        if (response.status !== 201 || response.headers.get("content-type") !== "application/json" ||
            response.headers.get("cache-control") !== "private, no-store" || !response.body) {
          await response.body?.cancel();
          return null;
        }
        const payload = await readPilotResponse(response.body, 4096);
        return payload === null ? null : JSON.parse(payload);
      } catch {
        return null;
      }
    },
    async signal(assertion, offer) {
      if (!validSignedAssertion(assertion)) return null;
      if (typeof offer !== "string" || Buffer.byteLength(offer) > 16_384) return null;
      try {
        const response = await post("/pilot/whep", {
          "Content-Type": "application/sdp", "X-Gan-Pilot-Assertion": assertion
        }, offer);
        if (response.status !== 201 || response.headers.get("content-type") !== "application/sdp" ||
            response.headers.get("cache-control") !== "private, no-store" || !response.body) {
          await response.body?.cancel();
          return null;
        }
        const answer = await readPilotResponse(response.body, 16_384);
        return answer?.startsWith("v=0") ? answer : null;
      } catch { return null; }
    },
    async revoke(handle) {
      if (!validHandle(handle)) return false;
      try {
        const response = await post("/pilot/revoke", { "Content-Type": "application/json" }, JSON.stringify({ handle }));
        await response.body?.cancel();
        return response.status === 204;
      } catch { return false; }
    }
  };
}

/**
 * Registry for one isolated QA serving process. Do not share a pilot window
 * across registry instances. Observer remains authoritative for media shutdown.
 */
export function createCameraPilotSessionRegistry({ qaGardenId, revoke, now = Date.now }) {
  let active;
  const matches = (entry, context) => entry.sessionId === context?.sessionId &&
    entry.viewerId === context.viewer?.id && entry.role === context.viewer?.role &&
    context.viewer?.active === true && context.camera?.active === true &&
    entry.gardenId === context.camera?.gardenId && entry.cameraId === context.camera?.id &&
    entry.siteId === context.camera?.siteId;

  return {
    register(context, grant) {
      if (active || !context?.sessionId || !context.viewer?.id ||
          !eligibleRoles.has(context.viewer.role) || context.viewer.active !== true ||
          context.camera?.active !== true || context.camera.gardenId !== qaGardenId ||
          !context.camera.siteId || !context.camera.id || !validHandle(grant?.handle) ||
          !Number.isSafeInteger(grant.expiresAtMs) || grant.expiresAtMs <= now() ||
          grant.expiresAtMs - now() > maxTtlMs) return false;
      active = {
        sessionId: context.sessionId, viewerId: context.viewer.id, role: context.viewer.role,
        gardenId: context.camera.gardenId, cameraId: context.camera.id, siteId: context.camera.siteId,
        handle: grant.handle, expiresAtMs: grant.expiresAtMs, blocked: false
      };
      return true;
    },
    lookup(context) {
      if (!active || active.blocked || active.expiresAtMs <= now() || !matches(active, context)) return null;
      return { handle: active.handle, expiresAtMs: active.expiresAtMs };
    },
    async stop(sessionId) {
      if (!active || active.sessionId !== sessionId) return false;
      const entry = active;
      entry.blocked = true;
      try {
        if (await revoke(entry.handle) !== true) return false;
        if (active === entry) active = undefined;
        return true;
      } catch {
        return false;
      }
    }
  };
}
