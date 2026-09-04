import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createObjectInferenceClient } from "../../services/video-gateway/object-inference-client.mjs";

const children = [];
let stalled = false, failResult = false;
const client = createObjectInferenceClient({
  startupMs: 100, inferenceMs: 50, retryMs: 1, maxQueued: 2,
  spawnWorker() {
    const child = new EventEmitter();
    child.kill = () => { child.killed = true; };
    child.send = (message, callback) => {
      assert.equal(message.rgb.length, 360_000);
      callback(null);
      if (!stalled) setTimeout(() => child.emit("message", { type: "result", id: message.id, ok: !failResult, no_raw_frame_returned: true, detections: [] }), 1);
    };
    children.push(child);
    return child;
  }
});
function ready() { children.at(-1).emit("message", { type: "ready", ok: true, inference_self_test: true }); }
const frame = Buffer.alloc(270_000);
try {
  assert.equal(client.status().available, false);
  assert.equal(await client.predict(frame), null, "Warmup does not block camera requests");
  const starting = client.start();
  assert.equal(children.length, 1, "Concurrent warmup reuses the same process");
  children[0].emit("message", { type: "startup_progress", phase: "session_loading", raw_frame: "must_not_be_retained" });
  assert.equal(client.status().startup_phase, "session_loading");
  assert.equal(client.status().available, false, "Progress cannot grant model readiness");
  assert.equal(JSON.stringify(client.status()).includes("must_not_be_retained"), false);
  children[0].emit("message", { type: "startup_progress", phase: "untrusted arbitrary text" });
  assert.equal(client.status().startup_phase, "session_loading", "Unknown diagnostics never enter status");
  ready();
  assert.equal(await starting, true);
  assert.equal(client.status().available, true);
  assert.deepEqual(await Promise.all([client.predict(frame), client.predict(frame), client.predict(frame)]), [[], [], []]);
  assert.equal(children.length, 1, "Multiple cameras reuse the warm session");
  assert.equal(await client.predict(Buffer.alloc(1)), null);
  stalled = true;
  const pending = [client.predict(frame), client.predict(frame), client.predict(frame)];
  assert.equal(await client.predict(frame), null, "Backpressure bounds queued raw frames");
  assert.deepEqual(await Promise.all(pending), [null, null, null]);
  assert.equal(client.status().available, false, "Timeout immediately revokes readiness");
  assert.equal(children[0].killed, true);
  await new Promise(resolve => setTimeout(resolve, 3));
  const restarting = client.start(); ready(); await restarting;
  children[0].emit("exit", 1);
  children[0].emit("message", { type: "startup_progress", phase: "runtime_loading" });
  assert.equal(client.status().startup_phase, "ready", "Old worker diagnostics cannot overwrite a replacement");
  assert.equal(client.status().available, true, "Old worker callbacks cannot kill the replacement");
  stalled = false; failResult = true;
  assert.equal(await client.predict(frame), null);
  assert.equal(client.status().available, false, "Invalid model output is never an empty success");
  console.log("Persistent object inference passed: session reuse, nonblocking warmup, bounded queue, crash/timeout readiness and stale-worker isolation.");
} finally { client.close(); }

const warmingChild = new EventEmitter();
warmingChild.kill = () => {};
const warming = createObjectInferenceClient({ startupMs: 40, spawnWorker: () => warmingChild });
let progressTimer;
try {
  const started = warming.start();
  progressTimer = setInterval(() => warmingChild.emit("message", { type: "startup_progress", phase: "self_test" }), 5);
  assert.equal(await started, false, "Startup progress must not prolong the bounded deadline");
  assert.equal(warming.status().reason, "object_worker_start_timeout");
  assert.equal(warming.status().startup_phase, "self_test", "The last failed startup phase remains diagnosable");
  assert.equal(warming.status().available, false);
  assert(warming.status().startup_elapsed_ms >= 35);
  console.log("Startup diagnostics passed: phase-only IPC, fixed deadline, no readiness grant and stale-worker isolation.");
} finally { clearInterval(progressTimer); warming.close(); }
