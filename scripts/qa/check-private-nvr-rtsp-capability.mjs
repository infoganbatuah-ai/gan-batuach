import { spawnSync } from "node:child_process";
import { parseProbeResult } from "../../services/video-gateway/probe-result.mjs";

const keychainService = "com.ganbatuach.video-gateway.runtime";

function keychain(account) {
  const result = spawnSync("/usr/bin/security", ["find-generic-password", "-s", keychainService, "-a", account, "-w"], { encoding: "utf8" });
  if (result.status !== 0 || !result.stdout.trim()) throw new Error(`Missing local Gateway material: ${account}`);
  return result.stdout.trim();
}

function endpointHost(value) {
  const parsed = new URL(value.includes("://") ? value : `rtsp://${value}`);
  return parsed.hostname;
}

function encode(value) {
  return encodeURIComponent(value).replace(/%3A/gi, ":");
}

function probe(url) {
  const result = spawnSync("ffprobe", [
    "-v", "error",
    "-rtsp_transport", "tcp",
    "-timeout", "4000000",
    "-select_streams", "v:0",
    "-show_entries", "stream=codec_type",
    "-of", "json",
    url
  ], { encoding: "utf8", timeout: 5_000, stdio: ["ignore", "pipe", "ignore"] });
  if (result.error?.code === "ETIMEDOUT") return false;
  if (result.status !== 0) return false;
  return parseProbeResult(result.stdout || "").ok;
}

const profile = JSON.parse(keychain("dvr_profile_json"));
const password = keychain("dvr_password");
const host = endpointHost(String(profile.endpoint || ""));
const port = Number(profile.port || 554);
const username = encode(String(profile.username || ""));
const credentials = username || password ? `${username}:${encode(password)}@` : "";
const channel = 1;
const candidates = [
  { template: "private_nvr_rtsp_relay", url: `rtsp://${host}:${port}/user=${username}&password=${encode(password)}&channel=${channel}&stream=1.sdp?` },
  { template: "private_nvr_rtsp_streaming", url: `rtsp://${credentials}${host}:${port}/rtsp/streaming?channel=${String(channel).padStart(2, "0")}&subtype=1` },
  { template: "private_nvr_streaming_channels", url: `rtsp://${credentials}${host}:${port}/Streaming/Channels/${channel}02` },
  { template: "private_nvr_realmonitor", url: `rtsp://${credentials}${host}:${port}/cam/realmonitor?channel=${channel}&subtype=1` },
  { template: "private_nvr_channel_stream_type", url: `rtsp://${credentials}${host}:${port}/chID=${channel}&streamType=sub` }
];

const supported = candidates.filter((candidate) => probe(candidate.url)).map((candidate) => candidate.template);
console.log(JSON.stringify({
  read_only: true,
  channel_probe_count: 1,
  rtsp_supported: supported.length > 0,
  supported_templates: supported,
  no_credentials_logged: true,
  no_private_endpoint_logged: true
}));
