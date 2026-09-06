import { createHash } from "node:crypto";

export const DIGITAL_OBSERVER_RISK_ENGINE_VERSION = "do-risk-v1";
export const DIGITAL_OBSERVER_RISK_FACTOR_VERSION = "do-risk-factors-v1";
export const DIGITAL_OBSERVER_DECISION_VERSION = "do-decision-v1";

export type RiskBand = "LOW" | "GUARDED" | "ELEVATED" | "HIGH" | "CRITICAL";
export type RiskDecision = "IGNORE" | "LOG_ONLY" | "PRESERVE_EVIDENCE" | "VERIFY" | "NOTIFY_IN_APP" | "ESCALATION_CANDIDATE";
export type BaselineMaturity = "NO_DATA" | "LEARNING" | "LOW_CONFIDENCE" | "ESTABLISHED" | "STALE";

export type ExplainableRiskFactor = {
  key: string;
  label: string;
  delta: number;
  evidence: Record<string, unknown>;
};

export type MatchedRiskRule = {
  id: string;
  observerSiteId: string;
  cameraSourceId: string | null;
  title: string;
  priority: number;
  version: string;
  contribution: number;
  minimumRiskScore: number | null;
  minimumDecision: RiskDecision | null;
  reason: string;
};

export type CanonicalRiskInput = {
  observerSiteId: string;
  incident: {
    id: string;
    observerSiteId: string;
    status: "open" | "acknowledged" | "resolved" | "closed";
    provenance: string;
    cameraSourceIds: string[];
    trackIds: string[];
    relatedEventIds: string[];
    eventTypes: string[];
    durationSeconds: number | null;
  };
  triggeringEvent: {
    id: string;
    observerSiteId: string;
    sourceType: string;
    provenance: string;
    validated: boolean;
    eventType: string;
    cameraSourceId: string;
    streamId: string | null;
    trackId: string | null;
    zone: string | null;
    confidence: number | null;
    occurredAt: string;
    recordingRequired: boolean;
    evidenceAvailable: boolean;
  };
  context: {
    available: boolean;
    localTime: string | null;
    localDay: string | null;
    withinExpectedHours: boolean | null;
  };
  baseline: {
    maturity: BaselineMaturity;
    version: string | null;
    confidence: number;
    expectedSignals: Array<{ key: string; value: boolean }>;
    deviationSignals: Array<{ key: string; reason: string }>;
    typicalDurationSeconds: number | null;
  };
  matchedRules: MatchedRiskRule[];
  policy: {
    recordingAuthorized: boolean;
    inAppNotificationAllowed: boolean;
    externalEscalationEnabled: false;
  };
  previousEvaluation?: {
    riskScore: number;
    peakRiskScore: number;
    riskBand: RiskBand;
  } | null;
  evaluatedAt?: string;
};

export type RiskEvaluation = {
  accepted: true;
  incidentId: string;
  triggeringEventId: string;
  riskScore: number;
  riskBand: RiskBand;
  evaluationConfidence: number;
  contributingFactors: ExplainableRiskFactor[];
  mitigatingFactors: ExplainableRiskFactor[];
  matchedRules: MatchedRiskRule[];
  baselineContext: CanonicalRiskInput["baseline"];
  recommendedDecision: RiskDecision;
  actionIntents: RiskDecision[];
  currentRiskScore: number;
  peakRiskScore: number;
  previousRiskScore: number | null;
  explanation: {
    headline: string;
    reasons: string[];
    mitigations: string[];
    uncertainty: string[];
  };
  riskEngineVersion: string;
  factorVersion: string;
  decisionVersion: string;
  evaluatedAt: string;
  inputFingerprint: string;
  decisionDedupeKey: string;
};

export type RejectedRiskEvaluation = {
  accepted: false;
  reason: "UNTRUSTED_PROVENANCE" | "SCOPE_MISMATCH" | "INCIDENT_EVENT_MISMATCH" | "INVALID_TIMESTAMP";
};

const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));

export function riskBandForScore(score: number): RiskBand {
  if (score >= 90) return "CRITICAL";
  if (score >= 75) return "HIGH";
  if (score >= 50) return "ELEVATED";
  if (score >= 20) return "GUARDED";
  return "LOW";
}

const decisionOrder: RiskDecision[] = ["IGNORE", "LOG_ONLY", "PRESERVE_EVIDENCE", "VERIFY", "NOTIFY_IN_APP", "ESCALATION_CANDIDATE"];

function strongestDecision(left: RiskDecision, right: RiskDecision) {
  return decisionOrder.indexOf(left) >= decisionOrder.indexOf(right) ? left : right;
}

function baseDecision(score: number): RiskDecision {
  if (score >= 90) return "ESCALATION_CANDIDATE";
  if (score >= 75) return "NOTIFY_IN_APP";
  if (score >= 50) return "VERIFY";
  return "LOG_ONLY";
}

function stableFingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function trustedInput(input: CanonicalRiskInput): RejectedRiskEvaluation | null {
  const event = input.triggeringEvent;
  const incident = input.incident;
  if (event.sourceType !== "system" || event.provenance !== "REAL_CAMERA_AI" || event.validated !== true || incident.provenance !== "REAL_CAMERA_AI") {
    return { accepted: false, reason: "UNTRUSTED_PROVENANCE" };
  }
  if (event.observerSiteId !== input.observerSiteId || incident.observerSiteId !== input.observerSiteId) {
    return { accepted: false, reason: "SCOPE_MISMATCH" };
  }
  if (!incident.cameraSourceIds.includes(event.cameraSourceId)
    || !incident.relatedEventIds.includes(event.id)
    || (event.trackId && !incident.trackIds.includes(event.trackId))) {
    return { accepted: false, reason: "INCIDENT_EVENT_MISMATCH" };
  }
  if (!Number.isFinite(Date.parse(event.occurredAt))) return { accepted: false, reason: "INVALID_TIMESTAMP" };
  if (input.matchedRules.some((rule) => rule.observerSiteId !== input.observerSiteId
    || Boolean(rule.cameraSourceId && rule.cameraSourceId !== event.cameraSourceId))) {
    return { accepted: false, reason: "SCOPE_MISMATCH" };
  }
  return null;
}

function factor(key: string, label: string, delta: number, evidence: Record<string, unknown>): ExplainableRiskFactor {
  return { key, label, delta, evidence };
}

function evaluationConfidence(input: CanonicalRiskInput) {
  const detectorConfidence = input.triggeringEvent.confidence;
  let confidence = detectorConfidence == null ? 0.55 : 0.55 + clamp(detectorConfidence, 0, 1) * 0.35;
  if (!input.context.available || input.context.withinExpectedHours === null) confidence -= 0.12;
  if (input.baseline.maturity !== "ESTABLISHED") confidence -= 0.08;
  if (!input.triggeringEvent.evidenceAvailable && input.triggeringEvent.recordingRequired) confidence -= 0.08;
  return Number(clamp(confidence, 0.25, 0.95).toFixed(4));
}

function humanHeadline(score: number, decision: RiskDecision) {
  if (decision === "ESCALATION_CANDIDATE") return "נדרשת בדיקה מיידית לפני כל פעולה נוספת.";
  if (decision === "NOTIFY_IN_APP") return "נדרשת תשומת לב באפליקציה.";
  if (decision === "VERIFY") return "מומלץ לבדוק את האירוע והראיות.";
  if (score >= 20) return "האירוע נשמר למעקב ללא קביעה שהוא מסוכן.";
  return "האירוע נראה שגרתי לפי המידע הזמין ונשמר ביומן.";
}

/**
 * Deterministic incident-level Risk Engine. Detection confidence affects only
 * evaluation confidence; it is never copied into the risk score.
 */
