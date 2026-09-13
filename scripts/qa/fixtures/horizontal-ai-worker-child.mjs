import { createDurableAiJobQueue } from "../../../services/video-gateway/durable-ai-job-queue.mjs";
import { createPortableInferenceWorker } from "../../../services/video-gateway/portable-inference-worker.mjs";
import { pbkdf2Sync } from "node:crypto";

const [databasePath, workerId] = process.argv.slice(2);
if (!databasePath || !workerId) process.exit(2);
const tenants = ["tenant-a", "tenant-b", "tenant-hot", ...Array.from({ length: 10 }, (_, index) => `tenant-${index}`)];
const sites = ["site-a", "site-b", "site-hot", ...Array.from({ length: 50 }, (_, index) => `site-${index}`)];
const identity = { authenticated: true, revoked: false, device_id: workerId, tenant_ids: tenants, site_ids: sites };
const queue = createDurableAiJobQueue({ databasePath, policy: { leaseMs: 300 }, workerAuthorizer: worker => worker.identity?.device_id?.startsWith("qa-worker-") === true });
const worker = createPortableInferenceWorker({ workerId, environment: "ISOLATED_PROCESS", identity,
  capabilities: ["OBJECT_DETECTION"], infer: async job => {
    // Deterministic CPU work makes the scale comparison independent of timer
    // coalescing or laptop power-management behavior.
    pbkdf2Sync(job.job_id, "observer-push36-scale", 100_000, 32, "sha256");
    return { detections: [], model_provenance: { model: "scale-fixture", expected_sha256: "scale-v1", runtime: "isolated-node" }, observation_timestamp: job.observation_timestamp };
  } });
let idle = 0, completed = 0;
const completedJobIds = new Set();
const cpuStart = process.cpuUsage();
try {
  // Stay beyond the 300 ms test lease so a peer's interrupted ACK can be
  // reclaimed under real SQLite writer contention.
  while (idle < 50) {
    const result = await worker.processOne(queue);
    if (result.status === "IDLE") { idle++; await new Promise(resolve => setTimeout(resolve, 10)); }
    else {
      idle = 0;
      if (result.status === "COMPLETED") {
        completed++;
        if (result.job_id) completedJobIds.add(result.job_id);
      }
    }
  }
  const cpu = process.cpuUsage(cpuStart);
  process.stdout.write(JSON.stringify({ worker_id: workerId, completed, completed_job_ids: [...completedJobIds].sort(), worker_cpu_ms: Number(((cpu.user + cpu.system) / 1000).toFixed(3)), snapshot: worker.snapshot() }));
} finally { queue.close(); }
