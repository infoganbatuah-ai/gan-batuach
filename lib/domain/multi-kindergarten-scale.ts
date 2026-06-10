export type ScaleTone = "good" | "warn" | "bad";

export type ScaleReadinessInput = {
  activeGardens: number;
  totalGardens: number;
  managers: number;
  inspectors: number;
  parents: number;
  staff: number;
  children: number;
  unresolvedIsolationChecks: number;
  slowApiChecks: number;
  slowDashboardChecks: number;
  activeCameras: number;
  offlineCameras: number;
  observerEvents: number;
  openIssues: number;
  onboardingCompleted: number;
  onboardingTotal: number;
  activeParentSignals: number;
  activeStaffSignals: number;
  activeManagerSignals: number;
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function percent(done: number, total: number, fallback = 100) {
  if (!total) return fallback;
  return clamp((done / total) * 100);
}

export function scaleTone(score: number | string): ScaleTone {
  const value = typeof score === "number" ? score : String(score).toLowerCase();
  if (typeof value === "number") {
    if (value >= 82) return "good";
    if (value >= 62) return "warn";
    return "bad";
  }
  if (["critical", "high", "failed", "blocked", "bad"].includes(value)) return "bad";
  if (["partial", "warn", "medium", "pending", "not_tested"].includes(value)) return "warn";
  return "good";
}

export function buildScaleReadinessScore(input: ScaleReadinessInput) {
  const tenantCoverage = clamp(
    (input.activeGardens >= 5 ? 35 : input.activeGardens * 7) +
    (input.managers >= input.activeGardens ? 25 : percent(input.managers, Math.max(input.activeGardens, 1), 0) * 0.25) +
    (input.inspectors ? 20 : 0) +
    (input.parents && input.staff && input.children ? 20 : 0)
  );
  const isolationScore = clamp(100 - input.unresolvedIsolationChecks * 18);
  const performanceScore = clamp(100 - input.slowApiChecks * 10 - input.slowDashboardChecks * 12);
  const cameraScore = input.activeCameras + input.offlineCameras
    ? clamp(100 - (input.offlineCameras / Math.max(input.activeCameras + input.offlineCameras, 1)) * 100)
    : 72;
  const stabilityScore = clamp(100 - input.openIssues * 8 - Math.min(input.observerEvents, 12) * 2);
  const onboardingScore = percent(input.onboardingCompleted, input.onboardingTotal, input.activeGardens ? 70 : 0);
  const adoptionScore = clamp(
    (input.activeParentSignals ? 34 : 0) +
    (input.activeStaffSignals ? 33 : 0) +
    (input.activeManagerSignals ? 33 : 0)
  );

  const readinessScore = clamp(
    tenantCoverage * 0.18 +
    isolationScore * 0.24 +
    performanceScore * 0.18 +
    stabilityScore * 0.14 +
    onboardingScore * 0.14 +
    adoptionScore * 0.12
  );

  return {
    readinessScore,
    tenantCoverage,
    isolationScore,
    performanceScore,
    cameraScore,
    stabilityScore,
    onboardingScore,
    adoptionScore,
    tone: scaleTone(readinessScore)
  };
}

export const tenantIsolationAudit = [
  {
    role: "Parent",
    scope: "ילדים, מסמכים, הודעות, מצלמות ואירועי איסוף רק דרך שיוך הורה-ילד/גן",
    evidence: "parents, parent_kindergarten_links, children, can_parent_access_garden"
  },
  {
    role: "Staff",
    scope: "נתוני עבודה, ילדים, משימות ומסמכים רק לפי garden_id משויך",
    evidence: "staff.garden_id, profiles.garden_id, can_access_garden"
  },
  {
    role: "Manager",
    scope: "ניהול גן יחיד לפי current_garden_id והרשאות manager/owner",
    evidence: "gardens.manager_id, profiles.garden_id, current_garden_id"
  },
  {
    role: "Inspector",
    scope: "גישה לגנים משויכים בלבד דרך inspector_id או שיבוץ ביקורת",
    evidence: "gardens.inspector_id, inspections.inspector_id, can_access_garden"
  }
] as const;