export function evaluateIncidentRisk(input: CanonicalRiskInput): RiskEvaluation | RejectedRiskEvaluation {
  const rejected = trustedInput(input);
  if (rejected) return rejected;

  const contributing: ExplainableRiskFactor[] = [];
  const mitigating: ExplainableRiskFactor[] = [];
  let score = 5;
  let minimumRiskScore = 0;

  if (input.incident.eventTypes.includes("person_entered")) {
    contributing.push(factor("meaningful_entry", "זוהתה כניסה ממשית לאזור", 10, { event_type: "person_entered" }));
    score += 10;
  }
  if (input.context.withinExpectedHours === false) {
    contributing.push(factor("outside_expected_hours", "הכניסה התרחשה מחוץ לשעות הצפויות שהוגדרו", 20, { local_time: input.context.localTime }));
    score += 20;
  } else if (input.context.withinExpectedHours === true) {
    mitigating.push(factor("within_expected_hours", "הפעילות התרחשה בשעות הצפויות שהוגדרו", -5, { local_time: input.context.localTime }));
    score -= 5;
  }

  const normalizedZone = String(input.triggeringEvent.zone ?? "").toLowerCase();
  if (["restricted", "restricted_area", "staff_only"].some((value) => normalizedZone.includes(value))) {
    contributing.push(factor("restricted_zone", "האירוע התרחש באזור שהוגדר כמוגבל", 30, { zone: input.triggeringEvent.zone }));
    score += 30;
  }

  const duration = input.incident.durationSeconds;
  const typicalDuration = input.baseline.typicalDurationSeconds;
  if (duration != null && duration >= 120 && (typicalDuration == null || duration >= Math.max(120, typicalDuration * 1.75))) {
    contributing.push(factor("long_dwell", "משך השהייה ארוך ביחס למדיניות או להיסטוריה הזמינה", 18, { duration_seconds: duration, typical_seconds: typicalDuration }));
    score += 18;
  } else if (input.incident.status === "closed" && duration != null && duration <= 60) {
    mitigating.push(factor("brief_resolved_passage", "המעבר הסתיים ביציאה רגילה בתוך זמן קצר", -8, { duration_seconds: duration }));
    score -= 8;
  } else if (input.incident.status === "closed") {
    mitigating.push(factor("normal_exit", "הפעילות הסתיימה ביציאה מאומתת", -5, { status: "closed" }));
    score -= 5;
  }

  if (input.baseline.maturity === "ESTABLISHED") {
    const deviations = input.baseline.deviationSignals.slice(0, 2);
    for (const deviation of deviations) {
      contributing.push(factor(`baseline_${deviation.key}`, "הדפוס אינו שכיח בקו הבסיס המבוסס של המצלמה", 8, { reason: deviation.reason, baseline_version: input.baseline.version }));
      score += 8;
    }
    const commonSignals = input.baseline.expectedSignals.filter((signal) => signal.value === true).length;
    if (commonSignals >= 2) {
      mitigating.push(factor("common_baseline_pattern", "הזמן ודפוס האירוע שכיחים בקו הבסיס המבוסס", -5, { common_signal_count: commonSignals, baseline_version: input.baseline.version }));
      score -= 5;
    }
  }

  for (const rule of input.matchedRules) {
    const delta = clamp(Math.round(rule.contribution), 0, 35);
    if (delta) {
      contributing.push(factor(`rule_${rule.id}`, `הופעל כלל מוגדר: ${rule.title}`, delta, { rule_id: rule.id, rule_version: rule.version, reason: rule.reason }));
      score += delta;
    }
    if (rule.minimumRiskScore != null) minimumRiskScore = Math.max(minimumRiskScore, clamp(rule.minimumRiskScore, 0, 100));
  }

  score = clamp(Math.round(Math.max(score, minimumRiskScore)), 0, 100);
  let decision = baseDecision(score);
  for (const rule of input.matchedRules) if (rule.minimumDecision) decision = strongestDecision(decision, rule.minimumDecision);
  if (decision === "NOTIFY_IN_APP" && !input.policy.inAppNotificationAllowed) decision = "VERIFY";
  // External escalation is an intent for future review only in this PUSH.
  const actionIntents: RiskDecision[] = [decision];
  if (decision === "ESCALATION_CANDIDATE" && input.policy.inAppNotificationAllowed) actionIntents.push("NOTIFY_IN_APP");
  if (input.triggeringEvent.recordingRequired && input.policy.recordingAuthorized) actionIntents.push("PRESERVE_EVIDENCE");

  const riskBand = riskBandForScore(score);
  const evaluatedAt = input.evaluatedAt ?? new Date().toISOString();
  const uncertainty = [
    ...(input.baseline.maturity !== "ESTABLISHED" ? [`השפעת קו הבסיס הוגבלה כי מצב הבשלות הוא ${input.baseline.maturity}.`] : []),
    ...(!input.context.available || input.context.withinExpectedHours === null ? ["הקשר השעות אינו מלא ולכן ביטחון ההערכה הונמך."] : []),
    ...(!input.triggeringEvent.evidenceAvailable && input.triggeringEvent.recordingRequired ? ["הראיה טרם זמינה ולכן ביטחון ההערכה הונמך."] : [])
  ];
  const fingerprint = stableFingerprint({
    engine: DIGITAL_OBSERVER_RISK_ENGINE_VERSION,
    incident: input.incident,
    event: input.triggeringEvent,
    context: input.context,
    baseline: input.baseline,
    rules: input.matchedRules,
    policy: input.policy
  });
  const previousRiskScore = input.previousEvaluation?.riskScore ?? null;
  const peakRiskScore = Math.max(input.previousEvaluation?.peakRiskScore ?? 0, score);
  return {
    accepted: true,
    incidentId: input.incident.id,
    triggeringEventId: input.triggeringEvent.id,
    riskScore: score,
    riskBand,
    evaluationConfidence: evaluationConfidence(input),
    contributingFactors: contributing,
    mitigatingFactors: mitigating,
    matchedRules: input.matchedRules,
    baselineContext: input.baseline,
    recommendedDecision: decision,
    actionIntents: [...new Set(actionIntents)],
    currentRiskScore: score,
    peakRiskScore,
    previousRiskScore,
    explanation: {
      headline: humanHeadline(score, decision),
      reasons: contributing.map((item) => item.label),
      mitigations: mitigating.map((item) => item.label),
      uncertainty
    },
    riskEngineVersion: DIGITAL_OBSERVER_RISK_ENGINE_VERSION,
    factorVersion: DIGITAL_OBSERVER_RISK_FACTOR_VERSION,
    decisionVersion: DIGITAL_OBSERVER_DECISION_VERSION,
    evaluatedAt,
    inputFingerprint: fingerprint,
    decisionDedupeKey: `${input.incident.id}:${decision}:${riskBand}:${input.incident.status}`
  };
}
