export type IsoEvidenceStatus = "missing" | "draft" | "uploaded" | "reviewed" | "approved" | "expired";
export type IsoGapStatus = "open" | "in_progress" | "fixed" | "accepted_risk" | "verified";

type Row = Record<string, any>;

export interface IsoEvidenceSummary {
  iso27001Evidence: number;
  iso27017Evidence: number;
  iso27701Evidence: number;
  auditReadinessScore: number;
  missingEvidence: Row[];
  expiredEvidence: Row[];
  openGaps: Row[];
  policyCoverage: number;
  supplierCoverage: number;
  soaCoverage: number;
  binderReadiness: number;
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function average(values: number[]) {
  return values.length ? clamp(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

function evidenceScore(status?: string | null) {
  if (status === "approved") return 100;
  if (status === "reviewed") return 85;
  if (status === "uploaded") return 70;
  if (status === "draft") return 40;
  if (status === "expired") return 20;
  return 0;
}

function implementationScore(status?: string | null) {
  if (status === "implemented") return 100;
  if (status === "partial") return 62;
  if (status === "planned") return 35;
  if (status === "not_applicable") return 100;
  return 0;
}

function approvalScore(status?: string | null) {
  if (status === "approved") return 100;
  if (status === "reviewed") return 85;
  if (status === "signed") return 90;
  if (status === "under_review") return 60;
  if (status === "draft") return 45;
  if (status === "needs_review") return 35;
  if (status === "not_required") return 100;
  return 0;
}

function standardEvidenceScore(standard: string, evidence: Row[], gaps: Row[]) {
  const scoped = evidence.filter((item) => item.standard === standard || item.standard === "combined");
  const base = average(scoped.map((item) => evidenceScore(item.status)));
  const penalty = gaps
    .filter((gap) => gap.standard === standard || gap.standard === "combined")
    .filter((gap) => !["fixed", "verified", "accepted_risk"].includes(String(gap.status)))
    .reduce((sum, gap) => {
      if (gap.severity === "critical") return sum + 10;
      if (gap.severity === "high") return sum + 7;
      if (gap.severity === "medium") return sum + 4;
      return sum + 2;
    }, 0);
  return clamp(base - Math.min(30, penalty));
}

export function buildIsoEvidenceSummary(input: {
  evidence?: Row[];
  soa?: Row[];
  policies?: Row[];
  procedures?: Row[];
  suppliers?: Row[];
  accessReviews?: Row[];
  gaps?: Row[];
  binderExports?: Row[];
  reviewSchedule?: Row[];
} = {}): IsoEvidenceSummary {
  const evidence = input.evidence ?? [];
  const soa = input.soa ?? [];
  const policies = input.policies ?? [];
  const procedures = input.procedures ?? [];
  const suppliers = input.suppliers ?? [];
  const accessReviews = input.accessReviews ?? [];
  const gaps = input.gaps ?? [];
  const binderExports = input.binderExports ?? [];
  const reviewSchedule = input.reviewSchedule ?? [];

  const policyCoverage = average([
    ...policies.map((policy) => approvalScore(policy.approval_status ?? policy.status)),
    ...procedures.map((procedure) => approvalScore(procedure.status))
  ]);
  const supplierCoverage = average(suppliers.map((supplier) => average([
    approvalScore(supplier.security_review_status),
    approvalScore(supplier.privacy_review_status),
    approvalScore(supplier.contract_status),
    approvalScore(supplier.dpa_status)
  ])));
  const soaCoverage = average(soa.map((item) => implementationScore(item.implementation_status)));
  const accessReviewCoverage = average(accessReviews.map((review) => {
    if (review.review_status === "completed") return 100;
    if (review.review_status === "in_progress") return 55;
    if (review.review_status === "overdue" || review.review_status === "blocked") return 10;
    return 30;
  }));
  const scheduleCoverage = average(reviewSchedule.map((item) => {
    if (item.status === "completed") return 100;
    if (item.status === "scheduled") return 70;
    if (item.status === "due") return 45;
    if (item.status === "overdue" || item.status === "blocked") return 10;
    return 30;
  }));
  const binderReadiness = binderExports.some((item) => item.status === "ready")
    ? 90
    : binderExports.length
      ? 55
      : 35;
  const openGaps = gaps.filter((gap) => !["fixed", "verified", "accepted_risk"].includes(String(gap.status)));
  const expiredEvidence = evidence.filter((item) => item.status === "expired" || (item.expires_at && new Date(item.expires_at).getTime() < Date.now()));
  const missingEvidence = evidence.filter((item) => ["missing", "draft"].includes(String(item.status)));
  const iso27001Evidence = standardEvidenceScore("iso_27001", evidence, gaps);
  const iso27017Evidence = standardEvidenceScore("iso_27017", evidence, gaps);
  const iso27701Evidence = standardEvidenceScore("iso_27701", evidence, gaps);
  const auditReadinessScore = average([
    iso27001Evidence,
    iso27017Evidence,
    iso27701Evidence,
    policyCoverage,
    supplierCoverage,
    soaCoverage,
    accessReviewCoverage,
    scheduleCoverage,
    binderReadiness
  ]);

  return {
    iso27001Evidence,
    iso27017Evidence,
    iso27701Evidence,
    auditReadinessScore,
    missingEvidence,
    expiredEvidence,
    openGaps,
    policyCoverage,
    supplierCoverage,
    soaCoverage,
    binderReadiness
  };
}
