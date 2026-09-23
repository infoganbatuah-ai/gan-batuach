import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { issuePush38HomeQaManifests } from "../release/issue-push38-home-qa-manifests.mjs";
import { issuePush38ConnectorPidfix } from "../release/issue-push38-home-qa-connector-pidfix.mjs";
import { PUSH38_CONNECTOR_PIDFIX } from "../../services/video-gateway/push38-home-qa-connector-pidfix.mjs";
import { issuePush38ConnectorRecovery } from "../release/issue-push38-home-qa-connector-recovery.mjs";
import { PUSH38_CONNECTOR_RECOVERY } from "../../services/video-gateway/push38-home-qa-connector-recovery.mjs";
import { issuePush38ConnectorStartupRecovery } from "../release/issue-push38-home-qa-connector-startup.mjs";
import { PUSH38_CONNECTOR_STARTUP_RECOVERY } from "../../services/video-gateway/push38-home-qa-connector-startup.mjs";
import { issuePush38ConnectorLivenessRecovery } from "../release/issue-push38-home-qa-connector-liveness.mjs";
import { PUSH38_CONNECTOR_LIVENESS_RECOVERY } from "../../services/video-gateway/push38-home-qa-connector-liveness.mjs";
import { issuePush38ConnectorParentExitRecovery } from "../release/issue-push38-home-qa-connector-parent-exit.mjs";
import { PUSH38_CONNECTOR_PARENT_EXIT_RECOVERY } from "../../services/video-gateway/push38-home-qa-connector-parent-exit.mjs";
import { issuePush38ConnectorRtspSessionRecovery } from "../release/issue-push38-home-qa-connector-rtsp-session.mjs";
import { PUSH38_CONNECTOR_RTSP_SESSION_RECOVERY } from "../../services/video-gateway/push38-home-qa-connector-rtsp-session.mjs";
import { issuePush38GatewayAuthRecovery } from "../release/issue-push38-home-qa-gateway-auth-recovery.mjs";
import { PUSH38_GATEWAY_AUTH_RECOVERY } from "../../services/video-gateway/push38-home-qa-gateway-auth-recovery.mjs";
import { issuePush38GatewaySessionStability } from "../release/issue-push38-home-qa-gateway-session-stability.mjs";
import { PUSH38_GATEWAY_SESSION_STABILITY } from "../../services/video-gateway/push38-home-qa-gateway-session-stability.mjs";
import { verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";

const root = mkdtempSync(join(tmpdir(), "observer-p38-issuance-test-"));
try {
  const key = generateKeyPairSync("ed25519");
  const publicBytes = key.publicKey.export({ format: "der", type: "spki" });
  const arn = "arn:aws:kms:us-east-1:111122223333:key/11111111-2222-3333-4444-555555555555";
  const keyId = "fixture-push38-release";
  const env = { GITHUB_REPOSITORY: "infoganbatuah-ai/gan-batuach",
    GITHUB_REF: "refs/heads/codex/push-38-aws-signing", RUNNER_TEMP: root,
    HOME_QA_OUTPUT_DIR: join(root, "issued"), SIGNER_KEY_ARN: arn, SIGNER_KEY_ID: keyId,
    SIGNER_PUBLIC_KEY_SHA256: createHash("sha256").update(publicBytes).digest("hex"),
    HOME_QA_R2_ORIGIN: "https://693f824a750afcc264fe6ee58c8a86ab.r2.cloudflarestorage.com",
    GITHUB_SHA: "a".repeat(40), PUSH38_CANDIDATE_SHA: "b".repeat(40) };
  const call = async (operation, input) => {
    assert.equal(input.KeyId, arn);
    if (operation === "get-public-key") return { KeyId: arn, KeySpec: "ECC_NIST_EDWARDS25519",
      KeyUsage: "SIGN_VERIFY", SigningAlgorithms: ["ED25519_SHA_512"],
      PublicKey: publicBytes.toString("base64") };
    if (operation === "describe-key") return { KeyMetadata: { Arn: arn,
      KeySpec: "ECC_NIST_EDWARDS25519", KeyUsage: "SIGN_VERIFY", KeyState: "Enabled",
      KeyManager: "CUSTOMER", Origin: "AWS_KMS" } };
    assert.equal(operation, "sign");
    return { KeyId: arn, SigningAlgorithm: "ED25519_SHA_512",
      Signature: sign(null, Buffer.from(input.Message, "base64"), key.privateKey).toString("base64") };
  };
  await assert.rejects(issuePush38HomeQaManifests({ env: { ...env, GITHUB_REF: "refs/heads/main" }, call }),
    /P38_HOME_QA_SIGNING_CONTEXT_INVALID/);
  const result = await issuePush38HomeQaManifests({ env, call });
  assert.equal(result.length, 3);
  for (const row of result) {
    const manifest = JSON.parse(readFileSync(join(env.HOME_QA_OUTPUT_DIR, `${row.role.toLowerCase()}.json`)));
    assert.equal(verifyEdgeUpdateManifest(manifest, { [keyId]: publicBytes.toString("base64url") }).ok, true);
    assert.equal(manifest.rollout.cohort_percent, 0);
    assert.deepEqual(manifest.rollout.explicit_device_ids, [row.device_id]);
  }
  const pidfixOutput = join(root, "pidfix-issued");
  await assert.rejects(issuePush38ConnectorPidfix({ env: { ...env,
    HOME_QA_OUTPUT_DIR: pidfixOutput, PUSH38_CANDIDATE_SHA: "f".repeat(40) }, call }),
  /P38_PIDFIX_SIGNING_CONTEXT_INVALID/);
  const pidfix = await issuePush38ConnectorPidfix({ env: { ...env,
    HOME_QA_OUTPUT_DIR: pidfixOutput, PUSH38_CANDIDATE_SHA: PUSH38_CONNECTOR_PIDFIX.buildSha }, call });
  const pidfixManifest = JSON.parse(readFileSync(join(pidfixOutput, "connector_remediation_pidfix.json")));
  assert.equal(pidfix.release_id, PUSH38_CONNECTOR_PIDFIX.releaseId);
  assert.equal(verifyEdgeUpdateManifest(pidfixManifest, { [keyId]: publicBytes.toString("base64url") }).ok, true);
  assert.equal(pidfixManifest.artifact_sha256, PUSH38_CONNECTOR_PIDFIX.digest);
  assert.deepEqual(pidfixManifest.rollout.explicit_device_ids, [PUSH38_CONNECTOR_PIDFIX.deviceId]);
  const recoveryOutput = join(root, "recovery-issued");
  await assert.rejects(issuePush38ConnectorRecovery({ env: { ...env,
    HOME_QA_OUTPUT_DIR: recoveryOutput, PUSH38_CANDIDATE_SHA: "f".repeat(40) }, call }),
  /P38_RECOVERY_SIGNING_CONTEXT_INVALID/);
  const recovery = await issuePush38ConnectorRecovery({ env: { ...env,
    HOME_QA_OUTPUT_DIR: recoveryOutput, PUSH38_CANDIDATE_SHA: PUSH38_CONNECTOR_RECOVERY.buildSha }, call });
  const recoveryManifest = JSON.parse(readFileSync(join(recoveryOutput, "connector_remediation_recovery.json")));
  assert.equal(recovery.release_id, PUSH38_CONNECTOR_RECOVERY.releaseId);
  assert.equal(verifyEdgeUpdateManifest(recoveryManifest, { [keyId]: publicBytes.toString("base64url") }).ok, true);
  assert.equal(recoveryManifest.artifact_sha256, PUSH38_CONNECTOR_RECOVERY.digest);
  assert.deepEqual(recoveryManifest.rollout.explicit_device_ids, [PUSH38_CONNECTOR_RECOVERY.deviceId]);
  const startupOutput = join(root, "startup-issued");
  await assert.rejects(issuePush38ConnectorStartupRecovery({ env: { ...env,
    HOME_QA_OUTPUT_DIR: startupOutput, PUSH38_CANDIDATE_SHA: "f".repeat(40) }, call }),
  /P38_STARTUP_SIGNING_CONTEXT_INVALID/);
  const startup = await issuePush38ConnectorStartupRecovery({ env: { ...env,
    HOME_QA_OUTPUT_DIR: startupOutput, PUSH38_CANDIDATE_SHA: PUSH38_CONNECTOR_STARTUP_RECOVERY.buildSha }, call });
  const startupManifest = JSON.parse(readFileSync(join(startupOutput, "connector_remediation_startup.json")));
  assert.equal(startup.release_id, PUSH38_CONNECTOR_STARTUP_RECOVERY.releaseId);
  assert.equal(verifyEdgeUpdateManifest(startupManifest, { [keyId]: publicBytes.toString("base64url") }).ok, true);
  assert.equal(startupManifest.artifact_sha256, PUSH38_CONNECTOR_STARTUP_RECOVERY.digest);
  assert.deepEqual(startupManifest.rollout.explicit_device_ids, [PUSH38_CONNECTOR_STARTUP_RECOVERY.deviceId]);
  const livenessOutput = join(root, "liveness-issued");
  await assert.rejects(issuePush38ConnectorLivenessRecovery({ env: { ...env,
    HOME_QA_OUTPUT_DIR: livenessOutput, PUSH38_CANDIDATE_SHA: "f".repeat(40) }, call }),
  /P38_LIVENESS_SIGNING_CONTEXT_INVALID/);
  const liveness = await issuePush38ConnectorLivenessRecovery({ env: { ...env,
    HOME_QA_OUTPUT_DIR: livenessOutput, PUSH38_CANDIDATE_SHA: PUSH38_CONNECTOR_LIVENESS_RECOVERY.buildSha }, call });
  const livenessManifest = JSON.parse(readFileSync(join(livenessOutput, "connector_remediation_liveness.json")));
  assert.equal(liveness.release_id, PUSH38_CONNECTOR_LIVENESS_RECOVERY.releaseId);
  assert.equal(verifyEdgeUpdateManifest(livenessManifest, { [keyId]: publicBytes.toString("base64url") }).ok, true);
  assert.equal(livenessManifest.artifact_sha256, PUSH38_CONNECTOR_LIVENESS_RECOVERY.digest);
  assert.deepEqual(livenessManifest.rollout.explicit_device_ids, [PUSH38_CONNECTOR_LIVENESS_RECOVERY.deviceId]);
  const parentExitOutput = join(root, "parent-exit-issued");
  await assert.rejects(issuePush38ConnectorParentExitRecovery({ env: { ...env,
    HOME_QA_OUTPUT_DIR: parentExitOutput, PUSH38_CANDIDATE_SHA: "f".repeat(40) }, call }),
  /P38_PARENT_EXIT_SIGNING_CONTEXT_INVALID/);
  const parentExit = await issuePush38ConnectorParentExitRecovery({ env: { ...env,
    HOME_QA_OUTPUT_DIR: parentExitOutput,
    PUSH38_CANDIDATE_SHA: PUSH38_CONNECTOR_PARENT_EXIT_RECOVERY.buildSha }, call });
  const parentExitManifest = JSON.parse(readFileSync(join(parentExitOutput,
    "connector_remediation_parent_exit.json")));
  assert.equal(parentExit.release_id, PUSH38_CONNECTOR_PARENT_EXIT_RECOVERY.releaseId);
  assert.equal(verifyEdgeUpdateManifest(parentExitManifest,
    { [keyId]: publicBytes.toString("base64url") }).ok, true);
  assert.equal(parentExitManifest.artifact_sha256, PUSH38_CONNECTOR_PARENT_EXIT_RECOVERY.digest);
  assert.deepEqual(parentExitManifest.rollout.explicit_device_ids,
    [PUSH38_CONNECTOR_PARENT_EXIT_RECOVERY.deviceId]);
  const rtspSessionOutput = join(root, "rtsp-session-issued");
  await assert.rejects(issuePush38ConnectorRtspSessionRecovery({ env: { ...env,
    HOME_QA_OUTPUT_DIR: rtspSessionOutput, PUSH38_CANDIDATE_SHA: "f".repeat(40) }, call }),
  /P38_RTSP_SESSION_SIGNING_CONTEXT_INVALID/);
  const rtspSession = await issuePush38ConnectorRtspSessionRecovery({ env: { ...env,
    HOME_QA_OUTPUT_DIR: rtspSessionOutput,
    PUSH38_CANDIDATE_SHA: PUSH38_CONNECTOR_RTSP_SESSION_RECOVERY.buildSha }, call });
  const rtspSessionManifest = JSON.parse(readFileSync(join(rtspSessionOutput,
    "connector_remediation_rtsp_session.json")));
  assert.equal(rtspSession.release_id, PUSH38_CONNECTOR_RTSP_SESSION_RECOVERY.releaseId);
  assert.equal(verifyEdgeUpdateManifest(rtspSessionManifest,
    { [keyId]: publicBytes.toString("base64url") }).ok, true);
  assert.equal(rtspSessionManifest.artifact_sha256, PUSH38_CONNECTOR_RTSP_SESSION_RECOVERY.digest);
  assert.deepEqual(rtspSessionManifest.rollout.explicit_device_ids,
    [PUSH38_CONNECTOR_RTSP_SESSION_RECOVERY.deviceId]);
  const gatewayAuthOutput = join(root, "gateway-auth-issued");
  await assert.rejects(issuePush38GatewayAuthRecovery({ env: { ...env,
    HOME_QA_OUTPUT_DIR: gatewayAuthOutput, PUSH38_CANDIDATE_SHA: "f".repeat(40) }, call }),
  /P38_GATEWAY_AUTH_SIGNING_CONTEXT_INVALID/);
  const gatewayAuth = await issuePush38GatewayAuthRecovery({ env: { ...env,
    HOME_QA_OUTPUT_DIR: gatewayAuthOutput, PUSH38_CANDIDATE_SHA: PUSH38_GATEWAY_AUTH_RECOVERY.buildSha }, call });
  const gatewayAuthManifest = JSON.parse(readFileSync(join(gatewayAuthOutput, "gateway_remediation_auth.json")));
  assert.equal(gatewayAuth.release_id, PUSH38_GATEWAY_AUTH_RECOVERY.releaseId);
  assert.equal(verifyEdgeUpdateManifest(gatewayAuthManifest, { [keyId]: publicBytes.toString("base64url") }).ok, true);
  assert.equal(gatewayAuthManifest.artifact_sha256, PUSH38_GATEWAY_AUTH_RECOVERY.digest);
  assert.deepEqual(gatewayAuthManifest.rollout.explicit_device_ids, [PUSH38_GATEWAY_AUTH_RECOVERY.deviceId]);
  const gatewaySessionOutput = join(root, "gateway-session-issued");
  await assert.rejects(issuePush38GatewaySessionStability({ env: { ...env,
    HOME_QA_OUTPUT_DIR: gatewaySessionOutput, PUSH38_CANDIDATE_SHA: "f".repeat(40) }, call }),
  /P38_GATEWAY_SESSION_SIGNING_CONTEXT_INVALID/);
  const gatewaySession = await issuePush38GatewaySessionStability({ env: { ...env,
    HOME_QA_OUTPUT_DIR: gatewaySessionOutput,
    PUSH38_CANDIDATE_SHA: PUSH38_GATEWAY_SESSION_STABILITY.buildSha }, call });
  const gatewaySessionManifest = JSON.parse(readFileSync(join(gatewaySessionOutput,
    "gateway_remediation_session_stability.json")));
  assert.equal(gatewaySession.release_id, PUSH38_GATEWAY_SESSION_STABILITY.releaseId);
  assert.equal(verifyEdgeUpdateManifest(gatewaySessionManifest,
    { [keyId]: publicBytes.toString("base64url") }).ok, true);
  assert.equal(gatewaySessionManifest.artifact_sha256, PUSH38_GATEWAY_SESSION_STABILITY.digest);
  assert.deepEqual(gatewaySessionManifest.rollout.explicit_device_ids,
    [PUSH38_GATEWAY_SESSION_STABILITY.deviceId]);
  console.log(JSON.stringify({ result: "PASS", signed_fixture_manifests: result.length,
    signed_pidfix_fixture_manifests: 1, signed_recovery_fixture_manifests: 1,
    signed_startup_recovery_fixture_manifests: 1, signed_liveness_recovery_fixture_manifests: 1,
    signed_parent_exit_recovery_fixture_manifests: 1,
    signed_rtsp_session_recovery_fixture_manifests: 1,
    signed_gateway_auth_recovery_fixture_manifests: 1,
    signed_gateway_session_stability_fixture_manifests: 1,
    unauthorized_branch_rejected: true, live_aws: "NOT_TESTED" }));
} finally { rmSync(root, { recursive: true, force: true }); }
