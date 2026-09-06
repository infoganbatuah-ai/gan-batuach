#!/usr/bin/env node
/**
 * Local-only diagnostic for the production SSD MobileNet frame contract.
 *
 * Give this script temporary MPEG-TS relay segments captured from one source.
 * It decodes the exact first keyframe twice (current stretch and letterbox),
 * feeds both forms to the installed Gateway model, and prints metadata only.
 * It never writes or returns frame pixels.
 */
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { readFile } from "node:fs/promises";

const expectedSha256 = "1fbcf47654165f2e0b5f1bdf3f123b9e9e1128cd6463717767b76ab4b5246f9a";
const runtimeRoot = join(homedir(), ".local", "share", "gan-batuach", "video-gateway");
const require = createRequire(join(runtimeRoot, "package.json"));
const ort = require("onnxruntime-node");
const modelPath = process.env.VIDEO_GATEWAY_OBJECT_MODEL_PATH || join(runtimeRoot, "models", "ssd_mobilenet_v1_10.onnx");
const segmentPaths = process.argv.slice(2);
const personClassId = 1;
const threshold = 0.55;

if (!segmentPaths.length) {
  process.stderr.write("usage: analyze-object-frame-preprocessing.mjs <temporary-segment.ts> [...segments]\n");
  process.exit(64);
}

const modelHash = createHash("sha256").update(await readFile(modelPath)).digest("hex");
if (modelHash !== expectedSha256) throw new Error("object_model_checksum_mismatch");

function runFfmpeg(segmentPath, filter) {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-threads", "1", "-filter_threads", "1", "-copyts", "-start_at_zero", "-f", "mpegts", "-i", segmentPath, "-map", "0:v:0", "-an", "-frames:v", "1", "-vf", filter, "-fps_mode", "passthrough", "-f", "rawvideo", "pipe:1"], { stdio: ["ignore", "pipe", "pipe"] });
    const chunks = [];
    let stderr = "";
    child.stdout.on("data", chunk => chunks.push(chunk));
    child.stderr.on("data", chunk => { stderr += chunk.toString("utf8"); });
    child.on("error", reject);
    child.on("close", code => {
      const bytes = Buffer.concat(chunks);
      if (code !== 0 || bytes.length !== 300 * 300 * 3) return reject(new Error(`frame_decode_failed:${basename(segmentPath)}:${stderr.slice(0, 160)}`));
      resolve(bytes);
    });
  });
}

function sequenceOf(path) {
  const result = /(?:segment-|_)(\d+)(?:\.ts)?$/.exec(basename(path));
  return result ? Number(result[1]) : null;
}

function compactBox(boxes, index) {
  return Array.from(boxes.slice(index * 4, index * 4 + 4)).map(value => Number(Number(value).toFixed(4)));
}

const session = await ort.InferenceSession.create(modelPath, { executionProviders: ["cpu"], executionMode: "parallel", intraOpNumThreads: 1, interOpNumThreads: 2 });
const inputName = session.inputNames[0];
const inputType = "uint8";
const dimensions = [1, 300, 300, 3];

async function infer(raw) {
  const input = new ort.Tensor(inputType, new Uint8Array(raw), dimensions);
  const startedAt = performance.now();
  const outputs = await session.run({ [inputName]: input });
  const elapsedMs = Math.round((performance.now() - startedAt) * 10) / 10;
  try {
    const boxes = outputs["detection_boxes:0"].data;
    const classes = outputs["detection_classes:0"].data;
    const scores = outputs["detection_scores:0"].data;
    const count = Math.min(100, Math.floor(Number(outputs["num_detections:0"].data[0] || 0)));
    const candidates = Array.from({ length: count }, (_, index) => ({ class_id: Math.round(Number(classes[index] || 0)), confidence: Number(Number(scores[index] || 0).toFixed(5)), box: compactBox(boxes, index) }));
    const person = candidates.filter(candidate => candidate.class_id === personClassId);
    const top = candidates.filter(candidate => candidate.confidence > 0.001).slice(0, 5);
    return {
      latency_ms: elapsedMs,
      count,
      person_raw_max_confidence: person.length ? Math.max(...person.map(candidate => candidate.confidence)) : 0,
      person_candidates: person.slice(0, 3),
      person_after_threshold: person.filter(candidate => candidate.confidence >= threshold),
      top_candidates: top
    };
  } finally {
    input.dispose();
    for (const output of Object.values(outputs)) output.dispose();
  }
}

const modes = {
  stretch: "scale=300:300,format=rgb24",
  letterbox: "scale=300:300:force_original_aspect_ratio=decrease,pad=300:300:(ow-iw)/2:(oh-ih)/2:color=black,format=rgb24"
};
const results = [];
for (const segmentPath of segmentPaths) {
  const result = { segment: basename(segmentPath), sequence: sequenceOf(segmentPath) };
  for (const [mode, filter] of Object.entries(modes)) {
    const raw = await runFfmpeg(segmentPath, filter);
    result[mode] = { pixel_sha256: createHash("sha256").update(raw).digest("hex"), ...(await infer(raw)) };
  }
  results.push(result);
}
await session.release();
process.stdout.write(`${JSON.stringify({
  model: "ssd_mobilenet_v1_10",
  model_sha256_verified: true,
  input: { name: inputName, type: inputType, dimensions, pixel_range: "0-255", layout: "NHWC" },
  threshold,
  note: "SSD graph supplies post-NMS candidates; this diagnostic applies no additional NMS.",
  results
}, null, 2)}\n`);
