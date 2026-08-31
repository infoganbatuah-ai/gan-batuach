import assert from "node:assert/strict";
import { createRelayInputMetrics } from "../../services/video-gateway/relay-input-metrics.mjs";
let at = 100;
for (const [format, hex] of [
  ["isobmff", "00000020667479700000000000000000"],
  ["mpeg_ps", "000001ba000000000000000000000000"],
  ["mpeg_ts_candidate", "47000000000000000000000000000000"],
  ["annex_b_candidate", "00000001670000000000000000000000"],
  ["annex_b_candidate", "00000167000000000000000000000000"],
  ["unrecognized", "11223344000000000000000000000000"]
]) {
  const metrics = createRelayInputMetrics(() => at);
  const chunk = Buffer.from(hex, "hex"), original = Buffer.from(chunk);
  metrics.observe(chunk.subarray(0, 2));
  assert.equal(metrics.snapshot().format, "pending");
  metrics.observe(chunk.subarray(2));
  assert.deepEqual(chunk, original, "Inspection must not alter streamed media");
  at += 1000;
  assert.deepEqual(metrics.snapshot(), { format, bytes: 16, chunks: 2, age_ms: 1000, input_idle_ms: 1000 });
  metrics.observe(Buffer.from("synthetic-private-payload-never-returned"));
  const snapshot = metrics.snapshot();
  assert.equal(snapshot.format, format);
  assert.equal(snapshot.input_idle_ms, 0);
  assert.ok(!JSON.stringify(snapshot).includes("synthetic"));
  assert.deepEqual(Object.keys(snapshot), ["format", "bytes", "chunks", "age_ms", "input_idle_ms"]);
}
assert.equal(createRelayInputMetrics().snapshot().input_idle_ms, null);
console.log("PASS: bounded format classification, fragmented input, counters, no media mutation or payload output");
