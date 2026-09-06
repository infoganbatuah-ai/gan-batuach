export const DIGITAL_OBSERVER_FEEDBACK_VERSION = "do-feedback-v1";
export const DIGITAL_OBSERVER_GROUND_TRUTH_VERSION = "do-ground-truth-v1";
export const DIGITAL_OBSERVER_CALIBRATION_DATASET_VERSION = "do-feedback-dataset-v1";
export const DIGITAL_OBSERVER_CALIBRATION_RECOMMENDATION_VERSION = "do-calibration-recommendation-v1";

export const DIGITAL_OBSERVER_FEEDBACK_LABELS = [
  "TRUE_SECURITY_EVENT",
  "TRUE_EXPECTED_ACTIVITY",
  "FALSE_DETECTION",
  "FALSE_CORRELATION",
  "FALSE_SPATIAL_EVENT",
  "UNCERTAIN",
  "OTHER"
] as const;

export type DigitalObserverFeedbackLabel = typeof DIGITAL_OBSERVER_FEEDBACK_LABELS[number];
export type FeedbackTargetType = "INCIDENT" | "EVENT" | "VERIFICATION" | "DECISION" | "EVIDENCE";
export type FeedbackEnvironment = "PRODUCTION" | "TEST" | "CALIBRATION_FIXTURE";

export type ReviewedCalibrationSample = {
  id: string;
  canonicalLabel: DigitalObserverFeedbackLabel;
  environment: FeedbackEnvironment;
  incidentProvenance: string;
  reviewState: "REVIEWED" | "CORRECTED" | "SUPERSEDED";
  observerSiteId: string;
  cameraSourceId: string | null;
  decision: string | null;
  verificationStatus: string | null;
  verificationClassification: string | null;
  versionSnapshot: Record<string, unknown>;
};

export type VersionAwareQualityGroup = {
  versionKey: string;
  sampleSize: number;
  labels: Record<DigitalObserverFeedbackLabel, number>;
};

const zeroLabels = (): Record<DigitalObserverFeedbackLabel, number> => ({
  TRUE_SECURITY_EVENT: 0,
  TRUE_EXPECTED_ACTIVITY: 0,
  FALSE_DETECTION: 0,
  FALSE_CORRELATION: 0,
  FALSE_SPATIAL_EVENT: 0,
  UNCERTAIN: 0,
  OTHER: 0
});

function canonicalVersionKey(snapshot: Record<string, unknown>) {
  const model = Array.isArray(snapshot.model) ? snapshot.model : [];
  return JSON.stringify({
    model,
    risk_engine: snapshot.risk_engine ?? null,
    risk_factors: snapshot.risk_factors ?? null,
    verification: snapshot.verification ?? null,
    decision: snapshot.decision ?? null,
    baseline: snapshot.baseline ?? null,
    rules: snapshot.rules ?? []
  });
}

export function isProductionReviewedSample(sample: ReviewedCalibrationSample) {
  return sample.environment === "PRODUCTION"
    && sample.incidentProvenance === "REAL_CAMERA_AI"
    && ["REVIEWED", "CORRECTED"].includes(sample.reviewState);
}

export function decisionQualityFor(label: DigitalObserverFeedbackLabel, decision: string | null) {
  if (label === "TRUE_EXPECTED_ACTIVITY" && ["IGNORE", "LOG_ONLY"].includes(String(decision))) return "ALIGNED";
  if (label === "UNCERTAIN" && decision === "VERIFY") return "ALIGNED";
  if (["FALSE_DETECTION", "FALSE_CORRELATION", "FALSE_SPATIAL_EVENT"].includes(label)
    && ["NOTIFY_IN_APP", "ESCALATION_CANDIDATE"].includes(String(decision))) return "POTENTIAL_OVER_ESCALATION";
  if (label === "TRUE_SECURITY_EVENT" && ["IGNORE", "LOG_ONLY"].includes(String(decision))) return "POTENTIAL_UNDER_RESPONSE";
  return "REVIEW_REQUIRED";
}

