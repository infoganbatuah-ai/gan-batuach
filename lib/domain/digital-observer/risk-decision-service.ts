import "server-only";
import { canonicalRealEventContext, evaluateRealEventContext } from "./home-learning-sampler";
import {
  evaluateIncidentRisk,
  type BaselineMaturity,
  type CanonicalRiskInput,
  type RiskBand,
  type RiskDecision,
  type RiskEvaluation
} from "./risk-decision-engine";
import { evaluateAndPersistIncidentVerification } from "./incident-verification-service";
import {
  evaluateCanonicalWatchRule,
  isCanonicalCompiledRule,
  type WatchRuleEvaluation
} from "./watch-rule-compiler";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic Supabase tables do not have generated database types in this repository.
type SupabaseLike = any;
type Row = Record<string, unknown>;

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function boundedPriority(value: unknown) {
  const priority = Number(value);
  return Number.isFinite(priority) ? Math.max(1, Math.min(10, Math.round(priority))) : 5;
}

function finiteNumberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function decisionValue(value: unknown): RiskDecision | null {
  const decision = String(value ?? "");
  return ["IGNORE", "LOG_ONLY", "PRESERVE_EVIDENCE", "VERIFY", "NOTIFY_IN_APP", "ESCALATION_CANDIDATE"].includes(decision)
    ? decision as RiskDecision
    : null;
}

function legacyWatchRequestMatches(request: Row, event: Row, context: { within_expected_hours: boolean | null }) {
  if (request.active !== true) return false;
  const metadata = objectValue(request.metadata);
  const eventMetadata = objectValue(event.metadata);
  const eventType = String(eventMetadata.event_type ?? "");
  const zone = String(eventMetadata.zone_id ?? eventMetadata.zone_type ?? "").toLowerCase();
  const cameraId = String(eventMetadata.camera_source_id ?? "");
  const requestCamera = String(request.camera_source_id ?? request.camera_id ?? metadata.camera_source_id ?? "");
  if (request.observer_site_id !== event.observer_site_id || (requestCamera && requestCamera !== cameraId)) return false;

  const policy = objectValue(metadata.risk_policy);
  const eventTypes = arrayValue(policy.event_types).map(String);
  if (eventTypes.length) return eventTypes.includes(eventType);
  if (request.watch_type === "after_hours_activity") return eventType === "person_entered" && context.within_expected_hours === false;
  if (request.watch_type === "restricted_area_entry") return eventType === "person_entered" && ["restricted", "restricted_area", "staff_only"].some((item) => zone.includes(item));
  return false;
}

type CanonicalRuleEvaluation = {
  request: Row;
  evaluation: WatchRuleEvaluation;
};

