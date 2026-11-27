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
    if (event.siteId !== siteId || !source || !eventIds.has(event.id) || !(occurred >= start && occurred < end)) return [];
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
