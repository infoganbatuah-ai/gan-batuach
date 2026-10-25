import { isDeepStrictEqual } from "node:util";
import type { CloudCameraEvent } from "./event-evidence-compatibility";

/** Immutable observation identity only. Delivery and media lifecycle are mutable. */
export type CanonicalCloudObservation = Readonly<{
  siteId: string;
  sourceId: string;
  cameraId: string;
  streamId: string;
  eventType: string;
  severity: "info" | "medium" | "critical";
  confidence: number;
  occurredAt: string;
  trackId: string | null;
  evidenceKind: CloudCameraEvent["evidence_kind"];
  recordingRequired: boolean;
  modelProvenance: CloudCameraEvent["model_provenance"] | null;
  verificationEvidence: CloudCameraEvent["verification_evidence"] | null;
}>;

export function buildCanonicalCloudObservation(input: {
  event: CloudCameraEvent;
  siteId: string;
  sourceId: string;
  eventType: string;
  severity: CanonicalCloudObservation["severity"];
  recordingRequired: boolean;
}): CanonicalCloudObservation {
  return {
    siteId: input.siteId,
    sourceId: input.sourceId,
    cameraId: input.event.camera_source_id,
    streamId: input.event.stream_id,
    eventType: input.eventType,
    severity: input.severity,
    confidence: input.event.confidence,
    occurredAt: input.event.timestamp,
    trackId: input.event.track_id ?? null,
    evidenceKind: input.event.evidence_kind,
    recordingRequired: input.recordingRequired,
    modelProvenance: input.event.model_provenance ?? null,
    verificationEvidence: input.event.verification_evidence ?? null
  };
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function storedConfidence(value: unknown): number | null {
  if (typeof value !== "number" && (typeof value !== "string" || !/^(?:0|1)(?:\.\d{1,8})?$/.test(value))) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 1 ? number : null;
}

/** Compare the persisted row after both a direct read and a 23505 reread. */
export function matchesCanonicalCloudObservation(rowValue: unknown, expected: CanonicalCloudObservation): boolean {
  const row = object(rowValue);
  const metadata = object(row?.metadata);
  const confidence = storedConfidence(row?.confidence);
  if (!row || !metadata || confidence === null) return false;
  const storedCreatedAt = row.created_at;
  if (typeof storedCreatedAt !== "string" || !Number.isFinite(Date.parse(storedCreatedAt))
    || Date.parse(storedCreatedAt) !== Date.parse(expected.occurredAt)) return false;
  return row.observer_site_id === expected.siteId
    && row.source_type === "system" && row.source_id === expected.sourceId
    && row.signal_type === "ai_camera" && row.severity === expected.severity
    && Math.round(confidence * 10_000) === Math.round(expected.confidence * 10_000)
    && metadata.camera_source_id === expected.cameraId
    && metadata.stream_id === expected.streamId
    && metadata.event_type === expected.eventType
    && metadata.first_seen === expected.occurredAt
    && (metadata.track_id ?? null) === expected.trackId
    && metadata.evidence_kind === expected.evidenceKind
    && metadata.recording_required === expected.recordingRequired
    && metadata.observation_provenance === "REAL_CAMERA_AI"
    && metadata.validated_event === true
    && isDeepStrictEqual(metadata.model_provenance ?? null, expected.modelProvenance)
    && isDeepStrictEqual(metadata.verification_evidence ?? null, expected.verificationEvidence);
}