function evaluateRiskRules(input: {
  requests: Row[];
  event: Row;
  incident: Row;
  context: { within_expected_hours: boolean | null };
}) {
  const eventMetadata = objectValue(input.event.metadata);
  const incidentDuration = durationSeconds(input.incident);
  const canonicalEvaluations: CanonicalRuleEvaluation[] = [];
  const matchedRequests: Row[] = [];
  for (const request of input.requests) {
    const compiled = request.structured_rule;
    if (request.compiler_version && isCanonicalCompiledRule(compiled)) {
      if (request.active !== true || request.rule_state !== "ACTIVE" || request.validation_status !== "VALID") continue;
      const evaluation = evaluateCanonicalWatchRule(compiled, {
        observerSiteId: String(input.event.observer_site_id),
        cameraSourceId: String(eventMetadata.camera_source_id ?? ""),
        eventId: String(input.event.id),
        incidentId: String(input.incident.id),
        eventType: String(eventMetadata.event_type ?? ""),
        zoneId: typeof eventMetadata.zone_id === "string" ? eventMetadata.zone_id : null,
        zoneType: typeof eventMetadata.zone_type === "string" ? eventMetadata.zone_type : null,
        occurredAt: String(input.event.created_at),
        confidence: finiteNumberOrNull(input.event.confidence),
        incidentDurationSeconds: incidentDuration,
        withinExpectedHours: input.context.within_expected_hours,
        provenance: String(eventMetadata.observation_provenance ?? ""),
        validated: eventMetadata.validated_event === true
      });
      canonicalEvaluations.push({ request, evaluation });
      if (evaluation.matched) matchedRequests.push(request);
    } else if (legacyWatchRequestMatches(request, input.event, input.context)) {
      matchedRequests.push(request);
    }
  }
  const matchedRules = matchedRequests.map((request) => {
    const metadata = objectValue(request.metadata);
    const policy = objectValue(metadata.risk_policy);
    const compiled = isCanonicalCompiledRule(request.structured_rule) ? request.structured_rule : null;
    const priority = boundedPriority(request.priority);
    const contribution = compiled
      ? compiled.policyIntent.riskContribution
      : Number.isFinite(Number(policy.contribution))
      ? Math.max(0, Math.min(35, Math.round(Number(policy.contribution))))
      : priority >= 9 ? 20 : priority >= 7 ? 15 : priority >= 4 ? 8 : 3;
    const minimumRiskScore = compiled
      ? null
      : Number.isFinite(Number(policy.minimum_risk_score))
      ? Math.max(0, Math.min(100, Math.round(Number(policy.minimum_risk_score))))
      : priority >= 9 ? 75 : priority >= 7 ? 50 : null;
    const minimumDecision = compiled
      ? decisionValue(compiled.policyIntent.minimumDecision)
      : decisionValue(policy.minimum_decision)
      ?? (priority >= 9 ? "NOTIFY_IN_APP" : priority >= 7 ? "VERIFY" : null);
    return {
      id: String(request.id),
      observerSiteId: String(request.observer_site_id),
      cameraSourceId: String(request.camera_source_id ?? request.camera_id ?? metadata.camera_source_id ?? "") || null,
      title: String(request.title ?? "כלל ניטור מוגדר"),
      priority,
      version: compiled ? `watch-rule-${String(request.rule_version ?? 1)}` : String(policy.version ?? metadata.rule_version ?? request.updated_at ?? request.created_at ?? "v1"),
      contribution,
      minimumRiskScore,
      minimumDecision,
      reason: compiled ? "canonical_natural_language_watch_rule" : String(policy.reason ?? `structured_watch_request:${request.watch_type}`)
    };
  });
  return { matchedRules, canonicalEvaluations };
}

function timelineEventTypes(incident: Row) {
  return arrayValue(incident.timeline_summary).map((item) => String(objectValue(item).event_type ?? "")).filter(Boolean);
}

function durationSeconds(incident: Row) {
  const start = Date.parse(String(incident.opened_at ?? incident.start_time ?? ""));
  const end = Date.parse(String(incident.closed_at ?? incident.last_activity_at ?? incident.end_time ?? ""));
  return Number.isFinite(start) && Number.isFinite(end) && end >= start ? Math.round((end - start) / 1_000) : null;
}

function expectedSignalRows(value: unknown) {
  return arrayValue(value).map((item) => objectValue(item)).filter((item) => typeof item.key === "string" && typeof item.value === "boolean")
    .map((item) => ({ key: String(item.key), value: Boolean(item.value) }));
}

function deviationSignalRows(value: unknown) {
  return arrayValue(value).map((item) => objectValue(item)).filter((item) => typeof item.key === "string")
    .map((item) => ({ key: String(item.key), reason: String(item.reason ?? item.key) }));
}

function baselineMaturity(value: unknown): BaselineMaturity {
  const maturity = String(value ?? "NO_DATA");
  return ["NO_DATA", "LEARNING", "LOW_CONFIDENCE", "ESTABLISHED", "STALE"].includes(maturity)
    ? maturity as BaselineMaturity
    : "NO_DATA";
}

