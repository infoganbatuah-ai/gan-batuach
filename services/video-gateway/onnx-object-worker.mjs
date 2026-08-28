import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import * as ort from "onnxruntime-node";

const modelPath = process.env.VIDEO_GATEWAY_OBJECT_MODEL_PATH || join(homedir(), ".local", "share", "gan-batuach", "video-gateway", "models", "ssd_mobilenet_v1_10.onnx");
const expectedSha256 = "1fbcf47654165f2e0b5f1bdf3f123b9e9e1128cd6463717767b76ab4b5246f9a";
const provenance = {
  model: "ssd_mobilenet_v1_10",
  source: "https://huggingface.co/onnxmodelzoo/ssd_mobilenet_v1_10",
  license: "Apache-2.0",
  expected_sha256: expectedSha256
};

const cocoLabels = {
  1: "person", 2: "bicycle", 3: "car", 4: "motorcycle", 5: "airplane", 6: "bus", 7: "train", 8: "truck", 9: "boat",
  10: "traffic_light", 11: "fire_hydrant", 13: "stop_sign", 14: "parking_meter", 15: "bench", 16: "bird", 17: "cat", 18: "dog",
  19: "horse", 20: "sheep", 21: "cow", 22: "elephant", 23: "bear", 24: "zebra", 25: "giraffe", 27: "backpack",
  28: "umbrella", 31: "handbag", 32: "tie", 33: "suitcase", 34: "frisbee", 35: "skis", 36: "snowboard", 37: "sports_ball",
  39: "baseball_bat", 40: "baseball_glove", 41: "skateboard", 42: "surfboard", 43: "tennis_racket", 44: "bottle", 46: "wine_glass",
  47: "cup", 48: "fork", 49: "knife", 50: "spoon", 51: "bowl", 52: "banana", 53: "apple", 54: "sandwich", 55: "orange",
  56: "broccoli", 57: "carrot", 58: "hot_dog", 59: "pizza", 60: "donut", 61: "cake", 62: "chair", 63: "couch", 64: "potted_plant",
  65: "bed", 67: "dining_table", 70: "toilet", 72: "tv", 73: "laptop", 74: "mouse", 75: "remote", 76: "keyboard", 77: "cell_phone",
  78: "microwave", 79: "oven", 80: "toaster", 81: "sink", 82: "refrigerator", 84: "book", 85: "clock", 86: "vase",
  87: "scissors", 88: "teddy_bear", 89: "hair_drier", 90: "toothbrush"
};

function output(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

const command = process.argv[2];
if (!["--self-test", "--infer-rgb"].includes(command)) {
  process.stderr.write("usage: onnx-object-worker --self-test|--infer-rgb\n");
  process.exit(64);
}

if (!existsSync(modelPath)) {
  output({ ok: false, reason: "object_model_not_installed", provenance });
  process.exit(1);
}

const actualSha256 = createHash("sha256").update(readFileSync(modelPath)).digest("hex");
if (actualSha256 !== expectedSha256) {
  output({ ok: false, reason: "object_model_checksum_mismatch", provenance });
  process.exit(1);
}

try {
  // This model is verified against the portable CPU provider. CoreML can build a
  // temporary compilation cache outside the Gateway sandbox, so claiming CoreML
  // readiness here would make the contract depend on a non-deterministic path.
  const session = await ort.InferenceSession.create(modelPath, { executionProviders: ["cpu"] });
  const inputName = session.inputNames[0];
  const metadata = Array.isArray(session.inputMetadata)
    ? session.inputMetadata.find((item) => item.name === inputName)
    : session.inputMetadata[inputName];
  const dimensions = (metadata?.dimensions || metadata?.shape || []).map((value, index) => {
    const numeric = Number(value);
    return Number.isInteger(numeric) && numeric > 0 ? numeric : index === 0 ? 1 : index === 1 || index === 2 ? 300 : 3;
  });
  const TensorArray = metadata?.type === "uint8" ? Uint8Array : metadata?.type === "float32" ? Float32Array : null;
  if (!inputName || !TensorArray || dimensions.length !== 4) {
    throw new Error("unsupported_object_model_input");
  }
  const valueCount = dimensions.reduce((total, value) => total * value, 1);
  const inputBytes = command === "--infer-rgb" ? await new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    process.stdin.on("data", (chunk) => {
      const remaining = valueCount - size;
      if (remaining > 0) {
        const accepted = chunk.subarray(0, remaining);
        chunks.push(accepted);
        size += accepted.length;
      }
    });
    process.stdin.on("end", () => resolve(Buffer.concat(chunks)));
    process.stdin.on("error", reject);
  }) : null;
  if (inputBytes && inputBytes.length !== valueCount) throw new Error("object_inference_input_size_invalid");
  const tensorData = inputBytes ? new TensorArray(inputBytes) : new TensorArray(valueCount);
  const outputs = await session.run({ [inputName]: new ort.Tensor(metadata.type, tensorData, dimensions) });
  if (!Object.keys(outputs).length) throw new Error("object_model_inference_empty");
  if (command === "--infer-rgb") {
    const boxes = outputs["detection_boxes:0"]?.data;
    const classes = outputs["detection_classes:0"]?.data;
    const scores = outputs["detection_scores:0"]?.data;
    const count = Math.min(20, Math.floor(Number(outputs["num_detections:0"]?.data?.[0] || 0)));
    if (!boxes || !classes || !scores) throw new Error("object_inference_output_invalid");
    const detections = [];
    for (let index = 0; index < count; index += 1) {
      const confidence = Number(scores[index] || 0);
      const classId = Math.round(Number(classes[index] || 0));
      if (confidence < 0.55 || !cocoLabels[classId]) continue;
      detections.push({ label: cocoLabels[classId], confidence: Number(confidence.toFixed(3)), box: Array.from(boxes.slice(index * 4, index * 4 + 4)).map((value) => Number(Number(value).toFixed(4))) });
    }
    output({ ok: true, runtime: "onnxruntime-node", execution_provider: "cpu", provenance, detections, no_raw_frame_returned: true });
    process.exit(0);
  }
  output({
    ok: true,
    runtime: "onnxruntime-node",
    execution_provider: "cpu",
    provenance,
    inputs: session.inputNames.length,
    outputs: session.outputNames.length,
    inference_self_test: true,
    capabilities: { object_detection: true, face_recognition: false, biometric_matching: false }
  });
} catch {
  output({ ok: false, reason: "object_model_load_failed", provenance });
  process.exit(1);
}
