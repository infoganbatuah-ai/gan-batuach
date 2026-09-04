const ADAPTER = "private_nvr_http_api_v1";

const READ_ONLY_PATHS = new Set([
  "/API/Login/DeviceInfo/Get",
  "/API/Login/ChannelInfo/Get",
  "/API/AlarmConfig/VoiceAlarm/Range",
  "/API/PreviewChannel/PTZ/Get",
  "/API/PreviewChannel/DualTalk/Get",
  "/API/PreviewChannel/Floodlight2AudioAlarm/Get",
  "/API/PreviewChannel/ManualAlarm/Get"
]);

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function truthyField(value) {
  return value === true || value === 1 || value === "1" || String(value).toLowerCase() === "true";
}

function containsKey(value, keys, depth = 0) {
  if (!value || typeof value !== "object" || depth > 5) return false;
  if (Array.isArray(value)) return value.some((item) => containsKey(item, keys, depth + 1));
  return Object.entries(value).some(([key, child]) => keys.has(key) || containsKey(child, keys, depth + 1));
}

function channelNames(channel) {
  return [`CH${channel}`, `IP_CH${channel}`, `WIFI_CH${channel}`];
}

function findChannelRecord(value, channel) {
  if (!value || typeof value !== "object") return null;
  const names = new Set(channelNames(channel));
  const queue = [value];
  let visited = 0;
  while (queue.length && visited < 500) {
    visited += 1;
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;
    if (!Array.isArray(current)) {
      for (const name of names) {
        if (current[name] && typeof current[name] === "object") return current[name];
      }
      const currentChannel = String(current.channel || current.name || "").toUpperCase();
      if (names.has(currentChannel)) return current;
    }
    queue.push(...Object.values(current).filter((item) => item && typeof item === "object"));
  }
  return null;
}

function advertisedChannelCapability(channelInfo, channel, capability) {
  const record = findChannelRecord(channelInfo, channel);
  if (!record) return false;
  const text = JSON.stringify(record).toLowerCase();
  if (capability === "ptz") return text.includes("ptz") && !text.includes('"ptz":false');
  if (capability === "talkback") return text.includes("dualtalk") || text.includes("talkback") || text.includes("speaker");
  return false;
}

