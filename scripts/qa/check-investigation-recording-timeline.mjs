import assert from "node:assert/strict";
import test from "node:test";
import { buildInvestigationRecordingTimeline, prepareInvestigationTimelineRecording } from "../../lib/domain/digital-observer/investigation-recording-timeline.ts";
import { createRecordingRangeAdapter } from "../../lib/domain/digital-observer/recording-range-retrieval.ts";
import { createSourceRecordingReference } from "../../lib/domain/digital-observer/storage-contract.mjs";

const time = (second) => new Date(Date.UTC(2026, 10, 27, 9, 0, second)).toISOString();
function fixture() {
  const context = {
    tenantId: "tenant-a", siteId: "site-a", historyAllowed: true, now: new Date(time(58)),
    sources: [
      { id: "camera-a", observer_site_id: "site-a", display_name: "כניסה" },
      { id: "camera-b", observer_site_id: "site-a", display_name: "חניה" },
      { id: "camera-other", observer_site_id: "site-other" },
    ],
    result: {
      query: { observerSiteId: "site-a", fromInclusive: "2026-11-27T11:00:10+02:00", toExclusive: time(60), cameraSourceIds: [] },
      grounding: { eventIds: ["event-a", "event-b"], evidenceIds: ["evidence-a", "evidence-b"] },
      events: [
        { id: "event-b", siteId: "site-a", cameraId: "camera-b", occurredAt: time(45), label: "יציאה",
          evidence: { state: "AVAILABLE", clipId: "evidence-b" } },
        { id: "event-a", siteId: "site-a", cameraId: "camera-a", occurredAt: time(20), label: "כניסה",
          evidence: { state: "AVAILABLE", clipId: "evidence-a", playbackPath: "/private", reason: "private" } },
      ],
    },
  };
  const scope = { tenantId: context.tenantId, siteId: context.siteId, sourceId: "camera-a" };
  const session = { ...scope, actorId: "owner-a", expiresAt: time(100) };
  const link = {
    recording: createSourceRecordingReference({
      ...scope, cameraSourceId: scope.sourceId, sourceSystem: "fixture-dvr", referenceId: "ref-a",
      recordingId: "recording-a", startsAt: time(0), endsAt: time(55), retentionAvailableUntil: time(110),
    }),
    event: { ...scope, id: "event-a", occurredAt: time(20) },
    evidence: { ...scope, id: "evidence-a", eventId: "event-a", recordingReferenceId: "ref-a" },
  };
  const audits = [];
  const prepareRange = createRecordingRangeAdapter({
    source: { ...scope, sourceSystem: "fixture-dvr" },
    now: () => context.now.getTime(),
    lookupLinkedRecording: async () => link,
    writeAccessAudit: async (entry) => { audits.push(entry); return true; },
  });
  return { context, session, link, audits, prepareRange, eventId: "event-a" };
}

test("orders authorized cameras by actual time and clamps a proposed range to query and clock", () => {
  const { context } = fixture();
  const timeline = buildInvestigationRecordingTimeline(context);
  assert.deepEqual(timeline.map((row) => [row.eventId, row.sourceLabel]), [["event-a", "כניסה"], ["event-b", "חניה"]]);
  assert.deepEqual(timeline[0].candidate, { evidenceId: "evidence-a", fromInclusive: time(10), toExclusive: time(50) });
  assert.equal(timeline[1].candidate.toExclusive, time(58));
  assert.doesNotMatch(JSON.stringify(timeline), /\/private|playbackPath/);
  context.result.query.cameraSourceIds = ["camera-b"];
  assert.deepEqual(buildInvestigationRecordingTimeline(context).map((row) => row.sourceId), ["camera-b"]);
});

test("excludes mismatched site, unauthorized sources and future or ungrounded events", () => {
  for (const mutation of [
    (row) => { row.siteId = "site-other"; },
    (row) => { row.cameraId = "camera-other"; },
    (row) => { row.occurredAt = time(59); },
    (row) => { row.occurredAt = "invalid"; },
    (row) => { row.id = "not-grounded"; },
  ]) {
    const { context } = fixture();
    mutation(context.result.events[1]);
    assert.deepEqual(buildInvestigationRecordingTimeline(context).map((row) => row.eventId), ["event-b"]);
  }
  const { context } = fixture();
  context.result.query.observerSiteId = "site-other";
  assert.deepEqual(buildInvestigationRecordingTimeline(context), []);
});

test("no history for privacy-restricted scope and no candidate for ungrounded or expired evidence", async () => {
  const f = fixture();
  f.context.historyAllowed = false;
  assert.deepEqual(buildInvestigationRecordingTimeline(f.context), []);
  await assert.rejects(prepareInvestigationTimelineRecording(f), /RECORDING_SELECTION_UNAVAILABLE/);
  f.context.historyAllowed = true;
  f.context.result.events[1].evidence.clipId = "wrong-evidence";
  assert.equal(buildInvestigationRecordingTimeline(f.context)[0].candidate, null);
  f.context.result.events[1].evidence = { state: "EXPIRED", clipId: "evidence-a" };
  assert.equal(buildInvestigationRecordingTimeline(f.context)[0].candidate, null);
  assert.deepEqual(f.audits, []);
});

test("rejects wrong tenant, site or camera grant before requesting an archive handle", async () => {
  const f = fixture();
  for (const key of ["tenantId", "siteId", "sourceId"]) {
    await assert.rejects(prepareInvestigationTimelineRecording({ ...f, session: { ...f.session, [key]: "other" } }),
      /RECORDING_(SCOPE_DENIED|SELECTION_UNAVAILABLE)/);
  }
  assert.deepEqual(f.audits, []);
});

test("a scoped Event reaches the range adapter and audit with its proven synthetic Evidence link", async () => {
  const f = fixture();
  const result = await prepareInvestigationTimelineRecording(f);
  assert.equal(result.recordingReferenceId, "ref-a");
  assert.equal(result.eventId, "event-a");
  assert.deepEqual(f.audits.map(({ eventId, evidenceId }) => [eventId, evidenceId]), [["event-a", "evidence-a"]]);
  f.link.evidence.eventId = "event-b";
  await assert.rejects(prepareInvestigationTimelineRecording(f), /RECORDING_RANGE_UNAVAILABLE/);
  assert.equal(f.audits.length, 1);
});

test("fails closed when the archive access audit cannot be confirmed", async () => {
  const f = fixture();
  f.prepareRange = createRecordingRangeAdapter({
    source: { tenantId: f.session.tenantId, siteId: f.session.siteId, sourceId: f.session.sourceId, sourceSystem: "fixture-dvr" },
    now: () => f.context.now.getTime(),
    lookupLinkedRecording: async () => f.link,
    writeAccessAudit: async () => false,
  });
  await assert.rejects(prepareInvestigationTimelineRecording(f), /RECORDING_ACCESS_AUDIT_UNAVAILABLE/);
});
