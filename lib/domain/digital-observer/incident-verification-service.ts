import "server-only";
import {
  evaluateIncidentVerification,
  type CameraVerificationHealth,
  type CanonicalVerificationInput,
  type IncidentVerification,
  type VerificationSignal,
  type VerificationStatus
} from "./incident-verification-engine";
import type { BaselineMaturity, CanonicalRiskInput, RiskBand, RiskDecision, RiskEvaluation } from "./risk-decision-engine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic Supabase tables do not have generated database types in this repository.
type SupabaseLike = any;
type Row = Record<string, unknown>;

type VerificationRiskContext = {
  incidentStatus: CanonicalRiskInput["incident"]["status"];
  withinExpectedHours: boolean | null;
  baselineMaturity: BaselineMaturity;
  baselineVersion: string | null;
  policy: CanonicalRiskInput["policy"];
};

type VerificationRiskProjection = Pick<RiskEvaluation,
  "riskScore" | "riskBand" | "evaluationConfidence" | "recommendedDecision"
> & { matchedRules: Array<{ priority: number }> };

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function finiteNumberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function verificationStatus(value: unknown): VerificationStatus {
  const status = String(value ?? "UNVERIFIED");
  return ["UNVERIFIED", "LIKELY", "CONFIRMED", "UNCERTAIN", "REJECTED_FALSE_POSITIVE", "RESOLVED"].includes(status)
    ? status as VerificationStatus
    : "UNVERIFIED";
}

function incidentStatus(value: unknown): VerificationRiskContext["incidentStatus"] {
  const status = String(value ?? "open");
  return ["open", "acknowledged", "resolved", "closed"].includes(status)
    ? status as VerificationRiskContext["incidentStatus"]
    : "open";
}

function baselineMaturity(value: unknown): BaselineMaturity {
  const maturity = String(value ?? "NO_DATA");
  return ["NO_DATA", "LEARNING", "LOW_CONFIDENCE", "ESTABLISHED", "STALE"].includes(maturity)
    ? maturity as BaselineMaturity
    : "NO_DATA";
}

function riskBand(value: unknown): RiskBand {
  const band = String(value ?? "LOW");
  return ["LOW", "GUARDED", "ELEVATED", "HIGH", "CRITICAL"].includes(band) ? band as RiskBand : "LOW";
}

function riskDecision(value: unknown): RiskDecision {
  const decision = String(value ?? "LOG_ONLY");
  return ["IGNORE", "LOG_ONLY", "PRESERVE_EVIDENCE", "VERIFY", "NOTIFY_IN_APP", "ESCALATION_CANDIDATE"].includes(decision)
    ? decision as RiskDecision
    : "LOG_ONLY";
}

function containsFactor(rows: unknown, key: string) {
  return arrayValue(rows).some((item) => String(objectValue(item).key ?? "") === key);
}

function cameraHealth(row: Row | null, latestSignalAt: string | null): CanonicalVerificationInput["cameraHealth"] {
  if (!row) return { state: "unknown", observedAt: null };
  const status = String(row.status ?? "").toLowerCase();
  const health = String(row.health_status ?? "").toLowerCase();
  let state: CameraVerificationHealth = "unknown";
  if (["offline", "failed", "error", "disabled"].includes(status) || ["offline", "failed", "error"].includes(health)) state = "offline";
  else if (["degraded", "reconnecting"].includes(status) || ["degraded", "reconnecting"].includes(health)) state = "degraded";
  else if (["connected", "active", "ready", "online"].includes(status) && ["healthy", "online", "connected", "ok"].includes(health)) state = "healthy";
  const observedAt = typeof row.last_health_check_at === "string"
    ? row.last_health_check_at
    : typeof row.last_seen_at === "string"
      ? row.last_seen_at
      : typeof row.updated_at === "string" ? row.updated_at : null;
  // Current source health is useful for a live ingest only. It must not be
  // retroactively presented as event-time health when an old Incident is
  // re-evaluated for migration or audit.
  if (!latestSignalAt || Date.now() - Date.parse(latestSignalAt) > 5 * 60_000) {
    return { state: "unknown", observedAt };
  }
  return { state, observedAt };
}

