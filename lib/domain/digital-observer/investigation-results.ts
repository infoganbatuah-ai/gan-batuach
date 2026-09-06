import { matchesDailyWindow, type CanonicalInvestigationQuery } from "./investigation-query";

type UnknownRecord = Record<string, unknown>;

export type InvestigationSource = {
  id: string;
  observer_site_id: string;
  display_name: string | null;
  location_label: string | null;
  camera_stream_id: string | null;
};

export type InvestigationEventRow = {
  id: string;
  observer_site_id: string;
  camera_id: string | null;
  signal_type: string | null;
  severity: string | null;
  confidence: number | null;
  review_status: string | null;
  recommended_action: string | null;
  metadata: UnknownRecord | null;
  created_at: string;
};

export type InvestigationClipRow = {
  id: string;
  observer_site_id: string;
  camera_source_id: string | null;
  signal_id: string | null;
  clip_status: string | null;
  media_status: string | null;
  media_missing_reason: string | null;
  captured_at: string | null;
  duration_seconds: number | null;
  delete_after: string | null;
  metadata: UnknownRecord | null;
};

export type InvestigationIncidentRow = {
  id: string;
  observer_site_id: string;
  status: string | null;
  title: string | null;
  summary: string | null;
  opened_at: string | null;
  last_activity_at: string | null;
  closed_at: string | null;
  primary_camera_source_id: string | null;
  involved_camera_ids: string[] | null;
  involved_track_ids: string[] | null;
  related_event_ids: string[] | null;
  provenance: string | null;
  correlation_version: string | null;
  timeline_summary: unknown;
  current_risk_score: number | null;
  peak_risk_score: number | null;
  current_risk_band: string | null;
  risk_evaluation_confidence: number | null;
  current_decision: string | null;
  current_verification_status: string | null;
  verification_classification: string | null;
  verification_confidence: number | null;
  final_decision: string | null;
  final_decision_confidence: number | null;
  current_feedback_label: string | null;
  current_ground_truth_label: string | null;
  metadata: UnknownRecord | null;
};

export type InvestigationRuleEvaluationRow = {
  id: string;
  observer_site_id: string;
  rule_id: string;
  event_id: string;
  incident_id: string | null;
  matched: boolean;
  event_provenance: string | null;
  evaluated_at: string;
};

export type EvidenceState = "AVAILABLE" | "NO_RECORDING_BY_POLICY" | "EXPIRED" | "FAILED" | "UNAVAILABLE";

export type InvestigationEvent = {
  kind: "EVENT";
  id: string;
  eventType: string;
  label: string;
  occurredAt: string;
  siteId: string;
  cameraId: string;
  cameraName: string;
  zoneName: string | null;
  trackId: string | null;
  confidence: number | null;
  severity: string | null;
  reviewStatus: string | null;
  provenance: string;
  evidence: { state: EvidenceState; clipId: string | null; playbackPath: string | null; durationSeconds: number | null; reason: string | null };
  relevanceScore: number;
};

export type InvestigationIncident = {
  kind: "INCIDENT";
  id: string;
  title: string;
  summary: string;
  status: string;
  openedAt: string;
  lastActivityAt: string;
  closedAt: string | null;
  siteId: string;
  cameraId: string;
  cameraName: string;
  trackIds: string[];
  provenance: string;
  risk: { score: number | null; peak: number | null; band: string | null; confidence: number | null };
  verification: { status: string | null; classification: string | null; confidence: number | null };
  decision: { current: string | null; final: string | null; confidence: number | null };
  feedbackLabel: string | null;
  watchRuleMatched: boolean;
  timeline: { eventId: string; eventType: string; label: string; timestamp: string; cameraId: string | null; trackId: string | null; confidence: number | null; provenance: string | null; evidenceState: EvidenceState }[];
  evidence: { states: EvidenceState[]; availableCount: number; playbackPaths: string[] };
  relevanceScore: number;
};

export type InvestigationSearchResult = {
  query: CanonicalInvestigationQuery;
  answer: string;
  incidents: InvestigationIncident[];
  events: InvestigationEvent[];
  grounding: { incidentIds: string[]; eventIds: string[]; evidenceIds: string[]; cameraIds: string[]; timestamps: string[] };
  pagination: { cursor: number; limit: number; nextCursor: number | null; totalMatches: number; returned: number };
  coverage: { realProvenanceOnly: true; rawVideoAnalyzed: false; continuousCoverageClaimed: false; scanCap: number; scanCapReached: boolean; expiredEvidenceRetainedAsFact: true };
};

