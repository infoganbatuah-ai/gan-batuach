import { createHash } from "node:crypto";

const DRIVER = "private_nvr_http_api_v1";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDENTIFIER = /^[a-zA-Z0-9_-]{1,160}$/;
const GENERATION = /^[a-zA-Z0-9._:-]{1,128}$/;
const CONFIRMATION_MAX_AGE_MS = 30_000;
const EVIDENCE_MAX_AGE_MS = 5 * 60_000;
const LIVE_EVIDENCE_MAX_AGE_MS = 30_000;
const DEFAULT_TIMEOUT_MS = 3_500;
const MAX_PTZ_PULSE_MS = 500;
const MAX_SIREN_PULSE_MS = 5_000;

const ACTIONS = Object.freeze({
  lighting: Object.freeze({ evidenceKey: "light", writeContract: true }),
  siren: Object.freeze({ evidenceKey: "siren", writeContract: true }),
  ptz: Object.freeze({ evidenceKey: "ptz", writeContract: true }),
  talkback: Object.freeze({ evidenceKey: "talkback", writeContract: false })
});

const REQUEST_FIELDS = new Set([
  "id", "task_kind", "gateway_id", "site_id", "camera_id", "stream_id", "channel", "source_generation", "binding_generation", "action",
  "payload", "payload_digest", "requested_at", "expires_at", "confirmation"
]);
const CONFIRMATION_FIELDS = new Set([
  "id", "request_id", "gateway_id", "site_id", "camera_id", "stream_id", "channel", "source_generation", "binding_generation", "action", "payload_digest",
  "actor_id", "confirmed_at", "expires_at"
]);
const PAYLOAD_FIELDS = Object.freeze({
  lighting: new Set(["enabled", "level"]),
  siren: new Set(["enabled", "duration_ms", "volume"]),
  ptz: new Set(["command", "duration_ms", "speed"]),
  talkback: new Set([])
});
const SAFE_PTZ_COMMANDS = new Set([
  "Ptz_Cmd_Up", "Ptz_Cmd_Down", "Ptz_Cmd_Left", "Ptz_Cmd_Right",
  "Ptz_Cmd_UpLeft", "Ptz_Cmd_UpRight", "Ptz_Cmd_DownLeft", "Ptz_Cmd_DownRight",
  "Ptz_Cmd_ZoomMinus", "Ptz_Cmd_ZoomAdd", "Ptz_Cmd_FocusMinus", "Ptz_Cmd_FocusAdd"
]);

const PATHS = Object.freeze({
  alarmGet: "/API/PreviewChannel/Floodlight2AudioAlarm/Get",
  alarmSet: "/API/PreviewChannel/Floodlight2AudioAlarm/Set",
  ptzRange: "/API/PreviewChannel/PTZ/Range",
  ptzControl: "/API/PreviewChannel/PTZ/Control"
});

function failure(code, details = {}) {
  return Object.assign(new Error(code), { code, details });
}

function exactObject(value, fields, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw failure(code);
  if (Object.keys(value).some((key) => !fields.has(key))) throw failure(code);
  return value;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function digest(value) {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

function parseTime(value, code) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw failure(code);
  return timestamp;
}

function ensureUuid(value, code) {
  if (typeof value !== "string" || !UUID.test(value)) throw failure(code);
}

function ensureIdentifier(value, code) {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) throw failure(code);
}

function ensureGeneration(value, code) {
  if (typeof value !== "string" || !GENERATION.test(value)) throw failure(code);
}

function channelName(channel) {
  return `CH${channel}`;
}