function signalRow(row: Row): VerificationSignal {
  const metadata = objectValue(row.metadata);
  const evidence = objectValue(metadata.verification_evidence);
  return {
    id: String(row.id),
    observerSiteId: String(row.observer_site_id),
    sourceType: String(row.source_type),
    provenance: String(metadata.observation_provenance ?? ""),
    validated: metadata.validated_event === true,
    eventType: String(metadata.event_type ?? ""),
    cameraSourceId: String(metadata.camera_source_id ?? ""),
    streamId: typeof metadata.stream_id === "string" ? metadata.stream_id : null,
    trackId: typeof metadata.track_id === "string" ? metadata.track_id : null,
    occurredAt: String(row.created_at ?? ""),
    detectionConfidence: finiteNumberOrNull(row.confidence),
    evidenceKind: typeof metadata.evidence_kind === "string" ? metadata.evidence_kind : null,
    verificationEvidence: Object.keys(evidence).length ? {
      distinctSourceFrames: finiteNumberOrNull(evidence.distinct_source_frames),
      directionalConfirmations: finiteNumberOrNull(evidence.directional_confirmations),
      sourceSequence: finiteNumberOrNull(evidence.source_sequence),
      sourceAnchorVerified: typeof evidence.source_anchor_verified === "boolean" ? evidence.source_anchor_verified : null,
      trackingDurationMs: finiteNumberOrNull(evidence.tracking_duration_ms)
    } : null
  };
}

function evidenceState(signals: Row[], clips: Row[]): CanonicalVerificationInput["evidence"] {
  const bySignal = new Map(signals.map((signal) => [String(signal.id), signal]));
  const available = clips.find((clip) => String(clip.media_status ?? clip.clip_status ?? "") === "available");
  if (available) {
    const signal = bySignal.get(String(available.signal_id));
    const metadata = objectValue(signal?.metadata);
    const capturedAt = Date.parse(String(available.captured_at ?? ""));
    const eventAt = Date.parse(String(signal?.created_at ?? ""));
    return {
      status: "available",
      sourceMatches: Boolean(signal && String(available.camera_source_id ?? "") === String(metadata.camera_source_id ?? "")),
      timeMatches: Number.isFinite(capturedAt) && Number.isFinite(eventAt) && Math.abs(capturedAt - eventAt) <= 60_000
    };
  }
  const mediaStates = signals.map((signal) => String(objectValue(signal.metadata).media_status ?? "unknown"));
  const status = (["failed", "missing", "expired", "pending"] as const).find((candidate) => mediaStates.includes(candidate))
    ?? (mediaStates.length && mediaStates.every((value) => value === "not_required") ? "not_required" : "unknown");
  return { status, sourceMatches: null, timeMatches: null };
}

function sameSourceBinding(signals: VerificationSignal[], incident: Row) {
  const cameras = new Set(signals.map((signal) => signal.cameraSourceId));
  const streams = new Set(signals.map((signal) => signal.streamId).filter(Boolean));
  const incidentCameras = new Set(arrayValue(incident.involved_camera_ids).map(String));
  return cameras.size === 1 && streams.size <= 1 && [...cameras].every((camera) => incidentCameras.has(camera));
}

function geometryValid(signals: VerificationSignal[]) {
  const directional = signals.filter((signal) => ["person_entered", "person_exited", "vehicle_entered", "vehicle_exited"].includes(signal.eventType));
  return directional.length ? directional.every((signal) => signal.evidenceKind === "line_crossing") : null;
}

async function persistVerification(input: {
  db: SupabaseLike;
  incident: Row;
  evaluation: IncidentVerification;
  previousVerificationId: string | null;
}) {
  const { db, incident, evaluation, previousVerificationId } = input;
  let saved = await db.from("digital_observer_incident_verifications").insert({
    observer_site_id: incident.observer_site_id,
    incident_id: incident.id,
    risk_evaluation_id: evaluation.riskEvaluationId,
    status: evaluation.status,
    classification: evaluation.classification,
    verification_confidence: evaluation.verificationConfidence,
    final_decision_confidence: evaluation.finalDecisionConfidence,
    confirmed_signals: evaluation.confirmedSignals,
    contradictory_signals: evaluation.contradictorySignals,
    verification_reasons: evaluation.verificationReasons,
    required_followup: evaluation.requiredFollowup,
    final_decision: evaluation.finalDecision,
    fast_path: evaluation.fastPath,
    metrics: evaluation.metrics,
    verification_version: evaluation.verificationVersion,
    final_decision_version: evaluation.finalDecisionVersion,
    input_fingerprint: evaluation.inputFingerprint,
    previous_verification_id: previousVerificationId,
    evaluated_at: evaluation.evaluatedAt,
    metadata: {
      deterministic: true,
      no_llm: true,
      real_provenance_only: true,
      external_action_executed: false,
      privacy_policy_authoritative: true
    }
  }).select("id").single();
  if (saved.error?.code === "23505") {
    saved = await db.from("digital_observer_incident_verifications").select("id")
      .eq("incident_id", incident.id)
      .eq("risk_evaluation_id", evaluation.riskEvaluationId)
      .eq("verification_version", evaluation.verificationVersion)
      .single();
  }
  if (saved.error || !saved.data?.id) throw new Error("INCIDENT_VERIFICATION_WRITE_FAILED");
  const verificationId = String(saved.data.id);

  const decisionIntent = await db.from("digital_observer_decision_intents").insert({
    observer_site_id: incident.observer_site_id,
    incident_id: incident.id,
    risk_evaluation_id: evaluation.riskEvaluationId,
    decision: evaluation.finalDecision,
    status: "proposed",
    dedupe_key: evaluation.decisionDedupeKey,
    cooldown_until: new Date(Date.parse(evaluation.evaluatedAt) + 5 * 60_000).toISOString(),
    requires_human_review: evaluation.requiredFollowup !== "NONE",
    external_execution_enabled: false,
    metadata: {
      decision_stage: "post_verification_final",
      verification_id: verificationId,
      verification_version: evaluation.verificationVersion,
      final_decision_version: evaluation.finalDecisionVersion,
      final_decision_confidence: evaluation.finalDecisionConfidence,
      privacy_policy_authoritative: true
    }
  });
  if (decisionIntent.error && decisionIntent.error.code !== "23505") throw new Error("FINAL_DECISION_INTENT_WRITE_FAILED");

  const metadata = objectValue(incident.metadata);
  const updated = await db.from("observer_correlated_events").update({
    current_verification_status: evaluation.status,
    verification_classification: evaluation.classification,
    verification_confidence: evaluation.verificationConfidence,
    final_decision: evaluation.finalDecision,
    final_decision_confidence: evaluation.finalDecisionConfidence,
    latest_verification_id: verificationId,
    verification_updated_at: evaluation.evaluatedAt,
    metadata: {
      ...metadata,
      verification_version: evaluation.verificationVersion,
      final_decision_version: evaluation.finalDecisionVersion,
      verification_reasons: evaluation.verificationReasons,
      required_verification_followup: evaluation.requiredFollowup,
      verification_fast_path: evaluation.fastPath,
      no_external_action_executed: true
    }
  }).eq("id", incident.id).eq("observer_site_id", incident.observer_site_id);
  if (updated.error) throw new Error("INCIDENT_VERIFICATION_PROJECTION_FAILED");
  return verificationId;
}

