import { homedir, platform as hostPlatform } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

function absoluteOverride(value, name) {
  if (!value) return "";
  if (!isAbsolute(value)) throw new Error(`${name}_MUST_BE_ABSOLUTE`);
  return resolve(value);
}

export function resolveEdgeRuntimePaths(env = process.env, options = {}) {
  const platform = options.platform || hostPlatform();
  const home = options.home || homedir();
  const profile = env.OBSERVER_EDGE_DEVICE_TYPE === "SOFTWARE_CONNECTOR" ? "observer-connector" : "observer-gateway";
  const standardRoot = platform === "win32"
    ? join(env.PROGRAMDATA || "C:\\ProgramData", "DigitalObserver", profile)
    : platform === "darwin"
      ? join(home, "Library", "Application Support", "Digital Observer", profile)
      : join(env.XDG_STATE_HOME || join(home, ".local", "state"), "digital-observer", profile);
  const dataDir = absoluteOverride(env.OBSERVER_EDGE_DATA_DIR || env.OBSERVER_CONNECTOR_DATA_DIR, "OBSERVER_EDGE_DATA_DIR") || standardRoot;
  const secretDir = absoluteOverride(env.GAN_BATUACH_GATEWAY_SECRET_DIR || env.OBSERVER_CONNECTOR_SECRET_DIR, "OBSERVER_EDGE_SECRET_DIR") || join(dataDir, "secrets");
  const modelDir = absoluteOverride(env.VIDEO_GATEWAY_EDGE_MODEL_DIR, "VIDEO_GATEWAY_EDGE_MODEL_DIR") || join(dataDir, "models");
  const logDir = absoluteOverride(env.OBSERVER_EDGE_LOG_DIR, "OBSERVER_EDGE_LOG_DIR") || join(dataDir, "logs");
  return Object.freeze({
    dataDir,
    secretDir,
    modelDir,
    logDir,
    objectModelPath: absoluteOverride(env.VIDEO_GATEWAY_OBJECT_MODEL_PATH, "VIDEO_GATEWAY_OBJECT_MODEL_PATH") || join(modelDir, "ssd_mobilenet_v1_10.onnx"),
    visionWorkerPath: absoluteOverride(env.VIDEO_GATEWAY_VISION_WORKER_PATH, "VIDEO_GATEWAY_VISION_WORKER_PATH") || join(dataDir, "bin", "vision-edge-worker")
  });
}
