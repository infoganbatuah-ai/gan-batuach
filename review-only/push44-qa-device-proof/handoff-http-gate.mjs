// Review-only HTTP adapter. No app route imports it; no real Auth or DB is wired.
export const QA_HANDOFF_ENABLED = false;
const maxBodyBytes = 2_048;
const path = "/api/digital-observer/qa-device-proof/handoff";
const audience = "com.ganbatuach.app.qa";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reject = (status = 403) => new Response(null, { status, headers: { "cache-control": "no-store" } });

async function boundedBody(request) {
  const claimed = request.headers.get("content-length");
  if (claimed !== null && (!/^\d+$/.test(claimed) || Number(claimed) > maxBodyBytes)) return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > maxBodyBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(next.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch { return null; } finally { reader.releaseLock(); }
}

export async function handleQaHandoff(request, dependencies = {}) {
  if (dependencies.enabled !== true) return reject(404);
  try {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.protocol !== "https:"
      || url.hostname !== "qa-iphone-device-proof.ganbatuach.com"
      || url.username || url.password || url.port
      || url.pathname !== path || url.search || url.hash
      || request.headers.get("content-type") !== "application/json") return reject(400);
    const text = await boundedBody(request);
    if (text === null) return reject(400);
    const body = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body)
      || Object.keys(body).sort().join(",") !== "challengeId,installationId,signatureBase64"
      || !uuid.test(body.challengeId) || !uuid.test(body.installationId)
      || typeof body.signatureBase64 !== "string" || body.signatureBase64.length > 256
      || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.signatureBase64)) return reject(400);
    if (typeof dependencies.authenticate !== "function" || typeof dependencies.consume !== "function") return reject();
    const identity = await dependencies.authenticate(request);
    if (!identity || typeof identity.accountId !== "string" || !identity.accountId
      || typeof identity.sessionId !== "string" || !identity.sessionId) return reject();
    const now = dependencies.now?.() ?? Date.now();
    if (!Number.isSafeInteger(now)) return reject();
    const consumed = await dependencies.consume({ challengeId: body.challengeId,
      accountId: identity.accountId, sessionId: identity.sessionId,
      installationId: body.installationId, audience,
      signatureBase64: body.signatureBase64, now });
    return consumed === true ? new Response(null, { status: 204, headers: { "cache-control": "no-store" } }) : reject();
  } catch { return reject(); }
}