export async function evaluateAndPersistIncidentVerification(input: {
  db: SupabaseLike;
  incident: Row;
  riskContext: VerificationRiskContext;
  riskEvaluation: VerificationRiskProjection;
  riskEvaluationId: string;
}) {
  const { db, incident, riskContext, riskEvaluation, riskEvaluationId } = input;
  const relatedEventIds = arrayValue(incident.related_event_ids).map(String);
  const [signalsResult, cameraResult, clipsResult, previousResult] = await Promise.all([
    db.from("observer_intelligence_signals").select("id,observer_site_id,source_type,confidence,created_at,metadata")
      .eq("observer_site_id", incident.observer_site_id).in("id", relatedEventIds),
    db.from("digital_observer_camera_sources").select("id,observer_site_id,status,health_status,last_health_check_at,last_seen_at,updated_at,metadata")
      .eq("id", incident.primary_camera_source_id).eq("observer_site_id", incident.observer_site_id).maybeSingle(),
    relatedEventIds.length
      ? db.from("digital_observer_event_clips").select("id,observer_site_id,camera_source_id,signal_id,clip_status,media_status,captured_at")
        .eq("observer_site_id", incident.observer_site_id).in("signal_id", relatedEventIds)
      : Promise.resolve({ data: [], error: null }),
    db.from("digital_observer_incident_verifications").select("id,status,verification_confidence")
      .eq("incident_id", incident.id).order("evaluated_at", { ascending: false }).limit(1).maybeSingle()
  ]);
  if (signalsResult.error || cameraResult.error || clipsResult.error || previousResult.error) {
    throw new Error("INCIDENT_VERIFICATION_INPUT_UNAVAILABLE");
  }
  const signalRows = (signalsResult.data ?? []) as Row[];
  const signals = signalRows.map(signalRow).sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
  const previous = previousResult.data as Row | null;
  const verificationInput: CanonicalVerificationInput = {
    observerSiteId: String(incident.observer_site_id),
    incident: {
      id: String(incident.id),
      observerSiteId: String(incident.observer_site_id),
      status: riskContext.incidentStatus,
      provenance: String(incident.provenance ?? ""),
      cameraSourceIds: arrayValue(incident.involved_camera_ids).map(String),
      trackIds: arrayValue(incident.involved_track_ids).map(String),
      relatedEventIds
    },
    signals,
    risk: {
      evaluationId: riskEvaluationId,
      riskScore: riskEvaluation.riskScore,
      riskBand: riskEvaluation.riskBand,
      evaluationConfidence: riskEvaluation.evaluationConfidence,
      recommendedDecision: riskEvaluation.recommendedDecision,
      matchedRuleCount: riskEvaluation.matchedRules.length,
      explicitHighPriorityRule: riskEvaluation.matchedRules.some((rule) => rule.priority >= 9)
    },
    context: {
      withinExpectedHours: riskContext.withinExpectedHours,
      baselineMaturity: riskContext.baselineMaturity,
      baselineVersion: riskContext.baselineVersion
    },
    cameraHealth: cameraHealth(cameraResult.data as Row | null, signals.at(-1)?.occurredAt ?? null),
    evidence: evidenceState(signalRows, (clipsResult.data ?? []) as Row[]),
    technicalIntegrity: {
      sourceBindingValid: sameSourceBinding(signals, incident),
      geometryValid: geometryValid(signals),
      replayedFrameDetected: signals.some((signal) => signal.verificationEvidence?.distinctSourceFrames === 1
        && Number(signal.verificationEvidence.sourceSequence) >= 0
        && signals.some((candidate) => candidate.id !== signal.id
          && candidate.verificationEvidence?.sourceSequence === signal.verificationEvidence?.sourceSequence))
    },
    policy: riskContext.policy,
    previousVerification: previous ? {
      id: String(previous.id), status: verificationStatus(previous.status),
      verificationConfidence: Number(previous.verification_confidence ?? 0)
    } : null
  };
  const evaluation = evaluateIncidentVerification(verificationInput);
  if (!evaluation.accepted) throw new Error(`INCIDENT_VERIFICATION_INPUT_${evaluation.reason}`);
  const verificationId = await persistVerification({
    db, incident, evaluation, previousVerificationId: previous ? String(previous.id) : null
  });
  return { status: "verified" as const, evaluation, verificationId };
}

