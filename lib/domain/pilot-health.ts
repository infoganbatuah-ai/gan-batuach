type Row = Record<string, any>;

function pct(done: number, total: number) {
  return total ? Math.round((done / total) * 100) : 0;
}

function unresolved(rows: Row[]) {
  return rows.filter((row) => !["verified", "accepted_risk", "resolved", "dismissed"].includes(String(row.status)));
}

function average(values: number[]) {
  const valid = values.filter((value) => Number.isFinite(value));
  return valid.length ? Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length) : 0;
}

export function buildPilotHealthSummary(input: {
  pilots?: Row[];
  checklist?: Row[];
  journeys?: Row[];
  issues?: Row[];
  feedback?: Row[];
  usage?: Row[];
  successCriteria?: Row[];
  participants?: Row[];
  cameras?: Row[];
  observerReviews?: Row[];
} = {}) {
  const pilots = input.pilots ?? [];
  const checklist = input.checklist ?? [];
  const journeys = input.journeys ?? [];
  const issues = input.issues ?? [];
  const feedback = input.feedback ?? [];
  const usage = input.usage ?? [];
  const successCriteria = input.successCriteria ?? [];
  const participants = input.participants ?? [];
  const cameras = input.cameras ?? [];
  const observerReviews = input.observerReviews ?? [];
  const openIssues = unresolved(issues);
  const openFeedback = unresolved(feedback);
  const criticalIssues = openIssues.filter((issue) => issue.severity === "critical").length;
  const highIssues = openIssues.filter((issue) => issue.severity === "high").length;
  const checklistScore = pct(checklist.filter((item) => ["completed", "verified", "not_required"].includes(String(item.status))).length, checklist.filter((item) => item.required !== false).length || checklist.length);
  const journeyScore = pct(journeys.filter((item) => item.status === "passed").length, journeys.filter((item) => item.status !== "not_applicable").length);
  const issueScore = Math.max(0, 100 - criticalIssues * 35 - highIssues * 18 - openIssues.length * 5);
  const feedbackRatings = feedback.map((item) => Number(item.rating ?? 0)).filter((value) => value > 0);
  const satisfactionScore = feedbackRatings.length ? Math.round((average(feedbackRatings) / 5) * 100) : average(successCriteria.map((item) => Number(item.current_value ?? 0)));
  const usageScore = Math.min(100, average([
    ...usage.map((item) => Number(item.onboarding_completion_percent ?? 0)),
    usage.length ? Math.min(100, usage.reduce((sum, item) => sum + Number(item.daily_active_users ?? 0), 0) * 5) : 0
  ]));
  const cameraScore = cameras.length
    ? pct(cameras.filter((camera) => ["connected", "online", "healthy"].includes(String(camera.status ?? camera.stream_status ?? camera.health_status))).length, cameras.length)
    : (pilots.some((pilot) => pilot.camera_availability === "test_mode" || pilot.camera_availability === "none") ? 65 : 0);
  const observerScore = observerReviews.length
    ? Math.max(40, Math.min(100, observerReviews.length * 10))
    : (pilots.some((pilot) => pilot.observer_participation) ? 55 : 0);
  const readinessScore = Math.max(0, Math.min(100, average([checklistScore, journeyScore, issueScore, satisfactionScore, usageScore, cameraScore, observerScore])));

  return {
    pilotStatus: pilots[0]?.pilot_status ?? "planned",
    activeUsers: participants.filter((item) => item.participant_status === "active").length || usage.reduce((sum, item) => sum + Number(item.daily_active_users ?? 0), 0),
    openIssues: openIssues.length,
    criticalIssues,
    highIssues,
    feedbackCount: feedback.length,
    openFeedback: openFeedback.length,
    readinessScore,
    checklistScore,
    journeyScore,
    issueScore,
    satisfactionScore,
    usageScore,
    cameraScore,
    observerScore,
    managerSatisfaction: criteriaValue(successCriteria, "manager-satisfaction", satisfactionScore),
    parentSatisfaction: criteriaValue(successCriteria, "parent-satisfaction", satisfactionScore),
    onboardingCompletion: criteriaValue(successCriteria, "onboarding-completion", checklistScore),
    issueResolution: criteriaValue(successCriteria, "issue-resolution", issueScore),
    observerReadiness: criteriaValue(successCriteria, "observer-readiness", observerScore),
    cameraReadiness: criteriaValue(successCriteria, "camera-readiness", cameraScore)
  };
}

function criteriaValue(criteria: Row[], key: string, fallback: number) {
  const found = criteria.find((item) => item.criteria_key === key);
  return found ? Math.round(Number(found.current_value ?? fallback)) : fallback;
}

export function pilotTone(value: string | number): "default" | "good" | "warn" | "bad" {
  if (typeof value === "number") {
    if (value >= 80) return "good";
    if (value >= 55) return "warn";
    return "bad";
  }
  if (["active", "completed", "verified", "passed", "met", "connected", "available"].includes(value)) return "good";
  if (["critical", "high", "blocked", "open"].includes(value)) return "bad";
  if (["planned", "in_progress", "tracking", "friction", "test_mode"].includes(value)) return "warn";
  return "default";
}

export const pilotRoleJourneys = {
  manager: ["login", "onboarding", "children_management", "parent_management", "staff_management", "documents", "cameras", "observer"],
  parent: ["registration", "child_access", "attendance_visibility", "messages", "documents", "pickup", "cameras_if_enabled"],
  staff: ["invitation", "onboarding", "permissions", "attendance", "tasks", "communication"]
};
