import { createHash, randomUUID } from "node:crypto";
import { createPrivateNvrCommandStateStore } from "./private-nvr-command-state-store.mjs";

const DRIVER = "private_nvr_http_api_v1";
const ACTION_EVIDENCE = { lighting: "light", siren: "siren", ptz: "ptz", talk: "talkback" };
const BINDING_MAX_AGE_MS = 15 * 60_000;

function runtimeFailure(code) {
  throw Object.assign(new Error(code), { code });
}

function capabilityDetail(value, verifiedAt) {
  const tested = value?.tested === true;
  const supported = tested && value?.supported === true;
  return {
    supported,
    method: tested ? "vendor_read_only_api" : "not_tested",
    tested_at: tested ? verifiedAt : null,
    adapter: DRIVER,
    reason: !tested ? "capability_probe_unavailable" : supported ? "read_only_capability_verified" : "capability_not_reported"
  };
}

export function createPrivateNvrCommandRuntime({ databasePath, auditSigningKey, identity, sourceResolver, probeCapabilities, now = Date.now }) {
  if (!identity?.gatewayId || !identity?.siteId || typeof sourceResolver !== "function" || typeof probeCapabilities !== "function") {
    runtimeFailure("command_runtime_dependencies_invalid");
  }
  const state = createPrivateNvrCommandStateStore({ databasePath, auditSigningKey, now });

  function authoritativeBindingFor(task) {
    const binding = state.authoritativeBinding(task?.stream_id);
    if (!binding || now() - binding.verifiedAt > BINDING_MAX_AGE_MS || binding.verifiedAt > now() + 5_000
      || binding.gatewayId !== identity.gatewayId || binding.siteId !== identity.siteId
      || (task.gateway_id != null && task.gateway_id !== binding.gatewayId) || task.site_id !== binding.siteId || task.camera_id !== binding.cameraId
      || task.stream_id !== binding.streamId || task.channel !== binding.channel
      || (task.source_generation != null && task.source_generation !== binding.generation)
      || (task.binding_generation != null && task.binding_generation !== binding.bindingGeneration)) {
      runtimeFailure("source_mapping_unavailable");
    }
    return binding;
  }

  async function boundSource(task) {
    const binding = authoritativeBindingFor(task);
    const source = await sourceResolver(binding);
    if (!source || source.gatewayId !== binding.gatewayId || source.siteId !== binding.siteId
      || source.cameraId !== binding.cameraId || source.streamId !== binding.streamId || source.channel !== binding.channel
      || source.generation !== binding.generation || source.bindingGeneration !== binding.bindingGeneration
      || source.recorderId !== binding.recorderId || source.sessionKey !== binding.sessionKey || source.mediaProgressing !== true) {
      runtimeFailure("source_mapping_unavailable");
    }
    return source;
  }

  async function evidenceFor(source) {
    const discovered = await probeCapabilities(source);
    const verifiedAt = new Date(now()).toISOString();
    return {
      adapter: DRIVER,
      gateway_id: source.gatewayId,
      site_id: source.siteId,
      camera_id: source.cameraId,
      stream_id: source.streamId,
      channel: source.channel,
      source_generation: source.generation,
      binding_generation: source.bindingGeneration,
      verified_at: verifiedAt,
      live: { tested: true, media_progressing: source.mediaProgressing === true, verified_at: source.liveVerifiedAt },
      ptz: { tested: discovered?.ptz?.tested === true, supported: discovered?.ptz?.supported === true },
      light: { tested: discovered?.light?.tested === true, supported: discovered?.light?.supported === true },
      siren: { tested: discovered?.siren?.tested === true, supported: discovered?.siren?.supported === true },
      talkback: { tested: discovered?.talkback?.tested === true, supported: discovered?.talkback?.supported === true }
    };
  }

  async function diagnostic(task) {
    const source = await boundSource(task);
    const evidence = await evidenceFor(source);
    const verifiedAt = evidence.verified_at;
    const details = {
      ptz: capabilityDetail(evidence.ptz, verifiedAt),
      twoWayAudio: capabilityDetail(evidence.talkback, verifiedAt),
      siren: capabilityDetail(evidence.siren, verifiedAt),
      lighting: capabilityDetail(evidence.light, verifiedAt)
    };
    const capabilities = Object.fromEntries(Object.entries(details).map(([key, value]) => [key, value.supported]));
    const common = {
      camera_id: source.cameraId,
      site_id: source.siteId,
      gateway_id: source.gatewayId,
      stream_id: source.streamId,
      channel: source.channel,
      source_generation: source.generation,
      binding_generation: source.bindingGeneration,
      executor_installed: false,
      evidence_id: randomUUID(),
      verified_at: verifiedAt,
      live: evidence.live,
      executed: false
    };
    if (task.task_kind === "capability_snapshot") {
      return { action: "result", request_id: task.id, outcome: "capability_snapshot",
        result_code: Object.values(capabilities).some(Boolean) ? "verified" : "unsupported",
        outcome_payload: { ...common, driver: DRIVER, provider: DRIVER, capabilities, details } };
    }
    const key = ACTION_EVIDENCE[task.action];
    const selected = key === "talkback" ? details.twoWayAudio : details[task.action];
    return { action: "result", request_id: task.id, outcome: "command_preflight",
      result_code: selected?.supported ? "preflight_only" : "unsupported",
      outcome_payload: { ...common, action: task.action, supported: selected?.supported === true,
        ack_kind: "preflight_only", requires_immediate_confirmation: true } };
  }

  async function submitDurably(result, submitResult) {
    const resultDigest = state.savePendingResult(result);
    await submitResult(result);
    state.acknowledgePendingResult(result.request_id, resultDigest);
  }

  return Object.freeze({
    provisionAuthoritativeBindings({ discoveryId, verifiedAt, bindings }) {
      if (!Array.isArray(bindings)) runtimeFailure("invalid_authoritative_binding_provisioning");
      const normalized = bindings.map((binding) => {
        const generation = createHash("sha256").update(`${discoveryId}:${binding.streamId}:${binding.channel}`).digest("hex");
        const bindingGeneration = createHash("sha256")
          .update(`${identity.gatewayId}:${identity.siteId}:${binding.cameraId}:${binding.streamId}`).digest("hex");
        return { ...binding, generation, bindingGeneration };
      });
      return state.replaceAuthoritativeBindings({ gatewayId: identity.gatewayId, siteId: identity.siteId,
        discoveryId, verifiedAt, bindings: normalized });
    },
    diagnostic,
    async executeOnce(task, submitResult) {
      await boundSource(task);
      const result = { action: "result", request_id: task.id, outcome: "failed", result_code: "physical_executor_disabled" };
      await submitDurably(result, submitResult);
      return { state: "result_recorded", result };
    },
    async flushPending(submitResult) {
      const pending = state.pendingResult();
      if (!pending) return false;
      await submitResult(pending.result);
      state.acknowledgePendingResult(pending.result.request_id, pending.resultDigest);
      return true;
    },
    status() {
      return { version: 12, executor_installed: true, dispatch_enabled: false, no_physical_command_sentinel: true, ...state.status() };
    },
    close() {
      state.close();
    }
  });
}