function payloadFor(action, payload) {
  exactObject(payload, PAYLOAD_FIELDS[action], "invalid_action_payload");
  if (action === "lighting") {
    if (typeof payload.enabled !== "boolean") throw failure("invalid_lighting_payload");
    if (payload.level !== undefined && (!Number.isInteger(payload.level) || payload.level < 0 || payload.level > 100)) {
      throw failure("invalid_lighting_level");
    }
    return { enabled: payload.enabled, ...(payload.level === undefined ? {} : { level: payload.level }) };
  }
  if (action === "siren") {
    if (typeof payload.enabled !== "boolean") throw failure("invalid_siren_payload");
    const duration = payload.duration_ms ?? MAX_SIREN_PULSE_MS;
    if (payload.enabled && (!Number.isInteger(duration) || duration < 250 || duration > MAX_SIREN_PULSE_MS)) {
      throw failure("invalid_siren_duration");
    }
    if (payload.volume !== undefined && (!Number.isInteger(payload.volume) || payload.volume < 0 || payload.volume > 100)) {
      throw failure("invalid_siren_volume");
    }
    return { enabled: payload.enabled, duration_ms: duration, ...(payload.volume === undefined ? {} : { volume: payload.volume }) };
  }
  if (action === "ptz") {
    if (typeof payload.command !== "string" || !SAFE_PTZ_COMMANDS.has(payload.command)) throw failure("invalid_ptz_command");
    const duration = payload.duration_ms ?? 250;
    if (!Number.isInteger(duration) || duration < 50 || duration > MAX_PTZ_PULSE_MS) throw failure("invalid_ptz_duration");
    if (!Number.isInteger(payload.speed) || payload.speed < 0 || payload.speed > 100) throw failure("invalid_ptz_speed");
    return { command: payload.command, duration_ms: duration, speed: payload.speed };
  }
  throw failure("unsupported_write_contract");
}

function validateEnvelope(request, identity, now) {
  exactObject(request, REQUEST_FIELDS, "invalid_command_request");
  if (request.task_kind !== "physical_command") throw failure("physical_command_required");
  ensureUuid(request.id, "invalid_request_id");
  ensureUuid(request.site_id, "invalid_site_id");
  ensureUuid(request.camera_id, "invalid_camera_id");
  ensureIdentifier(request.stream_id, "invalid_stream_id");
  ensureIdentifier(request.gateway_id, "invalid_gateway_id");
  ensureGeneration(request.source_generation, "invalid_source_generation");
  ensureGeneration(request.binding_generation, "invalid_binding_generation");
  if (!Number.isInteger(request.channel) || request.channel < 1 || request.channel > 64) throw failure("invalid_channel");
  if (!identity?.gatewayId || request.gateway_id !== identity.gatewayId || request.site_id !== identity.siteId) throw failure("source_scope_mismatch");
  if (!Object.hasOwn(ACTIONS, request.action)) throw failure("unsupported_action");
  if (!ACTIONS[request.action].writeContract) throw failure("write_contract_unavailable");
  const requested = parseTime(request.requested_at, "invalid_request_time");
  const expires = parseTime(request.expires_at, "invalid_request_expiry");
  if (requested > now + 5_000 || expires <= now || expires <= requested || expires - requested > CONFIRMATION_MAX_AGE_MS) {
    throw failure("command_request_expired");
  }
  const normalizedPayload = payloadFor(request.action, request.payload);
  const payloadDigest = digest(normalizedPayload);
  if (request.payload_digest !== payloadDigest) throw failure("payload_digest_mismatch");

  const confirmation = exactObject(request.confirmation, CONFIRMATION_FIELDS, "invalid_confirmation");
  ensureUuid(confirmation.id, "invalid_confirmation_id");
  ensureUuid(confirmation.actor_id, "invalid_confirmation_actor");
  if (confirmation.request_id !== request.id || confirmation.gateway_id !== request.gateway_id || confirmation.site_id !== request.site_id || confirmation.camera_id !== request.camera_id ||
      confirmation.stream_id !== request.stream_id || confirmation.channel !== request.channel || confirmation.source_generation !== request.source_generation ||
      confirmation.binding_generation !== request.binding_generation ||
      confirmation.action !== request.action || confirmation.payload_digest !== payloadDigest) throw failure("confirmation_binding_mismatch");
  const confirmed = parseTime(confirmation.confirmed_at, "invalid_confirmation_time");
  const confirmationExpires = parseTime(confirmation.expires_at, "invalid_confirmation_expiry");
  if (confirmed > now + 5_000 || now - confirmed > CONFIRMATION_MAX_AGE_MS || confirmationExpires <= now ||
      confirmationExpires <= confirmed || confirmationExpires - confirmed > CONFIRMATION_MAX_AGE_MS || confirmationExpires > expires) {
    throw failure("confirmation_expired");
  }
  return { normalizedPayload, payloadDigest, expires, confirmationExpires };
}

