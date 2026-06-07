type Row = Record<string, any>;

const outcomeKeys = ["correct_detection", "missed_detection", "false_positive", "false_negative", "uncertain"] as const;

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function confidenceFor(event: Row) {
  return Number(event.confidence ?? event.confidence_score ?? event.combined_confidence ?? event.confidence_at_review ?? 0);
}

function stability(values: number[]) {
  if (values.length < 2) return values.length ? 0.5 : 0;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) / values.length;
  return Math.max(0, Math.min(1, 1 - Math.sqrt(variance)));
}

export function buildObserverEventFeed({ aiEvents, audioEvents, correlatedEvents, summaries = [] }: { aiEvents: Row[]; audioEvents: Row[]; correlatedEvents: Row[]; summaries?: Row[] }) {
  const events: Row[] = [
    ...aiEvents.map((event) => ({ ...event, event_source: "ai_camera_event", event_label: event.event_type ?? "אירוע מצלמה", confidence: event.combined_confidence ?? event.confidence_score })),
    ...audioEvents.map((event) => ({ ...event, event_source: "audio_observer_event", event_label: event.event_type ?? "אירוע שמע" })),
    ...correlatedEvents.map((event) => ({ ...event, event_source: "observer_correlated_event", event_label: event.correlation_type ?? "אירוע מקושר" })),
    ...summaries.map((event) => ({ ...event, event_source: "observer_summary", event_label: event.summary_type ?? "סיכום תצפיתן", confidence: event.confidence_score ?? event.confidence }))
  ];
  return events.sort((a, b) => new Date(b.created_at ?? b.generated_at ?? 0).getTime() - new Date(a.created_at ?? a.generated_at ?? 0).getTime());
}

export function calculateObserverAccuracy(reviews: Row[], events: Row[] = [], calibrationProfiles: Row[] = []) {
  const counts = outcomeKeys.reduce<Record<string, number>>((acc, key) => ({ ...acc, [key]: 0 }), {});
  for (const review of reviews) {
    const outcome = String(review.outcome ?? "");
    if (outcome in counts) counts[outcome] += 1;
  }

  const reviewed = reviews.length;
  const correct = counts.correct_detection;
  const missed = counts.missed_detection;
  const falsePositive = counts.false_positive;
  const falseNegative = counts.false_negative;
  const uncertain = counts.uncertain;
  const accepted = correct;
  const rejected = falsePositive + falseNegative + missed;
  const precision = correct + falsePositive ? correct / (correct + falsePositive) : 0;
  const recall = correct + falseNegative + missed ? correct / (correct + falseNegative + missed) : 0;
  const falsePositiveRate = reviewed ? falsePositive / reviewed : 0;
  const falseNegativeRate = reviewed ? falseNegative / reviewed : 0;
  const confidenceValues = [
    ...reviews.map(confidenceFor).filter((value) => value > 0),
    ...events.map(confidenceFor).filter((value) => value > 0)
  ];
  const confidenceAverage = confidenceValues.length ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length : 0;
  const confidenceStability = stability(confidenceValues);
  const calibrationQuality = calibrationProfiles.length
    ? calibrationProfiles.reduce((sum, profile) => sum + Number(profile.readiness_score ?? 0), 0) / calibrationProfiles.length
    : 0;
  const maturityScore = clamp(
    Math.min(reviewed, 80) * 0.55
    + confidenceStability * 25
    + Math.min(calibrationProfiles.length * 5, 15)
    - falsePositiveRate * 20
    - falseNegativeRate * 25
  );
  const readinessScore = clamp(
    Math.min(reviewed, 100) * 0.35
    + precision * 18
    + recall * 18
    + confidenceStability * 14
    + confidenceAverage * 10
    + calibrationQuality * 0.15
    - falsePositiveRate * 25
    - falseNegativeRate * 30
  );

  return {
    reviewed,
    correct,
    missed,
    falsePositive,
    falseNegative,
    uncertain,
    accepted,
    rejected,
    precision,
    recall,
    falsePositiveRate,
    falseNegativeRate,
    confidenceAverage,
    confidenceStability,
    calibrationQuality,
    maturityScore,
    readinessScore,
    trainingStatus: reviewed >= 80 && precision >= 0.75 && recall >= 0.7 ? "candidate" : reviewed >= 25 ? "review_ready" : "collecting"
  };
}

export function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function scoreTone(score: number): "default" | "good" | "warn" | "bad" {
  if (score >= 80) return "good";
  if (score >= 55) return "warn";
  return "bad";
}

export function statusTone(status?: string | null): "default" | "good" | "warn" | "bad" {
  const value = String(status ?? "").toLowerCase();
  if (["ready", "stable", "candidate", "production_candidate", "review_ready", "correct_detection", "completed"].includes(value)) return "good";
  if (["blocked", "failed", "false_positive", "false_negative"].includes(value)) return "bad";
  if (["collecting", "calibrating", "uncertain", "missed_detection", "not_ready", "mock_ready", "queued"].includes(value)) return "warn";
  return "default";
}

export const observerSafetyRules = [
  "אין פעולה אוטומטית",
  "אין האשמות אוטומטיות",
  "אין יצירת משמעת או ענישה",
  "אין פנייה אוטומטית להורים או לרשויות",
  "בדיקת אדם חובה לפני כל החלטה"
];
