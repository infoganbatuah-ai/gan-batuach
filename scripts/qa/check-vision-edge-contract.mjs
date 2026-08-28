import { readFileSync } from "node:fs";

const readiness = readFileSync(new URL("../../services/video-gateway/edge-readiness.mjs", import.meta.url), "utf8");
const server = readFileSync(new URL("../../services/video-gateway/server.mjs", import.meta.url), "utf8");
const worker = readFileSync(new URL("../../services/video-gateway/vision-edge-worker.swift", import.meta.url), "utf8");
const builder = readFileSync(new URL("../build-vision-edge-worker.mjs", import.meta.url), "utf8");

for (const required of ["visionWorkerSelfTest", "vision_worker_not_built", "vision_worker_self_test_timeout", "face_detection", "human_detection", "image_classification"]) {
  if (!readiness.includes(required)) throw new Error(`Missing Edge Vision readiness control: ${required}`);
}
for (const required of ["VNDetectFaceRectanglesRequest", "VNDetectHumanRectanglesRequest", "VNClassifyImageRequest", "biometric_matching\": false", "face_recognition\": false"]) {
  if (!worker.includes(required)) throw new Error(`Missing safe Apple Vision worker boundary: ${required}`);
}
if (!builder.includes("timeout: 30_000")) throw new Error("Vision worker build must be time-bounded");
for (const required of ["face_detection", "human_detection", "image_classification", "face_recognition: false", "biometric_matching: false"]) {
  if (!server.includes(required)) throw new Error(`Missing truthful Edge capability contract: ${required}`);
}

console.log("Apple Vision edge contract QA PASS");