async function privateNvrRead(session, path, data, fetchImpl, timeoutMs) {
  if (!READ_ONLY_PATHS.has(path)) throw new Error("private_nvr_non_read_only_path_blocked");
  const response = await fetchImpl(`${session.baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-csrftoken": session.token,
      ...(session.cookie ? { cookie: session.cookie } : {})
    },
    body: JSON.stringify({ version: "1.0", data: data || {} }),
    signal: AbortSignal.timeout(timeoutMs)
  }).catch(() => null);
  if (!response?.ok) return { tested: false, data: null };
  const payload = await response.json().catch(() => null);
  if (!payload || payload.result === "failed") return { tested: false, data: null };
  return { tested: true, data: objectValue(payload.data || payload) };
}

function capability(tested, supported, reason) {
  return { tested: Boolean(tested), supported: Boolean(tested && supported), reason };
}

async function mapWithConcurrency(values, limit, mapper) {
  const result = new Array(values.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      result[index] = await mapper(values[index], index);
    }
  });
  await Promise.all(workers);
  return result;
}

export async function discoverPrivateNvrCapabilities({
  session,
  channels,
  fetchImpl = fetch,
  timeoutMs = 3500
}) {
  const [deviceInfoResult, channelInfoResult, voiceAlarmRangeResult] = await Promise.all([
    privateNvrRead(session, "/API/Login/DeviceInfo/Get", {}, fetchImpl, timeoutMs),
    privateNvrRead(session, "/API/Login/ChannelInfo/Get", {}, fetchImpl, timeoutMs),
    privateNvrRead(session, "/API/AlarmConfig/VoiceAlarm/Range", {}, fetchImpl, timeoutMs)
  ]);
  const deviceInfo = objectValue(deviceInfoResult.data);
  const channelInfo = objectValue(channelInfoResult.data);
  const voiceAlarmRange = objectValue(voiceAlarmRangeResult.data);
  const result = new Map();
  const channelResults = await mapWithConcurrency(channels, 4, async (channel) => {
    const channelName = `CH${channel}`;
    const ptzAdvertised = truthyField(deviceInfo.ptz_support) || advertisedChannelCapability(channelInfo, channel, "ptz");
    const talkAdvertised = truthyField(deviceInfo.support_speaker) || advertisedChannelCapability(channelInfo, channel, "talkback");
    const lightAdvertised = truthyField(deviceInfo.support_flood_light);
    const sirenAdvertised = truthyField(deviceInfo.support_siren_audio)
      || containsKey(findChannelRecord(voiceAlarmRange, channel), new Set(["siren_switch", "siren_time", "siren_value"]));
    const relayAdvertised = Number(deviceInfo.local_alarmout_num || 0) > 0;

    const [ptzResult, talkResult, alarmResult, relayResult] = await Promise.all([
      ptzAdvertised
        ? privateNvrRead(session, "/API/PreviewChannel/PTZ/Get", { channel: channelName }, fetchImpl, timeoutMs)
        : Promise.resolve({ tested: deviceInfoResult.tested || channelInfoResult.tested, data: null }),
      talkAdvertised
        ? privateNvrRead(session, "/API/PreviewChannel/DualTalk/Get", { channel: channelName }, fetchImpl, timeoutMs)
        : Promise.resolve({ tested: deviceInfoResult.tested || channelInfoResult.tested, data: null }),
      lightAdvertised || sirenAdvertised
        ? privateNvrRead(session, "/API/PreviewChannel/Floodlight2AudioAlarm/Get", { channel: channelName, command_flag: false }, fetchImpl, timeoutMs)
        : Promise.resolve({ tested: deviceInfoResult.tested || voiceAlarmRangeResult.tested, data: null }),
      relayAdvertised
        ? privateNvrRead(session, "/API/PreviewChannel/ManualAlarm/Get", { channel: channelName }, fetchImpl, timeoutMs)
        : Promise.resolve({ tested: deviceInfoResult.tested, data: null })
    ]);

    const ptzSupported = ptzResult.tested && (ptzAdvertised || containsKey(ptzResult.data, new Set(["ptz_version", "preset_point", "isctl"])));
    const talkSupported = talkResult.tested && (talkAdvertised || containsKey(talkResult.data, new Set(["dualtalk", "talkback", "speaker", "audio_format"])));
    const lightSupported = alarmResult.tested && (lightAdvertised || containsKey(alarmResult.data, new Set(["floodlight_switch", "floodlight_value", "redBlueLight_switch"])));
    const sirenSupported = (alarmResult.tested && containsKey(alarmResult.data, new Set(["audioAlarm_switch", "audioAlarm_value"])))
      || (voiceAlarmRangeResult.tested && sirenAdvertised);
    const relaySupported = relayResult.tested && (relayAdvertised || containsKey(relayResult.data, new Set(["alarm_out", "manual_alarm", "alarm_switch"])));

    return [channel, {
      adapter: ADAPTER,
      ptz: capability(ptzResult.tested, ptzSupported, ptzSupported ? "ptz_get_verified" : "ptz_not_reported"),
      talkback: capability(talkResult.tested, talkSupported, talkSupported ? "dual_talk_get_verified" : "talkback_not_reported"),
      audio_output: capability(talkResult.tested || alarmResult.tested, talkSupported || sirenSupported, talkSupported || sirenSupported ? "camera_audio_output_verified" : "audio_output_not_reported"),
      light: capability(alarmResult.tested, lightSupported, lightSupported ? "floodlight_get_verified" : "light_not_reported"),
      siren: capability(alarmResult.tested || voiceAlarmRangeResult.tested, sirenSupported, sirenSupported ? "siren_range_verified" : "siren_not_reported"),
      relay: capability(relayResult.tested, relaySupported, relaySupported ? "manual_alarm_get_verified" : "relay_not_reported")
    }];
  });
  for (const [channel, capabilities] of channelResults) result.set(channel, capabilities);
  return result;
}

export const privateNvrReadOnlyCapabilityPaths = [...READ_ONLY_PATHS];
