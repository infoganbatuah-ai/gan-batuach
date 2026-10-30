import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildPush38ConnectorRuntimePidRecoveryManifest,
  PUSH38_CONNECTOR_RUNTIME_PID_RECOVERY as item
} from "../../services/video-gateway/push38-home-qa-connector-runtime-pid.mjs";

const origin = "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com";
const { document } = buildPush38ConnectorRuntimePidRecoveryManifest({
  signingKeyId: "observer-kms-release-v1", artifactOrigin: origin,
  releasedAt: new Date().toISOString()
});
assert.equal(document.release_id, item.releaseId);
assert.equal(document.version, "0.2.18-p38-health");
assert.equal(document.build_sha, "a890469c38a5bd3d1b4572a05121cef9bd6d7fce");
assert.equal(document.artifact_sha256, item.digest);
assert.equal(document.artifact_size, item.size);
assert.equal(document.profile, "SOFTWARE_CONNECTOR");
assert.equal(document.channel, "HOME_QA");
assert.equal(document.compatibility.minimum_current_version, "0.2.14-p38-health");
assert.equal(document.compatibility.maximum_current_version, "0.2.14-p38-health");
assert.equal(document.rollout.cohort_percent, 0);
assert.deepEqual(document.rollout.explicit_device_ids, [item.deviceId]);
assert.match(document.artifact_url, new RegExp(`/home-qa/${item.releaseId}/${item.digest}\\.tar\\.gz$`));
const adapter = readFileSync("services/video-gateway/edge-macos-installed-adapter.mjs", "utf8");
assert.match(adapter,
  /resolve\(runner\)\.startsWith\(`\$\{join\(root, "slots"\)\}\/`\)[\s\S]*return owner\.pid/);
assert.doesNotMatch(adapter,
  /source\.ProgramArguments\?\.\[0\] !== CAFFEINATE_PATH[\s\S]*ppid === owner\.pid/);
const installer = readFileSync("scripts/qa/install-push38-homeqa-ota-agent.mjs", "utf8");
assert.match(installer, /--connector-runtime-pid-upgrade/);
assert.match(installer, /qa-p38-management-runtime-pid-95c3b60ed951/);
assert.match(installer, /qa-p38-health-connector-device-session-23a104eb2a64/);
console.log(JSON.stringify({ result: "PASS", release_id: item.releaseId,
  exact_device: true, broad_cohort: false, functional_runtime_switch: false }));
