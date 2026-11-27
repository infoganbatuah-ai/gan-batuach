// Disconnected fixture. The in-memory approval, audit acknowledgment and stream
// lease stand in for storage that is not yet available in Development.
import { createHash, generateKeyPairSync, randomUUID, sign } from "node:crypto";
import { loadTs } from "./digital-guard-test-loader.mjs";
import { createSourceRecordingReference } from "../../lib/domain/digital-observer/storage-contract.mjs";

const { sourceRecordingProofSigningBytes, verifySourceRecordingProof } = loadTs("lib/domain/digital-observer/source-recording-proof.ts");
const { prepareInvestigationTimelineRecording } = loadTs("lib/domain/digital-observer/investigation-recording-timeline.ts");
const uuid = (value) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function sourceRecordingFlowFixture({
  evidenceAnchor = Buffer.from("synthetic-anchor"),
  archiveAnchor = evidenceAnchor,
  auditAccepted = true,
} = {}) {
  const [tenantId, siteId, sourceId, actorId, eventId, evidenceId, recordingReferenceId] =
    Array.from({ length: 7 }, (_, i) => uuid(i + 1));
  const scope = { tenantId, siteId, sourceId };
  const start = Date.parse("2026-11-27T10:00:00Z");
  const iso = (ms) => new Date(ms).toISOString();
  let clock = start + 7_000;
  const session = { ...scope, actorId, expiresAt: iso(start + 95_000) };
  const selection = {
    ...scope, eventId, evidenceId, fromInclusive: iso(start), toExclusive: iso(start + 5_000),
  };
  const event = { ...scope, id: eventId, occurredAt: iso(start + 2_000) };
  const recorder = generateKeyPairSync("ed25519");
  const expected = {
    ...scope, operationId: randomUUID(), eventId, evidenceId, recordingReferenceId,
    recorderId: "synthetic-recorder", channelId: "fixture-channel", clockEpoch: "fixture-epoch",
    anchorSha256: digest(evidenceAnchor), eventObservedUtcMs: Date.parse(event.occurredAt),
  };
  const receipt = {
    ...expected,
    version: "observer-source-recording-proof-v1",
    anchorSha256: digest(archiveAnchor),
    requestedFromUtcMs: start, requestedToUtcMs: start + 5_000,
    issuedAtMs: start + 6_000, expiresAtMs: start + 45_000,
    archiveStartRecorderMs: start + 1_200, archiveEndRecorderMs: start + 6_200,
    clockVerifiedFromUtcMs: start, clockVerifiedUntilUtcMs: start + 5_000,
    recorderMinusUtcMs: 1_200, clockUncertaintyMs: 0,
  };
  const proof = { receipt, signature: sign(null, sourceRecordingProofSigningBytes(receipt), recorder.privateKey).toString("base64url") };
  const recording = createSourceRecordingReference({
    ...scope, cameraSourceId: sourceId, sourceSystem: "fixture-dvr", referenceId: recordingReferenceId,
    recordingId: "fixture-private-recording", startsAt: selection.fromInclusive, endsAt: selection.toExclusive,
    retentionAvailableUntil: iso(start + 110_000),
  });
  const evidence = { ...scope, id: evidenceId, eventId, recordingReferenceId };
  const audit = [];
  let consumed = false;
  let revoked = false;
  let permit;
  const { createAuditedRecordingRangeAdapter } = loadTs("lib/domain/digital-observer/recording-range-audit.ts", {
    "@/lib/supabase/admin": {
      createAdminClient: () => ({
        from: (table) => ({
          insert: (row) => ({
            select: (columns) => ({
              single: async () => {
                audit.push({ table, row, columns });
                return auditAccepted ? { data: { id: row.id }, error: null } : { data: null, error: { code: "42501" } };
              },
            }),
          }),
        }),
      }),
    },
    "@/lib/auth": {},
  });
  const prepareRange = createAuditedRecordingRangeAdapter({
    source: { ...scope, sourceSystem: "fixture-dvr" },
    now: () => clock,
    async lookupLinkedRecording(request) {
      if (revoked || consumed) return null;
      verifySourceRecordingProof({
        proof, expected, recorderPublicKey: recorder.publicKey, nowMs: clock,
        range: { fromUtcMs: Date.parse(request.fromInclusive), toUtcMs: Date.parse(request.toExclusive) },
      });
      // Single-process fixture only. Persistence and atomicity across processes
      // must be qualified separately against an authorized registrar.
      consumed = true;
      return { recording, event, evidence };
    },
  });

  async function authorize(viewer = session, requestedEvent = eventId) {
    const context = {
      tenantId, siteId, now: new Date(clock), historyAllowed: true,
      sources: [{ id: sourceId, observer_site_id: siteId, display_name: "Synthetic" }],
      result: {
        query: { observerSiteId: siteId, cameraSourceIds: [sourceId],
          fromInclusive: selection.fromInclusive, toExclusive: selection.toExclusive },
        grounding: { eventIds: [eventId], evidenceIds: [evidenceId] },
        events: [{ siteId, id: eventId, cameraId: sourceId, occurredAt: event.occurredAt,
          evidence: { state: "AVAILABLE", clipId: evidenceId } }],
      },
    };
    if (viewer?.actorId !== actorId) throw new Error("RECORDING_SCOPE_DENIED");
    const handle = await prepareInvestigationTimelineRecording({ context, session: viewer, eventId: requestedEvent, prepareRange });
    if (revoked) throw new Error("RECORDING_SCOPE_DENIED");
    permit = { code: randomUUID(), expiresAt: Math.min(Date.parse(handle.authorizationExpiresAt), receipt.expiresAtMs) };
    return { token: permit.code, range: [handle.fromInclusive, handle.toExclusive] };
  }

  function mayServe(token, viewer = session) {
    return Boolean(!revoked && permit && permit.code === token && clock < permit.expiresAt &&
      clock < Date.parse(viewer?.expiresAt ?? "") &&
      [tenantId, siteId, sourceId, actorId].every((value, index) => value ===
        [viewer?.tenantId, viewer?.siteId, viewer?.sourceId, viewer?.actorId][index]));
  }

  return { scope, session, eventId, selection, audit, authorize, mayServe,
    advanceMs: (ms) => { clock += ms; }, revoke: () => { revoked = true; } };
}
