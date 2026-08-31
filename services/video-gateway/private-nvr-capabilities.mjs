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
  const names = capability === "ptz" ? new Set(["ptz"]) : new Set(["dualtalk", "talkback", "speaker"]);
  const abilities = Array.isArray(record.ability) ? record.ability : [];
  return abilities.some((value) => typeof value === "string" && names.has(value.toLowerCase()))
    || hasField(record, names, truthyField);
}

function hasField(value, keys, accepts, depth = 0) {
  if (!value || typeof value !== "object" || depth > 5) return false;
  return Object.entries(value).some(([key, child]) => (keys.has(key.toLowerCase()) && accepts(child))
    || hasField(child, keys, accepts, depth + 1));
}

function channelEvidence(value, channel) {
  const scoped = findChannelRecord(value, channel);
  if (scoped) return scoped;
  const record = objectValue(value);
  // A successful GET for another channel is not evidence for this one.
  if (hasChannelReference(record)) return {};
  if (record.channel_info || record.channel_param) return {};
  return record;
}

function hasChannelReference(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 5) return false;
  return Object.entries(value).some(([key, child]) => key === "channel"
    || (key === "name" && /^(?:CH|IP_CH|WIFI_CH)\d+$/i.test(String(child)))
    || /^(?:CH|IP_CH|WIFI_CH)\d+$/i.test(key)
    || hasChannelReference(child, depth + 1));
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
  if (!payload || ["failed", "error", "unsupported"].includes(String(payload.result || "").toLowerCase())) return { tested: false, data: null };
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

    const ptzData = channelEvidence(ptzResult.data, channel);
    const talkData = channelEvidence(talkResult.data, channel);
    const alarmData = channelEvidence(alarmResult.data, channel);
    const relayData = channelEvidence(relayResult.data, channel);
    const nonempty = (value) => typeof value === "string" && value.trim().length > 0;
    const switchValue = (value) => typeof value === "boolean" || [0, 1, "0", "1"].includes(value);
    const ptzSupported = ptzResult.tested && (hasField(ptzData, new Set(["ptz_version"]), nonempty)
      || hasField(ptzData, new Set(["preset_point"]), Array.isArray)
      || hasField(ptzData, new Set(["isctl"]), truthyField));
    const talkSupported = talkResult.tested && (hasField(talkData, new Set(["dualtalk", "talkback", "speaker"]), truthyField)
      || hasField(talkData, new Set(["audio_format"]), nonempty));
    const lightSupported = alarmResult.tested && hasField(alarmData, new Set(["floodlight_switch", "redbluelight_switch"]), switchValue);
    const sirenSupported = alarmResult.tested && hasField(alarmData, new Set(["audioalarm_switch"]), switchValue);
    const relaySupported = relayResult.tested && (hasField(relayData, new Set(["alarm_out"]), (value) => Array.isArray(value) && value.length > 0)
      || hasField(relayData, new Set(["manual_alarm", "alarm_switch"]), switchValue));

    return [channel, {
      adapter: ADAPTER,
      ptz: capability(ptzResult.tested, ptzSupported, ptzSupported ? "ptz_get_verified" : "ptz_not_reported"),
      talkback: capability(talkResult.tested, talkSupported, talkSupported ? "dual_talk_get_verified" : "talkback_not_reported"),
      audio_output: capability(talkResult.tested || alarmResult.tested, talkSupported || sirenSupported, talkSupported || sirenSupported ? "camera_audio_output_verified" : "audio_output_not_reported"),
      light: capability(alarmResult.tested, lightSupported, lightSupported ? "floodlight_get_verified" : "light_not_reported"),
      siren: capability(alarmResult.tested, sirenSupported, sirenSupported ? "siren_get_verified" : "siren_not_reported"),
      relay: capability(relayResult.tested, relaySupported, relaySupported ? "manual_alarm_get_verified" : "relay_not_reported")
    }];
  });
  for (const [channel, capabilities] of channelResults) result.set(channel, capabilities);
  return result;
}

export const privateNvrReadOnlyCapabilityPaths = [...READ_ONLY_PATHS];
