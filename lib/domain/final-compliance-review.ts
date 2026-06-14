type Row = Record<string, any>;
type Recommendation = "not_ready" | "pilot_ready_with_blockers" | "pilot_ready" | "production_ready_after_external_review";

export interface FinalComplianceSummary {
  regulatoryScore: number;
  privacyScore: number;
  securityScore: number;
  cameraScore: number;
  aiGovernanceScore: number;
  isoScore: number;
  launchScore: number;
  finalReadinessScore: number;
  recommendation: Recommendation;
  criticalBlockers: Row[];
  legalReviewItems: Row[];
  regulatoryGaps: Row[];
  isoGaps: Row[];
  restrictedCapabilitiesOk: boolean;
  allowedCapabilitiesHumanReviewed: boolean;
  ganBatuachIsraelModeEnabled: boolean;
}

const restrictedCapabilityKeys = new Set([
  "audio_analytics",
  "speech_recognition",
  "keyword_detection",
  "face_recognition",
  "face_matching",
  "persistent_child_identity_tracking",
  "gait_recognition",
  "soft_biometric_matching",
  "cross_day_skeleton_identity",
  "contextual_child_association"
]);

const allowedCapabilityKeys = new Set([
  "pose_estimation",
  "skeleton_tracking",
  "skeleton_analytics",
  "motion_analytics",
  "motion_anomaly_detection",
  "fall_detection",
  "inactivity_detection",
  "crowding_detection",
  "restricted_area_detection",
  "safety_anomaly_detection"
]);

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value));
  return valid.length ? clamp(valid.reduce((sum, value) => sum + value, 0) / valid.length) : 0;
}

function statusScore(status?: string | null) {
  if (["ready", "passed", "approved", "verified", "completed", "closed", "implemented", "enabled"].includes(String(status))) return 100;
  if (["partial", "reviewed", "in_progress", "approved_with_restrictions", "pilot_ready"].includes(String(status))) return 70;
  if (["needs_review", "requires_external_review", "draft", "planned", "pending", "under_review"].includes(String(status))) return 45;
  if (["blocked", "failed", "missing", "open", "not_ready", "disabled"].includes(String(status))) return 10;
  return 50;
}

function weightedChecks(rows: Row[], scoreField = "readiness_score") {
  if (!rows.length) return 0;
  return average(rows.map((row) => Number(row[scoreField] ?? statusScore(row.status ?? row.current_status ?? row.review_status))));
}

function openRows(rows: Row[], closedStatuses: string[]) {
  return rows.filter((row) => !closedStatuses.includes(String(row.status ?? row.current_status ?? row.review_status ?? row.remediation_status)));
}

function calculateRecommendation(finalScore: number, criticalBlockers: Row[], pilotBlockers: Row[], productionBlockers: Row[], legalItems: Row[]): Recommendation {
  if (criticalBlockers.length || pilotBlockers.length || finalScore < 60) return "not_ready";
  if (productionBlockers.length || legalItems.length || finalScore < 78) return "pilot_ready_with_blockers";
  if (finalScore < 88 || legalItems.length) return "pilot_ready";
  return "production_ready_after_external_review";
}

