import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, symlinkSync, unlinkSync, rmdirSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, basename } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createObjectInferenceClient } from "../../services/video-gateway/object-inference-client.mjs";

// Isolated real-model benchmark. Reuses installed dependencies read-only, never
// replaces the running Gateway, sends events, saves clips or contacts the cloud.
const imagePaths = process.argv.slice(2);
const zeroOnly = imagePaths.length === 1 && imagePaths[0] === "--zero";
if (!imagePaths.length) throw new Error("Supply --zero or already audited local camera JPEG paths; run only in a coordinated model-test window");
const directory = mkdtempSync(join(tmpdir(), "journal-inference-benchmark-"));
const workerPath = join(directory, "onnx-object-worker.mjs");
copyFileSync(new URL("../../services/video-gateway/onnx-object-worker.mjs", import.meta.url), workerPath);
symlinkSync(join(homedir(), ".local/share/gan-batuach/video-gateway/node_modules"), join(directory, "node_modules"));
const client = createObjectInferenceClient({ workerPath, spawnWorker: () => {
  const child = spawn(process.execPath, [workerPath, "--serve-rgb"], { stdio: ["ignore", "ignore", "ignore", "ipc"] });
  if (zeroOnly) console.log(JSON.stringify({ probe: "worker_started", pid: child.pid, self_test_only: true }));
  return child;
} });
// Bound the entire zero-input IPC check, not only its individual requests.
const deadline = zeroOnly ? setTimeout(() => client.close(), 120_000) : null;
try {
  const start = performance.now();
  assert.equal(await client.start(), true, JSON.stringify(client.status()));
  console.log(JSON.stringify({ warmup_ms: Math.round(performance.now() - start), available: client.status().available, startup_phase: client.status().startup_phase, self_test_only: zeroOnly }));
  if (zeroOnly) {
    for (let pass = 1; pass <= 5; pass++) {
      const before = performance.now();
      const detections = await client.predict(Buffer.alloc(270_000));
      assert.notEqual(detections, null, JSON.stringify(client.status()));
      console.log(JSON.stringify({ pass, inference_ms: Math.round(performance.now() - before), self_test_only: true, detections_count: detections.length }));
    }
  } else for (const path of imagePaths) {
    const frame = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", path, "-frames:v", "1", "-vf", "scale=300:300,format=rgb24", "-f", "rawvideo", "pipe:1"], { maxBuffer: 512_000, timeout: 5_000 });
    assert.equal(frame.status, 0, "Local frame conversion must succeed");
    assert.equal(frame.stdout.length, 270_000);
    for (let pass = 1; pass <= 2; pass++) {
      const before = performance.now();
      const detections = await client.predict(frame.stdout);
      assert.notEqual(detections, null, JSON.stringify(client.status()));
      console.log(JSON.stringify({ source: basename(path), pass, inference_ms: Math.round(performance.now() - before), detections: detections.map(({label,confidence})=>({label,confidence})) }));
    }
  }
} finally {
  if (deadline) clearTimeout(deadline);
  client.close();
  unlinkSync(workerPath);
  unlinkSync(join(directory, "node_modules"));
  rmdirSync(directory);
}
