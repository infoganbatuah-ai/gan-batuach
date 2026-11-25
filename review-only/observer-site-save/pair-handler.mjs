// Unmounted review adapter. Its server-only dependencies authenticate the Product
// session, read the operator's pin and call only submit_qa_site_source_pair.
const localPath = "http://127.0.0.1/qa/site-source-pair";
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const response = (status, data) => Response.json(data, {
  status, headers: { "cache-control": "no-store" }
});

async function readSubmission(request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 512) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
    if (!body || Object.keys(body).sort().join(",") !== "fixture_label,submission") return null;
    return typeof body.submission === "string" && uuid.test(body.submission)
      && typeof body.fixture_label === "string" && body.fixture_label.length >= 2
      && body.fixture_label.length <= 100 && body.fixture_label.trim() === body.fixture_label ? body : null;
  } finally {
    reader.releaseLock();
  }
}

export async function handlePairSubmission(request, { verifyProductSession, readOperatorPin, submitPair, now = Date.now }) {
  if (request.method !== "POST" || request.url !== localPath) return response(404, {});
  if (request.headers.get("host") !== "127.0.0.1" || request.headers.get("origin") !== new URL(localPath).origin
    || request.headers.has("forwarded") || [...request.headers.keys()].some(key => key.startsWith("x-forwarded-"))) {
    return response(403, {});
  }
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return response(415, {});
  let body;
  try { body = await readSubmission(request); } catch { return response(400, {}); }
  if (!body) return response(400, {});
  try {
    const session = await verifyProductSession(request);
    if (!session || session.role !== "authenticated" || session.emailConfirmed !== true || session.observerActive !== true
      || !uuid.test(session.actor) || !uuid.test(session.sessionId)
      || !Number.isSafeInteger(session.exp) || session.exp <= now() / 1000) return response(401, {});
    const pin = await readOperatorPin();
    if (!pin || pin.actor !== session.actor || pin.sessionId !== session.sessionId
      || pin.submission !== body.submission || pin.fixtureLabel !== body.fixture_label
      || !Number.isSafeInteger(pin.expiresAtMs) || pin.expiresAtMs <= now()
      || pin.expiresAtMs - now() > 300_000 || !uuid.test(pin.sourceId)) return response(403, {});
    const result = await submitPair({
      verified_actor: session.actor, verified_session: session.sessionId, token_exp: session.exp,
      submission: body.submission, fixture_label: body.fixture_label
    });
    if (!result || !uuid.test(result.site_id) || result.source_id !== pin.sourceId) return response(503, {});
    return response(200, { site_id: result.site_id, source_id: result.source_id });
  } catch {
    return response(503, {});
  }
}
