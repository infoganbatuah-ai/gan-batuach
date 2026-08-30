import { createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";

const keychainService = process.env.GAN_BATUACH_GATEWAY_KEYCHAIN_SERVICE || "com.ganbatuach.video-gateway.runtime";
const readOnlyPaths = new Set([
  "/API/StorageConfig/Disk/Get",
  "/API/SystemInfo/Record/Get",
  "/API/RecordConfig/Get",
  "/API/Schedules/Record/Get",
  "/API/Playback/SearchRecord/Search",
  "/API/Maintenance/Log/Search"
]);

function keychainValue(account) {
  const result = execFileSync("/usr/bin/security", ["find-generic-password", "-s", keychainService, "-a", account, "-w"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  });
  return result.trim();
}

function cleanHost(value) {
  return String(value || "").trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "").replace(/:\d+$/, "");
}

function parseDigestChallenge(value) {
  const fields = {};
  for (const match of String(value || "").replace(/^Digest\s+/i, "").matchAll(/([a-z0-9_-]+)=(?:"([^"]*)"|([^,\s]+))/gi)) {
    fields[match[1].toLowerCase()] = match[2] ?? match[3] ?? "";
  }
  return fields;
}

function digestHex(algorithm, value) {
  return createHash(String(algorithm || "MD5").toUpperCase() === "SHA-256" ? "sha256" : "md5").update(value, "utf8").digest("hex");
}

async function login(baseUrl, username, password) {
  const uri = "/API/Web/Login";
  const body = JSON.stringify({ data: { remote_terminal_info: "GATEWAY_DIAGNOSTIC_READ_ONLY" } });
  const common = { method: "POST", headers: { "content-type": "application/json", "x-requested-with": "XMLHttpRequest" }, body, signal: AbortSignal.timeout(8000) };
  let response = await fetch(`${baseUrl}${uri}`, common);
  if (response.status === 401) {
    const challenge = parseDigestChallenge(response.headers.get("www-authenticate"));
    if (!challenge.realm || !challenge.nonce) throw new Error("dvr_auth_challenge_missing");
    const qop = String(challenge.qop || "auth").split(",")[0].trim();
    const nc = "00000001";
    const cnonce = randomBytes(8).toString("hex");
    const ha1 = digestHex(challenge.algorithm, `${username}:${challenge.realm}:${password}`);
    const ha2 = digestHex(challenge.algorithm, `POST:${uri}`);
    const digestResponse = digestHex(challenge.algorithm, `${ha1}:${challenge.nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
    const authorization = [
      `Digest username="${String(username).replaceAll('"', "")}"`, `realm="${challenge.realm}"`, `nonce="${challenge.nonce}"`,
      `uri="${uri}"`, `response="${digestResponse}"`, `opaque="${challenge.opaque || ""}"`, `qop=${qop}`, `nc=${nc}`,
      `cnonce="${cnonce}"`, challenge.algorithm ? `algorithm="${challenge.algorithm}"` : ""
    ].filter(Boolean).join(", ");
    response = await fetch(`${baseUrl}${uri}`, { ...common, headers: { ...common.headers, authorization } });
  }
  if (!response.ok) throw new Error(`dvr_login_failed_${response.status}`);
  const token = String(response.headers.get("x-csrftoken") || "").split(",")[0].trim();
  const cookie = String(response.headers.get("set-cookie") || "").split(";")[0].trim();
  if (!token) throw new Error("dvr_session_token_missing");
  return { token, cookie };
}

async function readOnlyPost(baseUrl, session, path, data = {}) {
  if (!readOnlyPaths.has(path) || !/(?:\/Get|\/Search)$/.test(path)) throw new Error("non_read_only_path_blocked");
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-csrftoken": session.token, ...(session.cookie ? { cookie: session.cookie } : {}) },
    body: JSON.stringify({ version: "1.0", data }),
    signal: AbortSignal.timeout(8000)
  }).catch(() => null);
  if (!response?.ok) return { supported: false, data: null };
  const payload = await response.json().catch(() => null);
  if (!payload || String(payload.result || "").toLowerCase() === "failed") return { supported: false, data: null };
  return { supported: true, data: payload.data || payload };
}

function channelEntries(value) {
  const source = value?.channel_info && typeof value.channel_info === "object" ? value.channel_info : {};
  return Object.entries(source).filter(([key, row]) => /^(?:CH|IP_CH|WIFI_CH)\d+$/i.test(key) && row && typeof row === "object");
}

function scheduleEnabled(row) {
  const categories = Array.isArray(row?.category) ? row.category : [];
  return categories.some((category) => Array.isArray(category?.week) && category.week.some((day) => Array.isArray(day?.time) && day.time.some((slot) => Number(slot) > 0)));
}

function scheduleEnabledNow(row, now = new Date()) {
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = dayNames[now.getDay()];
  const slot = Math.min(47, Math.floor(((now.getHours() * 60) + now.getMinutes()) / 30));
  const categories = Array.isArray(row?.category) ? row.category : [];
  return categories.some((category) => {
    const day = Array.isArray(category?.week) ? category.week.find((item) => String(item?.day || "").toLowerCase() === dayName.toLowerCase()) : null;
    return Array.isArray(day?.time) && Number(day.time[slot]) > 0;
  });
}

