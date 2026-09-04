import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { finished } from "node:stream/promises";

// Execute just the inspected function, never import/start the Gateway server.
// All bytes are synthetic zero buffers; no media/network/process is opened.
const source = readFileSync(process.argv[2] ?? join(homedir(), ".local/share/gan-batuach/video-gateway/services/video-gateway/server.mjs"), "utf8");
const start = source.indexOf("async function pipeWebStreamToWritable(");
const end = source.indexOf("\nasync function probePrivateNvrStream(", start);
assert(start >= 0 && end > start, "Expected reviewed pipe function boundaries");
const functionSource = source.slice(start, end);
const pipe = new Function("Buffer", "setImmediate", `${functionSource}\nreturn pipeWebStreamToWritable;`)(Buffer, setImmediate);
const immediate = () => new Promise(resolve => setImmediate(resolve));
function sourceOf(count, size, onPull = () => {}) {
  let sent = 0;
  return new ReadableStream({ pull(controller) {
    onPull();
    if (sent++ < count) controller.enqueue(new Uint8Array(size));
    else controller.close();
  } }, { highWaterMark: 0 });
}
async function bounded(work) {
  let timeout;
  try { return await Promise.race([work, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error("synthetic_pipe_timeout")), 2000); })]); }
  finally { clearTimeout(timeout); }
}

// Backpressure preserves every byte, and a scheduled turn runs before completion.
let received = 0, forwarded = 0, yielded = false;
const sink = new Writable({ highWaterMark: 1024, write(chunk, _, callback) { received += chunk.length; setImmediate(callback); } });
const completion = finished(sink);
setImmediate(() => { yielded = true; });
await bounded(Promise.all([pipe(sourceOf(200, 1024), sink, bytes => { forwarded += bytes; }), completion]));
assert.equal(received, 200 * 1024);
assert.equal(forwarded, received);
assert(yielded);

// A slow consumer pauses reads. Thus lastInputAt alone cannot distinguish a
// quiet upstream from unread upstream bytes held back by the downstream pipe.
let firstWrite, releaseWrite, pulls = 0, forwardedWhileHeld = 0;
const writing = new Promise(resolve => { firstWrite = resolve; });
let held = true;
const slow = new Writable({ highWaterMark: 1, write(_chunk, _encoding, callback) {
  if (held) { held = false; releaseWrite = callback; firstWrite(); }
  else callback();
} });
const slowCompletion = finished(slow);
const slowPipe = pipe(sourceOf(3, 1024, () => { pulls++; }), slow, bytes => { forwardedWhileHeld += bytes; });
try {
  await bounded(writing);
  await immediate();
  assert.equal(slow.writableNeedDrain, true);
  assert.equal(pulls, 1);
  assert.equal(forwardedWhileHeld, 1024);
} finally { releaseWrite?.(); }
await bounded(Promise.all([slowPipe, slowCompletion]));
assert.equal(forwardedWhileHeld, 3072);

// Source failure propagates to its caller, without starting another source.
const broken = new ReadableStream({ start(controller) { controller.error(new Error("synthetic_source_failure")); } });
const errorSink = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
const errorCompletion = finished(errorSink);
await assert.rejects(bounded(pipe(broken, errorSink)), /synthetic_source_failure/);
await bounded(errorCompletion);
console.log(JSON.stringify({ passed: true, function_sha256: createHash("sha256").update(functionSource).digest("hex"),
  checks: ["byte_preservation", "event_loop_yield", "backpressure_pauses_reads", "source_error_propagation"],
  live_source_examined: false, root_cause_proven: false }));
