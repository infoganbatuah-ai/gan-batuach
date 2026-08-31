import { ASSET, MEDIA_MAX_BYTES, RELAY_ORIGIN, SESSION_TTL_MS } from "./relay-protocol.mjs";

// Inert until a caller explicitly enables it after deployment/ownership
// verification. This module never reads Keychain or connects to a recorder.
export function createRemoteRelay({ enabled = false, lease, claimGrant, readAsset, fetcher = fetch, now = Date.now }) {
  const sessions = new Map();
  const controller = new AbortController();
  const state = { status: "disabled", last_poll_at: null, last_media_at: null, error: null };
  let permission = null;
  let running = null;

  async function post(path, payload, timeout = 28_000) {
    if (!permission || permission.expires_at <= now()) throw new Error("relay_permission_expired");
    const response = await fetcher(`${RELAY_ORIGIN}${path}`, {
      method: "POST", redirect: "error",
      headers: { "content-type": "application/json", authorization: `Bearer ${permission.token}` },
      body: JSON.stringify(payload), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(timeout)])
    });
    if (!response.ok) throw new Error("relay_request_failed");
    return response.json();
  }

  async function processTask(task) {
    const validId = (value) => typeof value === "string" && /^[a-zA-Z0-9_-]{43}$/.test(value);
    if (!validId(task?.id) || !validId(task?.session_id)) return;
    let result = { id: task.id, ok: false };
    try {
      if (task.kind === "claim") {
        if (typeof task.grant !== "string" || task.grant.length > 4096
          || !Number.isFinite(task.expires_at) || task.expires_at <= now() || task.expires_at > now() + SESSION_TTL_MS) throw new Error("invalid_claim");
        if (sessions.size >= 32 && !sessions.has(task.session_id)) throw new Error("viewer_limit");
        const streamId = await claimGrant(task.grant);
        sessions.set(task.session_id, { streamId, exp: task.expires_at });
        result = { id: task.id, ok: true, session_id: task.session_id };
      } else if (task.kind === "asset" && ASSET.test(task.asset)) {
        const session = sessions.get(task.session_id);
        if (!session || session.exp <= now()) throw new Error("session_expired");
        const data = await readAsset(session.streamId, task.asset);
        if (!Buffer.isBuffer(data) || !data.length || data.length > MEDIA_MAX_BYTES || session.exp <= now()) throw new Error("media_unavailable");
        result = { id: task.id, ok: true, base64: data.toString("base64") };
        state.last_media_at = new Date(now()).toISOString();
      }
    } catch { /* Never forward recorder error text or credentials. */ }
    await post("/gateway/result", result, 10_000);
  }

  async function pollOnce() {
    if (!enabled || controller.signal.aborted) return false;
    for (const [id, session] of sessions) if (session.exp <= now()) sessions.delete(id);
    if (!permission || permission.expires_at <= now() + 30_000) {
      const next = await lease();
      if (!next || next.relay_origin !== RELAY_ORIGIN || typeof next.token !== "string"
        || !Number.isFinite(next.expires_at) || next.expires_at <= now() + 5000 || next.expires_at > now() + 120_000) {
        permission = null;
        state.status = "not_configured";
        return false;
      }
      permission = next;
    }
    const payload = await post("/gateway/poll", {});
    if (!Array.isArray(payload.tasks) || payload.tasks.length > 8) throw new Error("invalid_relay_tasks");
    state.status = "connected";
    state.error = null;
    state.last_poll_at = new Date(now()).toISOString();
    await Promise.all(payload.tasks.map(processTask));
    return true;
  }

  function start() {
    if (!enabled) return Promise.resolve();
    if (running) return running;
    running = (async () => {
      while (!controller.signal.aborted) {
        let active = false;
        try { active = await pollOnce(); }
        catch {
          permission = null;
          state.status = "unavailable";
          state.error = "relay_connection_failed";
        }
        if (!active && !controller.signal.aborted) await new Promise((resolve) => {
          const done = () => { clearTimeout(timer); controller.signal.removeEventListener("abort", done); resolve(); };
          const timer = setTimeout(done, 30_000);
          controller.signal.addEventListener("abort", done, { once: true });
        });
      }
    })();
    return running;
  }
  function stop() { controller.abort(); sessions.clear(); permission = null; state.status = "stopped"; }
  return { start, stop, pollOnce, status: () => ({ ...state }) };
}
