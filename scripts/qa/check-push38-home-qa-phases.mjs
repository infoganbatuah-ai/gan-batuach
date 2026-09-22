import assert from "node:assert/strict";
import { HOME_QA_PHASE, homeQaManagedPhaseAllows } from "../../services/video-gateway/home-qa-transition-phase.mjs";

const connectorId = "db267b52-6282-4944-bcee-5d4857698fb0";
const gatewayId = "62df97e2-3c0b-427f-9108-bde029bc10e7";
const transition = "qa-connector-legacy-transition-v2-6e7988808b05";
const connectorFix = "qa-p38-health-connector-pidfix-1b9e9499ffa7";
const connectorRecovery = "qa-p38-health-connector-recovery-9bb5db251379";
const supersededConnectorFix = "qa-p38-health-connector-1b076f596574";
const gatewayFix = "qa-p38-health-gateway-6c9d08327ec6";
const manifest = (releaseId, deviceId, profile) => ({ release_id: releaseId,
  channel: "HOME_QA", platform: "darwin", architecture: "arm64", profile,
  rollout: { stage: "INTERNAL_QA", cohort_percent: 0, explicit_device_ids: [deviceId] } });
const connectorTransition = manifest(transition, connectorId, "SOFTWARE_CONNECTOR");
const connectorRemediation = manifest(connectorFix, connectorId, "SOFTWARE_CONNECTOR");
const connectorRecoveryRemediation = manifest(connectorRecovery, connectorId, "SOFTWARE_CONNECTOR");
const gatewayRemediation = manifest(gatewayFix, gatewayId, "PHYSICAL_GATEWAY");
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
assert.equal(homeQaManagedPhaseAllows({ enrollment: gateway, manifest: gatewayRemediation }), true);
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
