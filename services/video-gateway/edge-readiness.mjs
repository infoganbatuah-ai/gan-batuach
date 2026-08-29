import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const objectWorkerPath = fileURLToPath(new URL("./onnx-object-worker.mjs", import.meta.url));
let objectWorkerCache = null;
let objectWorkerSelfTestPromise = null;
let objectWorkerRetryAt = 0;
let baseReadinessCache = null;
const OBJECT_WORKER_SELF_TEST_TIMEOUT_MS = 120_000;
const OBJECT_WORKER_SELF_TEST_RETRY_MS = 60_000;

function executableAvailable(command) {
  const candidates = command === "ffprobe"
    ? ["/opt/homebrew/bin/ffprobe", "/usr/local/bin/ffprobe", command]
    : [command];
  const executable = candidates.find((candidate) => candidate === command || existsSync(candidate));
  const result = spawnSync(executable, [command === "ffprobe" ? "-version" : "--version"], { encoding: "utf8", timeout: 3000 });
  return result.status === 0;
}

function visionWorkerSelfTest() {
  const workerPath = process.env.VIDEO_GATEWAY_VISION_WORKER_PATH || join(homedir(), ".local", "share", "gan-batuach", "video-gateway", "vision-edge-worker");
  if (!existsSync(workerPath)) return { available: false, reason: "vision_worker_not_built", capabilities: {} };
  const result = spawnSync(workerPath, ["--self-test"], { encoding: "utf8", timeout: 5_000 });
  if (result.error?.code === "ETIMEDOUT") return { available: false, reason: "vision_worker_self_test_timeout", capabilities: {} };
  if (result.status !== 0) return { available: false, reason: "vision_worker_self_test_failed", capabilities: {} };
  try {
    const parsed = JSON.parse(result.stdout || "{}");
    if (parsed.ok !== true || parsed.runtime !== "apple_vision") return { available: false, reason: "vision_worker_invalid_self_test", capabilities: {} };
    return { available: true, reason: null, capabilities: parsed.capabilities && typeof parsed.capabilities === "object" ? parsed.capabilities : {} };
  } catch {
    return { available: false, reason: "vision_worker_invalid_output", capabilities: {} };
  }
}

function objectWorkerSelfTest() {
  if (objectWorkerCache?.available) return objectWorkerCache;
  if (objectWorkerCache && Date.now() < objectWorkerRetryAt) return objectWorkerCache;
  if (!objectWorkerSelfTestPromise) {
    // Never run model initialization synchronously on Gateway request paths.
    // Until this background test completes, the contract remains truthfully off.
    objectWorkerSelfTestPromise = new Promise((resolve) => {
      const child = spawn(process.execPath, [objectWorkerPath, "--self-test"], { stdio: ["ignore", "pipe", "ignore"] });
      let output = "";
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        objectWorkerCache = value;
        objectWorkerRetryAt = value.available ? 0 : Date.now() + OBJECT_WORKER_SELF_TEST_RETRY_MS;
        objectWorkerSelfTestPromise = null;
        resolve(value);
      };
      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        finish({ available: false, reason: "object_worker_self_test_timeout", provenance: null });
      }, OBJECT_WORKER_SELF_TEST_TIMEOUT_MS);
      child.stdout.on("data", (chunk) => { output += chunk.toString("utf8"); });
      child.on("error", () => finish({ available: false, reason: "object_worker_self_test_failed", provenance: null }));
      child.on("close", (status) => {
        try {
          const parsed = JSON.parse(output || "{}");
          if (status === 0 && parsed.ok === true && parsed.capabilities?.object_detection === true) {
            finish({ available: true, reason: null, provenance: parsed.provenance ?? null });
            return;
          }
          finish({ available: false, reason: String(parsed.reason || "object_worker_self_test_failed"), provenance: parsed.provenance ?? null });
        } catch {
          finish({ available: false, reason: "object_worker_self_test_failed", provenance: null });
        }
      });
    });
  }
  return objectWorkerSelfTestPromise
    ? { available: false, reason: "object_worker_self_test_pending", provenance: null }
    : objectWorkerCache || { available: false, reason: "object_worker_self_test_pending", provenance: null };
}

function baseReadiness() {
  if (baseReadinessCache) return baseReadinessCache;
  const modelDir = process.env.VIDEO_GATEWAY_EDGE_MODEL_DIR || "";
  const audioModel = modelDir ? join(modelDir, "audio-event-detector.mlmodelc") : "";
  // The compiled worker is the runtime artifact. Requiring `swift` here would
  // incorrectly disable Vision when the compiler is not on the LaunchAgent PATH.
  const appleVisionPlatform = process.platform === "darwin";
  const visionWorker = appleVisionPlatform ? visionWorkerSelfTest() : { available: false, reason: "apple_vision_runtime_unavailable", capabilities: {} };
  const ffprobe = executableAvailable("ffprobe");
  const hardwareAcceleration = process.platform === "darwin" && process.arch === "arm64";
  const audioModelPresent = Boolean(audioModel && existsSync(audioModel));
  baseReadinessCache = {
    visionWorker,
    ffprobe,
    hardwareAcceleration,
    audioModelPresent,
    appleVisionPlatform
  };
  return baseReadinessCache;
}

export function localEdgeReadiness() {
  const base = baseReadiness();
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
    capability_test: objectWorker.available ? { passed: true, reason: "object_model_loaded" } : { passed: false, reason: objectWorker.reason },
    consent_verified: false,
    cloud_video_upload: false,
    raw_frames_retained: false
  };
}

export function warmLocalEdgeReadiness() {
  // Let the read-only recorder discovery finish its initial network burst.
  // The readiness contract remains disabled until this real self-test passes.
  const warmup = setTimeout(() => {
    baseReadiness();
    objectWorkerSelfTest();
  }, 30_000);
  warmup.unref();
}
