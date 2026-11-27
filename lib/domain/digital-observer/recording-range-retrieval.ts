// Internal preparation contract for one customer-owned recording source.
// Callers must establish the session and resource grant server-side.
type SourceScope = Readonly<{ tenantId: string; siteId: string; sourceId: string }>;
type TimeRange = Readonly<{ fromInclusive: string; toExclusive: string }>;
type Request = SourceScope & TimeRange & { eventId: string; evidenceId: string };
type SessionGrant = SourceScope & { actorId: string; expiresAt: string };
type RecordingLink = {
  recording: {
    contract: string;
    reference_id: string;
    tenant_id: string;
    site_id: string;
    camera_source_id: string;
    source_system: string;
    recording_id: string;
    starts_at: string;
    ends_at: string;
    retrieval_capability: string;
    retention_available_until: string | null;
    authorization_requirement: string;
  };
  event: SourceScope & { id: string; occurredAt: string };
  evidence: SourceScope & { id: string; eventId: string; recordingReferenceId: string };
};
type AccessAudit = SourceScope & TimeRange & {
  action: "RECORDING_RANGE_AUTHORIZED";
  actorId: string;
  authorizedAt: string;
  eventId: string;
  evidenceId: string;
  recordingReferenceId: string;
};

const opaqueId = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const isoTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const maxRangeMs = 5 * 60_000;

function validId(value: unknown) {
  return typeof value === "string" && opaqueId.test(value);
}

function instant(value: string | null) {
  if (typeof value !== "string" || !isoTime.test(value)) return NaN;
  const time = Date.parse(value);
  const normalized = value.replace(/(?:\.(\d{1,3}))?Z$/, (_, fraction?: string) => `.${(fraction ?? "").padEnd(3, "0")}Z`);
  return Number.isFinite(time) && new Date(time).toISOString() === normalized ? time : NaN;
}

function sameScope(a: SourceScope, b: SourceScope) {
  return a.tenantId === b.tenantId && a.siteId === b.siteId && a.sourceId === b.sourceId;
}

export function createRecordingRangeAdapter(options: {
  source: SourceScope & { sourceSystem: string };
  lookupLinkedRecording: (selection: Readonly<Request>) => Promise<RecordingLink | null>;
  writeAccessAudit: (entry: Readonly<AccessAudit>) => Promise<boolean>;
  now?: () => number;
}) {
  const { lookupLinkedRecording, writeAccessAudit, now = Date.now } = options;
  const source = Object.freeze({ ...options.source });
  return async function prepareRecordingRange(session: SessionGrant | null, request: Request) {
    const selection = Object.freeze({
      tenantId: request.tenantId, siteId: request.siteId, sourceId: request.sourceId,
      eventId: request.eventId, evidenceId: request.evidenceId,
      fromInclusive: request.fromInclusive, toExclusive: request.toExclusive,
    });
    const observed = now();
    const sessionExpiry = instant(session?.expiresAt ?? null);
    if (!session || !sameScope(session, source) || !sameScope(selection, source) ||
      !validId(session.actorId) || !validId(session.tenantId) ||
      !validId(session.siteId) || !validId(session.sourceId) || !validId(source.sourceSystem) ||
      !(sessionExpiry > observed)) throw new Error("RECORDING_SCOPE_DENIED");
    const actorId = session.actorId;
    const from = instant(selection.fromInclusive);
    const to = instant(selection.toExclusive);
    if (!validId(selection.eventId) || !validId(selection.evidenceId) ||
      !(to > from && to - from <= maxRangeMs && to <= observed)) throw new Error("RECORDING_SELECTION_INVALID");

    const link = await lookupLinkedRecording(selection).catch(() => { throw new Error("RECORDING_LOOKUP_UNAVAILABLE"); });
    if (!link) throw new Error("RECORDING_RANGE_UNAVAILABLE");
    const { recording, event, evidence } = link;
    const retentionExpiry = instant(recording.retention_available_until);
    const eventTime = instant(event.occurredAt);
    if (recording.contract !== "observer-source-recording-reference-v1" ||
      recording.tenant_id !== source.tenantId || recording.site_id !== source.siteId ||
      recording.camera_source_id !== source.sourceId || recording.source_system !== source.sourceSystem ||
      recording.retrieval_capability !== "ON_DEMAND_AUTHORIZED" ||
      recording.authorization_requirement !== "TENANT_SITE_SOURCE_SCOPE" ||
      !validId(recording.reference_id) || !validId(recording.recording_id) ||
      !(instant(recording.starts_at) <= from && instant(recording.ends_at) >= to) ||
      !(eventTime >= from && eventTime < to) ||
      !sameScope(event, source) || event.id !== selection.eventId ||
      !sameScope(evidence, source) || evidence.id !== selection.evidenceId ||
      evidence.eventId !== event.id || evidence.recordingReferenceId !== recording.reference_id) {
      throw new Error("RECORDING_RANGE_UNAVAILABLE");
    }

    const authorizedAt = now();
    const validUntil = Math.min(retentionExpiry, sessionExpiry);
    if (!(validUntil > authorizedAt)) throw new Error("RECORDING_AUTHORIZATION_EXPIRED");
    const audit = Object.freeze({
      ...selection, action: "RECORDING_RANGE_AUTHORIZED" as const, actorId,
      authorizedAt: new Date(authorizedAt).toISOString(),
      recordingReferenceId: recording.reference_id,
    });
    const handle = Object.freeze({
      ...selection, recordingReferenceId: recording.reference_id, recordingId: recording.recording_id,
      sourceSystem: source.sourceSystem, authorizationExpiresAt: new Date(validUntil).toISOString(),
    });
    const recorded = await writeAccessAudit(audit).catch(() => false);
    if (recorded !== true) throw new Error("RECORDING_ACCESS_AUDIT_UNAVAILABLE");
    if (!(validUntil > now())) throw new Error("RECORDING_AUTHORIZATION_EXPIRED");
    return handle;
  };
}