/**
 * Runs the canonical verifier against an already-persisted REAL Incident. This
 * is an audit/backfill entry point for Incidents created before PUSH 10; it
 * never creates or changes source Events, Incidents, Risk scores, or media.
 */
export async function evaluatePersistedIncidentVerification(input: {
  db: SupabaseLike;
  observerSiteId: string;
  incidentId: string;
}) {
  const { db, observerSiteId, incidentId } = input;
  const incidentResult = await db.from("observer_correlated_events")
    .select("id,observer_site_id,status,provenance,primary_camera_source_id,involved_camera_ids,involved_track_ids,related_event_ids,metadata,latest_risk_evaluation_id")
    .eq("id", incidentId).eq("observer_site_id", observerSiteId).eq("correlation_version", "do-track-v1").single();
  if (incidentResult.error || !incidentResult.data?.latest_risk_evaluation_id) {
    throw new Error("PERSISTED_INCIDENT_RISK_UNAVAILABLE");
  }
  const incident = incidentResult.data as Row;
  const riskResult = await db.from("digital_observer_risk_evaluations")
    .select("id,risk_score,risk_band,evaluation_confidence,recommended_decision,matched_rules,baseline_context,contributing_factors,mitigating_factors")
    .eq("id", incident.latest_risk_evaluation_id).eq("incident_id", incidentId).eq("observer_site_id", observerSiteId).single();
  if (riskResult.error || !riskResult.data) throw new Error("PERSISTED_INCIDENT_RISK_UNAVAILABLE");
  const risk = riskResult.data as Row;
  const relatedEventIds = arrayValue(incident.related_event_ids).map(String);
  const signalsResult = await db.from("observer_intelligence_signals").select("id,metadata")
    .eq("observer_site_id", observerSiteId).in("id", relatedEventIds);
  if (signalsResult.error) throw new Error("PERSISTED_INCIDENT_SIGNALS_UNAVAILABLE");
  const baselineContext = objectValue(risk.baseline_context);
  const matchedRules = arrayValue(risk.matched_rules).map((rule) => ({
    priority: Number(objectValue(rule).priority ?? 0)
  }));
  const signalMetadata: Array<Record<string, unknown>> = (signalsResult.data ?? [])
    .map((signal: Row) => objectValue(signal.metadata));
  const withinExpectedHours = containsFactor(risk.contributing_factors, "outside_expected_hours")
    ? false
    : containsFactor(risk.mitigating_factors, "within_expected_hours") ? true : null;
  return evaluateAndPersistIncidentVerification({
    db,
    incident,
    riskContext: {
      incidentStatus: incidentStatus(incident.status),
      withinExpectedHours,
      baselineMaturity: baselineMaturity(baselineContext.maturity),
      baselineVersion: typeof baselineContext.version === "string" ? baselineContext.version : null,
      policy: {
        recordingAuthorized: signalMetadata.some((metadata) => metadata.recording_required === true),
        inAppNotificationAllowed: true,
        externalEscalationEnabled: false
      }
    },
    riskEvaluation: {
      riskScore: Number(risk.risk_score),
      riskBand: riskBand(risk.risk_band),
      evaluationConfidence: Number(risk.evaluation_confidence),
      recommendedDecision: riskDecision(risk.recommended_decision),
      matchedRules
    },
    riskEvaluationId: String(risk.id)
  });
}
