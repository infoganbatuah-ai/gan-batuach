import assert from "node:assert/strict";
import { createHardwareTranscoder, hardwareDecodeArgs, hardwareEncodeArgs } from "../../services/video-gateway/hardware-transcoder.mjs";
let at = 1000, calls = 0;
const gate = createHardwareTranscoder({ platform: "darwin", now: () => at, cooldownMs: 1000, run: async (args, input, timeout) => {
  calls++;
  assert.equal(timeout, 5000);
  assert.ok(args.includes("-allow_sw") && args[args.indexOf("-allow_sw") + 1] === "0");
  if (input) assert.deepEqual(args.slice(args.indexOf("-hwaccel"), args.indexOf("-i")), hardwareDecodeArgs);
  return { ok: true, output: Buffer.alloc(188 * 3) };
} });
assert.equal(gate.canUse("a", "hevc"), false);
assert.deepEqual(await Promise.all([gate.test(), gate.test()]), [true, true]);
assert.equal(calls, 2, "Concurrent requests must share one bounded self-test");
assert.equal(gate.canUse("a", "h264"), false, "Keep verified H264 streamcopy");
assert.equal(gate.canUse("a", "unknown"), false);
assert.equal(gate.canUse("a", "hevc"), true);
gate.failed("a");
assert.equal(gate.canUse("a", "hevc"), false);
assert.equal(gate.canUse("b", "hevc"), true, "One unsupported source cannot disable siblings");
assert.equal(gate.status().software_fallback_channels, 1);
assert.ok(!JSON.stringify(gate.status()).includes('"a"'));
at += 1001;
assert.equal(gate.canUse("a", "hevc"), true);
assert.equal(await createHardwareTranscoder({ platform: "linux", run: () => { throw Error("must_not_run"); } }).test(), false);
for (const run of [async () => ({ok:false, output:Buffer.alloc(0)}), async () => { throw Error("private diagnostic"); }]) {
  const failed = createHardwareTranscoder({ platform:"darwin", run });
  assert.equal(await failed.test(), false);
  assert.ok(!JSON.stringify(failed.status()).includes("private"));
}
assert.ok(!hardwareDecodeArgs.includes("-r") && !hardwareEncodeArgs.includes("-r"));
if (process.argv.includes("--run-hardware")) {
  const actual = createHardwareTranscoder();
  assert.equal(await actual.test(), true, "Actual hardware must complete synthetic HEVC-to-H264 conversion");
  console.log(JSON.stringify(actual.status()));
}
console.log("PASS: hardware evidence gate, bounded single-flight test, per-channel fallback, no static capability claims or timestamp rewriting");
