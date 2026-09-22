import "server-only";

import { createDigitalObserverAdminDataClient } from "@/lib/domain/digital-observer/admin-access";
import { getDigitalObserverServiceReadiness } from "@/lib/domain/digital-observer/service-readiness";

export type OperationalHealth = "HEALTHY" | "DEGRADED" | "UNAVAILABLE" | "UNKNOWN";
export type OperationalSeverity = "INFO" | "WARNING" | "HIGH" | "CRITICAL";

export type OperationalMetric = {
  name: string;
  value: number | null;
  unit: "count" | "percent" | "milliseconds";
  observedAt: string;
  available: boolean;
};

export type OperationalIssue = {
  category: string;
  domain: string;
  severity: OperationalSeverity;
  count: number;
  firstSeen: string | null;
  lastSeen: string | null;
  retryable: boolean;
};

export type OperationalAlert = OperationalIssue & {
  dedupeKey: string;
  status: "ACTIVE";
};

export type OperationalDomainSnapshot = {
  domain: string;
  health: OperationalHealth;
  lastActivityAt: string | null;
  metrics: OperationalMetric[];
  issues: OperationalIssue[];
  dataAvailable: boolean;
};

export type OperationalTelemetrySnapshot = {
  collectedAt: string;
  version: {
    appRevision: string;
    deploymentId: string | null;
    environment: string;
    schemaState: "PUSH_25_MIGRATION_PENDING" | "UNKNOWN";
  };
  domains: OperationalDomainSnapshot[];
  alerts: OperationalAlert[];
  roadmap: {
    push16: "BLOCKED — INDEPENDENT REAL SOURCE REQUIRED";
    push25BillingRls: "DEFERRED — FROZEN AREA";
  };
};

type Row = Record<string, unknown>;
// Dynamic Supabase tables are not represented in the generated database type.
// This isolated read model accepts only bounded, explicitly selected columns.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = any;

type ReadResult = { rows: Row[]; available: boolean };

