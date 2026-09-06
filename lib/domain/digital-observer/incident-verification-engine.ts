import { createHash } from "node:crypto";
import type { BaselineMaturity, RiskBand, RiskDecision } from "./risk-decision-engine";

export const DIGITAL_OBSERVER_VERIFICATION_VERSION = "do-verification-v2";
export const DIGITAL_OBSERVER_FINAL_DECISION_VERSION = "do-final-decision-v1";

export type VerificationStatus = "UNVERIFIED" | "LIKELY" | "CONFIRMED" | "UNCERTAIN" | "REJECTED_FALSE_POSITIVE" | "RESOLVED";
export type VerificationClassification = "TRUE_SECURITY_EVENT" | "TRUE_EXPECTED_ACTIVITY" | "FALSE_DETECTION" | "FALSE_CORRELATION" | "OTHER_UNKNOWN";
export type VerificationFollowup = "NONE" | "VERIFY" | "PRESERVE_EVIDENCE" | "HUMAN_REVIEW";
export type CameraVerificationHealth = "healthy" | "degraded" | "offline" | "unknown";

export type VerificationSignal = {
  id: string;
  observerSiteId: string;
  sourceType: string;
  provenance: string;
  validated: boolean;
  eventType: string;
  cameraSourceId: string;
  streamId: string | null;
  trackId: string | null;
  occurredAt: string;
  detectionConfidence: number | null;
  evidenceKind: string | null;
  verificationEvidence?: {
    distinctSourceFrames?: number | null;
    directionalConfirmations?: number | null;
    sourceSequence?: number | null;
    sourceAnchorVerified?: boolean | null;
    trackingDurationMs?: number | null;
  } | null;
};

export type CanonicalVerificationInput = {
  observerSiteId: string;
  incident: {
    id: string;
    observerSiteId: string;
    status: "open" | "acknowledged" | "resolved" | "closed";
    provenance: string;
    cameraSourceIds: string[];
    trackIds: string[];
    relatedEventIds: string[];
  };
  signals: VerificationSignal[];
  risk: {
    evaluationId: string;
    riskScore: number;
    riskBand: RiskBand;
    evaluationConfidence: number;
    recommendedDecision: RiskDecision;
    matchedRuleCount: number;
    explicitHighPriorityRule: boolean;
  };
  context: {
    withinExpectedHours: boolean | null;
    baselineMaturity: BaselineMaturity;
    baselineVersion: string | null;
  };
  cameraHealth: {
    state: CameraVerificationHealth;
    observedAt: string | null;
  };
  evidence: {
    status: "available" | "not_required" | "pending" | "missing" | "failed" | "expired" | "unknown";
    sourceMatches: boolean | null;
    timeMatches: boolean | null;
  };
  technicalIntegrity: {
    sourceBindingValid: boolean;
    geometryValid: boolean | null;
    replayedFrameDetected: boolean;
  };
  policy: {
    recordingAuthorized: boolean;
    inAppNotificationAllowed: boolean;
    externalEscalationEnabled: false;
  };
  previousVerification?: {
    id: string;
    status: VerificationStatus;
    verificationConfidence: number;
  } | null;
  evaluatedAt?: string;
};

export type VerificationReason = {
  key: string;
  label: string;
  effect: number;
  evidence: Record<string, unknown>;
};

export type IncidentVerification = {
  accepted: true;
  incidentId: string;
  riskEvaluationId: string;
  status: VerificationStatus;
  classification: VerificationClassification;
  verificationConfidence: number;
  finalDecisionConfidence: number;
  confirmedSignals: VerificationReason[];
  contradictorySignals: VerificationReason[];
  verificationReasons: string[];
  requiredFollowup: VerificationFollowup;
  finalDecision: RiskDecision;
  fastPath: boolean;
  metrics: {
    distinctEventCount: number;
    distinctTrackCount: number;
    minimumDistinctSourceFrames: number;
    timeToVerificationMs: number | null;
  };
  verificationVersion: string;
  finalDecisionVersion: string;
  evaluatedAt: string;
  inputFingerprint: string;
  decisionDedupeKey: string;
};

export type RejectedIncidentVerification = {
  accepted: false;
  reason: "UNTRUSTED_PROVENANCE" | "SCOPE_MISMATCH" | "INCIDENT_EVENT_MISMATCH" | "INVALID_TIMESTAMP" | "NO_SIGNALS";
};

const decisionOrder: RiskDecision[] = ["IGNORE", "LOG_ONLY", "PRESERVE_EVIDENCE", "VERIFY", "NOTIFY_IN_APP", "ESCALATION_CANDIDATE"];
const directionalEvents = new Set(["person_entered", "person_exited", "vehicle_entered", "vehicle_exited"]);

