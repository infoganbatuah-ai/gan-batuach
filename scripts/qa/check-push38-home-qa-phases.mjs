import assert from "node:assert/strict";
import { HOME_QA_PHASE, homeQaManagedPhaseAllows } from "../../services/video-gateway/home-qa-transition-phase.mjs";

const connectorId = "db267b52-6282-4944-bcee-5d4857698fb0";
const gatewayId = "62df97e2-3c0b-427f-9108-bde029bc10e7";
const transition = "qa-connector-legacy-transition-v2-6e7988808b05";
const connectorFix = "qa-p38-health-connector-pidfix-1b9e9499ffa7";
const connectorRecovery = "qa-p38-health-connector-recovery-9bb5db251379";
const connectorStartup = "qa-p38-health-connector-startup-d44b7e4262f9";
const connectorLiveness = "qa-p38-health-connector-liveness-bb89862c6352";
const connectorParentExit = "qa-p38-health-connector-parent-exit-f7dba974e80f";
const connectorRtspSession = "qa-p38-health-connector-rtsp-session-fb790d87cf53";
const connectorHostContinuity = "qa-p38-health-connector-host-continuity-8b8ec21e41c2";
const connectorDeviceSession = "qa-p38-health-connector-device-session-23a104eb2a64";
const connectorLivenessContinuity = "qa-p38-health-connector-liveness-continuity-6efc70f798aa";
const supersededConnectorFix = "qa-p38-health-connector-1b076f596574";
const gatewayFix = "qa-p38-health-gateway-6c9d08327ec6";
const gatewayAuthRecovery = "qa-p38-health-gateway-auth-4197f1a246f1";
const gatewaySessionStability = "qa-p38-health-gateway-session-e354546bdbf8";
const gatewayCommonCauseRecovery = "qa-p38-health-gateway-common-cause-189e548bc104";
const gatewayFiniteStreamHandoff = "qa-p38-health-gateway-finite-handoff-76781a8e0832";
const manifest = (releaseId, deviceId, profile) => ({ release_id: releaseId,
  channel: "HOME_QA", platform: "darwin", architecture: "arm64", profile,
  rollout: { stage: "INTERNAL_QA", cohort_percent: 0, explicit_device_ids: [deviceId] } });
const connectorTransition = manifest(transition, connectorId, "SOFTWARE_CONNECTOR");
const connectorRemediation = manifest(connectorFix, connectorId, "SOFTWARE_CONNECTOR");
const connectorRecoveryRemediation = manifest(connectorRecovery, connectorId, "SOFTWARE_CONNECTOR");
const connectorStartupRemediation = manifest(connectorStartup, connectorId, "SOFTWARE_CONNECTOR");
const connectorLivenessRemediation = manifest(connectorLiveness, connectorId, "SOFTWARE_CONNECTOR");
const connectorParentExitRemediation = manifest(connectorParentExit, connectorId, "SOFTWARE_CONNECTOR");
const connectorRtspSessionRemediation = manifest(connectorRtspSession, connectorId, "SOFTWARE_CONNECTOR");
const connectorHostContinuityRemediation = manifest(connectorHostContinuity, connectorId, "SOFTWARE_CONNECTOR");
const connectorDeviceSessionRemediation = manifest(connectorDeviceSession, connectorId, "SOFTWARE_CONNECTOR");
const connectorLivenessContinuityRemediation = manifest(connectorLivenessContinuity, connectorId, "SOFTWARE_CONNECTOR");
const gatewayRemediation = manifest(gatewayFix, gatewayId, "PHYSICAL_GATEWAY");
const gatewayAuthRemediation = manifest(gatewayAuthRecovery, gatewayId, "PHYSICAL_GATEWAY");
const gatewaySessionRemediation = manifest(gatewaySessionStability, gatewayId, "PHYSICAL_GATEWAY");
const gatewayCommonCauseRemediation = manifest(gatewayCommonCauseRecovery, gatewayId, "PHYSICAL_GATEWAY");
const gatewayFiniteStreamHandoffRemediation = manifest(gatewayFiniteStreamHandoff, gatewayId, "PHYSICAL_GATEWAY");
assert.equal(HOME_QA_PHASE.LEGACY, "LEGACY_VERIFIED_FOR_TRANSITION");
assert.equal(HOME_QA_PHASE.PENDING, "MANAGED_IDENTITY_PENDING_PROOF");
const connector = { gateway_id: connectorId, deployment_profile: "SOFTWARE_CONNECTOR",
  identity_scheme: "ED25519_V1", credential_version: 1,
  metadata: { home_qa_phase: HOME_QA_PHASE.VERIFIED, home_qa_proof_sha256: "a".repeat(64),
    home_qa_known_good_release_id: transition } };
