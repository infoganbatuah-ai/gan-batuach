export const DIGITAL_OBSERVER_INCIDENT_VERSION = "do-track-v1";
export const incidentOpeningEventTypes = new Set(["person_entered"]);
export const incidentClosingEventTypes = new Set(["person_exited"]);

export type CanonicalIncidentStatus = "open" | "acknowledged" | "resolved" | "closed";
export type CanonicalIncidentEvent = {
  id: string;
  observer_site_id: string;
  created_at: string;
  confidence: number | null;
  severity: string;
  metadata: {
    event_type?: string;
    camera_source_id?: string;
    camera_name?: string;
    stream_id?: string;
    track_id?: string;
    zone_type?: string | null;
    observation_provenance?: string;
    evidence_kind?: string;
    model_provenance?: Record<string, unknown>;
  };
};

export type CanonicalIncident = {
  id: string;
  observer_site_id: string;
  status: CanonicalIncidentStatus;
  severity: string;
  title: string;
  summary: string;
  opened_at: string;
  last_activity_at: string;
  closed_at: string | null;
  primary_camera_source_id: string;
  involved_camera_ids: string[];
  involved_track_ids: string[];
  related_event_ids: string[];
  provenance: "REAL_CAMERA_AI";
  correlation_version: string;
  timeline_summary: CanonicalIncidentTimelineItem[];
};

export type CanonicalIncidentTimelineItem = {
  event_id: string;
  event_type: string;
  timestamp: string;
  camera_source_id: string;
  camera_name: string | null;
  track_id: string;
  provenance: "REAL_CAMERA_AI";
  confidence: number | null;
  evidence_kind: string | null;
};

export function canonicalIncidentEvent(event: CanonicalIncidentEvent) {
  const metadata = event?.metadata;
  const eventType = String(metadata?.event_type ?? "");
  const cameraId = String(metadata?.camera_source_id ?? "");
  const trackId = String(metadata?.track_id ?? "");
  const occurredAt = Date.parse(event?.created_at);
  return Boolean(
    event?.id
    && event?.observer_site_id
    && Number.isFinite(occurredAt)
    && cameraId
    && trackId
    && metadata?.observation_provenance === "REAL_CAMERA_AI"
    && (incidentOpeningEventTypes.has(eventType) || incidentClosingEventTypes.has(eventType))
  );
}

export function incidentCorrelationKey(event: CanonicalIncidentEvent) {
  if (!canonicalIncidentEvent(event)) return null;
  return `${event.observer_site_id}:${event.metadata.camera_source_id}:${event.metadata.track_id}`;
}

export function incidentTimelineItem(event: CanonicalIncidentEvent): CanonicalIncidentTimelineItem | null {
  if (!canonicalIncidentEvent(event)) return null;
  return {
    event_id: event.id,
    event_type: String(event.metadata.event_type),
    timestamp: new Date(event.created_at).toISOString(),
    camera_source_id: String(event.metadata.camera_source_id),
    camera_name: typeof event.metadata.camera_name === "string" ? event.metadata.camera_name : null,
    track_id: String(event.metadata.track_id),
    provenance: "REAL_CAMERA_AI",
    confidence: Number.isFinite(event.confidence) ? Number(event.confidence) : null,
    evidence_kind: typeof event.metadata.evidence_kind === "string" ? event.metadata.evidence_kind : null
  };
}

export function deterministicIncidentSummary(events: CanonicalIncidentTimelineItem[]) {
  const ordered = [...events].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  const entered = ordered.some((event) => event.event_type === "person_entered");
  const exited = ordered.some((event) => event.event_type === "person_exited");
  if (entered && exited) return "אדם נכנס לאזור המצולם ולאחר מכן יצא.";
  if (entered) return "אדם נכנס לאזור המצולם; האירוע עדיין פתוח לבדיקה.";
  return "אירוע מצלמה ממתין לבדיקה.";
}

export function sortIncidentTimeline(events: CanonicalIncidentTimelineItem[]) {
  const unique = new Map(events.map((event) => [event.event_id, event]));
  return [...unique.values()].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

export function legalIncidentTransition(from: CanonicalIncidentStatus, to: CanonicalIncidentStatus) {
  if (from === to) return true;
  const allowed: Record<CanonicalIncidentStatus, CanonicalIncidentStatus[]> = {
    open: ["acknowledged", "resolved", "closed"],
    acknowledged: ["resolved", "closed"],
    resolved: ["closed"],
    closed: []
  };
  return allowed[from].includes(to);
}

/** Deterministic in-memory projection used by APIs/tests; PostgreSQL owns writes. */
export function correlateCanonicalEvents(events: CanonicalIncidentEvent[]) {
  const incidents: CanonicalIncident[] = [];
  const linkedEvents = new Set<string>();
  const ordered = [...events].filter(canonicalIncidentEvent)
    .sort((left, right) => left.created_at.localeCompare(right.created_at));
  for (const event of ordered) {
    if (linkedEvents.has(event.id)) continue;
    const item = incidentTimelineItem(event);
    const key = incidentCorrelationKey(event);
    if (!item || !key) continue;
    let incident = incidents.find((candidate) => candidate.status !== "closed"
      && candidate.observer_site_id === event.observer_site_id
      && candidate.primary_camera_source_id === item.camera_source_id
      && candidate.involved_track_ids.includes(item.track_id)
      && Date.parse(event.created_at) - Date.parse(candidate.last_activity_at) <= 10 * 60_000);
    if (!incident) {
      if (!incidentOpeningEventTypes.has(item.event_type)) continue;
      incident = {
        id: `incident:${key}:${event.id}`,
        observer_site_id: event.observer_site_id,
        status: "open",
        severity: event.severity,
        title: "תנועה באזור הכניסה",
        summary: "אדם נכנס לאזור המצולם; האירוע עדיין פתוח לבדיקה.",
        opened_at: item.timestamp,
        last_activity_at: item.timestamp,
        closed_at: null,
        primary_camera_source_id: item.camera_source_id,
        involved_camera_ids: [item.camera_source_id],
        involved_track_ids: [item.track_id],
        related_event_ids: [],
        provenance: "REAL_CAMERA_AI",
        correlation_version: DIGITAL_OBSERVER_INCIDENT_VERSION,
        timeline_summary: []
      };
      incidents.push(incident);
    }
    incident.timeline_summary = sortIncidentTimeline([...incident.timeline_summary, item]);
    incident.related_event_ids = [...new Set([...incident.related_event_ids, event.id])];
    incident.last_activity_at = item.timestamp;
    incident.summary = deterministicIncidentSummary(incident.timeline_summary);
    if (incidentClosingEventTypes.has(item.event_type)) {
      incident.status = "closed";
      incident.closed_at = item.timestamp;
    }
    linkedEvents.add(event.id);
  }
  return incidents;
}
