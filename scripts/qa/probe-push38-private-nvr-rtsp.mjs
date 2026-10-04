// Bounded read-only RTSP capability probe for the installed Home DVR.
// Credentials are read locally, sent to ffprobe over stdin, and never emitted.
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { createEdgeSecretStoreSync } from "../../services/video-gateway/edge-secret-store-sync.mjs";

const output = resolve(process.argv.find((value) => value.startsWith("--output="))?.slice(9) || ".");
const probeAll = process.argv.includes("--all");
const restricted = `${realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
if (!output.startsWith(restricted) || existsSync(output)) {
  throw new Error("P38_RTSP_PROBE_RESTRICTED_NEW_OUTPUT_REQUIRED");
}

const store = createEdgeSecretStoreSync({
  keychainService: "com.ganbatuach.video-gateway.runtime"
});
const profile = JSON.parse(store.read("dvr_profile_json"));
const password = store.read("dvr_password");
if (!profile?.endpoint || !profile?.username || !password) {
  throw new Error("P38_RTSP_PROBE_PROFILE_UNAVAILABLE");
}
const endpoint = new URL(String(profile.endpoint).includes("://")
  ? profile.endpoint : `http://${profile.endpoint}`);
if (endpoint.username || endpoint.password || !["http:", "https:"].includes(endpoint.protocol)) {
  throw new Error("P38_RTSP_PROBE_ENDPOINT_INVALID");
}
const host = endpoint.hostname;
const configuredPort = Number(profile.port || endpoint.port || (endpoint.protocol === "https:" ? 443 : 80));
const ports = [...new Set([configuredPort, 554])].filter((port) =>
  Number.isInteger(port) && port > 0 && port <= 65535);
const channel = 1;
const quality = profile.stream_quality === "main" ? "main" : "sub";
const subtype = quality === "main" ? 0 : 1;
const encodedUser = encodeURIComponent(String(profile.username));
const encodedPassword = encodeURIComponent(String(password));
const auth = `${encodedUser}:${encodedPassword}@`;

function candidates(port) {
  const queryAuth = `user=${encodedUser}&password=${encodedPassword}&channel=${channel}&stream=${subtype}.sdp?`;
  return [
    { template: "private_nvr_rtsp_relay", url: `rtsp://${host}:${port}/${queryAuth}` },
    { template: "private_nvr_rtsp_streaming", url: `rtsp://${auth}${host}:${port}/rtsp/streaming?channel=01&subtype=${subtype}` },
    { template: "private_nvr_streaming_channels", url: `rtsp://${auth}${host}:${port}/Streaming/Channels/${channel}${quality === "main" ? "01" : "02"}` },
    { template: "private_nvr_realmonitor", url: `rtsp://${auth}${host}:${port}/cam/realmonitor?channel=${channel}&subtype=${subtype}` },
    { template: "private_nvr_channel_stream_type", url: `rtsp://${auth}${host}:${port}/chID=${channel}&streamType=${quality === "main" ? "main" : "sub"}` }
  ];
}

function probe(candidate, portClass) {
  return new Promise((resolveProbe) => {
    const content = [
      "ffconcat version 1.0",
      `file '${candidate.url}'`,
      "option rtsp_transport tcp",
      "option timeout 5000000",
      ""
    ].join("\n");
    const args = ["-v", "error", "-f", "concat", "-safe", "0",
      "-protocol_whitelist", "pipe,rtsp,tcp,udp,rtp,http,https,tls,crypto",
      "-i", "pipe:0", "-show_entries", "stream=codec_name,codec_type,width,height",
      "-of", "json"];
    const child = spawn("/opt/homebrew/bin/ffprobe", args,
      { stdio: ["pipe", "pipe", "ignore"] });
    let stdout = "";
    let settled = false;
    const startedAt = Date.now();
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      stdout = "";
      if (child.exitCode === null && !child.killed) child.kill("SIGKILL");
      resolveProbe({ template: candidate.template, port_class: portClass,
        elapsed_ms: Date.now() - startedAt, ...result });
    };
    const timer = setTimeout(() => finish({ status: "TIMEOUT" }), 6_000);
    child.stdout.on("data", (chunk) => {
      if (settled) return;
      stdout += chunk.toString("utf8");
      if (stdout.length > 64 * 1024) finish({ status: "RESPONSE_TOO_LARGE" });
    });
    child.once("error", () => finish({ status: "PROBE_UNAVAILABLE" }));
    child.once("close", (code) => {
      if (settled) return;
      if (code !== 0) return finish({ status: "UNREACHABLE" });
      try {
        const parsed = JSON.parse(stdout || "{}");
        const stream = parsed.streams?.find((item) => item.codec_type === "video");
        if (!stream) return finish({ status: "NO_VIDEO" });
        finish({ status: "PASS", codec: stream.codec_name || null,
          width: Number(stream.width) || null, height: Number(stream.height) || null });
      } catch {
        finish({ status: "INVALID_RESPONSE" });
      }
    });
    child.stdin.end(content);
  });
}

const attempts = [];
let selected = null;
for (const port of ports) {
  const portClass = port === configuredPort ? "CONFIGURED_SERVICE_PORT" : "STANDARD_RTSP_PORT";
  for (const candidate of candidates(port)) {
    const result = await probe(candidate, portClass);
    attempts.push(result);
    if (result.status === "PASS" && !selected) {
      selected = result;
    }
    if (result.status === "PASS" && !probeAll) {
      break;
    }
  }
  if (selected && !probeAll) break;
}

const evidence = {
  protocol: "observer-push38-private-nvr-rtsp-probe-v1",
  observed_at: new Date().toISOString(),
  mode: "READ_ONLY_SEQUENTIAL_BOUNDED",
  recorder_identity: "ERO-N7516HR_RAYSHARP_FAMILY_PREVIOUSLY_VERIFIED",
  channel,
  quality,
  attempts,
  selected,
  probe_all_candidates: probeAll,
  settings_changed: false,
  runtime_changed: false,
  credentials_recorded: false,
  endpoint_recorded: false
};
writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600, flag: "wx" });
const sha = createHash("sha256").update(readFileSync(output)).digest("hex");
console.log(JSON.stringify({ status: selected ? "PASS" : "FAIL", selected,
  attempts: attempts.length, evidence_sha256: sha, settings_changed: false,
  runtime_changed: false, credentials_recorded: false }));
process.exitCode = selected ? 0 : 2;
