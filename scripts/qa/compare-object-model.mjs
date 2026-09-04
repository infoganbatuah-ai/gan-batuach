import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join, basename } from "node:path";
import { spawnSync } from "node:child_process";

// Diagnostic only: a downloaded public model and existing local images. Does
// not change Gateway configuration, retain frames or contact an external API.
const [modelPath, ...images] = process.argv.slice(2);
if (!modelPath || !images.length) throw new Error("Supply an ONNX model and local image paths");
const require = createRequire(join(homedir(), ".local/share/gan-batuach/video-gateway/package.json"));
const ort = require("onnxruntime-node");
const session = await ort.InferenceSession.create(modelPath, { executionProviders: ["cpu"], intraOpNumThreads: 2, interOpNumThreads: 1 });
console.log(JSON.stringify({ inputs: session.inputMetadata, outputs: session.outputMetadata }));
try {
  for (const path of images) {
    const decoded = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", path, "-frames:v", "1", "-vf", "scale=416:416:force_original_aspect_ratio=decrease:flags=bilinear,pad=416:416:0:0:color=0x727272,format=bgr24", "-f", "rawvideo", "pipe:1"], { maxBuffer: 600_000, timeout: 5_000 });
    if (decoded.status !== 0 || decoded.stdout.length !== 416 * 416 * 3) throw new Error("frame_decode_failed");
    const pixels = new Float32Array(416 * 416 * 3);
    for (let c=0;c<3;c++) for(let p=0;p<416*416;p++) pixels[c*416*416+p]=decoded.stdout[p*3+c];
    const input = new ort.Tensor("float32", pixels, [1,3,416,416]);
    const start = performance.now();
    const result = await session.run({ [session.inputNames[0]]:input });
    const output = result[session.outputNames[0]];
    if (output.dims.at(-1) !== 85) throw new Error("unexpected_model_output");
    const detections=[];
    for(let i=0;i<output.data.length;i+=85) {
      let cls=0,score=0;
      for(let j=0;j<80;j++){const candidate=output.data[i+4]*output.data[i+5+j];if(candidate>score){cls=j;score=candidate;}}
      if(score>.55)detections.push({class_id:cls,confidence:Number(score.toFixed(3))});
    }
    console.log(JSON.stringify({source:basename(path),ms:Math.round(performance.now()-start),candidates_before_nms:detections.sort((a,b)=>b.confidence-a.confidence).slice(0,15)}));
    input.dispose();for(const tensor of Object.values(result))tensor.dispose();
  }
} finally { await session.release(); }
