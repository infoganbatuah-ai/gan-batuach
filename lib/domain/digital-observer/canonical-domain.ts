/**
 * Canonical Digital Observer domain ownership manifest.
 *
 * Runtime services own behavior. This data-only manifest gives QA,
 * compatibility adapters and operations one stable place to resolve the
 * authoritative contract for every Product concept.
 */
export const DIGITAL_OBSERVER_DOMAIN_CONTRACT = "digital-observer-domain-v1" as const;
export const DIGITAL_OBSERVER_EVENT_PROVENANCE = "REAL_CAMERA_AI" as const;
export const DIGITAL_OBSERVER_INCIDENT_VERSION = "do-track-v1" as const;
export const LEGACY_KINDERGARTEN_CORRELATION_VERSION = "legacy-kindergarten-mock-v1" as const;

export type DomainPathClass = "CANONICAL" | "COMPATIBILITY" | "LEGACY" | "DEVELOPMENT_ONLY";

export const DIGITAL_OBSERVER_CANONICAL_DOMAINS = {
  cameraSource: { store: "digital_observer_camera_sources", owner: "camera-connection-layer", api: "/api/digital-observer/cameras" },
  event: { store: "observer_intelligence_signals", owner: "video-gateway/cloud-events", api: "/api/digital-observer/event-journal" },
  incident: { store: "observer_correlated_events", discriminator: DIGITAL_OBSERVER_INCIDENT_VERSION, owner: "correlate_digital_observer_signal", api: "/api/digital-observer/incidents" },
  evidence: { store: "digital_observer_event_clips", owner: "video-gateway/cloud-event-media", api: "/api/digital-observer/event-clips/[id]/media" },
  risk: { store: "digital_observer_risk_evaluations", owner: "risk-decision-service" },
  verification: { store: "digital_observer_incident_verifications", owner: "incident-verification-service" },
  decision: { store: "digital_observer_decision_intents", owner: "incident-verification-service" },
  watchRules: { store: "digital_observer_watch_rule_versions", owner: "watch-rule-service", api: "/api/digital-observer/watch-rules" },
  investigation: { store: "canonical Event/Incident/Evidence projections", owner: "investigation-search-service", api: "/api/digital-observer/investigation" },
  feedback: { store: "digital_observer_feedback_revisions", owner: "feedback-calibration", api: "/api/digital-observer/incidents/feedback" },
  health: { store: "canonical read projection", owner: "camera-health-model", api: "/api/digital-observer/camera-health" }
} as const;

/** Paths retained for a different, explicitly bounded product or migration. */
export const DIGITAL_OBSERVER_COMPATIBILITY_PATHS = {
  kindergartenAiEvents: { class: "COMPATIBILITY", store: "ai_events", scope: "kindergarten product only" },
  kindergartenCameraEvents: { class: "DEVELOPMENT_ONLY", store: "ai_camera_events", scope: "admin-created mock/shadow QA only" },
  kindergartenIncidents: { class: "COMPATIBILITY", store: "incident_reports", scope: "kindergarten operations only" },
  kindergartenCorrelation: { class: "COMPATIBILITY", store: "observer_correlated_events", discriminator: LEGACY_KINDERGARTEN_CORRELATION_VERSION, scope: "kindergarten mock correlation only" },
  legacyWatchRequestPolicy: { class: "COMPATIBILITY", store: "observer_watch_requests", discriminator: "compiler_version is null", scope: "read-only risk-policy adapter inside the canonical risk service; no independent action path" },
  legacyIncidentRows: { class: "LEGACY", store: "observer_correlated_events", discriminator: "correlation_version != do-track-v1", scope: "read-compatible historical rows; excluded from Digital Observer Product" }
} as const satisfies Record<string, { class: DomainPathClass; store: string; scope: string; discriminator?: string }>;

export function isCanonicalDigitalObserverIncident(row: { correlation_version?: unknown; provenance?: unknown }) {
  return row.correlation_version === DIGITAL_OBSERVER_INCIDENT_VERSION
    && row.provenance === DIGITAL_OBSERVER_EVENT_PROVENANCE;
}
