export type ComplianceTone = "good" | "warn" | "bad";

export function complianceTone(scoreOrSeverity: number | string): ComplianceTone {
  if (typeof scoreOrSeverity === "number") {
    if (scoreOrSeverity >= 82) return "good";
    if (scoreOrSeverity >= 62) return "warn";
    return "bad";
  }
  const value = scoreOrSeverity.toLowerCase();
  if (["critical", "expired", "bad", "overdue", "high"].includes(value)) return "bad";
  if (["medium", "warn", "in_progress", "pending_review", "30_days", "14_days", "7_days"].includes(value)) return "warn";
  return "good";
}

export function clampComplianceScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function buildComplianceScore(input: {
  totalDocuments: number;
  invalidDocuments: number;
  expiringDocuments: number;
  totalStaff: number;
  staffIssues: number;
  overdueInspections: number;
  unresolvedFindings: number;
  missingProcedures: number;
  policyGaps: number;
}) {
  const documentsScore = input.totalDocuments
    ? clampComplianceScore(100 - ((input.invalidDocuments * 18 + input.expiringDocuments * 8) / Math.max(input.totalDocuments, 1)) * 10)
    : 72;
  const staffScore = input.totalStaff
    ? clampComplianceScore(100 - (input.staffIssues / Math.max(input.totalStaff, 1)) * 100)
    : 78;
  const inspectionsScore = clampComplianceScore(100 - input.overdueInspections * 12);
  const findingsScore = clampComplianceScore(100 - input.unresolvedFindings * 8);
  const proceduresScore = clampComplianceScore(100 - input.missingProcedures * 12 - input.policyGaps * 10);
  const score = clampComplianceScore(
    documentsScore * 0.22 +
    staffScore * 0.22 +
    inspectionsScore * 0.2 +
    findingsScore * 0.2 +
    proceduresScore * 0.16
  );
  return {
    score,
    documentsScore,
    staffScore,
    inspectionsScore,
    findingsScore,
    proceduresScore,
    tone: complianceTone(score)
  };
}

export function expirationBucket(expiresAt?: string | null) {
  if (!expiresAt) return "no_date";
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
  if (days < 0) return "expired";
  if (days <= 7) return "7_days";
  if (days <= 14) return "14_days";
  if (days <= 30) return "30_days";
  if (days <= 60) return "60_days";
  if (days <= 90) return "90_days";
  return "future";
}

export const complianceCategories = [
  "licenses",
  "insurance",
  "staff_certifications",
  "first_aid",
  "mandatory_training",
  "safety_procedures",
  "inspection_requirements",
  "legal_documents"
] as const;