function validateSource(request, source, now) {
  if (!source || source.kind !== "private_nvr_http_mp4" || source.siteId !== request.site_id ||
      source.cameraId !== request.camera_id || source.streamId !== request.stream_id || source.channel !== request.channel ||
      source.generation !== request.source_generation || source.bindingGeneration !== request.binding_generation ||
      typeof source.recorderId !== "string" || !IDENTIFIER.test(source.recorderId)) {
    throw failure("source_mapping_unavailable");
  }
  const liveVerifiedAt = Date.parse(source.liveVerifiedAt || "");
  if (source.mediaProgressing !== true || !Number.isFinite(liveVerifiedAt) || liveVerifiedAt > now + 5_000 || now - liveVerifiedAt > LIVE_EVIDENCE_MAX_AGE_MS) {
    throw failure("live_media_evidence_unavailable");
  }
}

function validateEvidence(request, evidence, now) {
  const capability = evidence?.[ACTIONS[request.action].evidenceKey];
  if (evidence?.adapter !== DRIVER || evidence.gateway_id !== request.gateway_id || evidence.site_id !== request.site_id ||
      evidence.camera_id !== request.camera_id || evidence.channel !== request.channel || evidence.stream_id !== request.stream_id ||
      evidence.source_generation !== request.source_generation || evidence.binding_generation !== request.binding_generation ||
      capability?.tested !== true || capability?.supported !== true) throw failure("capability_not_verified");
  const verifiedAt = parseTime(evidence.verified_at, "capability_evidence_invalid");
  if (verifiedAt > now + 5_000 || now - verifiedAt > EVIDENCE_MAX_AGE_MS) throw failure("capability_evidence_stale");
  return { capability, verifiedAt };
}

function responseData(response) {
  if (!response || typeof response !== "object") throw failure("device_state_unknown");
  if (response.status === 401 || response.status === 403) throw failure("session_rejected");
  if (response.status < 200 || response.status >= 300 || response.payload?.result === "failed" || response.payload?.error_code || response.payload?.ch_error_code) {
    throw failure("device_command_rejected");
  }
  return response.payload?.data ?? response.payload ?? {};
}

function findPtzCommands(value, output = new Set(), depth = 0) {
  if (depth > 6 || value === null || value === undefined) return output;
  if (typeof value === "string" && /^Ptz_Cmd_[A-Za-z0-9_]{1,80}$/.test(value)) output.add(value);
  else if (Array.isArray(value)) value.forEach((item) => findPtzCommands(item, output, depth + 1));
  else if (typeof value === "object") Object.values(value).forEach((item) => findPtzCommands(item, output, depth + 1));
  return output;
}

function findNamedRange(value, name, depth = 0) {
  if (!value || typeof value !== "object" || depth > 6) return null;
  if (!Array.isArray(value) && value[name] && typeof value[name] === "object") {
    const minimum = Number(value[name].min);
    const maximum = Number(value[name].max);
    if (Number.isFinite(minimum) && Number.isFinite(maximum) && minimum <= maximum) return { minimum, maximum };
  }
  for (const child of Object.values(value)) {
    const found = findNamedRange(child, name, depth + 1);
    if (found) return found;
  }
  return null;
}

function boundedValue(current, requested, rangeKey) {
  if (requested === undefined) return undefined;
  const range = current?.[rangeKey];
  const minimum = Number(range?.min);
  const maximum = Number(range?.max);
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum > maximum) throw failure("device_value_range_unavailable");
  if (requested < minimum || requested > maximum) throw failure("requested_value_out_of_device_range");
  return requested;
}

