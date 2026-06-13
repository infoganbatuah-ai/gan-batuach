export type IsoStandard = "iso_27001" | "iso_27017" | "iso_27701";

export interface IsoControl {
  id?: string;
  control_key: string;
  control_id: string;
  standard: IsoStandard;
  category: string;
  title: string;
  implementation_status: "implemented" | "partial" | "planned" | "not_applicable" | "blocked";
  evidence_status: "approved" | "collected" | "partial" | "missing" | "expired";
  policy_status: "approved" | "draft" | "missing" | "needs_review" | "not_required";
  owner_role?: string | null;
  gap_summary?: string | null;
  remediation_plan?: string | null;
  due_at?: string | null;
}

export interface IsoAssetInventoryItem {
  id?: string;
  asset_key: string;
  asset_type: string;
  asset_name: string;
  provider: string;
  environment: string;
  data_classification: string;
  security_status: "ready" | "partial" | "needs_review" | "blocked" | "retired";
  contains_child_data?: boolean;
  contains_medical_data?: boolean;
  contains_camera_data?: boolean;
  encryption_required?: boolean;
  backup_required?: boolean;
  rls_required?: boolean;
}

export interface IsoRiskRegisterItem {
  id?: string;
  risk_key: string;
  standard?: string | null;
  risk_domain: string;
  risk_description: string;
  severity: "critical" | "high" | "medium" | "low";
  likelihood: "very_likely" | "likely" | "possible" | "unlikely" | "rare";
  mitigation_strategy?: string | null;
  remediation_status: "open" | "mitigating" | "mitigated" | "verified" | "accepted_risk" | "closed";
  due_at?: string | null;
}

export interface IsoInternalAudit {
  id?: string;
  audit_key: string;
  standard: IsoStandard | "combined";
  audit_scope: string;
  audit_status: "planned" | "in_progress" | "completed" | "cancelled";
  closure_status: "open" | "corrective_actions_open" | "ready_for_closure" | "closed";
  findings?: unknown[];
  corrective_actions?: unknown[];
  next_audit_due_at?: string | null;
}

export interface IsoReadinessSummary {
  iso27001: number;
  iso27017: number;
  iso27701: number;
  isoReadinessScore: number;
  openGaps: Array<{
    key: string;
    standard: string;
    title: string;
    severity: "critical" | "high" | "medium" | "low";
    recommendation: string;
  }>;
  counts: {
    controls: number;
    assets: number;
    risks: number;
    audits: number;
    permitAlerts: number;
  };
}

const standards: IsoStandard[] = ["iso_27001", "iso_27017", "iso_27701"];

function controlScore(control: Partial<IsoControl>) {
  const implementation = {
    implemented: 100,
    partial: 60,
    planned: 25,
    not_applicable: 100,
    blocked: 0
  }[String(control.implementation_status)] ?? 0;
  const evidence = {
    approved: 100,
    collected: 80,
    partial: 45,
    missing: 0,
    expired: 20
  }[String(control.evidence_status)] ?? 0;
  const policy = {
    approved: 100,
    draft: 55,
    needs_review: 35,
    missing: 0,
    not_required: 100
  }[String(control.policy_status)] ?? 0;
  return Math.round(implementation * 0.45 + evidence * 0.35 + policy * 0.2);
}

function average(values: number[]) {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
}

function riskPenalty(risks: Partial<IsoRiskRegisterItem>[], standard?: IsoStandard) {
  const relevant = risks.filter((risk) => !standard || risk.standard === standard);
  const open = relevant.filter((risk) => !["verified", "accepted_risk", "closed"].includes(String(risk.remediation_status)));
  return Math.min(25, open.reduce((sum, risk) => {
    if (risk.severity === "critical") return sum + 8;
    if (risk.severity === "high") return sum + 5;
    if (risk.severity === "medium") return sum + 3;
    return sum + 1;
  }, 0));
}

function readinessForStandard(standard: IsoStandard, controls: Partial<IsoControl>[], risks: Partial<IsoRiskRegisterItem>[]) {
  const scoped = controls.filter((control) => control.standard === standard);
  const controlCoverage = average(scoped.map(controlScore));
  return Math.max(0, Math.min(100, controlCoverage - riskPenalty(risks, standard)));
}

export function buildIsoReadinessSummary(input: {
  controls?: Partial<IsoControl>[];
  assets?: Partial<IsoAssetInventoryItem>[];
  risks?: Partial<IsoRiskRegisterItem>[];
  audits?: Partial<IsoInternalAudit>[];
  permitAlerts?: Array<Record<string, unknown>>;
} = {}): IsoReadinessSummary {
  const controls = input.controls ?? [];
  const risks = input.risks ?? [];
  const assets = input.assets ?? [];
  const audits = input.audits ?? [];
  const permitAlerts = input.permitAlerts ?? [];
  const scores = {
    iso27001: readinessForStandard("iso_27001", controls, risks),
    iso27017: readinessForStandard("iso_27017", controls, risks),
    iso27701: readinessForStandard("iso_27701", controls, risks)
  };
  const assetCoverage = average(assets.map((asset) => {
    if (asset.security_status === "ready") return 100;
    if (asset.security_status === "partial") return 65;
    if (asset.security_status === "needs_review") return 35;
    if (asset.security_status === "retired") return 100;
    return 0;
  }));
  const auditCoverage = average(audits.map((audit) => audit.closure_status === "closed" ? 100 : audit.audit_status === "completed" ? 75 : audit.audit_status === "in_progress" ? 45 : 20));
  const permitCoverage = permitAlerts.length ? Math.max(0, 100 - permitAlerts.length * 6) : 100;
  const isoReadinessScore = average([scores.iso27001, scores.iso27017, scores.iso27701, assetCoverage, auditCoverage, permitCoverage]);
  const controlGaps = controls
    .filter((control) => controlScore(control) < 75)
    .map((control) => ({
      key: String(control.control_key ?? control.control_id ?? "control"),
      standard: String(control.standard ?? "iso"),
      title: String(control.title ?? "Control gap"),
      severity: control.implementation_status === "blocked" || control.evidence_status === "missing" ? "high" as const : "medium" as const,
      recommendation: String(control.remediation_plan ?? control.gap_summary ?? "Complete implementation evidence and policy approval.")
    }));
  const riskGaps = risks
    .filter((risk) => !["verified", "accepted_risk", "closed"].includes(String(risk.remediation_status)))
    .map((risk) => ({
      key: String(risk.risk_key ?? "risk"),
      standard: String(risk.standard ?? "risk"),
      title: String(risk.risk_description ?? "Open risk"),
      severity: (risk.severity ?? "medium") as "critical" | "high" | "medium" | "low",
      recommendation: String(risk.mitigation_strategy ?? "Assign mitigation owner and close the risk.")
    }));
  return {
    ...scores,
    isoReadinessScore,
    openGaps: [...riskGaps, ...controlGaps].sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity)).slice(0, 12),
    counts: {
      controls: controls.length,
      assets: assets.length,
      risks: risks.length,
      audits: audits.length,
      permitAlerts: permitAlerts.length
    }
  };
}

export function severityWeight(severity: string) {
  if (severity === "critical") return 4;
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  return 1;
}

export { standards as isoStandards };
