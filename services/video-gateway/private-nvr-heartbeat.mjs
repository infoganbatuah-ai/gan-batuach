// The recorder's own public web client uses Login/Heartbeat every ten seconds.
// This maintains an existing login only. It never logs in, controls a camera,
// changes configuration, or treats a heartbeat as proof of live video.
export function createPrivateNvrHeartbeat({ sessions, fetchImpl = fetch, now = Date.now, timeoutMs = 3500 }) {
  let pending = null;
  const status = { attempts: 0, responses_ok: 0, failures: 0, authentication_rejected: 0, last_response_at: null };
  async function send(session) {
    if (!session?.token || !session.baseUrl || session.refreshPromise) return;
    status.attempts++;
    try {
      const url = new URL("/API/Login/Heartbeat", session.baseUrl);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw Error("invalid_origin");
      const response = await fetchImpl(url, {
        method: "POST", redirect: "error",
        headers: { "content-type": "application/json", "x-csrftoken": session.token, ...(session.cookie ? { cookie: session.cookie } : {}) },
        body: JSON.stringify({ version: "1.0", data: {} }),
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (response.status === 401 || response.status === 403) status.authentication_rejected++;
      const reader = response.body?.getReader();
      const chunks = [];
      let bytes = 0;
      if (reader) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes += value.byteLength;
            if (bytes > 16384) { await reader.cancel(); throw Error("response_too_large"); }
            chunks.push(value);
          }
        } finally { reader.releaseLock(); }
      }
      let payload;
      try { payload = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { payload = null; }
      if (!response.ok || !payload || payload.result === "failed" || payload.result === "error") throw Error("heartbeat_unavailable");
      status.responses_ok++;
      status.last_response_at = new Date(now()).toISOString();
    } catch { status.failures++; }
  }
  return {
    tick() {
      if (pending) return pending;
      pending = Promise.resolve().then(async () => {
        for (const session of [...sessions()].slice(0, 16)) await send(session);
      }).catch(() => { status.failures++; }).finally(() => { pending = null; });
      return pending;
    },
    status: () => ({ ...status })
  };
}
