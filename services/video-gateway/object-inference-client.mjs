import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

// One warm CPU session for all cameras, with bounded backpressure. No image
// bytes are logged, persisted, or returned by this client.
export function createObjectInferenceClient({
  workerPath = fileURLToPath(new URL("./onnx-object-worker.mjs", import.meta.url)),
  startupMs = 120_000,
  inferenceMs = 8_000,
  retryMs = 60_000,
  maxQueued = 16,
  spawnWorker = () => spawn(process.execPath, [workerPath, "--serve-rgb"], { stdio: ["ignore", "ignore", "ignore", "ipc"] })
} = {}) {
  let child = null;
  let initializing = null;
  let retryAt = 0;
  let stopped = false;
  let active = null;
  let startupStartedAt = 0;
  let state = { available: false, reason: "object_worker_not_started", provenance: null, startup_phase: "not_started", startup_elapsed_ms: 0 };
  const startupPhases = new Set(["model_validation", "runtime_loading", "session_loading", "self_test"]);
  const queue = [];

  function fail(reason) {
    state = { ...state, available: false, reason,
      startup_elapsed_ms: initializing ? Date.now() - startupStartedAt : state.startup_elapsed_ms };
    retryAt = Date.now() + retryMs;
    const previous = child;
    child = null;
    if (initializing) {
      clearTimeout(initializing.timer);
      initializing.resolve(false);
      initializing = null;
    }
    if (active) {
      clearTimeout(active.timer);
      active.resolve(null);
      active = null;
    }
    for (const request of queue.splice(0)) request.resolve(null);
    previous?.kill("SIGKILL");
  }

  function pump() {
    if (active || !state.available || !child) return;
    let request;
    while ((request = queue.shift())) {
      if (Date.now() - request.enqueuedAt <= inferenceMs) break;
      request.resolve(null);
      request = null;
    }
    if (!request) return;
    active = request;
    const current = child;
    request.timer = setTimeout(() => fail("object_inference_timeout"), inferenceMs);
    try {
      current.send({ type: "infer", id: request.id, rgb: request.rgb }, (error) => {
        if (error && child === current) fail("object_worker_disconnected");
      });
      request.rgb = null;
    } catch {
      fail("object_worker_disconnected");
    }
  }

  function start() {
    if (stopped) return Promise.resolve(false);
    if (state.available) return Promise.resolve(true);
    if (initializing) return initializing.promise;
    if (Date.now() < retryAt) return Promise.resolve(false);
    startupStartedAt = Date.now();
    state = { available: false, reason: "object_worker_warming", provenance: state.provenance, startup_phase: "spawn", startup_elapsed_ms: 0 };
    let resolve;
    const promise = new Promise((done) => { resolve = done; });
    initializing = { promise, resolve, timer: setTimeout(() => fail("object_worker_start_timeout"), startupMs) };
    let current;
    try { current = child = spawnWorker(); } catch { fail("object_worker_start_failed"); return promise; }
    current.on("message", (message) => {
      if (child !== current || !message || typeof message !== "object") return;
      if (message.type === "startup_progress" && initializing && startupPhases.has(message.phase)) {
        // Diagnostics never grant readiness or renew the fixed startup deadline.
        // Accept only bounded phase codes, not child logs, paths or image data.
        state = { ...state, startup_phase: message.phase, startup_elapsed_ms: Date.now() - startupStartedAt };
      } else if (message.type === "ready" && message.ok === true && message.inference_self_test === true && initializing) {
        state = { available: true, reason: null, provenance: message.provenance ?? null,
          startup_phase: "ready", startup_elapsed_ms: Date.now() - startupStartedAt };
        clearTimeout(initializing.timer);
        initializing.resolve(true);
        initializing = null;
        pump();
      } else if (message.type === "result" && active?.id === message.id) {
        if (message.ok !== true || message.no_raw_frame_returned !== true || !Array.isArray(message.detections)) {
          fail("object_inference_failed");
          return;
        }
        clearTimeout(active.timer);
        active.resolve(message.detections.slice(0, 20));
        active = null;
        pump();
      }
    });
    current.on("error", () => { if (child === current) fail("object_worker_start_failed"); });
    current.on("exit", () => { if (child === current) fail("object_worker_exited"); });
    current.on("disconnect", () => { if (child === current) fail("object_worker_disconnected"); });
    return promise;
  }

  return {
    start,
    status: () => ({ ...state, queued: queue.length, busy: Boolean(active) }),
    predict(rgb) {
      if (!Buffer.isBuffer(rgb) || rgb.length !== 270_000 || stopped) return Promise.resolve(null);
      // Warming must never hold the HTTP request open for the startup timeout.
      if (!state.available) { void start(); return Promise.resolve(null); }
      if (queue.length >= maxQueued) return Promise.resolve(null);
      return new Promise((resolve) => {
        queue.push({ id: randomUUID(), rgb: rgb.toString("base64"), enqueuedAt: Date.now(), resolve });
        pump();
      });
    },
    close() { stopped = true; fail("object_worker_stopped"); }
  };
}

export const objectInference = createObjectInferenceClient();