function asRows(value: unknown): Row[] {
  return Array.isArray(value) ? value.filter((item): item is Row => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
}

function asInstant(value: unknown): string | null {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
}

function latest(rows: Row[], ...keys: string[]) {
  const instants = rows.flatMap((row) => keys.map((key) => asInstant(row[key]))).filter((value): value is string => Boolean(value));
  return instants.sort().at(-1) ?? null;
}

function earliest(rows: Row[], ...keys: string[]) {
  const instants = rows.flatMap((row) => keys.map((key) => asInstant(row[key]))).filter((value): value is string => Boolean(value));
  return instants.sort().at(0) ?? null;
}

function metric(name: string, value: number | null, unit: OperationalMetric["unit"], available: boolean, observedAt: string): OperationalMetric {
  return { name, value: available ? value : null, unit, observedAt, available };
}

function countBy(rows: Row[], key: string, values: string[]) {
  const allowed = new Set(values.map((value) => value.toLowerCase()));
  return rows.filter((row) => allowed.has(String(row[key] ?? "").toLowerCase())).length;
}

function domainHealth(available: boolean, issueCount: number, hasObservedResource = true): OperationalHealth {
  if (!available) return "UNKNOWN";
  if (!hasObservedResource) return "UNKNOWN";
  return issueCount ? "DEGRADED" : "HEALTHY";
}

function issue(category: string, domain: string, severity: OperationalSeverity, count: number, rows: Row[], retryable = true): OperationalIssue | null {
  if (!count) return null;
  return { category, domain, severity, count, firstSeen: earliest(rows, "created_at", "evaluated_at", "last_health_check_at"), lastSeen: latest(rows, "updated_at", "created_at", "evaluated_at", "last_health_check_at", "last_seen_at"), retryable };
}

function compactIssues(values: Array<OperationalIssue | null>) {
  return values.filter((value): value is OperationalIssue => Boolean(value));
}

async function readRows(label: string, query: () => PromiseLike<{ data: unknown; error: { code?: string } | null }>): Promise<ReadResult> {
  try {
    const result = await query();
    if (result.error) {
      console.warn("[observer-telemetry] read unavailable", { label, code: result.error.code ?? "UNKNOWN" });
      return { rows: [], available: false };
    }
    return { rows: asRows(result.data), available: true };
  } catch (error) {
    console.warn("[observer-telemetry] read crashed", { label, errorType: error instanceof Error ? error.name : typeof error });
    return { rows: [], available: false };
  }
}

export function operationalAlertKey(item: OperationalIssue) {
  return `${item.domain}:${item.category}`;
}

export function buildOperationalAlerts(domains: OperationalDomainSnapshot[]): OperationalAlert[] {
  return domains.flatMap((domain) => domain.issues.map((item) => ({ ...item, dedupeKey: operationalAlertKey(item), status: "ACTIVE" as const })));
}

export function safeOperationalSnapshot(snapshot: OperationalTelemetrySnapshot) {
  return {
    collectedAt: snapshot.collectedAt,
    version: snapshot.version,
    roadmap: snapshot.roadmap,
    domains: snapshot.domains.map((domain) => ({
      domain: domain.domain,
      health: domain.health,
      lastActivityAt: domain.lastActivityAt,
      dataAvailable: domain.dataAvailable,
      metrics: domain.metrics,
      issues: domain.issues.map(({ category, severity, count, firstSeen, lastSeen, retryable }) => ({ category, severity, count, firstSeen, lastSeen, retryable }))
    })),
    alerts: snapshot.alerts.map(({ dedupeKey, domain, category, severity, count, firstSeen, lastSeen, retryable, status }) => ({ dedupeKey, domain, category, severity, count, firstSeen, lastSeen, retryable, status }))
  };
}

export async function loadDigitalObserverOperationalTelemetry(): Promise<OperationalTelemetrySnapshot> {
  const collectedAt = new Date().toISOString();
  const supabase = createDigitalObserverAdminDataClient() as SupabaseLike;
  const [sources, signals, incidents, clips, baselines, risk, verification, decisions, feedback, rules, deliveries] = await Promise.all([
    readRows("camera_sources", () => supabase.from("digital_observer_camera_sources").select("id,observer_site_id,status,health_status,last_seen_at,last_health_check_at,last_error_code,connector_type,connector_provider,created_at").limit(1000)),
    readRows("signals", () => supabase.from("observer_intelligence_signals").select("id,observer_site_id,source_type,review_status,created_at,reviewed_at,resolved_at").order("created_at", { ascending: false }).limit(1000)),
    readRows("incidents", () => supabase.from("observer_correlated_events").select("id,observer_site_id,status,opened_at,last_activity_at,closed_at,correlation_version,provenance").eq("correlation_version", "do-track-v1").limit(1000)),
    readRows("evidence", () => supabase.from("digital_observer_event_clips").select("id,observer_site_id,clip_status,media_status,retry_count,captured_at,delete_after,created_at").limit(1000)),
    readRows("baselines", () => supabase.from("observer_site_learning_profiles").select("observer_site_id,learning_status,learning_maturity,confidence_level,updated_at").limit(1000)),
    readRows("risk", () => supabase.from("digital_observer_risk_evaluations").select("id,observer_site_id,risk_band,evaluated_at,risk_engine_version").limit(1000)),
    readRows("verification", () => supabase.from("digital_observer_incident_verifications").select("id,observer_site_id,status,classification,evaluated_at,verification_version").limit(1000)),
    readRows("decisions", () => supabase.from("digital_observer_decision_intents").select("id,observer_site_id,decision,status,created_at,updated_at").limit(1000)),
    readRows("feedback", () => supabase.from("digital_observer_feedback_revisions").select("id,observer_site_id,label,created_at").limit(1000)),
    readRows("rule_evaluations", () => supabase.from("digital_observer_watch_rule_evaluations").select("id,observer_site_id,matched,evaluated_at,evaluation_version").limit(1000)),
    readRows("deliveries", () => supabase.from("digital_observer_notification_deliveries").select("id,observer_site_id,channel,provider_mode,delivery_status,attempt_count,created_at,sent_at").limit(1000))
  ]);

  const sourceIssues = sources.rows.filter((row) => ["offline", "failed", "degraded", "error", "unavailable"].includes(String(row.status ?? row.health_status ?? "").toLowerCase()) || ["offline", "failed", "degraded", "error"].includes(String(row.health_status ?? "").toLowerCase()));
  const evidenceIssues = clips.rows.filter((row) => ["failed", "expired"].includes(String(row.media_status ?? row.clip_status ?? "").toLowerCase()));
  const decisionSuppressions = countBy(decisions.rows, "status", ["suppressed", "expired", "cancelled"]);
  const providerFailures = countBy(deliveries.rows, "delivery_status", ["failed", "rejected", "error"]);
  const readiness = getDigitalObserverServiceReadiness();

  const domains: OperationalDomainSnapshot[] = [
    {
      domain: "CAMERA_CONNECTION",
      health: domainHealth(sources.available, sourceIssues.length, sources.rows.length > 0),
      lastActivityAt: latest(sources.rows, "last_seen_at", "last_health_check_at", "created_at"),
      dataAvailable: sources.available,
      metrics: [metric("camera_sources", sources.rows.length, "count", sources.available, collectedAt), metric("camera_degraded_or_offline", sourceIssues.length, "count", sources.available, collectedAt)],
      issues: compactIssues([issue("CAMERA_OFFLINE_OR_DEGRADED", "CAMERA_CONNECTION", sourceIssues.length > 3 ? "HIGH" : "WARNING", sourceIssues.length, sourceIssues)])
    },
    {
      domain: "EVENT_JOURNAL",
      health: domainHealth(signals.available, 0, signals.rows.length > 0),
      lastActivityAt: latest(signals.rows, "created_at", "reviewed_at", "resolved_at"),
      dataAvailable: signals.available,
      metrics: [metric("events_observed", signals.rows.length, "count", signals.available, collectedAt), metric("events_pending_review", countBy(signals.rows, "review_status", ["needs_review", "reviewing", "escalated"]), "count", signals.available, collectedAt)],
      issues: []
    },
    {
      domain: "INCIDENT",
      health: domainHealth(incidents.available, 0, incidents.rows.length > 0),
      lastActivityAt: latest(incidents.rows, "last_activity_at", "opened_at", "closed_at"),
      dataAvailable: incidents.available,
      metrics: [metric("incidents_total", incidents.rows.length, "count", incidents.available, collectedAt), metric("incidents_open", countBy(incidents.rows, "status", ["open", "acknowledged"]), "count", incidents.available, collectedAt)],
      issues: []
    },
    {
      domain: "EVIDENCE_STORAGE",
      health: domainHealth(clips.available, evidenceIssues.length, clips.rows.length > 0),
      lastActivityAt: latest(clips.rows, "captured_at", "created_at"),
      dataAvailable: clips.available,
      metrics: [metric("evidence_records", clips.rows.length, "count", clips.available, collectedAt), metric("evidence_failed_or_expired", evidenceIssues.length, "count", clips.available, collectedAt)],
      issues: compactIssues([issue("EVIDENCE_UNAVAILABLE", "EVIDENCE_STORAGE", evidenceIssues.length > 3 ? "HIGH" : "WARNING", evidenceIssues.length, evidenceIssues)])
    },
    {
      domain: "CONTEXT_BASELINE",
      health: domainHealth(baselines.available, countBy(baselines.rows, "learning_maturity", ["STALE"]), baselines.rows.length > 0),
      lastActivityAt: latest(baselines.rows, "updated_at"),
      dataAvailable: baselines.available,
      metrics: [metric("baseline_profiles", baselines.rows.length, "count", baselines.available, collectedAt), metric("baseline_stale", countBy(baselines.rows, "learning_maturity", ["STALE"]), "count", baselines.available, collectedAt)],
      issues: compactIssues([issue("BASELINE_STALE", "CONTEXT_BASELINE", "WARNING", countBy(baselines.rows, "learning_maturity", ["STALE"]), baselines.rows)])
    },
    {
      domain: "RISK_VERIFICATION_DECISION",
      health: domainHealth(risk.available && verification.available && decisions.available, 0, risk.rows.length + verification.rows.length + decisions.rows.length > 0),
      lastActivityAt: latest([...risk.rows, ...verification.rows, ...decisions.rows], "evaluated_at", "updated_at", "created_at"),
      dataAvailable: risk.available && verification.available && decisions.available,
      metrics: [metric("risk_evaluations", risk.rows.length, "count", risk.available, collectedAt), metric("verifications", verification.rows.length, "count", verification.available, collectedAt), metric("decision_suppressions", decisionSuppressions, "count", decisions.available, collectedAt)],
      issues: []
    },
    {
      domain: "RULES_SEARCH_FEEDBACK",
      health: domainHealth(rules.available && feedback.available, 0, rules.rows.length + feedback.rows.length > 0),
      lastActivityAt: latest([...rules.rows, ...feedback.rows], "evaluated_at", "created_at"),
      dataAvailable: rules.available && feedback.available,
      metrics: [metric("rule_evaluations", rules.rows.length, "count", rules.available, collectedAt), metric("rule_matches", rules.rows.filter((row) => row.matched === true).length, "count", rules.available, collectedAt), metric("feedback_revisions", feedback.rows.length, "count", feedback.available, collectedAt)],
      issues: []
    },
    {
      domain: "PROVIDERS",
      health: domainHealth(deliveries.available, providerFailures, deliveries.rows.length > 0),
      lastActivityAt: latest(deliveries.rows, "sent_at", "created_at"),
      dataAvailable: deliveries.available,
      metrics: [metric("provider_deliveries", deliveries.rows.length, "count", deliveries.available, collectedAt), metric("provider_delivery_failures", providerFailures, "count", deliveries.available, collectedAt)],
      issues: compactIssues([issue("PROVIDER_DELIVERY_FAILURE", "PROVIDERS", providerFailures > 5 ? "HIGH" : "WARNING", providerFailures, deliveries.rows)])
    },
    {
      domain: "API_DATABASE",
      health: domainHealth(sources.available && signals.available, 0, true),
      lastActivityAt: collectedAt,
      dataAvailable: sources.available && signals.available,
      metrics: [
        metric("configured_service_modes", Object.values(readiness).filter((value) => value && typeof value === "object" && "state" in value).length, "count", true, collectedAt),
        metric("read_model_dependencies_available", Number(sources.available && signals.available), "count", sources.available && signals.available, collectedAt)
      ],
      issues: []
    }
  ];

  return {
    collectedAt,
    version: {
      appRevision: String(process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? process.env.npm_package_version ?? "unknown").slice(0, 80),
      deploymentId: process.env.VERCEL_DEPLOYMENT_ID ? String(process.env.VERCEL_DEPLOYMENT_ID).slice(0, 120) : null,
      environment: String(process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown").slice(0, 32),
      schemaState: "PUSH_25_MIGRATION_PENDING"
    },
    alerts: buildOperationalAlerts(domains),
    domains,
    roadmap: {
      push16: "BLOCKED — INDEPENDENT REAL SOURCE REQUIRED",
      push25BillingRls: "DEFERRED — FROZEN AREA"
    }
  };
}
