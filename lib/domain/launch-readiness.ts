export type LaunchReadinessSummary = {
  overallScore: number;
  readyCategories: number;
  partialCategories: number;
  notReadyCategories: number;
  openIssues: number;
  criticalIssues: number;
  highIssues: number;
  openBlockers: number;
  completedChecklist: number;
  requiredChecklist: number;
  checklistPercent: number;
  activePilots: number;
  completedPilots: number;
  participantsActive: number;
  satisfactionAverage: number;
  configurationReady: number;
  configurationPending: number;
  launchStatus: "ready" | "partial" | "blocked";
};

export function buildLaunchReadinessSummary(input: {
  readiness?: any[];
  issues?: any[];
  blockers?: any[];
  checklist?: any[];
  pilots?: any[];
  participants?: any[];
  configuration?: any[];
} = {}): LaunchReadinessSummary {
  const readiness = input.readiness ?? [];
  const issues = input.issues ?? [];
  const blockers = input.blockers ?? [];
  const checklist = input.checklist ?? [];
  const pilots = input.pilots ?? [];
  const participants = input.participants ?? [];
  const configuration = input.configuration ?? [];
  const openIssues = issues.filter((issue) => !["verified", "accepted_risk"].includes(String(issue.status)));
  const openBlockers = blockers.filter((blocker) => !["verified", "accepted_risk"].includes(String(blocker.status)));
  const requiredChecklist = checklist.filter((item) => item.required);
  const completedRequired = requiredChecklist.filter((item) => ["completed", "verified", "not_required"].includes(String(item.status)));
  const score = readiness.length ? Math.round(readiness.reduce((sum, item) => sum + Number(item.score ?? 0), 0) / readiness.length) : 0;
  const satisfactionValues = pilots.map((pilot) => Number(pilot.satisfaction_score ?? 0)).filter((value) => value > 0);
  const criticalIssues = openIssues.filter((issue) => issue.severity === "critical").length;
  const criticalBlockers = openBlockers.filter((blocker) => blocker.severity === "critical").length;
  return {
    overallScore: score,
    readyCategories: readiness.filter((item) => item.status === "ready").length,
    partialCategories: readiness.filter((item) => item.status === "partial").length,
    notReadyCategories: readiness.filter((item) => ["not_ready", "blocked"].includes(String(item.status))).length,
    openIssues: openIssues.length,
    criticalIssues,
    highIssues: openIssues.filter((issue) => issue.severity === "high").length,
    openBlockers: openBlockers.length,
    completedChecklist: completedRequired.length,
    requiredChecklist: requiredChecklist.length,
    checklistPercent: requiredChecklist.length ? Math.round((completedRequired.length / requiredChecklist.length) * 100) : 0,
    activePilots: pilots.filter((pilot) => pilot.pilot_status === "active").length,
    completedPilots: pilots.filter((pilot) => pilot.pilot_status === "completed").length,
    participantsActive: participants.filter((participant) => participant.participant_status === "active").length,
    satisfactionAverage: satisfactionValues.length ? Math.round(satisfactionValues.reduce((sum, value) => sum + value, 0) / satisfactionValues.length) : 0,
    configurationReady: configuration.filter((item) => item.readiness_status === "ready").length,
    configurationPending: configuration.filter((item) => ["partial", "not_ready", "blocked"].includes(String(item.readiness_status))).length,
    launchStatus: criticalIssues || criticalBlockers ? "blocked" : score >= 85 && openBlockers.length === 0 && completedRequired.length === requiredChecklist.length ? "ready" : "partial"
  };
}

export function readinessTone(status: string) {
  if (["ready", "completed", "verified", "active"].includes(status)) return "pill good";
  if (["blocked", "critical", "not_ready", "open"].includes(status)) return "pill bad";
  return "pill warn";
}
