import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Explicitly scheduled, one-model-at-a-time diagnostic. Never run during a live
// Gateway acceptance window without its owner's coordination. Uses zero input,
// no camera credentials, network requests, saved images, events or clips.
const configurations = {
  baseline: { executionProviders: ["cpu"], intraOpNumThreads: 2, interOpNumThreads: 1 },
  parallel: { executionProviders: ["cpu"], executionMode: "parallel", intraOpNumThreads: 1, interOpNumThreads: 2 }
};
const [command, mode] = process.argv.slice(2);
const print = (value) => process.stdout.write(`${JSON.stringify(value)}\n`);
const validMode = Object.hasOwn(configurations, mode ?? "");

if (command === "--child" && process.connected && validMode) {
  let phase = "model_validation";
  let completed = false;
  const started = performance.now();
  const cpuStarted = process.cpuUsage();
  const report = (value) => {
    const cpu = process.cpuUsage(cpuStarted);
    const elapsed = performance.now() - started;
    process.send?.({ mode, pid: process.pid, elapsed_ms: Math.round(elapsed),
      cpu_user_ms: Math.round(cpu.user / 1000), cpu_system_ms: Math.round(cpu.system / 1000),
      mean_cpu_percent: elapsed > 0 ? Math.round((cpu.user + cpu.system) / elapsed / 10) : 0, ...value });
  };
  const advance = (next) => { phase = next; report({ type: "phase", phase }); };
  // If the supervising diagnostic exits, never leave an inference worker behind.
  process.on("disconnect", () => { if (!completed) process.exit(1); });
  try {
    advance(phase);
    const root = join(homedir(), ".local/share/gan-batuach/video-gateway");
    const modelPath = join(root, "models/ssd_mobilenet_v1_10.onnx");
    const sha = createHash("sha256").update(readFileSync(modelPath)).digest("hex");
    if (sha !== "1fbcf47654165f2e0b5f1bdf3f123b9e9e1128cd6463717767b76ab4b5246f9a") throw new Error();
    advance("runtime_loading");
    const requireRuntime = createRequire(join(root, "package.json"));
    const ort = requireRuntime("onnxruntime-node");
    advance("session_loading");
    const session = await ort.InferenceSession.create(modelPath, configurations[mode]);
    try {
      const inputName = session.inputNames[0];
      const metadata = Array.isArray(session.inputMetadata)
        ? session.inputMetadata.find((item) => item.name === inputName)
        : session.inputMetadata[inputName];
      if (metadata?.type !== "uint8") throw new Error();
      advance("self_test");
      const durations = [];
      let outputDigest = null;
      for (let pass = 0; pass < 5; pass += 1) {
        const input = new ort.Tensor("uint8", new Uint8Array(270_000), [1, 300, 300, 3]);
        let outputs;
        const before = performance.now();
        try {
          outputs = await session.run({ [inputName]: input });
          durations.push(Math.round((performance.now() - before) * 10) / 10);
          const digest = createHash("sha256");
          for (const name of ["detection_boxes:0", "detection_classes:0", "detection_scores:0", "num_detections:0"]) {
            const data = outputs[name]?.data;
            if (!ArrayBuffer.isView(data) || !data.length || !Array.from(data).every(Number.isFinite)) throw new Error();
            digest.update(name).update(Buffer.from(data.buffer, data.byteOffset, data.byteLength));
          }
          const nextDigest = digest.digest("hex");
          if (outputDigest !== null && outputDigest !== nextDigest) throw new Error();
          outputDigest = nextDigest;
        } finally {
          input.dispose();
          for (const tensor of Object.values(outputs ?? {})) tensor.dispose();
        }
      }
      report({ type: "result", ok: true, self_test_only: true, options: configurations[mode], inference_ms: durations,
        output_digest: outputDigest, rss_mb: Math.round(process.memoryUsage().rss / 1048576), max_rss_kb: process.resourceUsage().maxRSS });
    } finally { await session.release(); }
    completed = true;
    process.disconnect();
    process.exitCode = 0;
  } catch {
    // Paths or native exception text are deliberately not returned.
    report({ type: "result", ok: false, phase, reason: "session_probe_failed" });
    completed = true;
    process.disconnect();
    process.exitCode = 1;
  }
} else if (command === "--run-model" && validMode) {
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "--child", mode], {
    stdio: ["ignore", "ignore", "ignore", "ipc"]
  });
  let phase = "spawn";
  let resultSeen = false;
  let succeeded = false;
  const started = performance.now();
  const terminate = () => child.kill("SIGKILL");
  const timer = setTimeout(() => {
    print({ mode, ok: false, reason: "session_probe_timeout", phase, elapsed_ms: Math.round(performance.now() - started) });
    resultSeen = true;
    terminate();
  }, 120_000);
  process.once("SIGINT", terminate);
  process.once("SIGTERM", terminate);
  child.on("message", (message) => {
    if (message?.type === "phase") phase = message.phase;
    if (message?.type === "result") { resultSeen = true; succeeded = message.ok === true; }
    print(message);
  });
  child.once("error", () => { print({ mode, ok: false, reason: "session_probe_spawn_failed" }); });
  child.once("close", (code) => {
    clearTimeout(timer);
    process.removeListener("SIGINT", terminate);
    process.removeListener("SIGTERM", terminate);
    if (!resultSeen) print({ mode, ok: false, reason: "session_probe_exited", phase });
    process.exitCode = succeeded && code === 0 ? 0 : 1;
  });
} else {
  print({ usage: "node scripts/qa/compare-object-session-startup.mjs --run-model baseline|parallel", model_started: false,
    warning: "Run only in a coordinated model-test window; success is not detection-accuracy or camera-coverage acceptance." });
  if (command) process.exitCode = 64;
}
