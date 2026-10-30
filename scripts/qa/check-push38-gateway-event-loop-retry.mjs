import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PUSH38_GATEWAY_EVENT_LOOP_CLEANUP as release
} from "../../services/video-gateway/push38-home-qa-gateway-event-loop-cleanup.mjs";

const source = readFileSync(
  "scripts/qa/retry-push38-homeqa-gateway-event-loop-cleanup-after-host-isolation.mjs", "utf8");
for (const token of [
  "PUSH38_GATEWAY_EVENT_LOOP_CLEANUP",
  "EDGE_UPDATE_HEALTH_PROCESS_RUNNING_FAILED",
  "observer-push38-live-gateway-dvr-truth-v1",
  "MEDIA_AND_SOURCE_TRUTH_PASS",
  "every_available_source_decoded_at_every_checkpoint",
  "every_available_source_progressing_at_every_checkpoint",
  "authorizeQuarantinedReleaseRetry",
  "priorRetries.length !== 0",
  "status='PAUSED'",
  "status='ACTIVE'",
  "cohort_percent=0",
  "explicit_device_ids",
  "ota_agent_owns_install: true",
  "manager.quarantineRelease(manifest, FAILURE)"
]) assert.ok(source.includes(token), `missing retry safeguard: ${token}`);
assert.equal(release.releaseId,
  "qa-p38-health-gateway-event-loop-cleanup-rb77-83aaf23ce84e");
assert.ok(!source.includes("cohort_percent=100"));
assert.ok(!source.includes("adapter.install"));
assert.ok(!source.includes("manager.apply"));
assert.ok(!source.includes("launchctl kickstart"));
console.log(JSON.stringify({ status: "PASS", release: "0.2.79-p38-health",
  exact_device: true, one_retry_only: true, full_media_evidence_required: true,
  normal_ota_owns_install: true, broad_cohort: false }));
