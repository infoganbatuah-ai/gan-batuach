import { readFileSync } from "node:fs";

const readiness = readFileSync("services/video-gateway/edge-readiness.mjs", "utf8");
const server = readFileSync("services/video-gateway/server.mjs", "utf8");

for (const required of [
  "let objectWorkerSelfTestPromise = null",
  "let objectWorkerRetryAt = 0",
  "object_worker_self_test_pending",
  "OBJECT_WORKER_SELF_TEST_RETRY_MS",
  "Never run model initialization synchronously on Gateway request paths",
  "Let the read-only recorder discovery finish its initial network burst",
  "export function warmLocalEdgeReadiness"
]) {
  if (!readiness.includes(required)) throw new Error(`Missing request-safe edge readiness control: ${required}`);
}

if (!server.includes("warmLocalEdgeReadiness();")) {
  throw new Error("Gateway must warm edge readiness without blocking its listener");
}

console.log("Edge readiness request cache QA PASS");