function alarmPayload(current, request, enabled) {
  if (!current || typeof current !== "object" || Array.isArray(current)) throw failure("device_state_unknown");
  if (request.action === "lighting") {
    if (!Object.hasOwn(current, "floodlight_switch")) throw failure("lighting_state_unavailable");
    const data = { channel: channelName(request.channel), operation_type: "Floodlight", floodlight_switch: enabled };
    if (request.payload.level !== undefined && current.floodlight_value_adjustable !== true) throw failure("lighting_level_unavailable");
    const level = boundedValue(current, request.payload.level, "floodlight_value_range");
    if (level !== undefined) {
      if (!Object.hasOwn(current, "floodlight_value")) throw failure("lighting_level_unavailable");
      data.floodlight_value = level;
    }
    return data;
  }
  if (!Object.hasOwn(current, "audioAlarm_switch")) throw failure("siren_state_unavailable");
  const data = { channel: channelName(request.channel), operation_type: "AudioAlarm", audioAlarm_switch: enabled };
  if (request.payload.volume !== undefined && current.audioAlarm_value_adjustable !== true) throw failure("siren_volume_unavailable");
  const volume = boundedValue(current, request.payload.volume, "audioAlarm_value_range");
  if (volume !== undefined) {
    if (!Object.hasOwn(current, "audioAlarm_value")) throw failure("siren_volume_unavailable");
    data.audioAlarm_value = volume;
  }
  return data;
}

function terminalOutcome(request, phase, auditDigest, code, reportedAt) {
  const acknowledged = phase.ackObserved === true;
  const outcome = acknowledged ? "acknowledged_needs_reconciliation" : "unknown_non_retryable";
  return Object.freeze({
    action: "result",
    request_id: request.id,
    outcome,
    result_code: outcome,
    outcome_payload: {
      request_id: request.id,
      gateway_id: request.gateway_id,
      site_id: request.site_id,
      action: request.action,
      camera_id: request.camera_id,
      stream_id: request.stream_id,
      channel: request.channel,
      source_generation: request.source_generation,
      binding_generation: request.binding_generation,
      executor_installed: true,
      executed: null,
      non_retryable: true,
      phase: {
        write_attempted: true,
        ack_observed: acknowledged,
        state_verified: phase.stateVerified === true
      },
      audit_digest: auditDigest,
      error_code: code,
      reported_at: reportedAt
    }
  });
}

function stateMatches(current, action, enabled, payload) {
  const switchMatches = (value) => (value === true || value === 1) ? enabled === true : (value === false || value === 0) ? enabled === false : false;
  if (action === "lighting") return switchMatches(current?.floodlight_switch) && (payload.level === undefined || Number(current?.floodlight_value) === payload.level);
  return switchMatches(current?.audioAlarm_switch) && (payload.volume === undefined || Number(current?.audioAlarm_value) === payload.volume);
}

function explicitAck(response) {
  responseData(response);
  const result = response?.payload?.result ?? response?.payload?.data?.result ?? response?.payload?.status;
  if (!['success', 'ok', true].includes(result)) throw failure("device_ack_unverified");
  return true;
}

function ensureConfirmationFresh(validation, now) {
  if (now >= Math.min(validation.expires, validation.confirmationExpires)) throw failure("confirmation_expired");
}