const clamp = (value: number, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, value));
const rounded = (value: number) => Number(clamp(value).toFixed(4));

function reason(key: string, label: string, effect: number, evidence: Record<string, unknown>): VerificationReason {
  return { key, label, effect, evidence };
}

function stableFingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function strongestDecision(left: RiskDecision, right: RiskDecision) {
  return decisionOrder.indexOf(left) >= decisionOrder.indexOf(right) ? left : right;
}

function trustedInput(input: CanonicalVerificationInput): RejectedIncidentVerification | null {
  if (!input.signals.length) return { accepted: false, reason: "NO_SIGNALS" };
  if (input.incident.provenance !== "REAL_CAMERA_AI"
    || input.signals.some((signal) => signal.sourceType !== "system" || signal.provenance !== "REAL_CAMERA_AI" || signal.validated !== true)) {
    return { accepted: false, reason: "UNTRUSTED_PROVENANCE" };
  }
  if (input.incident.observerSiteId !== input.observerSiteId
    || input.signals.some((signal) => signal.observerSiteId !== input.observerSiteId)) {
    return { accepted: false, reason: "SCOPE_MISMATCH" };
  }
  if (input.signals.some((signal) => !input.incident.relatedEventIds.includes(signal.id)
    || !input.incident.cameraSourceIds.includes(signal.cameraSourceId)
    || Boolean(signal.trackId && !input.incident.trackIds.includes(signal.trackId)))) {
    return { accepted: false, reason: "INCIDENT_EVENT_MISMATCH" };
  }
  if (input.signals.some((signal) => !Number.isFinite(Date.parse(signal.occurredAt)))) {
    return { accepted: false, reason: "INVALID_TIMESTAMP" };
  }
  return null;
}

function inferredDistinctFrames(signal: VerificationSignal) {
  const explicit = Number(signal.verificationEvidence?.distinctSourceFrames);
  if (Number.isSafeInteger(explicit) && explicit > 0) return explicit;
  // These are lower bounds guaranteed by the versioned Gateway Journal
  // contracts, not claims about frames that the cloud did not observe.
  if (directionalEvents.has(signal.eventType) && signal.evidenceKind === "line_crossing") return 3;
  if (signal.eventType === "person_detected" && signal.evidenceKind === "object_detection") return 2;
  return 1;
}

function expectedActivity(input: CanonicalVerificationInput) {
  return input.context.withinExpectedHours === true && input.risk.riskScore < 50;
}

function realActivityClassification(input: CanonicalVerificationInput): VerificationClassification {
  if (expectedActivity(input)) return "TRUE_EXPECTED_ACTIVITY";
  if (input.context.withinExpectedHours === false || input.risk.riskScore >= 50) return "TRUE_SECURITY_EVENT";
  return "OTHER_UNKNOWN";
}

function finalDecisionFor(input: CanonicalVerificationInput, status: VerificationStatus, classification: VerificationClassification, confidence: number) {
  let decision = input.risk.recommendedDecision;
  if (status === "REJECTED_FALSE_POSITIVE") decision = "LOG_ONLY";
  else if (status === "UNCERTAIN" || status === "UNVERIFIED") {
    decision = input.risk.riskScore >= 20 ? "VERIFY" : "LOG_ONLY";
  } else if (status === "LIKELY" && input.risk.riskScore >= 75) {
    decision = "VERIFY";
  } else if (classification === "TRUE_EXPECTED_ACTIVITY" && input.risk.riskScore < 50) {
    decision = "LOG_ONLY";
  }
  if (confidence < 0.5 && input.risk.riskScore >= 50) decision = "VERIFY";
  if (decision === "NOTIFY_IN_APP" && !input.policy.inAppNotificationAllowed) decision = "VERIFY";
  if (decision === "PRESERVE_EVIDENCE" && !input.policy.recordingAuthorized) {
    decision = input.risk.riskScore >= 20 ? "VERIFY" : "LOG_ONLY";
  }
  if (decision === "ESCALATION_CANDIDATE" && !input.policy.externalEscalationEnabled) {
    // This remains a candidate only; PUSH 10 does not execute an external action.
    return strongestDecision("VERIFY", decision);
  }
  return decision;
}

/**
 * Deterministic Incident verification. It evaluates whether the factual camera
 * situation is corroborated; it does not decide whether ordinary activity is
 * dangerous and it never invokes a model or external provider.
 */
