import { createHash, randomUUID } from "node:crypto";

const DRIVER = "private_nvr_http_api_v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FIELDS = new Set(["id", "task_kind", "camera_id", "site_id", "stream_id", "channel", "action", "payload_digest", "expires_at", "requested_at"]);
const ACTIONS = { ptz: "ptz", talk: "twoWayAudio", siren: "siren", lighting: "lighting" };
const EVIDENCE_KEYS = { ptz: "ptz", twoWayAudio: "talkback", siren: "siren", lighting: "light" };

function invalid(code) { throw Object.assign(new Error(code), { code }); }

// Requests must come from the authenticated, site/source-scoped cloud queue.
// This module has no physical-command transport and accepts no credentials.
export function createPrivateNvrPreflightDriver({ resolveSource, probe, now = Date.now }) {
  const requests = new Map();
  return async function handle(request, identity) {
    const at = now();
    if (!request || typeof request !== "object" || Array.isArray(request) || Object.keys(request).some(key => !FIELDS.has(key))) invalid("invalid_preflight_request");
    if (![request.id, request.camera_id, request.site_id].every(value => typeof value === "string" && UUID.test(value))) invalid("invalid_source_identity");
    if (!identity?.gatewayId || request.site_id !== identity.siteId) invalid("source_scope_mismatch");
    if (!["capability_snapshot", "command_preflight"].includes(request.task_kind)) invalid("physical_dispatch_blocked");
    if (typeof request.stream_id !== "string" || !/^[a-zA-Z0-9_-]{1,160}$/.test(request.stream_id) || !Number.isInteger(request.channel) || request.channel < 1 || request.channel > 64) invalid("invalid_stream_mapping");
    const requested = Date.parse(request.requested_at), expires = Date.parse(request.expires_at);
    if (!Number.isFinite(requested) || !Number.isFinite(expires) || requested > at + 5000 || expires <= at || expires <= requested || expires - requested > 120000 || at - requested > 120000) invalid("preflight_expired");
    if (request.task_kind === "command_preflight") {
      if (!Object.hasOwn(ACTIONS, request.action) || typeof request.payload_digest !== "string" || !/^[a-f0-9]{64}$/.test(request.payload_digest)) invalid("invalid_preflight_action");
    } else if (request.action !== undefined || request.payload_digest !== undefined) invalid("snapshot_action_blocked");
    const source = resolveSource(request.stream_id);
    if (!source || source.kind !== "private_nvr_http_mp4" || source.channel !== request.channel) invalid("source_mapping_unavailable");
    const fingerprint = createHash("sha256").update(JSON.stringify(Object.keys(request).sort().map(key => [key, request[key]]))).digest("hex");
    for (const [key, entry] of requests) if (entry.expires <= at) requests.delete(key);
    const existing = requests.get(request.id);
    if (existing) {
      if (existing.fingerprint !== fingerprint) invalid("request_replay_mismatch");
      return existing.result;
    }
    if (requests.size >= 128) invalid("preflight_capacity_exceeded");
    const result = (async () => {
      let discovered;
      try { discovered = await probe(source, Math.min(3500, Math.max(1, expires - at))); } catch { discovered = null; }
      if (now() >= expires) invalid("preflight_expired");
      const verifiedAt = new Date(now()).toISOString();
      const details = {};
      for (const [name, key] of Object.entries(EVIDENCE_KEYS)) {
        const evidence = discovered?.adapter === DRIVER ? discovered[key] : null;
        const tested = evidence?.tested === true;
        const supported = tested && evidence.supported === true;
        details[name] = {
          supported, method: tested ? "vendor_read_only_api" : "not_tested",
          tested_at: tested ? verifiedAt : null, adapter: DRIVER,
          reason: !tested ? "capability_probe_unavailable" : supported ? "read_only_capability_verified" : "capability_not_reported"
        };
      }
      const capabilities = Object.fromEntries(Object.entries(details).map(([name, value]) => [name, value.supported]));
      const tested = Object.values(details).some(value => value.method !== "not_tested");
      const common = { camera_id: request.camera_id, site_id: request.site_id, executor_installed: false, evidence_id: randomUUID(), verified_at: tested ? verifiedAt : null };
      if (request.task_kind === "capability_snapshot") return {
        outcome: "capability_snapshot", result_code: !tested ? "unavailable" : Object.values(capabilities).some(Boolean) ? "verified" : "unsupported",
        outcome_payload: { ...common, stream_id: request.stream_id, channel: request.channel, driver: DRIVER, provider: DRIVER, capabilities, details }
      };
      const actionEvidence = details[ACTIONS[request.action]];
      const actionTested = actionEvidence.method !== "not_tested";
      const supported = actionEvidence.supported;
      return {
        outcome: "command_preflight", result_code: !actionTested ? "unavailable" : supported ? "preflight_only" : "unsupported",
        outcome_payload: { ...common, verified_at: actionTested ? verifiedAt : null, action: request.action, supported, ack_kind: "preflight_only", executed: false, requires_immediate_confirmation: true }
      };
    })();
    requests.set(request.id, { fingerprint, expires, result });
    return result;
  };
}
