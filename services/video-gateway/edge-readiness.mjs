import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const objectWorkerPath = fileURLToPath(new URL("./onnx-object-worker.mjs", import.meta.url));
let objectWorkerCache = { checkedAt: 0, value: null };
const OBJECT_WORKER_SELF_TEST_TIMEOUT_MS = 60_000;

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
  const now = Date.now();
  if (objectWorkerCache.value && now - objectWorkerCache.checkedAt < 60_000) return objectWorkerCache.value;
  const result = spawnSync(process.execPath, [objectWorkerPath, "--self-test"], {
    encoding: "utf8",
    // ONNX can take longer on a cold start while macOS maps the model and
    // native runtime. Treat only a completed inference self-test as readiness.
    timeout: OBJECT_WORKER_SELF_TEST_TIMEOUT_MS,
    stdio: ["ignore", "pipe", "ignore"]
  });
  let value = { available: false, reason: "object_worker_self_test_failed", provenance: null };
  if (result.error?.code === "ETIMEDOUT") {
    value = { available: false, reason: "object_worker_self_test_timeout", provenance: null };
  } else {
    try {
      const parsed = JSON.parse(result.stdout || "{}");
      if (result.status === 0 && parsed.ok === true && parsed.capabilities?.object_detection === true) {
        value = { available: true, reason: null, provenance: parsed.provenance ?? null };
      } else {
        value = { available: false, reason: String(parsed.reason || "object_worker_self_test_failed"), provenance: parsed.provenance ?? null };
      }
    } catch {}
  }
  objectWorkerCache = { checkedAt: now, value };
  return value;
}

export function localEdgeReadiness() {
  const modelDir = process.env.VIDEO_GATEWAY_EDGE_MODEL_DIR || "";
  const audioModel = modelDir ? join(modelDir, "audio-event-detector.mlmodelc") : "";
  // The compiled worker is the runtime artifact. Requiring `swift` here would
  // incorrectly disable Vision when the compiler is not on the LaunchAgent PATH.
  const appleVisionPlatform = process.platform === "darwin";
  const visionWorker = appleVisionPlatform ? visionWorkerSelfTest() : { available: false, reason: "apple_vision_runtime_unavailable", capabilities: {} };
  const objectWorker = objectWorkerSelfTest();
  const ffprobe = executableAvailable("ffprobe");
  const hardwareAcceleration = process.platform === "darwin" && process.arch === "arm64";
  const audioModelPresent = Boolean(audioModel && existsSync(audioModel));
  // An artifact on disk is not inference. A loaded worker and a capability
  // self-test are required before any model capability can become active.
  const objectDetection = objectWorker.available;
  const audioDetection = false;

  return {
    processing: "local_gateway",
    ffprobe_available: ffprobe,
    gateway_connectivity: "healthy",
    gateway_version: process.env.VIDEO_GATEWAY_VERSION || "local-gateway",
    runtime: { available: visionWorker.available, kind: visionWorker.available ? "apple_vision" : appleVisionPlatform ? "apple_vision_unverified" : "not_available", self_test_reason: visionWorker.reason },
    hardware: { platform: process.platform, architecture: process.arch, acceleration_available: hardwareAcceleration },
    models: {
      approved_inventory: [
        { capability: "object_detection", present: objectWorker.available, loaded: objectWorker.available, self_test_passed: objectWorker.available, execution_provider: objectWorker.available ? "cpu" : null, provenance: objectWorker.provenance },
        { capability: "audio_event_detection", present: audioModelPresent, loaded: false, self_test_passed: false }
      ],
      loaded: objectWorker.available
    },
    apple_vision_runtime_available: visionWorker.available,
    face_detection: visionWorker.capabilities.face_detection === true,
    human_detection: visionWorker.capabilities.human_detection === true,
    image_classification: visionWorker.capabilities.image_classification === true,
    object_detection: objectDetection,
    audio_event_detection: audioDetection,
    face_recognition: false,
    biometric_matching: false,
    active: objectWorker.available,
    reason: objectWorker.available
      ? "object_detection_ready"
      : appleVisionPlatform && !visionWorker.available
      ? visionWorker.reason
      : appleVisionPlatform && audioModelPresent
        ? "model_present_but_runtime_load_and_capability_test_required"
      : !appleVisionPlatform
        ? "apple_vision_runtime_unavailable"
        : "approved_edge_model_not_installed",
    capability_test: objectWorker.available ? { passed: true, reason: "object_model_loaded" } : { passed: false, reason: objectWorker.reason },
    consent_verified: false,
    cloud_video_upload: false,
    raw_frames_retained: false
  };
}