export function evaluateIncidentVerification(input: CanonicalVerificationInput): IncidentVerification | RejectedIncidentVerification {
  const rejected = trustedInput(input);
  if (rejected) return rejected;

  const signals = [...input.signals].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
  const confirmed: VerificationReason[] = [];
  const contradictory: VerificationReason[] = [];
  const eventTypes = new Set(signals.map((signal) => signal.eventType));
  const tracks = new Set(signals.map((signal) => signal.trackId).filter((track): track is string => Boolean(track)));
  const minimumDistinctSourceFrames = Math.max(...signals.map(inferredDistinctFrames));
  let score = 0.22;

  confirmed.push(reason("trusted_real_provenance", "האירועים התקבלו מצינור מצלמה אמיתי ומאומת.", 0.22, {
    provenance: "REAL_CAMERA_AI", event_count: signals.length
  }));

  if (!input.technicalIntegrity.sourceBindingValid) {
    contradictory.push(reason("source_binding_mismatch", "שיוך האתר, המצלמה או הזרם אינו עקבי.", -0.8, {}));
  } else {
    confirmed.push(reason("source_binding_valid", "שיוך האתר, המצלמה והזרם עקבי.", 0.1, {}));
    score += 0.1;
  }

  if (input.technicalIntegrity.replayedFrameDetected) {
    contradictory.push(reason("replayed_frame", "זוהה שימוש חוזר בפריים ולכן הוא אינו מחזק את האימות.", -0.45, {}));
    score -= 0.45;
  } else if (minimumDistinctSourceFrames >= 2) {
    confirmed.push(reason("multi_frame_confirmation", "האבחנה נשענת על יותר מפריים מקור ייחודי אחד.", 0.15, {
      minimum_distinct_source_frames: minimumDistinctSourceFrames
    }));
    score += 0.15;
  }

  if (tracks.size === 1) {
    confirmed.push(reason("stable_track", "אותו Track ID מקשר את התצפיות לאורך האירוע.", 0.14, { track_id: [...tracks][0] }));
    score += 0.14;
  } else if (tracks.size > 1) {
    contradictory.push(reason("track_fragmentation", "התצפיות מפוצלות בין מספר Track IDs.", -0.14, { track_count: tracks.size }));
    score -= 0.14;
  }

  const directional = signals.filter((signal) => directionalEvents.has(signal.eventType));
  if (directional.length) {
    const geometryValid = input.technicalIntegrity.geometryValid === true
      && directional.every((signal) => signal.evidenceKind === "line_crossing");
    if (geometryValid) {
      confirmed.push(reason("spatial_transition_confirmed", "מעבר כיווני אושר לפי גאומטריית הקו הקיימת.", 0.18, {
        event_types: directional.map((signal) => signal.eventType)
      }));
      score += 0.18;
    } else {
      contradictory.push(reason("spatial_transition_unverified", "אירוע כיווני אינו מגובה בחוזה גאומטרי תקין.", -0.4, {}));
      score -= 0.4;
    }
  }

  const hasEntry = eventTypes.has("person_entered");
  const hasExit = eventTypes.has("person_exited");
  if (hasEntry && hasExit && tracks.size === 1) {
    confirmed.push(reason("compatible_event_sequence", "רצף הכניסה והיציאה שייך לאותו Track ולאותה תקרית.", 0.12, {}));
    score += 0.12;
  } else if (eventTypes.has("person_detected") && !hasEntry) {
    contradictory.push(reason("detection_without_crossing", "האדם זוהה, אך לא הוכח מעבר של קו הכניסה.", -0.04, {}));
    score -= 0.04;
  }

  if (input.cameraHealth.state === "healthy") {
    confirmed.push(reason("camera_healthy", "מקור המצלמה דיווח על מצב תקין בזמן ההערכה.", 0.07, { observed_at: input.cameraHealth.observedAt }));
    score += 0.07;
  } else if (input.cameraHealth.state === "degraded") {
    contradictory.push(reason("camera_degraded", "איכות מקור המצלמה מדורגת ולכן ודאות האימות הונמכה.", -0.12, {}));
    score -= 0.12;
  } else if (input.cameraHealth.state === "offline") {
    contradictory.push(reason("camera_offline", "המצלמה אינה פעילה ולכן אין להסיק שאימות רציף נמשך.", -0.2, {}));
    score -= 0.2;
  } else {
    contradictory.push(reason("camera_health_unknown", "מצב בריאות המצלמה אינו ידוע.", -0.07, {}));
    score -= 0.07;
  }

  if (input.evidence.status === "available") {
    if (input.evidence.sourceMatches === true && input.evidence.timeMatches === true) {
      confirmed.push(reason("evidence_window_matches", "הראיה הזמינה קשורה למצלמה ולחלון הזמן של האירוע.", 0.12, {}));
      score += 0.12;
    } else {
      contradictory.push(reason("evidence_mismatch", "הראיה אינה תואמת למקור או לזמן האירוע.", -0.35, {}));
      score -= 0.35;
    }
  } else if (["missing", "failed", "expired"].includes(input.evidence.status) && input.policy.recordingAuthorized) {
    contradictory.push(reason("authorized_evidence_unavailable", "הקלטה אושרה אך הראיה אינה זמינה.", -0.08, { status: input.evidence.status }));
    score -= 0.08;
  } else if (input.evidence.status === "not_required") {
    confirmed.push(reason("no_recording_policy_respected", "היעדר הראיה תואם למדיניות שלא אישרה הקלטה.", 0, {}));
  }

  score = rounded(score);
  const hardFalseCorrelation = !input.technicalIntegrity.sourceBindingValid
    || (directional.length > 0 && input.technicalIntegrity.geometryValid !== true)
    || input.evidence.status === "available" && (input.evidence.sourceMatches !== true || input.evidence.timeMatches !== true);
  const hardFalseDetection = input.technicalIntegrity.replayedFrameDetected && minimumDistinctSourceFrames < 2 && tracks.size === 0;

  let status: VerificationStatus;
  let classification: VerificationClassification;
  if (hardFalseCorrelation || hardFalseDetection) {
    status = "REJECTED_FALSE_POSITIVE";
    classification = hardFalseCorrelation ? "FALSE_CORRELATION" : "FALSE_DETECTION";
  } else if (input.incident.status === "closed" && hasEntry && hasExit && score >= 0.65) {
    status = "RESOLVED";
    classification = realActivityClassification(input);
  } else if (directional.length && score >= 0.65) {
    status = "CONFIRMED";
    classification = realActivityClassification(input);
  } else if (score >= 0.5 && (minimumDistinctSourceFrames >= 2 || tracks.size === 1)) {
    status = "LIKELY";
    classification = expectedActivity(input) ? "TRUE_EXPECTED_ACTIVITY" : "OTHER_UNKNOWN";
  } else if (score > 0) {
    status = "UNCERTAIN";
    classification = "OTHER_UNKNOWN";
  } else {
    status = "UNVERIFIED";
    classification = "OTHER_UNKNOWN";
  }

  const finalDecision = finalDecisionFor(input, status, classification, score);
  const fastPath = input.risk.explicitHighPriorityRule && input.risk.riskScore >= 75
    && ["CONFIRMED", "RESOLVED"].includes(status);
  const finalDecisionConfidence = rounded(input.risk.evaluationConfidence * 0.4 + score * 0.6);
  const requiredFollowup: VerificationFollowup = status === "REJECTED_FALSE_POSITIVE"
    ? "HUMAN_REVIEW"
    : ["UNVERIFIED", "UNCERTAIN"].includes(status) || (status === "LIKELY" && input.risk.riskScore >= 50)
      ? "VERIFY"
      : input.policy.recordingAuthorized && input.evidence.status !== "available" && input.risk.riskScore >= 50
        ? "PRESERVE_EVIDENCE"
        : "NONE";
  const evaluatedAt = input.evaluatedAt ?? new Date().toISOString();
  const firstObservedAt = Date.parse(signals[0].occurredAt);
  const inputFingerprint = stableFingerprint({
    verificationVersion: DIGITAL_OBSERVER_VERIFICATION_VERSION,
    incident: input.incident,
    signals,
    risk: input.risk,
    context: input.context,
    cameraHealth: input.cameraHealth,
    evidence: input.evidence,
    technicalIntegrity: input.technicalIntegrity,
    policy: input.policy
  });

  return {
    accepted: true,
    incidentId: input.incident.id,
    riskEvaluationId: input.risk.evaluationId,
    status,
    classification,
    verificationConfidence: score,
    finalDecisionConfidence,
    confirmedSignals: confirmed,
    contradictorySignals: contradictory,
    verificationReasons: [...confirmed, ...contradictory].map((item) => item.label),
    requiredFollowup,
    finalDecision,
    fastPath,
    metrics: {
      distinctEventCount: new Set(signals.map((signal) => signal.id)).size,
      distinctTrackCount: tracks.size,
      minimumDistinctSourceFrames,
      timeToVerificationMs: Number.isFinite(firstObservedAt) ? Math.max(0, Date.parse(evaluatedAt) - firstObservedAt) : null
    },
    verificationVersion: DIGITAL_OBSERVER_VERIFICATION_VERSION,
    finalDecisionVersion: DIGITAL_OBSERVER_FINAL_DECISION_VERSION,
    evaluatedAt,
    inputFingerprint,
    decisionDedupeKey: `${input.incident.id}:${input.risk.evaluationId}:${DIGITAL_OBSERVER_VERIFICATION_VERSION}:${finalDecision}`
  };
}
