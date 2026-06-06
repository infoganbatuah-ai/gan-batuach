export type SecurityReadinessSummary = {
  totalChecks: number;
  readyChecks: number;
  partialChecks: number;
  blockedChecks: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
  unresolvedFindings: number;
  secretsTracked: number;
  secretsPending: number;
  backupReady: number;
  backupPending: number;
  recoveryReady: number;
  recoveryPending: number;
  auditCoveragePercent: number;
  rateLimitBlocks: number;
  monitoringOpen: number;
  overallStatus: "ready" | "partial" | "blocked";
};

export function buildSecurityReadinessSummary(input: {
  checks?: any[];
  findings?: any[];
  secrets?: any[];
  backups?: any[];
  recovery?: any[];
  auditCatalog?: any[];
  rateLimitEvents?: any[];
  monitoringEvents?: any[];
} = {}): SecurityReadinessSummary {
  const checks = input.checks ?? [];
  const findings = input.findings ?? [];
  const secrets = input.secrets ?? [];
  const backups = input.backups ?? [];
  const recovery = input.recovery ?? [];
  const auditCatalog = input.auditCatalog ?? [];
  const rateLimitEvents = input.rateLimitEvents ?? [];
  const monitoringEvents = input.monitoringEvents ?? [];
  const unresolved = findings.filter((finding) => !["resolved", "false_positive", "accepted_risk"].includes(String(finding.status)));
  const implementedAudits = auditCatalog.filter((event) => event.implemented).length;
  const auditCoveragePercent = auditCatalog.length ? Math.round((implementedAudits / auditCatalog.length) * 100) : 0;
  const blockedChecks = checks.filter((check) => check.status === "blocked").length;
  const criticalFindings = unresolved.filter((finding) => finding.severity === "critical").length;
  return {
    totalChecks: checks.length,
    readyChecks: checks.filter((check) => check.status === "ready").length,
    partialChecks: checks.filter((check) => check.status === "partial").length,
    blockedChecks,
    criticalFindings,
    highFindings: unresolved.filter((finding) => finding.severity === "high").length,
    mediumFindings: unresolved.filter((finding) => finding.severity === "medium").length,
    lowFindings: unresolved.filter((finding) => finding.severity === "low").length,
    unresolvedFindings: unresolved.length,
    secretsTracked: secrets.length,
    secretsPending: secrets.filter((secret) => ["pending", "blocked", "partial"].includes(String(secret.readiness_status))).length,
    backupReady: backups.filter((backup) => backup.status === "ready").length,
    backupPending: backups.filter((backup) => ["pending", "partial", "blocked"].includes(String(backup.status))).length,
    recoveryReady: recovery.filter((checkpoint) => checkpoint.status === "ready").length,
    recoveryPending: recovery.filter((checkpoint) => ["pending", "partial", "blocked", "needs_review"].includes(String(checkpoint.status))).length,
    auditCoveragePercent,
    rateLimitBlocks: rateLimitEvents.filter((event) => event.blocked).length,
    monitoringOpen: monitoringEvents.filter((event) => ["open", "reviewing"].includes(String(event.status))).length,
    overallStatus: criticalFindings || blockedChecks ? "blocked" : checks.some((check) => check.status !== "ready") || unresolved.length ? "partial" : "ready"
  };
}

export function securityStatusTone(status: string) {
  if (["ready", "resolved", "current", "passed"].includes(status)) return "pill good";
  if (["blocked", "critical", "high", "failed", "overdue"].includes(status)) return "pill bad";
  return "pill warn";
}
