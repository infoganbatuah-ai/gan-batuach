import { edgeReleaseScopeAllows } from "./edge-release-object.mjs";

export const HOME_QA_PHASE = Object.freeze({
  LEGACY: "LEGACY_VERIFIED_FOR_TRANSITION",
  PENDING: "MANAGED_IDENTITY_PENDING_PROOF",
  VERIFIED: "MANAGED_IDENTITY_VERIFIED"
});

const transitionRelease = "qa-connector-legacy-transition-v2-6e7988808b05";
const connectorRemediation = "qa-p38-health-connector-pidfix-1b9e9499ffa7";
const connectorRecoveryRemediation = "qa-p38-health-connector-recovery-9bb5db251379";
const connectorStartupRecovery = "qa-p38-health-connector-startup-d44b7e4262f9";
const connectorLivenessRecovery = "qa-p38-health-connector-liveness-bb89862c6352";
const connectorParentExitRecovery = "qa-p38-health-connector-parent-exit-f7dba974e80f";
const connectorRtspSessionRecovery = "qa-p38-health-connector-rtsp-session-fb790d87cf53";
const gatewayRemediation = "qa-p38-health-gateway-6c9d08327ec6";
const gatewayAuthRecovery = "qa-p38-health-gateway-auth-4197f1a246f1";
const gatewaySessionStability = "qa-p38-health-gateway-session-e354546bdbf8";
const gatewayCommonCauseRecovery = "qa-p38-health-gateway-common-cause-189e548bc104";
const gatewayBaseline = "qa-legacy-gateway-91bf6814075f";

// This is an additional HOME_QA gate, never a replacement for signed-manifest,
// managed-device authentication, hash, trust or downgrade verification.
export function homeQaManagedPhaseAllows({ enrollment, manifest }) {
  const metadata = enrollment?.metadata;
  if (enrollment?.identity_scheme !== "ED25519_V1" ||
    !Number.isInteger(enrollment.credential_version) || enrollment.credential_version < 1 ||
    metadata?.home_qa_phase !== HOME_QA_PHASE.VERIFIED ||
    typeof metadata?.home_qa_proof_sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(metadata.home_qa_proof_sha256)) return false;
  if (manifest?.channel !== "HOME_QA" || manifest.rollout?.stage !== "INTERNAL_QA" ||
    manifest.rollout?.cohort_percent !== 0 ||
    !edgeReleaseScopeAllows(manifest, { deviceId: enrollment.gateway_id,
      profile: enrollment.deployment_profile, platform: "darwin", architecture: "arm64", channel: "HOME_QA" }))
    return false;
  if (manifest.release_id === transitionRelease) return false;
  if (enrollment.deployment_profile === "SOFTWARE_CONNECTOR")
    return [connectorRemediation, connectorRecoveryRemediation, connectorStartupRecovery,
      connectorLivenessRecovery, connectorParentExitRecovery, connectorRtspSessionRecovery]
      .includes(manifest.release_id) &&
      metadata.home_qa_known_good_release_id === transitionRelease;
  if (enrollment.deployment_profile === "PHYSICAL_GATEWAY")
    return [gatewayRemediation, gatewayAuthRecovery, gatewaySessionStability,
      gatewayCommonCauseRecovery].includes(manifest.release_id) &&
      metadata.home_qa_known_good_release_id === gatewayBaseline;
  return false;
}