const gateway = { ...connector, gateway_id: gatewayId, deployment_profile: "PHYSICAL_GATEWAY",
  metadata: { ...connector.metadata, home_qa_known_good_release_id: "qa-legacy-gateway-91bf6814075f" } };
assert.equal(homeQaManagedPhaseAllows({ enrollment: connector, manifest: connectorRemediation }), true);
assert.equal(homeQaManagedPhaseAllows({ enrollment: connector, manifest: connectorRecoveryRemediation }), true);
assert.equal(homeQaManagedPhaseAllows({ enrollment: connector, manifest: connectorStartupRemediation }), true);
assert.equal(homeQaManagedPhaseAllows({ enrollment: connector, manifest: connectorLivenessRemediation }), true);
assert.equal(homeQaManagedPhaseAllows({ enrollment: connector, manifest: connectorParentExitRemediation }), true);
assert.equal(homeQaManagedPhaseAllows({ enrollment: connector, manifest: connectorRtspSessionRemediation }), true);
assert.equal(homeQaManagedPhaseAllows({ enrollment: connector, manifest: connectorHostContinuityRemediation }), true);
assert.equal(homeQaManagedPhaseAllows({ enrollment: connector, manifest: connectorDeviceSessionRemediation }), true);
assert.equal(homeQaManagedPhaseAllows({ enrollment: connector, manifest: connectorLivenessContinuityRemediation }), true);
assert.equal(homeQaManagedPhaseAllows({ enrollment: gateway, manifest: gatewayRemediation }), true);
assert.equal(homeQaManagedPhaseAllows({ enrollment: gateway, manifest: gatewayAuthRemediation }), true);
assert.equal(homeQaManagedPhaseAllows({ enrollment: gateway, manifest: gatewaySessionRemediation }), true);
assert.equal(homeQaManagedPhaseAllows({ enrollment: gateway, manifest: gatewayCommonCauseRemediation }), true);
assert.equal(homeQaManagedPhaseAllows({ enrollment: gateway, manifest: gatewayFiniteStreamHandoffRemediation }), true);
for (const bad of [
  { ...connector, identity_scheme: "LEGACY_HMAC" },
  { ...connector, credential_version: 0 },
  { ...connector, gateway_id: gatewayId },
  { ...connector, metadata: { ...connector.metadata, home_qa_phase: HOME_QA_PHASE.LEGACY } },
  { ...connector, metadata: { ...connector.metadata, home_qa_phase: HOME_QA_PHASE.PENDING } },
  { ...connector, metadata: { ...connector.metadata, home_qa_known_good_release_id: "" } },
  { ...connector, metadata: { ...connector.metadata, home_qa_proof_sha256: "" } }
]) assert.equal(homeQaManagedPhaseAllows({ enrollment: bad, manifest: connectorRemediation }), false);
assert.equal(homeQaManagedPhaseAllows({ enrollment: connector, manifest: connectorTransition }), false);
assert.equal(homeQaManagedPhaseAllows({ enrollment: connector,
  manifest: manifest(supersededConnectorFix, connectorId, "SOFTWARE_CONNECTOR") }), false);
assert.equal(homeQaManagedPhaseAllows({ enrollment: connector, manifest: gatewayRemediation }), false);
assert.equal(homeQaManagedPhaseAllows({ enrollment: connector,
  manifest: { ...connectorRecoveryRemediation, release_id: "qa-p38-health-connector-unreviewed" } }), false);
assert.equal(homeQaManagedPhaseAllows({ enrollment: gateway, manifest: connectorRemediation }), false);
assert.equal(homeQaManagedPhaseAllows({ enrollment: connector, manifest: { ...connectorRemediation,
  rollout: { ...connectorRemediation.rollout, cohort_percent: 100 } } }), false);
console.log(JSON.stringify({ result: "PASS", legacy_transition_is_not_exposed_by_managed_ota: true,
  premature_connector_remediation_denied: true, managed_exact_device_gate: true }));
