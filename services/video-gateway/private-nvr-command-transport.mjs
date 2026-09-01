const ALLOWED_READ_PATHS = new Set([
  "/API/PreviewChannel/Floodlight2AudioAlarm/Get",
  "/API/PreviewChannel/PTZ/Range"
]);
const ALLOWED_WRITE_PATHS = new Set([
  "/API/PreviewChannel/Floodlight2AudioAlarm/Set",
  "/API/PreviewChannel/PTZ/Control"
]);
const CHANNEL = /^CH(?:[1-9]|[1-5][0-9]|6[0-4])$/;
const SAFE_PTZ_COMMANDS = new Set([
  "Ptz_Cmd_Up", "Ptz_Cmd_Down", "Ptz_Cmd_Left", "Ptz_Cmd_Right",
  "Ptz_Cmd_UpLeft", "Ptz_Cmd_UpRight", "Ptz_Cmd_DownLeft", "Ptz_Cmd_DownRight",
  "Ptz_Cmd_ZoomMinus", "Ptz_Cmd_ZoomAdd", "Ptz_Cmd_FocusMinus", "Ptz_Cmd_FocusAdd"
]);
const FLOODLIGHT_WRITE_FIELDS = new Set(["channel", "operation_type", "floodlight_switch", "floodlight_value"]);
const AUDIO_ALARM_WRITE_FIELDS = new Set(["channel", "operation_type", "audioAlarm_switch", "audioAlarm_value"]);

function blocked(code) {
  throw Object.assign(new Error(code), { code });
}

function exactObject(value, fields) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((key) => !fields.has(key))) blocked("invalid_vendor_payload");
}

function exactChannel(data, expectedChannel) {
  if (!CHANNEL.test(expectedChannel || "") || data.channel !== expectedChannel) blocked("vendor_channel_binding_mismatch");
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function validateAlarm(data, expectedChannel) {
  if (!["Floodlight", "AudioAlarm"].includes(data.operation_type)) blocked("invalid_vendor_operation");
  const floodlight = data.operation_type === "Floodlight";
  exactObject(data, floodlight ? FLOODLIGHT_WRITE_FIELDS : AUDIO_ALARM_WRITE_FIELDS);
  exactChannel(data, expectedChannel);
  const switchKey = floodlight ? "floodlight_switch" : "audioAlarm_switch";
  const valueKey = floodlight ? "floodlight_value" : "audioAlarm_value";
  if (typeof data[switchKey] !== "boolean") blocked("invalid_vendor_operation_payload");
  if (data[valueKey] !== undefined && (!finiteNumber(data[valueKey]) || data[valueKey] < 0 || data[valueKey] > 100)) {
    blocked("invalid_vendor_field_type");
  }
}

function validatePayload(path, data, expectedChannel) {
  if (path === "/API/PreviewChannel/Floodlight2AudioAlarm/Get") {
    exactObject(data, new Set(["channel", "command_flag"]));
    exactChannel(data, expectedChannel);
    if (data.command_flag !== false) blocked("invalid_vendor_read_payload");
    return;
  }
  if (path === "/API/PreviewChannel/PTZ/Range") {
    exactObject(data, new Set(["channel"]));
    exactChannel(data, expectedChannel);
    return;
  }
  if (path === "/API/PreviewChannel/Floodlight2AudioAlarm/Set") return validateAlarm(data, expectedChannel);
  if (path === "/API/PreviewChannel/PTZ/Control") {
    exactObject(data, new Set(["channel", "cmd", "state", "speed"]));
    exactChannel(data, expectedChannel);
    if (!SAFE_PTZ_COMMANDS.has(data.cmd) || !["Start", "Stop"].includes(data.state) || !Number.isInteger(data.speed) || data.speed < 0 || data.speed > 100) blocked("invalid_vendor_ptz_payload");
    return;
  }
  blocked("vendor_path_blocked");
}

function requestBody(path, data, expectedChannel) {
  if (!data || typeof data !== "object" || Array.isArray(data)) blocked("invalid_vendor_payload");
  validatePayload(path, data, expectedChannel);
  const serialized = JSON.stringify({ version: "1.0", data });
  if (Buffer.byteLength(serialized, "utf8") > 16_384) blocked("vendor_payload_too_large");
  return serialized;
}

async function request({ session, path, data, expectedChannel, timeoutMs, write, fetchImpl }) {
  if (!session?.baseUrl || !session?.token) blocked("device_session_unavailable");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 10_000) blocked("invalid_vendor_timeout");
  if (!(write ? ALLOWED_WRITE_PATHS : ALLOWED_READ_PATHS).has(path)) blocked("vendor_path_blocked");
  const response = await fetchImpl(`${session.baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrftoken": session.token,
      ...(session.cookie ? { cookie: session.cookie } : {})
    },
    body: requestBody(path, data, expectedChannel),
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs)
  });
  const payload = await response.json().catch(() => null);
  return { status: response.status, payload };
}

export function createPrivateNvrCommandTransport({ fetchImpl = fetch } = {}) {
  return Object.freeze({
    read: (options) => request({ ...options, write: false, fetchImpl }),
    write: (options) => request({ ...options, write: true, fetchImpl })
  });
}

export const privateNvrCommandTransportPaths = Object.freeze({
  read: Object.freeze([...ALLOWED_READ_PATHS]),
  write: Object.freeze([...ALLOWED_WRITE_PATHS])
});