export function createPrivateNvrCommandExecutor({
  resolveSource,
  getCapabilityEvidence,
  getSession,
  refreshSession,
  transport,
  audit,
  replay,
  lease,
  now = Date.now,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  timeoutMs = DEFAULT_TIMEOUT_MS
}) {
  if (![resolveSource, getCapabilityEvidence, getSession, refreshSession, audit?.appendIntent, audit?.verifyReceipt, replay?.reserve, replay?.finalize,
    lease?.acquire, lease?.release, transport?.read, transport?.write].every((entry) => typeof entry === "function")) throw failure("executor_dependencies_invalid");

  async function readWithRefresh(session, path, data) {
    const expectedChannel = data.channel;
    let response = await transport.read({ session, path, data, expectedChannel, timeoutMs });
    if (response?.status === 401 || response?.status === 403) {
      session = await refreshSession(session);
      if (!session) throw failure("session_refresh_failed");
      response = await transport.read({ session, path, data, expectedChannel, timeoutMs });
    }
    return { session, data: responseData(response) };
  }

  async function verifiedAlarmWrite(session, request, enabled, { allowExpired = false, continuationStop = false, phase, ensureDispatchAllowed }) {
    const state = await readWithRefresh(session, PATHS.alarmGet, { channel: channelName(request.channel), command_flag: false });
    session = state.session;
    const data = alarmPayload(state.data, request, enabled);
    if (!continuationStop) await ensureDispatchAllowed({ allowExpired });
    phase.writeAttempted = true;
    const written = await transport.write({ session, path: PATHS.alarmSet, data,
      expectedChannel: channelName(request.channel), timeoutMs }).catch((error) => {
      throw failure("device_write_state_unknown", { cause: error?.code || "transport_error" });
    });
    explicitAck(written);
    phase.ackObserved = true;
    const verified = await readWithRefresh(session, PATHS.alarmGet, { channel: channelName(request.channel), command_flag: false });
    if (!stateMatches(verified.data, request.action, enabled, request.payload)) throw failure("device_ack_mismatch");
    phase.stateVerified = true;
    return { session: verified.session, verified: true };
  }

  async function execute(request, identity) {
    const at = now();
    const validation = validateEnvelope(request, identity, at);
    request = Object.freeze({ ...request, payload: validation.normalizedPayload });
    const source = await resolveSource(request.stream_id);
    validateSource(request, source, now());
    const evidence = await getCapabilityEvidence(source, request.action);
    const verifiedEvidence = validateEvidence(request, evidence, now());
    const fingerprint = digest({
      request_id: request.id,
      confirmation_id: request.confirmation.id,
      gateway_id: request.gateway_id,
      site_id: request.site_id,
      camera_id: request.camera_id,
      stream_id: request.stream_id,
      channel: request.channel,
      source_generation: request.source_generation,
      binding_generation: request.binding_generation,
      action: request.action,
      payload_digest: validation.payloadDigest
    });
    const reservation = await replay.reserve({ id: request.id, fingerprint, expires_at: request.expires_at });
    if (reservation?.status !== "reserved") {
      if (reservation?.fingerprint && reservation.fingerprint !== fingerprint) throw failure("request_replay_mismatch");
      throw failure("request_replay_blocked");
    }

    const leaseKey = digest({ recorder_id: source.recorderId, channel: request.channel });
    let leaseResult;
    try {
      leaseResult = await lease.acquire({ key: leaseKey, owner: request.id, ttl_ms: 60_000 });
    } catch {
      await replay.finalize({ id: request.id, fingerprint, state: "failed", non_retryable: false, error_code: "command_lease_unavailable" }).catch(() => {});
      throw failure("command_lease_unavailable");
    }
    if (leaseResult?.status !== "acquired" || typeof leaseResult.lease_id !== "string") {
      await replay.finalize({ id: request.id, fingerprint, state: "failed", non_retryable: false, error_code: "channel_command_in_progress" }).catch(() => {});
      throw failure("channel_command_in_progress");
    }
    const phase = { writeAttempted: false, ackObserved: false, stateVerified: false };

    const intent = Object.freeze({
      schema: "private_nvr_physical_intent_v1",
      request_id: request.id,
      confirmation_id: request.confirmation.id,
      actor_id: request.confirmation.actor_id,
      gateway_id: identity.gatewayId,
      site_id: request.site_id,
      camera_id: request.camera_id,
      stream_id: request.stream_id,
      channel: request.channel,
      recorder_id: source.recorderId,
      source_generation: request.source_generation,
      binding_generation: request.binding_generation,
      action: request.action,
      payload_digest: validation.payloadDigest,
      capability_verified_at: new Date(verifiedEvidence.verifiedAt).toISOString(),
      confirmed_at: request.confirmation.confirmed_at,
      expires_at: request.confirmation.expires_at,
      recorded_at: new Date(now()).toISOString()
    });

    let auditDigest = null;
    try {
      const intentDigest = digest(intent);
      const receipt = await audit.appendIntent(intent, { intent_digest: intentDigest });
      if (!receipt?.immutable || receipt.intent_digest !== intentDigest || typeof receipt.digest !== "string" || !/^[a-f0-9]{64}$/.test(receipt.digest)) {
        throw failure("immutable_audit_binding_mismatch");
      }
      if (await audit.verifyReceipt(receipt, intentDigest, intent) !== true) throw failure("immutable_audit_signature_invalid");
      auditDigest = receipt.digest;
      ensureConfirmationFresh(validation, now());
      let session = await getSession(source);
      if (!session) throw failure("device_session_unavailable");
      const ensureDispatchAllowed = async ({ allowExpired = false } = {}) => {
        if (!allowExpired) ensureConfirmationFresh(validation, now());
        const currentSource = await resolveSource(request.stream_id);
        validateSource(request, currentSource, now());
        if (currentSource.recorderId !== source.recorderId) throw failure("source_mapping_changed");
        if (!allowExpired) ensureConfirmationFresh(validation, now());
      };
      let result;
      if (request.action === "lighting") {
        result = await verifiedAlarmWrite(session, request, request.payload.enabled, {
          allowExpired: request.payload.enabled === false, phase, ensureDispatchAllowed
        });
      } else if (request.action === "siren") {
        if (!request.payload.enabled) result = await verifiedAlarmWrite(session, request, false, { allowExpired: true, phase, ensureDispatchAllowed });
        else {
          let startError = null;
          try {
            const started = await verifiedAlarmWrite(session, request, true, { phase, ensureDispatchAllowed });
            session = started.session;
            await sleep(request.payload.duration_ms);
          } catch (error) {
            startError = error;
          }
          if (phase.writeAttempted) {
            result = await verifiedAlarmWrite(session, request, false, { continuationStop: true, phase, ensureDispatchAllowed }).catch((error) => {
              throw failure("siren_stop_state_unknown", { cause: error?.code || "unknown" });
            });
          }
          if (startError) throw startError;
        }
      } else if (request.action === "ptz") {
        const range = await readWithRefresh(session, PATHS.ptzRange, { channel: channelName(request.channel) });
        session = range.session;
        if (!findPtzCommands(range.data).has(request.payload.command)) throw failure("ptz_command_not_advertised");
        const speedRange = findNamedRange(range.data, "speed");
        if (!speedRange || request.payload.speed < speedRange.minimum || request.payload.speed > speedRange.maximum) throw failure("ptz_speed_not_advertised");
        const common = { channel: channelName(request.channel), cmd: request.payload.command, speed: request.payload.speed };
        let started = false;
        try {
          await ensureDispatchAllowed();
          started = true;
          phase.writeAttempted = true;
          const response = await transport.write({ session, path: PATHS.ptzControl, data: { ...common, state: "Start" },
            expectedChannel: channelName(request.channel), timeoutMs });
          explicitAck(response);
          phase.ackObserved = true;
          await sleep(request.payload.duration_ms);
        } finally {
          if (started) {
            phase.writeAttempted = true;
            const stopped = await transport.write({ session, path: PATHS.ptzControl, data: { ...common, state: "Stop" },
              expectedChannel: channelName(request.channel), timeoutMs }).catch(() => null);
            if (!stopped) throw failure("ptz_stop_state_unknown");
            try { explicitAck(stopped); phase.ackObserved = true; } catch (error) { throw failure("ptz_stop_state_unknown", { cause: error?.code || "unknown" }); }
          }
        }
        result = { verified: true };
      }
      const outcome = Object.freeze({
        action: "result",
        request_id: request.id,
        outcome: "physical_command",
        result_code: "acknowledged",
        outcome_payload: {
          request_id: request.id,
          gateway_id: request.gateway_id,
          site_id: request.site_id,
          action: request.action,
          camera_id: request.camera_id,
          stream_id: request.stream_id,
          channel: request.channel,
          source_generation: request.source_generation,
          binding_generation: request.binding_generation,
          executor_installed: true,
          executed: true,
          ack_kind: request.action === "ptz" ? "explicit_start_stop_ack" : "read_back_state_ack",
          audit_digest: receipt.digest,
          completed_at: new Date(now()).toISOString()
        }
      });
      try {
        await replay.finalize({ id: request.id, fingerprint, state: "acknowledged", non_retryable: true, result: outcome });
      } catch {
        throw failure("acknowledged_needs_reconciliation", { non_retryable: true, phase: { ...phase }, audit_digest: auditDigest });
      }
      return outcome;
    } catch (error) {
      const code = error?.code || "device_state_unknown";
      if (phase.writeAttempted) {
        const state = phase.ackObserved ? "acknowledged_needs_reconciliation" : "unknown_non_retryable";
        const outcome = terminalOutcome(request, phase, auditDigest, code, new Date(now()).toISOString());
        await replay.finalize({ id: request.id, fingerprint, state, non_retryable: true, error_code: code, result: outcome }).catch(() => {});
        return outcome;
      }
      await replay.finalize({ id: request.id, fingerprint, state: "failed", non_retryable: false, error_code: code }).catch(() => {});
      throw error;
    } finally {
      await lease.release({ key: leaseKey, owner: request.id, lease_id: leaseResult.lease_id }).catch(() => {});
    }
  }

  return Object.freeze({ execute });
}

