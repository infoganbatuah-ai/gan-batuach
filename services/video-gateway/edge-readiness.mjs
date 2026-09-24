import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { objectInference } from "./object-inference-client.mjs";
import { resolveEdgeRuntimePaths } from "./runtime-paths.mjs";

let baseReadinessCache = null;
let baseReadinessPromise = null;

function runBounded(command, args, timeoutMs) {
  return new Promise((resolve) => {
    let stdout = "", settled = false, timedOut = false;
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "ignore"] });
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    timer.unref?.();
    child.stdout?.on("data", (chunk) => {
      if (stdout.length < 64 * 1024) stdout += String(chunk).slice(0, 64 * 1024 - stdout.length);
    });
    child.once("error", (error) => finish({ ok: false, stdout, timedOut, error }));
    child.once("close", (code) => finish({ ok: !timedOut && code === 0, stdout, timedOut, code }));
  });
}

async function executableAvailable(command) {
  const candidates = command === "ffprobe"
    ? ["/opt/homebrew/bin/ffprobe", "/usr/local/bin/ffprobe", command]
    : [command];
  const executable = candidates.find((candidate) => candidate === command || existsSync(candidate));
  const result = await runBounded(executable, [command === "ffprobe" ? "-version" : "--version"], 3_000);
  return result.ok;
}

async function visionWorkerSelfTest() {
  const workerPath = resolveEdgeRuntimePaths().visionWorkerPath;
  if (!existsSync(workerPath)) return { available: false, reason: "vision_worker_not_built", capabilities: {} };
  const result = await runBounded(workerPath, ["--self-test"], 5_000);
  if (result.timedOut) return { available: false, reason: "vision_worker_self_test_timeout", capabilities: {} };
  if (!result.ok) return { available: false, reason: "vision_worker_self_test_failed", capabilities: {} };
  try {
    const parsed = JSON.parse(result.stdout || "{}");
    if (parsed.ok !== true || parsed.runtime !== "apple_vision") return { available: false, reason: "vision_worker_invalid_self_test", capabilities: {} };
    return { available: true, reason: null, capabilities: parsed.capabilities && typeof parsed.capabilities === "object" ? parsed.capabilities : {} };
  } catch {
    return { available: false, reason: "vision_worker_invalid_output", capabilities: {} };
  }
}

function objectWorkerSelfTest() {
  // Health reads the existing worker state; it must not start expensive work.
  // Startup and the inference request path own worker recovery.
  return objectInference.status();
}

function pendingBaseReadiness() {
  const modelDir = resolveEdgeRuntimePaths().modelDir;
  const audioModel = join(modelDir, "audio-event-detector.mlmodelc");
  const appleVisionPlatform = process.platform === "darwin";
  return {
    visionWorker: { available: false, reason: "vision_worker_self_test_pending", capabilities: {} },
    ffprobe: false,
    hardwareAcceleration: process.platform === "darwin" && process.arch === "arm64",
    audioModelPresent: Boolean(audioModel && existsSync(audioModel)),
    appleVisionPlatform
  };
}

async function warmBaseReadiness() {
  if (baseReadinessCache) return baseReadinessCache;
  if (baseReadinessPromise) return baseReadinessPromise;
  baseReadinessPromise = (async () => {
    const pending = pendingBaseReadiness();
    // The compiled worker is the runtime artifact. Requiring `swift` here would
    // incorrectly disable Vision when the compiler is not on the LaunchAgent PATH.
    const visionWorkerPromise = pending.appleVisionPlatform
      ? visionWorkerSelfTest()
      : Promise.resolve({ available: false, reason: "apple_vision_runtime_unavailable", capabilities: {} });
    const [visionWorker, ffprobe] = await Promise.all([visionWorkerPromise, executableAvailable("ffprobe")]);
    baseReadinessCache = {
      visionWorker,
      ffprobe,
      hardwareAcceleration: pending.hardwareAcceleration,
      audioModelPresent: pending.audioModelPresent,
      appleVisionPlatform: pending.appleVisionPlatform
    };
    return baseReadinessCache;
  })().finally(() => { baseReadinessPromise = null; });
  return baseReadinessPromise;
}

export function localEdgeReadiness() {
  // Health is latency-sensitive. It may observe a pending capability contract,
  // but it must never synchronously spawn a process or block the event loop.
  const base = baseReadinessCache || pendingBaseReadiness();
  const objectWorker = objectWorkerSelfTest();
  const objectDetection = objectWorker.available;
  const audioDetection = false;

  return {
    processing: "local_gateway",
    ffprobe_available: base.ffprobe,
    gateway_connectivity: "healthy",
    gateway_version: process.env.VIDEO_GATEWAY_VERSION || "local-gateway",
    runtime: { available: base.visionWorker.available, kind: base.visionWorker.available ? "apple_vision" : base.appleVisionPlatform ? "apple_vision_unverified" : "not_available", self_test_reason: base.visionWorker.reason },
    hardware: { platform: process.platform, architecture: process.arch, acceleration_available: base.hardwareAcceleration },
    models: {
      approved_inventory: [
        { capability: "object_detection", present: objectWorker.available, loaded: objectWorker.available, self_test_passed: objectWorker.available, execution_provider: objectWorker.available ? "cpu" : null, provenance: objectWorker.provenance },
        { capability: "audio_event_detection", present: base.audioModelPresent, loaded: false, self_test_passed: false }
      ],
      loaded: objectWorker.available
    },
    apple_vision_runtime_available: base.visionWorker.available,
    face_detection: base.visionWorker.capabilities.face_detection === true,
    human_detection: base.visionWorker.capabilities.human_detection === true,
    image_classification: base.visionWorker.capabilities.image_classification === true,
    object_detection: objectDetection,
    audio_event_detection: audioDetection,
    face_recognition: false,
    biometric_matching: false,
    active: objectWorker.available,
    reason: objectWorker.available
      ? "object_detection_ready"
      : base.appleVisionPlatform && !base.visionWorker.available
      ? base.visionWorker.reason
      : base.appleVisionPlatform && base.audioModelPresent
        ? "model_present_but_runtime_load_and_capability_test_required"
      : !base.appleVisionPlatform
        ? "apple_vision_runtime_unavailable"
        : objectWorker.reason || "approved_edge_model_not_installed",
    capability_test: { passed: objectWorker.available, reason: objectWorker.available ? "object_model_loaded" : objectWorker.reason,
      startup_phase: objectWorker.startup_phase, startup_elapsed_ms: objectWorker.startup_elapsed_ms },
    consent_verified: false,
    cloud_video_upload: false,
    raw_frames_retained: false
  };
}

export function warmLocalEdgeReadiness() {
  // Let the read-only recorder discovery finish its initial network burst.
  // The readiness contract remains disabled until this real self-test passes.
  const warmup = setTimeout(() => {
    void warmBaseReadiness();
    void objectInference.start();
  }, 30_000);
  warmup.unref();
}
