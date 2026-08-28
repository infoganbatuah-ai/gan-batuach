import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

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

export function localEdgeReadiness() {
  const modelDir = process.env.VIDEO_GATEWAY_EDGE_MODEL_DIR || "";
  const visionModel = modelDir ? join(modelDir, "object-detector.mlmodelc") : "";
  const audioModel = modelDir ? join(modelDir, "audio-event-detector.mlmodelc") : "";
  const visionRuntime = process.platform === "darwin" && executableAvailable("swift");
  const visionWorker = visionRuntime ? visionWorkerSelfTest() : { available: false, reason: "apple_vision_runtime_unavailable", capabilities: {} };
  const ffprobe = executableAvailable("ffprobe");
  const hardwareAcceleration = process.platform === "darwin" && process.arch === "arm64";
  const objectModelPresent = Boolean(visionModel && existsSync(visionModel));
  const audioModelPresent = Boolean(audioModel && existsSync(audioModel));
  // An artifact on disk is not inference. A loaded worker and a capability
  // self-test are required before any model capability can become active.
  const objectDetection = false;
  const audioDetection = false;

  return {
    processing: "local_gateway",
    ffprobe_available: ffprobe,
    gateway_connectivity: "healthy",
    gateway_version: process.env.VIDEO_GATEWAY_VERSION || "local-gateway",
    runtime: { available: visionRuntime && visionWorker.available, kind: visionWorker.available ? "apple_vision" : visionRuntime ? "apple_swift_unverified" : "not_available", self_test_reason: visionWorker.reason },
    hardware: { platform: process.platform, architecture: process.arch, acceleration_available: hardwareAcceleration },
    models: {
      approved_inventory: [
        { capability: "object_detection", present: objectModelPresent, loaded: false, self_test_passed: false },
        { capability: "audio_event_detection", present: audioModelPresent, loaded: false, self_test_passed: false }
      ],
      loaded: false
    },
    apple_vision_runtime_available: visionRuntime,
    face_detection: visionWorker.capabilities.face_detection === true,
    human_detection: visionWorker.capabilities.human_detection === true,
    image_classification: visionWorker.capabilities.image_classification === true,
    object_detection: objectDetection,
    audio_event_detection: audioDetection,
    face_recognition: false,
    biometric_matching: false,
    active: false,
    reason: visionRuntime && !visionWorker.available
      ? visionWorker.reason
      : visionRuntime && (objectModelPresent || audioModelPresent)
      ? "model_present_but_runtime_load_and_capability_test_required"
      : !visionRuntime
        ? "apple_vision_runtime_unavailable"
        : "approved_edge_model_not_installed",
    capability_test: { passed: false, reason: "no_loaded_model_worker" },
    consent_verified: false,
    cloud_video_upload: false,
    raw_frames_retained: false
  };
}