export function publicPrivateNvrControls(evidence, now = Date.now()) {
  const at = typeof now === "function" ? now() : now;
  const liveVerifiedAt = Date.parse(evidence?.live?.verified_at || "");
  const live = evidence?.live?.tested === true && evidence?.live?.media_progressing === true && Number.isFinite(liveVerifiedAt) &&
    at >= liveVerifiedAt - 5_000 && at - liveVerifiedAt <= LIVE_EVIDENCE_MAX_AGE_MS;
  if (!live) return [];
  const result = [];
  for (const [action, contract] of Object.entries(ACTIONS)) {
    const capability = evidence?.[contract.evidenceKey];
    const verifiedAt = Date.parse(evidence?.verified_at || "");
    if (contract.writeContract && evidence?.adapter === DRIVER && capability?.tested === true && capability?.supported === true &&
        Number.isFinite(verifiedAt) && at - verifiedAt <= EVIDENCE_MAX_AGE_MS && at >= verifiedAt - 5_000) result.push(action);
  }
  return result;
}

export const privateNvrCommandContract = Object.freeze({
  version: 12,
  executor_installed: false,
  driver: DRIVER,
  confirmation_max_age_ms: CONFIRMATION_MAX_AGE_MS,
  evidence_max_age_ms: EVIDENCE_MAX_AGE_MS,
  live_evidence_max_age_ms: LIVE_EVIDENCE_MAX_AGE_MS,
  write_paths: Object.freeze([...new Set([PATHS.alarmSet, PATHS.ptzControl])]),
  read_paths: Object.freeze([...new Set([PATHS.alarmGet, PATHS.ptzRange])]),
  supported_actions: Object.freeze(["lighting", "siren", "ptz"]),
  blocked_actions: Object.freeze({ talkback: "vendor_media_transport_not_safely_derived" }),
  limits: Object.freeze({ ptz_pulse_ms: MAX_PTZ_PULSE_MS, siren_pulse_ms: MAX_SIREN_PULSE_MS })
});

export const privateNvrPayloadDigest = digest;