export function buildFeedbackQualityMetrics(input: ReviewedCalibrationSample[]) {
  const samples = input.filter(isProductionReviewedSample);
  const labels = zeroLabels();
  const decisionPatterns: Record<string, number> = {};
  let verificationAligned = 0;
  let verificationComparable = 0;

  for (const sample of samples) {
    labels[sample.canonicalLabel] += 1;
    const decisionQuality = decisionQualityFor(sample.canonicalLabel, sample.decision);
    decisionPatterns[decisionQuality] = (decisionPatterns[decisionQuality] ?? 0) + 1;
    const factualTrue = ["TRUE_SECURITY_EVENT", "TRUE_EXPECTED_ACTIVITY"].includes(sample.canonicalLabel);
    const confirmed = ["LIKELY", "CONFIRMED", "RESOLVED"].includes(String(sample.verificationStatus));
    const falseDetectionMatch = sample.canonicalLabel === "FALSE_DETECTION"
      && sample.verificationClassification === "FALSE_DETECTION";
    const falseCorrelationMatch = sample.canonicalLabel === "FALSE_CORRELATION"
      && sample.verificationClassification === "FALSE_CORRELATION";
    if (factualTrue || sample.canonicalLabel === "FALSE_DETECTION" || sample.canonicalLabel === "FALSE_CORRELATION") {
      verificationComparable += 1;
      if (factualTrue ? confirmed : falseDetectionMatch || falseCorrelationMatch) verificationAligned += 1;
    }
  }

  const precisionDenominator = labels.TRUE_SECURITY_EVENT + labels.TRUE_EXPECTED_ACTIVITY + labels.FALSE_DETECTION;
  const versionGroups = new Map<string, VersionAwareQualityGroup>();
  for (const sample of samples) {
    const versionKey = canonicalVersionKey(sample.versionSnapshot);
    const group = versionGroups.get(versionKey) ?? { versionKey, sampleSize: 0, labels: zeroLabels() };
    group.sampleSize += 1;
    group.labels[sample.canonicalLabel] += 1;
    versionGroups.set(versionKey, group);
  }

  return {
    reviewedIncidentCount: samples.length,
    labels,
    falseDetectionRate: {
      value: samples.length ? labels.FALSE_DETECTION / samples.length : null,
      numerator: labels.FALSE_DETECTION,
      denominator: samples.length
    },
    expectedActivityRate: {
      value: samples.length ? labels.TRUE_EXPECTED_ACTIVITY / samples.length : null,
      numerator: labels.TRUE_EXPECTED_ACTIVITY,
      denominator: samples.length
    },
    reviewedDetectionPrecision: {
      value: precisionDenominator
        ? (labels.TRUE_SECURITY_EVENT + labels.TRUE_EXPECTED_ACTIVITY) / precisionDenominator
        : null,
      numerator: labels.TRUE_SECURITY_EVENT + labels.TRUE_EXPECTED_ACTIVITY,
      denominator: precisionDenominator,
      scope: "reviewed_detected_incidents_only"
    },
    recall: {
      available: false,
      reason: "Known missed real-world events / false negatives are not yet captured by this reviewed-Incident dataset."
    },
    verificationAlignment: {
      value: verificationComparable ? verificationAligned / verificationComparable : null,
      numerator: verificationAligned,
      denominator: verificationComparable
    },
    decisionPatterns,
    versionGroups: [...versionGroups.values()]
  };
}

export function calibrationRecommendation(input: ReviewedCalibrationSample[]) {
  const samples = input.filter(isProductionReviewedSample);
  const metrics = buildFeedbackQualityMetrics(samples);
  const sampleSize = samples.length;
  const falseSpatial = metrics.labels.FALSE_SPATIAL_EVENT;
  const falseCorrelation = metrics.labels.FALSE_CORRELATION;
  const expectedOverEscalation = samples.filter((sample) => sample.canonicalLabel === "TRUE_EXPECTED_ACTIVITY"
    && ["VERIFY", "NOTIFY_IN_APP", "ESCALATION_CANDIDATE"].includes(String(sample.decision))).length;
  let recommendationType = "CONTINUE_REVIEWED_DATA_COLLECTION";
  if (sampleSize >= 10 && metrics.labels.FALSE_DETECTION / sampleSize >= 0.2) recommendationType = "REVIEW_PERSON_DETECTOR_FALSE_POSITIVES";
  else if (sampleSize >= 10 && falseSpatial / sampleSize >= 0.2) recommendationType = "REVIEW_CAMERA_SPATIAL_GEOMETRY";
  else if (sampleSize >= 10 && falseCorrelation / sampleSize >= 0.2) recommendationType = "REVIEW_INCIDENT_CORRELATION";
  else if (sampleSize >= 10 && expectedOverEscalation / sampleSize >= 0.3) recommendationType = "REVIEW_EXPECTED_ACTIVITY_DECISION_ALIGNMENT";

  return {
    recommendationType,
    status: sampleSize < 10 ? "INSUFFICIENT_SAMPLE" : "REVIEW_READY",
    sampleSize,
    confidence: Math.min(0.9, sampleSize / 20),
    requiresHumanApproval: true,
    productionMutationAllowed: false,
    affectedVersionGroups: metrics.versionGroups.map((group) => ({ versionKey: group.versionKey, sampleSize: group.sampleSize }))
  };
}