const labels: Record<string, string> = {
  person_detected: "זוהה אדם",
  person_entered: "אדם נכנס",
  person_exited: "אדם יצא",
  camera_offline: "מצלמה נותקה",
  camera_reconnected: "המצלמה חזרה לשדר"
};

function objectValue(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function eventType(row: InvestigationEventRow) {
  return String(objectValue(row.metadata).event_type ?? row.signal_type ?? "system");
}

function eventCameraId(row: InvestigationEventRow) {
  const metadata = objectValue(row.metadata);
  return String(metadata.camera_source_id ?? row.camera_id ?? "");
}

function eventTime(row: InvestigationEventRow) {
  const metadata = objectValue(row.metadata);
  return String(metadata.first_seen ?? row.created_at ?? "");
}

function evidenceFor(row: InvestigationEventRow, clips: InvestigationClipRow[], now: Date) {
  const metadata = objectValue(row.metadata);
  const cameraId = eventCameraId(row);
  const clip = clips.find((item) => item.signal_id === row.id && item.observer_site_id === row.observer_site_id && item.camera_source_id === cameraId);
  if (metadata.recording_required === false) return { state: "NO_RECORDING_BY_POLICY" as const, clipId: null, playbackPath: null, durationSeconds: null, reason: "policy_did_not_authorize_recording" };
  if (!clip) return { state: "UNAVAILABLE" as const, clipId: null, playbackPath: null, durationSeconds: null, reason: "no_evidence_record" };
  const expired = clip.clip_status === "expired" || clip.clip_status === "deleted" || (clip.delete_after ? Date.parse(clip.delete_after) <= now.getTime() : false);
  if (expired) return { state: "EXPIRED" as const, clipId: clip.id, playbackPath: null, durationSeconds: clip.duration_seconds, reason: "retention_expired" };
  if (clip.clip_status === "failed" || clip.media_status === "failed") return { state: "FAILED" as const, clipId: clip.id, playbackPath: null, durationSeconds: clip.duration_seconds, reason: clip.media_missing_reason ?? "media_failed" };
  if (clip.clip_status === "available" && clip.media_status === "available") return {
    state: "AVAILABLE" as const,
    clipId: clip.id,
    playbackPath: `/api/digital-observer/event-clips/${clip.id}/media?kind=clip`,
    durationSeconds: clip.duration_seconds,
    reason: null
  };
  return { state: "UNAVAILABLE" as const, clipId: clip.id, playbackPath: null, durationSeconds: clip.duration_seconds, reason: clip.media_missing_reason ?? "media_not_available" };
}

function sourceFor(cameraId: string, sources: InvestigationSource[]) {
  return sources.find((source) => source.id === cameraId || source.camera_stream_id === cameraId) ?? null;
}

function validRealEvent(row: InvestigationEventRow, query: CanonicalInvestigationQuery, sources: InvestigationSource[]) {
  const metadata = objectValue(row.metadata);
  const timestamp = eventTime(row);
  const time = Date.parse(timestamp);
  const source = sourceFor(eventCameraId(row), sources);
  return row.observer_site_id === query.observerSiteId
    && metadata.validated_event === true
    && query.provenance.includes(String(metadata.observation_provenance) as CanonicalInvestigationQuery["provenance"][number])
    && Boolean(source && source.observer_site_id === query.observerSiteId)
    && Number.isFinite(time)
    && time >= Date.parse(query.fromInclusive)
    && time < Date.parse(query.toExclusive)
    && matchesDailyWindow(timestamp, query);
}

function eventMatches(row: InvestigationEventRow, query: CanonicalInvestigationQuery, evidence: EvidenceState) {
  const metadata = objectValue(row.metadata);
  const cameraId = eventCameraId(row);
  const type = eventType(row);
  const zone = String(metadata.zone_name ?? metadata.zone_label ?? metadata.zone_type ?? "");
  return (!query.cameraSourceIds.length || query.cameraSourceIds.includes(cameraId))
    && (!query.eventTypes.length || query.eventTypes.includes(type as CanonicalInvestigationQuery["eventTypes"][number]))
    && (query.detectionConfidenceMin == null || Number(row.confidence) >= query.detectionConfidenceMin)
    && (!query.zoneNames.length || query.zoneNames.some((name) => name === zone))
    && (!query.trackId || metadata.track_id === query.trackId)
    && (!query.evidenceStates.length || query.evidenceStates.includes(evidence));
}

function eventResult(row: InvestigationEventRow, sources: InvestigationSource[], clips: InvestigationClipRow[], query: CanonicalInvestigationQuery, now: Date): InvestigationEvent | null {
  const cameraId = eventCameraId(row);
  const source = sourceFor(cameraId, sources);
  if (!source) return null;
  const metadata = objectValue(row.metadata);
  const evidence = evidenceFor(row, clips, now);
  if (!eventMatches(row, query, evidence.state)) return null;
  const type = eventType(row);
  return {
    kind: "EVENT",
    id: row.id,
    eventType: type,
    label: labels[type] ?? "אירוע מצלמה",
    occurredAt: new Date(eventTime(row)).toISOString(),
    siteId: row.observer_site_id,
    cameraId: source.id,
    cameraName: source.display_name ?? source.location_label ?? "מצלמה",
    zoneName: typeof metadata.zone_name === "string" ? metadata.zone_name : typeof metadata.zone_type === "string" ? metadata.zone_type : source.location_label,
    trackId: typeof metadata.track_id === "string" ? metadata.track_id : null,
    confidence: row.confidence == null ? null : Number(row.confidence),
    severity: row.severity,
    reviewStatus: row.review_status,
    provenance: String(metadata.observation_provenance),
    evidence,
    relevanceScore: 50 + (query.cameraSourceIds.length ? 20 : 0) + (query.eventTypes.length ? 15 : 0) + (evidence.state === "AVAILABLE" ? 5 : 0)
  };
}

function timelineRows(value: unknown) {
  return Array.isArray(value) ? value.map(objectValue).filter((item) => typeof item.event_id === "string" && typeof item.timestamp === "string") : [];
}

function incidentMatches(row: InvestigationIncidentRow, query: CanonicalInvestigationQuery, events: InvestigationEvent[], matchedIncidentIds: Set<string>) {
  const cameras = [row.primary_camera_source_id, ...strings(row.involved_camera_ids)].filter((value): value is string => Boolean(value));
  const tracks = strings(row.involved_track_ids);
  const timeline = timelineRows(row.timeline_summary);
  const evidenceStates = events.filter((event) => strings(row.related_event_ids).includes(event.id)).map((event) => event.evidence.state);
  return row.observer_site_id === query.observerSiteId
    && query.provenance.includes(String(row.provenance) as CanonicalInvestigationQuery["provenance"][number])
    && row.correlation_version === "do-track-v1"
    && (!query.cameraSourceIds.length || query.cameraSourceIds.some((id) => cameras.includes(id)))
    && (!query.incidentStatuses.length || query.incidentStatuses.includes(String(row.status) as CanonicalInvestigationQuery["incidentStatuses"][number]))
    && (!query.riskBands.length || query.riskBands.includes(String(row.current_risk_band) as CanonicalInvestigationQuery["riskBands"][number]))
    && (!query.riskScore || (Number(row.current_risk_score) >= query.riskScore.min && Number(row.current_risk_score) <= query.riskScore.max))
    && (!query.verificationStates.length || query.verificationStates.includes(String(row.current_verification_status) as CanonicalInvestigationQuery["verificationStates"][number]))
    && (!query.decisions.length || query.decisions.some((decision) => decision === row.final_decision || decision === row.current_decision))
    && (!query.feedbackLabels.length || query.feedbackLabels.some((label) => label === row.current_feedback_label || label === row.current_ground_truth_label))
    && (!query.trackId || tracks.includes(query.trackId))
    && (!query.eventTypes.length || timeline.some((item) => query.eventTypes.includes(String(item.event_type) as CanonicalInvestigationQuery["eventTypes"][number])))
    && (!query.evidenceStates.length || query.evidenceStates.some((state) => evidenceStates.includes(state)))
    && (query.watchRuleMatched !== true || matchedIncidentIds.has(row.id));
}

function incidentResult(row: InvestigationIncidentRow, sources: InvestigationSource[], events: InvestigationEvent[], matchedIncidentIds: Set<string>): InvestigationIncident | null {
  const cameraId = row.primary_camera_source_id ?? strings(row.involved_camera_ids)[0] ?? "";
  const source = sourceFor(cameraId, sources);
  if (!source || !row.opened_at || !row.last_activity_at) return null;
  const byId = new Map(events.map((event) => [event.id, event]));
  const timeline = timelineRows(row.timeline_summary).map((item) => {
    const eventId = String(item.event_id);
    const linked = byId.get(eventId);
    const type = String(item.event_type ?? linked?.eventType ?? "system");
    return {
      eventId,
      eventType: type,
      label: labels[type] ?? "אירוע מצלמה",
      timestamp: new Date(String(item.timestamp)).toISOString(),
      cameraId: typeof item.camera_source_id === "string" ? item.camera_source_id : linked?.cameraId ?? null,
      trackId: typeof item.track_id === "string" ? item.track_id : linked?.trackId ?? null,
      confidence: typeof item.confidence === "number" ? item.confidence : linked?.confidence ?? null,
      provenance: typeof item.provenance === "string" ? item.provenance : linked?.provenance ?? null,
      evidenceState: linked?.evidence.state ?? "UNAVAILABLE" as EvidenceState
    };
  }).sort((left, right) => left.timestamp.localeCompare(right.timestamp));
  const related = strings(row.related_event_ids).map((id) => byId.get(id)).filter((event): event is InvestigationEvent => Boolean(event));
  const playbackPaths = related.map((event) => event.evidence.playbackPath).filter((path): path is string => Boolean(path));
  const evidenceStates = [...new Set(related.map((event) => event.evidence.state))];
  return {
    kind: "INCIDENT",
    id: row.id,
    title: row.title ?? "תקרית מצלמה",
    summary: row.summary ?? "נמצאה תקרית קנונית ללא סיכום נוסף.",
    status: row.status ?? "open",
    openedAt: new Date(row.opened_at).toISOString(),
    lastActivityAt: new Date(row.last_activity_at).toISOString(),
    closedAt: row.closed_at ? new Date(row.closed_at).toISOString() : null,
    siteId: row.observer_site_id,
    cameraId: source.id,
    cameraName: source.display_name ?? source.location_label ?? "מצלמה",
    trackIds: strings(row.involved_track_ids),
    provenance: String(row.provenance),
    risk: { score: row.current_risk_score, peak: row.peak_risk_score, band: row.current_risk_band, confidence: row.risk_evaluation_confidence },
    verification: { status: row.current_verification_status, classification: row.verification_classification, confidence: row.verification_confidence },
    decision: { current: row.current_decision, final: row.final_decision, confidence: row.final_decision_confidence },
    feedbackLabel: row.current_ground_truth_label ?? row.current_feedback_label,
    watchRuleMatched: matchedIncidentIds.has(row.id),
    timeline,
    evidence: { states: evidenceStates.length ? evidenceStates : ["UNAVAILABLE"], availableCount: playbackPaths.length, playbackPaths },
    relevanceScore: 70 + (row.current_risk_band ? 5 : 0) + (row.current_verification_status ? 5 : 0) + (playbackPaths.length ? 5 : 0)
  };
}

function formatAt(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("he-IL", { timeZone, dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

export function groundedInvestigationAnswer(result: Omit<InvestigationSearchResult, "answer">) {
  if (!result.incidents.length && !result.events.length) return "לא נמצאו אירועים תואמים בטווח שביקשת. לא נוצר סיכום כאשר אין רשומות תומכות.";
  if (result.query.latestOnly && result.incidents[0]) {
    const incident = result.incidents[0];
    const risk = incident.risk.band ? ` רמת הסיכון שנשמרה היא ${incident.risk.band}${incident.risk.score == null ? "" : ` (${incident.risk.score}/100)`}.` : "";
    const verification = incident.verification.status ? ` מצב האימות: ${incident.verification.status}.` : "";
    const decision = incident.decision.final ?? incident.decision.current;
    const evidence = incident.evidence.availableCount ? " קיימת ראיה מורשית שניתן לפתוח מתוך התוצאה." : " אין ראיה זמינה לפתיחה; מצב הראיה מפורט בתוצאה.";
    return `${incident.summary} המצלמה: ${incident.cameraName}; פעילות אחרונה: ${formatAt(incident.lastActivityAt, result.query.timeZone)}.${risk}${verification}${decision ? ` ההחלטה שנשמרה: ${decision}.` : ""}${evidence}`;
  }
  const cameraNames = [...new Set([...result.incidents.map((item) => item.cameraName), ...result.events.map((item) => item.cameraName)])];
  const evidenceCount = [...result.incidents.flatMap((item) => item.evidence.playbackPaths), ...result.events.map((item) => item.evidence.playbackPath).filter(Boolean)].length;
  return `נמצאו ${result.incidents.length} תקריות ו-${result.events.length} אירועים תואמים מתוך נתוני Production אמיתיים${cameraNames.length ? ` במצלמות: ${cameraNames.join(", ")}` : ""}.${evidenceCount ? ` קיימות ${evidenceCount} הפניות לראיות מורשות.` : " לא נמצאה ראיה זמינה בתוצאות; אירועים ללא הקלטה נשארים מוצגים כעובדות שמורות."}`;
}

export function assembleInvestigationResults(input: {
  query: CanonicalInvestigationQuery;
  sources: InvestigationSource[];
  eventRows: InvestigationEventRow[];
  clipRows: InvestigationClipRow[];
  incidentRows: InvestigationIncidentRow[];
  ruleEvaluationRows?: InvestigationRuleEvaluationRow[];
  now?: Date;
  scanCapReached?: boolean;
}): InvestigationSearchResult {
  const now = input.now ?? new Date();
  const sources = input.sources.filter((source) => source.observer_site_id === input.query.observerSiteId);
  const validEvents = input.eventRows.filter((row) => validRealEvent(row, input.query, sources))
    .map((row) => eventResult(row, sources, input.clipRows, { ...input.query, eventTypes: [], evidenceStates: [], trackId: null, zoneNames: [] }, now))
    .filter((event): event is InvestigationEvent => Boolean(event));
  const filteredEvents = validEvents.filter((event) => {
    const row = input.eventRows.find((item) => item.id === event.id)!;
    return eventMatches(row, input.query, event.evidence.state);
  });
  const matchedIncidentIds = new Set((input.ruleEvaluationRows ?? []).filter((row) => row.observer_site_id === input.query.observerSiteId && row.matched === true && row.event_provenance === "REAL_CAMERA_AI" && row.incident_id).map((row) => row.incident_id!));
  const incidents = input.incidentRows.filter((row) => {
    const from = Date.parse(input.query.fromInclusive), to = Date.parse(input.query.toExclusive);
    const opened = Date.parse(String(row.opened_at)), active = Date.parse(String(row.last_activity_at));
    return Number.isFinite(opened) && Number.isFinite(active) && opened < to && active >= from && incidentMatches(row, input.query, validEvents, matchedIncidentIds);
  }).map((row) => incidentResult(row, sources, validEvents, matchedIncidentIds)).filter((incident): incident is InvestigationIncident => Boolean(incident));

  const combined = [
    ...(input.query.scopes.includes("INCIDENTS") ? incidents : []),
    ...(input.query.scopes.includes("EVENTS") ? filteredEvents : [])
  ].sort((left, right) => right.relevanceScore - left.relevanceScore || (right.kind === "INCIDENT" ? right.lastActivityAt : right.occurredAt).localeCompare(left.kind === "INCIDENT" ? left.lastActivityAt : left.occurredAt));
  const totalMatches = combined.length;
  const start = input.query.pagination.cursor;
  const requestedLimit = input.query.latestOnly ? 1 : input.query.pagination.limit;
  const page = combined.slice(start, start + requestedLimit);
  const pageIncidents = page.filter((item): item is InvestigationIncident => item.kind === "INCIDENT");
  const pageEvents = page.filter((item): item is InvestigationEvent => item.kind === "EVENT");
  const eventIds = [...new Set([...pageEvents.map((item) => item.id), ...pageIncidents.flatMap((item) => item.timeline.map((entry) => entry.eventId))])];
  const evidenceIds = [...new Set([...pageEvents.map((item) => item.evidence.clipId).filter((id): id is string => Boolean(id)), ...pageIncidents.flatMap((item) => item.timeline.map((entry) => validEvents.find((event) => event.id === entry.eventId)?.evidence.clipId).filter((id): id is string => Boolean(id)))])];
  const withoutAnswer: Omit<InvestigationSearchResult, "answer"> = {
    query: input.query,
    incidents: pageIncidents,
    events: pageEvents,
    grounding: {
      incidentIds: pageIncidents.map((item) => item.id),
      eventIds,
      evidenceIds,
      cameraIds: [...new Set([...pageIncidents.map((item) => item.cameraId), ...pageEvents.map((item) => item.cameraId)])],
      timestamps: [...new Set([...pageIncidents.map((item) => item.lastActivityAt), ...pageEvents.map((item) => item.occurredAt)])]
    },
    pagination: { cursor: start, limit: requestedLimit, nextCursor: start + requestedLimit < totalMatches ? start + requestedLimit : null, totalMatches, returned: page.length },
    coverage: { realProvenanceOnly: true, rawVideoAnalyzed: false, continuousCoverageClaimed: false, scanCap: 500, scanCapReached: input.scanCapReached === true, expiredEvidenceRetainedAsFact: true }
  };
  return { ...withoutAnswer, answer: groundedInvestigationAnswer(withoutAnswer) };
}
