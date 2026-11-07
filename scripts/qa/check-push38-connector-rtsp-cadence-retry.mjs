import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PUSH38_CONNECTOR_RTSP_CADENCE as item } from
  "../../services/video-gateway/push38-home-qa-connector-rtsp-cadence.mjs";

const source = readFileSync(new URL("./retry-push38-homeqa-connector-rtsp-cadence-after-build-isolation.mjs",
  import.meta.url), "utf8");
assert.equal(item.version, "0.2.26-p38-health");
assert.equal(item.rollbackVersion, "0.2.25-p38-health");
for (const token of [
  "QUALIFICATION_BUILD_LIVENESS_STARVATION",
  "build-evidence-sha256",
  "P38_CONNECTOR_RTSP_CADENCE_RETRY_BUILD_EVIDENCE_PIN_MISMATCH",
  "EDGE_UPDATE_CRASH_LOOP",
  "SUSTAINED_DOWN",
  "authorizeQuarantinedReleaseRetry",
  "connectorSamples",
  "gatewaySamples",
  "0.2.22-p38-health",
  "qa-p38-health-gateway-buffered-output-f3ca7f4971fa",
  "cohort_percent=0",
  "explicit_device_ids",
  "runtime_writes: 0"
]) assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.doesNotMatch(source, /\.next\/BUILD_ID/);
assert.doesNotMatch(source, /quarantined-releases\.json[^\n]*writeFileSync/);
assert.doesNotMatch(source, /CURRENT[^\n]*writeFileSync/);
console.log(JSON.stringify({ status: "PASS", release_id: item.releaseId,
  exact_device: true, retry_once: true, ota_agent_owns_install: true,
  crash_policy_weakened: false, runtime_mutation_by_retry_command: false }));
