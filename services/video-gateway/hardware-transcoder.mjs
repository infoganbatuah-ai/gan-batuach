import { spawn } from "node:child_process";

function runBounded(args, input, timeoutMs) {
  return new Promise(resolve => {
    const child = spawn("ffmpeg", args, { stdio: ["pipe", "pipe", "ignore"] });
    const chunks = [];
    let bytes = 0, settled = false;
    const finish = ok => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ ok, output: ok ? Buffer.concat(chunks) : Buffer.alloc(0) });
    };
    const timer = setTimeout(() => { child.kill("SIGKILL"); finish(false); }, timeoutMs);
    child.on("error", () => finish(false));
    child.on("close", code => finish(code === 0));
    child.stdin.on("error", () => {});
    child.stdout.on("data", chunk => {
      bytes += chunk.length;
      if (bytes > 2_000_000) { child.kill("SIGKILL"); finish(false); return; }
      chunks.push(chunk);
    });
    child.stdin.end(input);
  });
}

export const hardwareDecodeArgs = ["-hwaccel", "videotoolbox", "-hwaccel_output_format", "videotoolbox"];
export const hardwareEncodeArgs = ["-c:v", "h264_videotoolbox", "-allow_sw", "0", "-realtime", "1", "-b:v", "1500k", "-g", "30", "-bf", "0"];

export function createHardwareTranscoder({ platform = process.platform, run = runBounded, now = Date.now, cooldownMs = 10 * 60_000 } = {}) {
  let pending, state = { available: false, reason: "not_tested", tested_at: null };
  const failures = new Map();
  async function test() {
    if (pending) return pending;
    pending = (async () => {
      if (platform !== "darwin") { state = { available: false, reason: "platform_not_supported", tested_at: null }; return false; }
      state = { available: false, reason: "self_test_running", tested_at: null };
      try {
        // Synthetic input only. Encoder enumeration is not capability evidence.
        const fixture = await run(["-hide_banner", "-loglevel", "error", "-filter_threads", "1", "-f", "lavfi", "-i", "testsrc=size=640x480:rate=25", "-frames:v", "30", "-vf", "format=nv12", "-c:v", "hevc_videotoolbox", "-allow_sw", "0", "-realtime", "1", "-b:v", "800k", "-g", "30", "-bf", "0", "-tag:v", "hvc1", "-f", "mp4", "-movflags", "frag_keyframe+empty_moov", "pipe:1"], null, 5000);
        let ok = false;
        if (fixture.ok && fixture.output.length > 0) {
          const result = await run(["-hide_banner", "-loglevel", "error", "-threads", "1", "-filter_threads", "1", ...hardwareDecodeArgs, "-i", "pipe:0", "-map", "0:v:0", "-an", ...hardwareEncodeArgs, "-f", "mpegts", "pipe:1"], fixture.output, 5000);
          ok = result.ok && result.output.length >= 188;
          result.output.fill(0);
        }
        fixture.output.fill(0);
        state = { available: ok, reason: ok ? "synthetic_hevc_to_h264_passed" : "hardware_self_test_failed", tested_at: new Date(now()).toISOString() };
        return ok;
      } catch {
        state = { available: false, reason: "hardware_self_test_failed", tested_at: new Date(now()).toISOString() };
        return false;
      }
    })();
    return pending;
  }
  return {
    test,
    canUse(streamId, codec) {
      if ((failures.get(streamId) || 0) <= now()) failures.delete(streamId);
      return state.available && codec === "hevc" && !failures.has(streamId);
    },
    failed(streamId) { failures.set(streamId, now() + cooldownMs); },
    status() {
      for (const [id, expires] of failures) if (expires <= now()) failures.delete(id);
      return { ...state, software_fallback_channels: failures.size };
    }
  };
}
