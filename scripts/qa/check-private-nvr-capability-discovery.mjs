import assert from "node:assert/strict";
import { discoverPrivateNvrCapabilities, privateNvrReadOnlyCapabilityPaths } from "../../services/video-gateway/private-nvr-capabilities.mjs";

assert.ok(privateNvrReadOnlyCapabilityPaths.every((path) => path.endsWith("/Get") || path.endsWith("/Range")), "Capability probe must contain read-only API paths only");
assert.equal(privateNvrReadOnlyCapabilityPaths.some((path) => path.endsWith("/Set") || path.endsWith("/Control")), false, "Capability probe must never include mutation paths");

const payloadByPath = {
  "/API/Login/DeviceInfo/Get": { result: "success", data: { ptz_support: true, support_speaker: true, support_flood_light: true, support_siren_audio: true, local_alarmout_num: 1 } },
  "/API/Login/ChannelInfo/Get": { result: "success", data: { channel_param: [{ channel: "CH1", connect_status: "Online", ability: ["Ptz"] }, { channel: "CH2", connect_status: "Offline" }] } },
  "/API/AlarmConfig/VoiceAlarm/Range": { result: "success", data: { channel_info: { CH1: { siren_switch: { type: "bool" } } } } },
  "/API/PreviewChannel/PTZ/Get": { result: "success", data: { channel: "CH1", ptz_version: "2.0", preset_point: [] } },
  "/API/PreviewChannel/DualTalk/Get": { result: "success", data: { channel: "CH1", speaker: true } },
  "/API/PreviewChannel/Floodlight2AudioAlarm/Get": { result: "success", data: { channel: "CH1", floodlight_switch: false, audioAlarm_switch: false } },
  "/API/PreviewChannel/ManualAlarm/Get": { result: "success", data: { channel: "CH1", alarm_out: ["Local->1"] } }
};

const calls = [];
const fetchImpl = async (url, options) => {
  const path = new URL(url).pathname;
  calls.push({ path, method: options.method, body: JSON.parse(options.body) });
  return { ok: true, json: async () => payloadByPath[path] || { result: "failed" } };
};

const result = await discoverPrivateNvrCapabilities({
  session: { baseUrl: "http://local.invalid", token: "redacted", cookie: "redacted" },
  channels: [1],
  fetchImpl,
  timeoutMs: 1000
});
const channel = result.get(1);
for (const capability of ["ptz", "talkback", "audio_output", "light", "siren", "relay"]) {
  assert.equal(channel[capability].tested, true, `${capability} must carry tested evidence`);
  assert.equal(channel[capability].supported, true, `${capability} fixture must be supported`);
}
assert.ok(calls.every((call) => call.method === "POST" && (call.path.endsWith("/Get") || call.path.endsWith("/Range"))), "Only read-only capability requests may be sent");
assert.ok(calls.every((call) => call.body.version === "1.0" && typeof call.body.data === "object"), "Vendor requests must use the documented envelope");

// Device-wide advertising and a successful empty/wrong-channel response must
// never unlock controls. These fixtures issue no real network requests.
for (const responseData of [{}, { capability: { channel: "CH2", ptz_version: "2", speaker: true } },
  { channel: "CH2", ptz_version: "2", speaker: true, floodlight_switch: false, audioAlarm_switch: false, alarm_out: ["output"] },
  { channel_info: { CH2: { ptz_version: "2", speaker: true, floodlight_switch: true } } }]) {
  const probe = await discoverPrivateNvrCapabilities({ session: { baseUrl: "http://local.invalid", token: "synthetic" }, channels: [1],
    fetchImpl: async (url) => ({ ok: true, json: async () => new URL(url).pathname.startsWith("/API/PreviewChannel/")
      ? { result: "success", data: responseData } : payloadByPath[new URL(url).pathname] }) });
  for (const name of ["ptz", "talkback", "audio_output", "light", "siren", "relay"]) {
    assert.equal(probe.get(1)[name].supported, false, `${name}: no per-channel evidence must fail closed`);
  }
}

const isolated = await discoverPrivateNvrCapabilities({ session: { baseUrl: "http://local.invalid", token: "synthetic" }, channels: [1, 2],
  fetchImpl: async (url, options) => {
    const path = new URL(url).pathname;
    if (path.startsWith("/API/PreviewChannel/") && JSON.parse(options.body).data.channel === "CH2") throw new Error("synthetic_offline");
    return { ok: true, json: async () => payloadByPath[path] };
  } });
assert.equal(isolated.get(1).ptz.supported, true);
assert.equal(isolated.get(2).ptz.supported, false);
assert.equal(isolated.get(2).siren.supported, false);

console.log("Private NVR read-only capability discovery checks passed.");