function diskSummary(data) {
  const disks = Array.isArray(data?.disk_info) ? data.disk_info : [];
  return {
    detected: disks.length,
    overwrite: data?.over_write ?? null,
    disks: disks.map((disk, index) => ({
      number: Number(disk.display_id || disk.id || index + 1),
      status: String(disk.status || "unknown"),
      type: String(disk.device_type || disk.disk_type || "unknown"),
      total_mb: Number(disk.total_size || 0),
      free_mb: Number(disk.free_size || 0)
    }))
  };
}

function recordingSummary(config, status, schedule, now) {
  const configRows = channelEntries(config);
  const statusMap = new Map(channelEntries(status));
  const scheduleMap = new Map(channelEntries(schedule));
  return configRows.map(([channel, row]) => ({
    channel,
    record_switch: row.record_switch === true,
    record_state: String(statusMap.get(channel)?.record_state || "unknown"),
    schedule_configured: scheduleEnabled(scheduleMap.get(channel)),
    schedule_active_now: scheduleEnabledNow(scheduleMap.get(channel), now)
  }));
}

function recordingSegmentCount(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 8) return 0;
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + recordingSegmentCount(item, depth + 1), 0);
  const keys = new Set(Object.keys(value).map((key) => key.toLowerCase()));
  const looksLikeSegment = (keys.has("start_time") || keys.has("starttime")) && (keys.has("end_time") || keys.has("endtime") || keys.has("record_id"));
  return Number(looksLikeSegment) + Object.values(value).reduce((sum, item) => sum + recordingSegmentCount(item, depth + 1), 0);
}

function recentErrors(data) {
  const rows = Array.isArray(data?.log_info) ? data.log_info : Array.isArray(data?.log_list) ? data.log_list : Array.isArray(data) ? data : [];
  return rows.slice(0, 50).map((row) => ({
    type: String(row.sub_type || row.main_type || row.event || "unknown"),
    result: String(row.result_code || row.result || "unknown")
  })).filter((row) => /disk|hdd|record|space|storage|error|fail|no_hdd/i.test(`${row.type} ${row.result}`)).slice(0, 10);
}

function datePart(date) {
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
}

const profile = JSON.parse(keychainValue("dvr_profile_json"));
const password = keychainValue("dvr_password");
const host = cleanHost(profile.endpoint);
const port = Number(profile.port || 80);
if (!host || !profile.username || !password) throw new Error("dvr_keychain_profile_incomplete");
const baseUrl = `http://${host}:${port}`;
const session = await login(baseUrl, String(profile.username), password);
const now = new Date();
const start = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
const [disk, recordStatus, recordConfig, recordSchedule, playbackSearch, logs] = await Promise.all([
  readOnlyPost(baseUrl, session, "/API/StorageConfig/Disk/Get"),
  readOnlyPost(baseUrl, session, "/API/SystemInfo/Record/Get"),
  readOnlyPost(baseUrl, session, "/API/RecordConfig/Get"),
  readOnlyPost(baseUrl, session, "/API/Schedules/Record/Get"),
  readOnlyPost(baseUrl, session, "/API/Playback/SearchRecord/Search", {
    channel: Array.from({ length: Number(profile.channel_count || 16) }, (_, index) => index),
    start_date: datePart(start), start_time: "00:00:00", end_date: datePart(now), end_time: "23:59:59",
    record_type: 4294967295, stream_mode: "Mainstream", smart_region: [], enable_smart_search: 0
  }),
  readOnlyPost(baseUrl, session, "/API/Maintenance/Log/Search", {
    start_date: datePart(start), end_date: datePart(now), start_time: "00:00:00", end_time: "23:59:59", main_type: "All", sub_type: "All"
  })
]);
const recording = recordingSummary(recordConfig.data, recordStatus.data, recordSchedule.data, now);
console.log(JSON.stringify({
  ui_url: baseUrl,
  read_only: true,
  probes: {
    disk: disk.supported,
    record_status: recordStatus.supported,
    record_config: recordConfig.supported,
    record_schedule: recordSchedule.supported,
    playback_search: playbackSearch.supported,
    recent_logs: logs.supported
  },
  storage: diskSummary(disk.data),
  recording: {
    channels_reported: recording.length,
    enabled_channels: recording.filter((row) => row.record_switch).length,
    actively_recording_channels: recording.filter((row) => /on|recording/i.test(row.record_state)).length,
    channels_with_schedule_configured: recording.filter((row) => row.schedule_configured).length,
    channels_scheduled_now: recording.filter((row) => row.schedule_active_now).length,
    recording_segments_last_7_days: recordingSegmentCount(playbackSearch.data),
    channels: recording
  },
  recent_recording_or_storage_errors: recentErrors(logs.data)
}, null, 2));
