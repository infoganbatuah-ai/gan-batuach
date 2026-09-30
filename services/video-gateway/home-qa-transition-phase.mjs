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
const connectorHostContinuityRecovery = "qa-p38-health-connector-host-continuity-8b8ec21e41c2";
const connectorDeviceSessionRecovery = "qa-p38-health-connector-device-session-23a104eb2a64";
const connectorLivenessContinuity = "qa-p38-health-connector-liveness-continuity-6efc70f798aa";
const connectorRelayBackoffRecovery = "qa-p38-health-connector-relay-backoff-f551947fd1ee";
const connectorRestartGraceRecovery = "qa-p38-health-connector-restart-grace-34b1985a311c";
const connectorRtspHandoffRecovery = "qa-p38-health-connector-rtsp-handoff-kg20-448381dc3792";
const connectorHealthObservationRecovery = "qa-p38-health-connector-observed-health-3a211a8ef1c2";
const connectorFinalStability = "qa-p38-health-connector-final-stability-3a211a8ef1c2";
const connectorRtspCadence = "qa-p38-health-connector-rtsp-cadence-559bb01f78a2";
const connectorOutputRescue = "qa-p38-health-connector-output-rescue-b0b6ef01b6e1";
const connectorGenericRtsp = "qa-p38-health-connector-generic-rtsp-a241029690ae";
const connectorLivenessIsolation = "qa-p38-health-connector-liveness-isolation-e46f2cb0daf6";
const connectorCodecPreservation = "qa-p38-health-connector-codec-preservation-70ea29e3dcad";
const gatewayRemediation = "qa-p38-health-gateway-6c9d08327ec6";
const gatewayAuthRecovery = "qa-p38-health-gateway-auth-4197f1a246f1";
const gatewaySessionStability = "qa-p38-health-gateway-session-e354546bdbf8";
const gatewayCommonCauseRecovery = "qa-p38-health-gateway-common-cause-189e548bc104";
const gatewayFiniteStreamHandoff = "qa-p38-health-gateway-finite-handoff-76781a8e0832";
const gatewaySupervisorRecovery = "qa-p38-health-gateway-supervisor-recovery-fb68c5180b58";
const gatewayStableHandoff = "qa-p38-health-gateway-stable-handoff-afc7339384bb";
const gatewayMediaCadence = "qa-p38-health-gateway-media-cadence-2abe984fa273";
const gatewayMaintenanceIsolation = "qa-p38-health-gateway-maintenance-isolation-995d6f822468";
const gatewaySessionSweep = "qa-p38-health-gateway-session-sweep-0a64245f8a97";
const gatewaySessionDrain = "qa-p38-health-gateway-session-drain-5165c94df699";
const gatewayHeartbeatLogin = "qa-p38-health-gateway-heartbeat-login-0a956d9891db";
const gatewayIdleHandoff = "qa-p38-health-gateway-idle-handoff-5a63b02f8a16";
const gatewayBufferedOutput = "qa-p38-health-gateway-buffered-output-f3ca7f4971fa";
const gatewayOutputRescue = "qa-p38-health-gateway-output-rescue-9934c36fe0a2";
const gatewayConfirmedHandoff = "qa-p38-health-gateway-confirmed-handoff-47fed292ea79";
const gatewayStartupWindow = "qa-p38-health-gateway-startup-window-a47982f4139f";
const gatewayHandoffProbation = "qa-p38-health-gateway-handoff-probation-60ace0737b23";
const gatewayRetainedFallback = "qa-p38-health-gateway-retained-fallback-8c94935aceab";
const gatewayContinuousHandoff = "qa-p38-health-gateway-continuous-handoff-0337991da88c";
const gatewayRoutineProvisional = "qa-p38-health-gateway-routine-provisional-6045266c007a";
const gatewayRoutineRebased = "qa-p38-health-gateway-routine-rebased-6045266c007a";
const gatewayProbationBudget = "qa-p38-health-gateway-probation-budget-ac185c72cf9e";
const gatewayRescueCapacity = "qa-p38-health-gateway-rescue-capacity-cedb6ebe5d18";
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
      connectorLivenessRecovery, connectorParentExitRecovery, connectorRtspSessionRecovery,
      connectorHostContinuityRecovery, connectorDeviceSessionRecovery, connectorLivenessContinuity,
      connectorRelayBackoffRecovery, connectorRestartGraceRecovery, connectorRtspHandoffRecovery,
      connectorHealthObservationRecovery, connectorFinalStability, connectorRtspCadence,
      connectorOutputRescue, connectorGenericRtsp, connectorLivenessIsolation,
      connectorCodecPreservation]
      .includes(manifest.release_id) &&
      metadata.home_qa_known_good_release_id === transitionRelease;
  if (enrollment.deployment_profile === "PHYSICAL_GATEWAY")
    return [gatewayRemediation, gatewayAuthRecovery, gatewaySessionStability,
      gatewayCommonCauseRecovery, gatewayFiniteStreamHandoff, gatewaySupervisorRecovery,
      gatewayStableHandoff, gatewayMediaCadence, gatewayMaintenanceIsolation,
      gatewaySessionSweep, gatewaySessionDrain, gatewayHeartbeatLogin,
      gatewayIdleHandoff, gatewayBufferedOutput, gatewayOutputRescue,
      gatewayConfirmedHandoff, gatewayStartupWindow, gatewayHandoffProbation,
      gatewayRetainedFallback, gatewayContinuousHandoff,
      gatewayRoutineProvisional, gatewayRoutineRebased,
      gatewayProbationBudget, gatewayRescueCapacity].includes(manifest.release_id) &&
      metadata.home_qa_known_good_release_id === gatewayBaseline;
  return false;
}