export function buildFinalComplianceSummary(input: {
  regulatoryModes?: Row[];
  verticalCapabilities?: Row[];
  aiCapabilities?: Row[];
  aiGovernanceReviews?: Row[];
  cameraChecks?: Row[];
  securityChecks?: Row[];
  privacyRequests?: Row[];
  retentionPolicies?: Row[];
  legalHolds?: Row[];
  mfaPolicies?: Row[];
  auditCatalog?: Row[];
  isoControls?: Row[];
  isoEvidence?: Row[];
  isoGaps?: Row[];
  launchScores?: Row[];
  launchBlockers?: Row[];
  finalGaps?: Row[];
  legalReviewItems?: Row[];
  securityPipelineFindings?: Row[];
  readinessSnapshot?: Row | null;
} = {}): FinalComplianceSummary {
  const regulatoryModes = input.regulatoryModes ?? [];
  const verticalCapabilities = input.verticalCapabilities ?? [];
  const aiCapabilities = input.aiCapabilities ?? [];
  const cameraChecks = input.cameraChecks ?? [];
  const securityChecks = input.securityChecks ?? [];
  const privacyRequests = input.privacyRequests ?? [];
  const retentionPolicies = input.retentionPolicies ?? [];
  const legalHolds = input.legalHolds ?? [];
  const mfaPolicies = input.mfaPolicies ?? [];
  const auditCatalog = input.auditCatalog ?? [];
  const isoControls = input.isoControls ?? [];
  const isoEvidence = input.isoEvidence ?? [];
  const isoGaps = input.isoGaps ?? [];
  const launchScores = input.launchScores ?? [];
  const launchBlockers = input.launchBlockers ?? [];
  const finalGaps = input.finalGaps ?? [];
  const legalReviewItems = input.legalReviewItems ?? [];
  const securityPipelineFindings = input.securityPipelineFindings ?? [];

  const ganBatuachIsraelModeEnabled = regulatoryModes.some((mode) => mode.mode_key === "GAN_BATUACH_ISRAEL_MODE" && mode.status === "enabled");
  const ganCapabilities = verticalCapabilities.filter((capability) => capability.vertical_key === "gan_batuach");
  const restrictedCapabilities = ganCapabilities.filter((capability) => restrictedCapabilityKeys.has(String(capability.capability_key)));
  const restrictedCapabilitiesOk = restrictedCapabilities.every((capability) => ["disabled", "legal_review_required"].includes(String(capability.capability_status)) && ["disabled", "restricted", "legal_review_required"].includes(String(capability.legal_status)));
  const allowedCapabilities = ganCapabilities.filter((capability) => allowedCapabilityKeys.has(String(capability.capability_key)));
  const allowedCapabilitiesHumanReviewed = allowedCapabilities.every((capability) => capability.human_review_required !== false && capability.parent_visible_allowed !== true);

  const regulatoryScore = average([
    ganBatuachIsraelModeEnabled ? 100 : 20,
    restrictedCapabilitiesOk ? 100 : 20,
    allowedCapabilitiesHumanReviewed ? 95 : 45,
    weightedChecks(securityChecks.filter((check) => ["privacy", "compliance", "provider_security"].includes(String(check.category))), "score")
  ]);
  const privacyScore = average([
    privacyRequests.length ? 75 : 45,
    retentionPolicies.length ? 80 : 35,
    legalHolds.length ? 75 : 50,
    weightedChecks(securityChecks.filter((check) => ["privacy", "encryption"].includes(String(check.category))), "score")
  ]);
  const securityScore = average([
    weightedChecks(securityChecks.filter((check) => ["mfa", "authorization", "rls", "audit_logging", "encryption", "session_security", "device_trust"].includes(String(check.category))), "score"),
    mfaPolicies.length ? average(mfaPolicies.map((policy) => statusScore(policy.enforcement_status))) : 35,
    auditCatalog.length ? average(auditCatalog.map((event) => event.implemented ? 100 : event.required ? 45 : 70)) : 35,
    securityPipelineFindings.some((finding) => ["critical", "high"].includes(String(finding.severity)) && ["open", "triaged"].includes(String(finding.status))) ? 45 : 80
  ]);
  const cameraScore = weightedChecks(cameraChecks);
  const aiGovernanceScore = average([
    aiCapabilities.length ? average(aiCapabilities.map((capability) => capability.enabled === false || capability.human_review_required !== false ? 80 : 35)) : 45,
    input.aiGovernanceReviews?.length ? average((input.aiGovernanceReviews ?? []).map((review) => statusScore(review.status))) : 45,
    allowedCapabilitiesHumanReviewed ? 90 : 35
  ]);
  const isoScore = average([
    isoControls.length ? average(isoControls.map((control) => statusScore(control.implementation_status) * 0.45 + statusScore(control.evidence_status) * 0.35 + statusScore(control.policy_status) * 0.2)) : 35,
    isoEvidence.length ? average(isoEvidence.map((item) => statusScore(item.status))) : 35,
    isoGaps.length ? Math.max(20, 100 - openRows(isoGaps, ["fixed", "verified", "accepted_risk"]).length * 8) : 65
  ]);
  const launchScore = launchScores.length ? average(launchScores.map((score) => Number(score.score ?? 0))) : 45;

  const unresolvedFinalGaps = openRows(finalGaps, ["fixed", "verified", "accepted_risk"]);
  const criticalBlockers = unresolvedFinalGaps.filter((gap) => gap.severity === "critical" || gap.blocks_pilot === true);
  const productionBlockers = unresolvedFinalGaps.filter((gap) => gap.blocks_production === true);
  const unresolvedLegalItems = legalReviewItems.filter((item) => !["approved", "closed", "accepted_risk"].includes(String(item.current_status)));
  const launchOpenBlockers = openRows(launchBlockers, ["fixed", "verified", "accepted_risk"]);
  const rawFinal = average([regulatoryScore, privacyScore, securityScore, cameraScore, aiGovernanceScore, isoScore, launchScore]);
  const penalty = Math.min(25, criticalBlockers.length * 8 + launchOpenBlockers.length * 5 + unresolvedLegalItems.length * 2);
  const finalReadinessScore = clamp(rawFinal - penalty);
  const recommendation = calculateRecommendation(finalReadinessScore, criticalBlockers, criticalBlockers, productionBlockers, unresolvedLegalItems);

  return {
    regulatoryScore,
    privacyScore,
    securityScore,
    cameraScore,
    aiGovernanceScore,
    isoScore,
    launchScore,
    finalReadinessScore,
    recommendation,
    criticalBlockers: [...criticalBlockers, ...launchOpenBlockers],
    legalReviewItems: unresolvedLegalItems,
    regulatoryGaps: unresolvedFinalGaps.filter((gap) => ["regulatory", "privacy", "camera", "ai_governance", "medical_data", "mfa_identity", "retention"].includes(String(gap.gap_area))),
    isoGaps: openRows(isoGaps, ["fixed", "verified", "accepted_risk"]),
    restrictedCapabilitiesOk,
    allowedCapabilitiesHumanReviewed,
    ganBatuachIsraelModeEnabled
  };
}
