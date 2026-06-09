type Row = Record<string, any>;

function unresolved(findings: Row[]) {
  return findings.filter((finding) => !["resolved", "false_positive", "accepted_risk"].includes(String(finding.status)));
}

function averageScore(rows: Row[], field = "readiness_score") {
  if (!rows.length) return 0;
  return Math.round(rows.reduce((sum, row) => sum + Number(row[field] ?? 0), 0) / rows.length);
}

function passedPercent(rows: Row[], passStatuses: string[]) {
  if (!rows.length) return 0;
  return Math.round((rows.filter((row) => passStatuses.includes(String(row.status ?? row.rls_status ?? row.auth_status))).length / rows.length) * 100);
}

export function buildExternalSecurityAuditSummary(input: {
  auditReviews?: Row[];
  findings?: Row[];
  rlsReports?: Row[];
  apiReports?: Row[];
  penetrationTests?: Row[];
  recoveryProcedures?: Row[];
  securityChecks?: Row[];
  backups?: Row[];
  secrets?: Row[];
} = {}) {
  const auditReviews = input.auditReviews ?? [];
  const findings = unresolved(input.findings ?? []);
  const rlsReports = input.rlsReports ?? [];
  const apiReports = input.apiReports ?? [];
  const penetrationTests = input.penetrationTests ?? [];
  const recoveryProcedures = input.recoveryProcedures ?? [];
  const securityChecks = input.securityChecks ?? [];
  const backups = input.backups ?? [];
  const secrets = input.secrets ?? [];
  const criticalFindings = findings.filter((finding) => finding.severity === "critical").length;
  const highFindings = findings.filter((finding) => finding.severity === "high").length;
  const mediumFindings = findings.filter((finding) => finding.severity === "medium").length;
  const lowFindings = findings.filter((finding) => finding.severity === "low").length;
  const auditScore = averageScore(auditReviews);
  const rlsScore = rlsReports.length ? Math.round((rlsReports.filter((report) => report.rls_status === "enabled" && ["scoped", "admin_only", "public_insert_only"].includes(String(report.scope_status))).length / rlsReports.length) * 100) : 0;
  const apiScore = apiReports.length ? Math.round((apiReports.filter((report) => !["blocked", "needs_review"].includes(String(report.auth_status)) && !["blocked", "needs_review"].includes(String(report.authorization_status)) && report.client_role_trust_status === "not_trusted" && !["blocked", "needs_review"].includes(String(report.secrets_exposure_status))).length / apiReports.length) * 100) : 0;
  const secretsScore = secrets.length ? Math.round((secrets.filter((secret) => ["ready", "not_required"].includes(String(secret.readiness_status))).length / secrets.length) * 100) : 0;
  const backupScore = backups.length ? Math.round((backups.filter((backup) => ["ready", "not_required"].includes(String(backup.status))).length / backups.length) * 100) : 0;
  const complianceScore = auditReviews.length ? averageScore(auditReviews.filter((review) => review.category === "compliance")) || auditScore : 0;
  const authScore = auditReviews.length ? averageScore(auditReviews.filter((review) => review.category === "authentication" || review.category === "authorization")) || auditScore : 0;
  const penalty = criticalFindings * 18 + highFindings * 8 + mediumFindings * 3;
  const base = Math.round((authScore * 0.16) + (rlsScore * 0.17) + (apiScore * 0.17) + (secretsScore * 0.14) + (backupScore * 0.12) + (complianceScore * 0.12) + (auditScore * 0.12));
  const readinessScore = Math.max(0, Math.min(100, base - penalty));

  return {
    criticalFindings,
    highFindings,
    mediumFindings,
    lowFindings,
    resolvedFindings: (input.findings ?? []).filter((finding) => ["resolved", "false_positive", "accepted_risk"].includes(String(finding.status))).length,
    readinessScore,
    authScore,
    rlsScore,
    apiScore,
    secretsScore,
    backupScore,
    complianceScore,
    auditScore,
    penetrationCompletionPercent: passedPercent(penetrationTests, ["passed", "accepted_risk"]),
    recoveryReadyPercent: passedPercent(recoveryProcedures, ["ready", "tested"]),
    readyChecks: securityChecks.filter((check) => check.status === "ready").length,
    blockedReviews: auditReviews.filter((review) => review.status === "blocked").length,
    externalAuditStatus: criticalFindings > 0 || readinessScore < 55 ? "blocked" : readinessScore >= 80 && highFindings === 0 ? "pilot_ready" : "hardening"
  };
}

export function auditTone(status?: string | number | null): "default" | "good" | "warn" | "bad" {
  if (typeof status === "number") {
    if (status >= 80) return "good";
    if (status >= 55) return "warn";
    return "bad";
  }
  const value = String(status ?? "").toLowerCase();
  if (["ready", "resolved", "verified", "passed", "pilot_ready", "scoped", "enabled", "not_exposed", "not_trusted"].includes(value)) return "good";
  if (["critical", "high", "blocked", "failed", "disabled"].includes(value)) return "bad";
  if (["partial", "needs_review", "open", "discovered", "not_started", "pending", "hardening"].includes(value)) return "warn";
  return "default";
}

export const securityAuditPrinciples = [
  "כל תפקיד נבדק לפי הרשאה מינימלית",
  "אין אמון בתפקיד שמגיע מהלקוח",
  "אין חשיפת RTSP, סיסמאות או מפתחות בדפדפן",
  "כל פעולה רגישה צריכה Audit",
  "אין תצפיתן שמייצר האשמות או החלטות אוטומטיות"
];
