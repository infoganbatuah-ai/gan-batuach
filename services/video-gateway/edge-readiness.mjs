import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

function executableAvailable(command) {
  const candidates = command === "ffprobe"
    ? ["/opt/homebrew/bin/ffprobe", "/usr/local/bin/ffprobe", command]
    : [command];
  const executable = candidates.find((candidate) => candidate === command || existsSync(candidate));
  const result = spawnSync(executable, [command === "ffprobe" ? "-version" : "--version"], { encoding: "utf8", timeout: 3000 });
  return result.status === 0;
}

export function localEdgeReadiness() {
  const modelDir = process.env.VIDEO_GATEWAY_EDGE_MODEL_DIR || "";
  const visionModel = modelDir ? join(modelDir, "object-detector.mlmodelc") : "";
  const audioModel = modelDir ? join(modelDir, "audio-event-detector.mlmodelc") : "";
  const visionRuntime = process.platform === "darwin" && executableAvailable("swift");
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
    runtime: { available: visionRuntime, kind: visionRuntime ? "apple_swift" : "not_available" },
    hardware: { platform: process.platform, architecture: process.arch, acceleration_available: hardwareAcceleration },
    models: {
      approved_inventory: [
        { capability: "object_detection", present: objectModelPresent, loaded: false, self_test_passed: false },
        { capability: "audio_event_detection", present: audioModelPresent, loaded: false, self_test_passed: false }
      ],
      loaded: false
    },
    apple_vision_runtime_available: visionRuntime,
    object_detection: objectDetection,
    audio_event_detection: audioDetection,
    face_recognition: false,
    biometric_matching: false,
    active: false,
    reason: visionRuntime && (objectModelPresent || audioModelPresent)
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
