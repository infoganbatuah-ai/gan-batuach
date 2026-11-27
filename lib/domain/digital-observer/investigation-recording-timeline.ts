import type { InvestigationSearchResult, InvestigationSource } from "./investigation-results";
import type { createRecordingRangeAdapter } from "./recording-range-retrieval";

type Selection = Pick<InvestigationSearchResult, "query" | "events" | "grounding">;
type PrepareRange = ReturnType<typeof createRecordingRangeAdapter>;

export function buildInvestigationRecordingTimeline(input: {
  result: Selection;
  siteId: string;
  sources: readonly InvestigationSource[];
  historyAllowed: boolean;
  now: Date;
}) {
  const { result, siteId } = input;
  if (!input.historyAllowed || result.query.observerSiteId !== siteId) return [];

  const querySources = new Set(result.query.cameraSourceIds);
  const sources = new Map(input.sources
    .filter((source) => source.observer_site_id === siteId && (!querySources.size || querySources.has(source.id)))
    .map((source) => [source.id, source]));
  const eventIds = new Set(result.grounding.eventIds);
  const evidenceIds = new Set(result.grounding.evidenceIds);
  const start = Date.parse(result.query.fromInclusive);
  const end = Math.min(Date.parse(result.query.toExclusive), input.now.getTime());
  if (!(start < end)) return [];

  return result.events.flatMap((event) => {
    const source = sources.get(event.cameraId);
    const occurred = Date.parse(event.occurredAt);
    if (event.siteId !== siteId || !source || !eventIds.has(event.id) ||
      event.timeBasis === "UNVERIFIED_TIME_ZONE" || !(occurred >= start && occurred < end)) return [];
    const clipId = event.evidence.clipId;
    const candidate = event.evidence.state === "AVAILABLE" && clipId && evidenceIds.has(clipId) ? {
      evidenceId: clipId,
      fromInclusive: new Date(Math.max(start, occurred - 30_000)).toISOString(),
      toExclusive: new Date(Math.min(end, occurred + 30_000)).toISOString(),
    } : null;
    return [{
      eventId: event.id,
      sourceId: source.id,
      sourceLabel: source.display_name ?? source.location_label ?? event.cameraName,
      label: event.label,
      occurredAt: new Date(occurred).toISOString(),
      evidenceState: event.evidence.state,
      timeBasis: event.timeBasis,
      candidate,
    }];
  }).sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt) || a.eventId.localeCompare(b.eventId));
}

export type InvestigationRecordingTimeline = ReturnType<typeof buildInvestigationRecordingTimeline>;

// Server-only orchestration for a future approved archive boundary. Build the
// timeline again from authorized results, never from a browser-posted row.
export async function prepareInvestigationTimelineRecording(input: {
  context: Parameters<typeof buildInvestigationRecordingTimeline>[0] & { tenantId: string };
  session: Parameters<PrepareRange>[0];
  eventId: string;
  prepareRange: PrepareRange;
}) {
  const { context, session } = input;
  if (!session || session.tenantId !== context.tenantId || session.siteId !== context.siteId) {
    throw new Error("RECORDING_SCOPE_DENIED");
  }
  const entry = buildInvestigationRecordingTimeline(context).find((item) => item.eventId === input.eventId);
  if (!entry?.candidate || entry.sourceId !== session.sourceId) {
    throw new Error("RECORDING_SELECTION_UNAVAILABLE");
  }
  return input.prepareRange(session, {
    ...entry.candidate, eventId: entry.eventId, sourceId: entry.sourceId,
    siteId: context.siteId, tenantId: context.tenantId,
  });
}

const reconstructionWindowMs = 60_000;
const reconstructionLimit = 25;

export function buildIncidentReconstructions(input: Parameters<typeof buildInvestigationRecordingTimeline>[0] & {
  result: Selection & Pick<InvestigationSearchResult, "incidents" | "pagination" | "coverage">;
}) {
  const { result, siteId } = input;
  if (!input.historyAllowed || result.query.observerSiteId !== siteId) return [];

  const querySources = new Set(result.query.cameraSourceIds);
  const sources = new Map(input.sources.filter((source) => source.observer_site_id === siteId &&
    (!querySources.size || querySources.has(source.id))).map((source) => [source.id, source]));
  const groundedIncidents = new Set(result.grounding.incidentIds);
  const groundedEvents = new Set(result.grounding.eventIds);
  const groundedEvidence = new Set(result.grounding.evidenceIds);
  const from = Date.parse(result.query.fromInclusive);
  const to = Math.min(Date.parse(result.query.toExclusive), input.now.getTime());
  if (!(from < to)) return [];

  return result.incidents.slice(0, reconstructionLimit).flatMap((incident) => {
    if (incident.siteId !== siteId || !groundedIncidents.has(incident.id)) return [];
    const unique = new Map(incident.timeline.map((entry) => [entry.eventId, entry]));
    const observations = [...unique.values()].flatMap((entry) => {
      const fact = entry.verifiedObservation;
      const source = fact && sources.get(fact.cameraId);
      if (!fact || !source || !groundedEvents.has(entry.eventId) ||
        !fact.timeBasis || fact.timeBasis === "UNVERIFIED_TIME_ZONE") return [];
      const timestamp = Date.parse(fact.occurredAt);
      if (!(timestamp >= from && timestamp < to)) return [];
      const evidencePath = entry.evidenceState === "AVAILABLE" && fact.evidenceId && groundedEvidence.has(fact.evidenceId) &&
        fact.evidencePath === `/api/digital-observer/event-clips/${encodeURIComponent(fact.evidenceId)}/media?kind=clip` ? fact.evidencePath : null;
      return [{
        eventId: entry.eventId, sourceId: source.id, label: fact.label,
        sourceLabel: source.display_name ?? source.location_label ?? "מצלמה",
        observedAt: new Date(timestamp).toISOString(), timeBasis: fact.timeBasis,
        evidenceState: entry.evidenceState === "AVAILABLE" && !evidencePath ? "UNAVAILABLE" as const : entry.evidenceState,
        evidenceId: evidencePath ? fact.evidenceId : null,
        evidencePath,
      }];
    }).sort((a, b) => a.observedAt.localeCompare(b.observedAt) || a.eventId.localeCompare(b.eventId));

    const groups: { startsAt: string; endsAt: string; sourceCount: number; observations: typeof observations }[] = [];
    for (const observation of observations.slice(0, reconstructionLimit)) {
      const group = groups.at(-1);
      if (!group || Date.parse(observation.observedAt) - Date.parse(group.startsAt) >= reconstructionWindowMs) {
        groups.push({ startsAt: observation.observedAt, endsAt: observation.observedAt, sourceCount: 1, observations: [observation] });
        continue;
      }
      group.endsAt = observation.observedAt;
      group.observations.push(observation);
      group.sourceCount = new Set(group.observations.map((item) => item.sourceId)).size;
    }

    return [{
      incidentId: incident.id,
      groups,
      omittedObservations: unique.size - observations.length,
      capped: observations.length > reconstructionLimit,
      partialSearch: result.pagination.cursor > 0 || result.pagination.nextCursor !== null || result.coverage.scanCapReached,
    }];
  });
}

export type IncidentReconstructions = ReturnType<typeof buildIncidentReconstructions>;