function incidentStatus(value: unknown): CanonicalRiskInput["incident"]["status"] {
  const status = String(value ?? "open");
  return ["open", "acknowledged", "resolved", "closed"].includes(status)
    ? status as CanonicalRiskInput["incident"]["status"]
    : "open";
}

function storedRiskBand(value: unknown): RiskBand {
  const band = String(value ?? "LOW");
  return ["LOW", "GUARDED", "ELEVATED", "HIGH", "CRITICAL"].includes(band) ? band as RiskBand : "LOW";
}

export async function evaluateAndPersistIncidentRisk(input: {
  db: SupabaseLike;
  signal: Row;
}) {
  const { db, signal } = input;
  const metadata = objectValue(signal.metadata);
  const eventType = String(metadata.event_type ?? "");
  if (!(["person_entered", "person_exited"].includes(eventType))
    || metadata.observation_provenance !== "REAL_CAMERA_AI"
    || metadata.validated_event !== true) return { status: "not_applicable" as const };

  const link = await db.from("observer_correlated_event_links").select("correlated_event_id")
    .eq("source_type", "observer_intelligence_signal").eq("source_id", signal.id).maybeSingle();
  if (link.error || !link.data?.correlated_event_id) throw new Error("RISK_INCIDENT_UNAVAILABLE");
  const incidentResult = await db.from("observer_correlated_events")
    .select("id,observer_site_id,status,provenance,opened_at,last_activity_at,closed_at,primary_camera_source_id,involved_camera_ids,involved_track_ids,related_event_ids,timeline_summary,metadata,current_risk_score,peak_risk_score,current_risk_band,current_decision,latest_risk_evaluation_id")
    .eq("id", link.data.correlated_event_id).eq("observer_site_id", signal.observer_site_id).single();
  if (incidentResult.error || !incidentResult.data) throw new Error("RISK_INCIDENT_UNAVAILABLE");
  const incident = incidentResult.data as Row;

  const [siteResult, scheduleResult, baselineResult, ruleResult, previousResult] = await Promise.all([
    db.from("observer_sites").select("id,timezone").eq("id", signal.observer_site_id).single(),
    db.from("observer_monitoring_schedules").select("status,schedule_mode,timezone,active_days,active_hours,schedule").eq("observer_site_id", signal.observer_site_id).maybeSingle(),
    db.from("site_behavior_baselines").select("baseline_value,metadata,confidence_level").eq("observer_site_id", signal.observer_site_id).eq("baseline_type", "normal_movement_patterns").maybeSingle(),
    db.from("observer_watch_requests").select("id,observer_site_id,camera_id,camera_source_id,title,watch_type,priority,active,metadata,structured_rule,validation_status,compiler_version,rule_version,rule_state,created_at,updated_at").eq("observer_site_id", signal.observer_site_id).eq("active", true).limit(100),
    db.from("digital_observer_risk_evaluations").select("id,risk_score,peak_risk_score,risk_band").eq("incident_id", incident.id).order("evaluated_at", { ascending: false }).limit(1).maybeSingle()
  ]);
  if (siteResult.error || !siteResult.data || scheduleResult.error || baselineResult.error || ruleResult.error || previousResult.error) {
    throw new Error("RISK_CONTEXT_UNAVAILABLE");
  }
  const timeZone = String(siteResult.data.timezone ?? scheduleResult.data?.timezone ?? "Asia/Jerusalem");
  const canonicalEvent = canonicalRealEventContext(signal, timeZone, scheduleResult.data);
  if (!canonicalEvent) throw new Error("RISK_UNTRUSTED_EVENT");
  const baselineValue = objectValue(baselineResult.data?.baseline_value);
  const realContext = objectValue(baselineValue.real_event_context);
  const cameras = objectValue(realContext.cameras);
  const cameraBaseline = objectValue(cameras[canonicalEvent.camera_source_id]);
  const contextResult = evaluateRealEventContext(canonicalEvent, cameraBaseline);
  const ruleEvaluation = evaluateRiskRules({
    requests: ruleResult.data ?? [],
    event: signal,
    incident,
    context: canonicalEvent.expected_hours
  });
  const rules = ruleEvaluation.matchedRules;
  const previous = previousResult.data as Row | null;
  const timelineTypes = timelineEventTypes(incident);
  const riskInput: CanonicalRiskInput = {
    observerSiteId: String(signal.observer_site_id),
    incident: {
      id: String(incident.id), observerSiteId: String(incident.observer_site_id), status: incidentStatus(incident.status),
      provenance: String(incident.provenance ?? ""),
      cameraSourceIds: arrayValue(incident.involved_camera_ids).map(String),
      trackIds: arrayValue(incident.involved_track_ids).map(String),
      relatedEventIds: arrayValue(incident.related_event_ids).map(String),
      eventTypes: timelineTypes,
      durationSeconds: durationSeconds(incident)
    },
    triggeringEvent: {
      id: String(signal.id), observerSiteId: String(signal.observer_site_id), sourceType: String(signal.source_type),
      provenance: String(metadata.observation_provenance ?? ""), validated: metadata.validated_event === true,
      eventType, cameraSourceId: canonicalEvent.camera_source_id, streamId: canonicalEvent.stream_id,
      trackId: canonicalEvent.track_id, zone: canonicalEvent.zone, confidence: canonicalEvent.confidence,
      occurredAt: canonicalEvent.timestamp, recordingRequired: metadata.recording_required === true,
      evidenceAvailable: metadata.media_status === "available"
    },
    context: {
      available: canonicalEvent.expected_hours.configured,
      localTime: `${canonicalEvent.local.local_date} ${String(canonicalEvent.local.local_hour).padStart(2, "0")}:00`,
      localDay: canonicalEvent.local.local_day_of_week,
      withinExpectedHours: canonicalEvent.expected_hours.within_expected_hours
    },
    baseline: {
      maturity: baselineMaturity(cameraBaseline.maturity ?? realContext.baseline_maturity),
      version: typeof realContext.version === "string" ? realContext.version : null,
      confidence: Number(cameraBaseline.confidence ?? realContext.confidence ?? 0),
      expectedSignals: expectedSignalRows(contextResult.expected_pattern_signals),
      deviationSignals: deviationSignalRows(contextResult.deviation_signals),
      typicalDurationSeconds: finiteNumberOrNull(objectValue(cameraBaseline.tracked_duration).average_seconds)
    },
    matchedRules: rules,
    policy: {
      recordingAuthorized: metadata.recording_required === true,
      inAppNotificationAllowed: true,
      externalEscalationEnabled: false
    },
    previousEvaluation: previous ? {
      riskScore: Number(previous.risk_score), peakRiskScore: Number(previous.peak_risk_score), riskBand: storedRiskBand(previous.risk_band)
    } : null
  };
  const evaluation = evaluateIncidentRisk(riskInput);
  if (!evaluation.accepted) throw new Error(`RISK_INPUT_${evaluation.reason}`);
  return persistRiskEvaluation(db, incident, evaluation, riskInput, ruleEvaluation.canonicalEvaluations);
}

async function persistRiskEvaluation(
  db: SupabaseLike,
  incident: Row,
  evaluation: RiskEvaluation,
  riskInput: CanonicalRiskInput,
  ruleEvaluations: CanonicalRuleEvaluation[]
) {
  let saved = await db.from("digital_observer_risk_evaluations").insert({
    observer_site_id: incident.observer_site_id,
    incident_id: incident.id,
    triggering_event_id: evaluation.triggeringEventId,
    risk_score: evaluation.riskScore,
    peak_risk_score: evaluation.peakRiskScore,
    risk_band: evaluation.riskBand,
    evaluation_confidence: evaluation.evaluationConfidence,
    contributing_factors: evaluation.contributingFactors,
    mitigating_factors: evaluation.mitigatingFactors,
    matched_rules: evaluation.matchedRules,
    baseline_context: evaluation.baselineContext,
    explanation: evaluation.explanation,
    recommended_decision: evaluation.recommendedDecision,
    action_intents: evaluation.actionIntents,
    risk_engine_version: evaluation.riskEngineVersion,
    factor_version: evaluation.factorVersion,
    decision_version: evaluation.decisionVersion,
    input_fingerprint: evaluation.inputFingerprint,
    previous_evaluation_id: incident.latest_risk_evaluation_id ?? null,
    evaluated_at: evaluation.evaluatedAt,
    metadata: { deterministic: true, no_llm: true, real_provenance_only: true, external_action_executed: false }
  }).select("id").single();
  if (saved.error?.code === "23505") {
    saved = await db.from("digital_observer_risk_evaluations").select("id")
      .eq("incident_id", incident.id)
      .eq("triggering_event_id", evaluation.triggeringEventId)
      .eq("risk_engine_version", evaluation.riskEngineVersion)
      .single();
  }
  if (saved.error || !saved.data?.id) throw new Error("RISK_EVALUATION_WRITE_FAILED");

  const watchRuleWrites = await Promise.all(ruleEvaluations.map(({ request, evaluation: ruleEvaluation }) => db.rpc(
    "record_digital_observer_watch_rule_evaluation",
    {
      requested_rule_id: request.id,
      requested_rule_version: Number(request.rule_version),
      requested_event_id: evaluation.triggeringEventId,
      requested_incident_id: incident.id,
      requested_risk_evaluation_id: saved.data.id,
      requested_matched: ruleEvaluation.matched,
      requested_matched_conditions: ruleEvaluation.matchedConditions,
      requested_non_match_reasons: ruleEvaluation.nonMatchReasons,
      requested_input_fingerprint: ruleEvaluation.inputFingerprint,
      requested_evaluated_at: evaluation.evaluatedAt
    }
  )));
  if (watchRuleWrites.some((write) => write.error)) throw new Error("WATCH_RULE_EVALUATION_WRITE_FAILED");

  const incidentMetadata = objectValue(incident.metadata);
  const updated = await db.from("observer_correlated_events").update({
    current_risk_score: evaluation.currentRiskScore,
    peak_risk_score: evaluation.peakRiskScore,
    current_risk_band: evaluation.riskBand,
    risk_evaluation_confidence: evaluation.evaluationConfidence,
    current_decision: evaluation.recommendedDecision,
    latest_risk_evaluation_id: saved.data.id,
    risk_updated_at: evaluation.evaluatedAt,
    metadata: {
      ...incidentMetadata,
      risk_explanation: evaluation.explanation,
      risk_engine_version: evaluation.riskEngineVersion,
      risk_factor_version: evaluation.factorVersion,
      risk_baseline_version: evaluation.baselineContext.version,
      risk_baseline_maturity: evaluation.baselineContext.maturity,
      no_external_action_executed: true
    }
  }).eq("id", incident.id).eq("observer_site_id", incident.observer_site_id);
  if (updated.error) throw new Error("RISK_INCIDENT_PROJECTION_FAILED");
  const verification = await evaluateAndPersistIncidentVerification({
    db,
    incident: {
      ...incident,
      current_risk_score: evaluation.currentRiskScore,
      peak_risk_score: evaluation.peakRiskScore,
      current_risk_band: evaluation.riskBand,
      latest_risk_evaluation_id: saved.data.id,
      metadata: incidentMetadata
    },
    riskContext: {
      incidentStatus: riskInput.incident.status,
      withinExpectedHours: riskInput.context.withinExpectedHours,
      baselineMaturity: riskInput.baseline.maturity,
      baselineVersion: riskInput.baseline.version,
      policy: riskInput.policy
    },
    riskEvaluation: evaluation,
    riskEvaluationId: String(saved.data.id)
  });
  return { status: "evaluated" as const, evaluation, evaluationId: String(saved.data.id), verification };
}
