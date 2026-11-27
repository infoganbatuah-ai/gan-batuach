import assert from "node:assert/strict";
import test from "node:test";
import { createRecordingRangeAdapter } from "../../lib/domain/digital-observer/recording-range-retrieval.ts";
import { createSourceRecordingReference } from "../../lib/domain/digital-observer/storage-contract.mjs";

const time = (minutes) => new Date(Date.UTC(2026, 10, 27, 9, minutes)).toISOString();
const source = { tenantId: "tenant-a", siteId: "site-a", sourceId: "dvr-channel-a" };

function fixture() {
  let clock = Date.parse(time(10));
  const audits = [];
  const lookups = [];
  const request = { ...source, eventId: "event-a", evidenceId: "evidence-a", fromInclusive: time(2), toExclusive: time(5) };
  const session = { ...source, actorId: "actor-a", expiresAt: time(20) };
  const link = {
    recording: { ...createSourceRecordingReference({
      ...source, cameraSourceId: source.sourceId, sourceSystem: "fixture-dvr", referenceId: "ref-a",
      recordingId: "recording-a", startsAt: time(0), endsAt: time(9), retentionAvailableUntil: time(30),
    }), ignoredPrivateMetadata: "do-not-return" },
    event: { ...source, id: request.eventId, occurredAt: time(3) },
    evidence: { ...source, id: request.evidenceId, eventId: request.eventId, recordingReferenceId: "ref-a" },
  };
  const run = (overrides) => createRecordingRangeAdapter({
    source: { ...source, sourceSystem: "fixture-dvr" },
    lookupLinkedRecording: async (selection) => { lookups.push(selection); return link; },
    writeAccessAudit: async (entry) => { audits.push(entry); return true; },
    now: () => clock,
    ...overrides,
  });
  return { run, request, session, link, audits, lookups, advanceTo: (minute) => { clock = Date.parse(time(minute)); } };
}

test("returns only the authorized subrange and links after audit acknowledgement", async () => {
  const f = fixture();
  const result = await f.run()(f.session, { ...f.request, url: "https://example.invalid/" });
  assert.deepEqual(result, {
    ...f.request, recordingReferenceId: "ref-a", recordingId: "recording-a",
    sourceSystem: "fixture-dvr", authorizationExpiresAt: time(20),
  });
  assert.deepEqual(f.lookups, [f.request]);
  assert.deepEqual(f.audits, [{
    ...f.request, action: "RECORDING_RANGE_AUTHORIZED", actorId: "actor-a",
    authorizedAt: time(10), recordingReferenceId: "ref-a",
  }]);
});

for (const key of ["tenantId", "siteId", "sourceId"]) {
  test(`denies cross-scope ${key} on both session and selection before lookup`, async () => {
    const f = fixture();
    await assert.rejects(f.run()({ ...f.session, [key]: "other" }, f.request), /RECORDING_SCOPE_DENIED/);
    await assert.rejects(f.run()(f.session, { ...f.request, [key]: "other" }), /RECORDING_SCOPE_DENIED/);
    assert.deepEqual(f.lookups, []);
  });
}

test("denies absent, expired or malformed grants", async () => {
  const f = fixture();
  for (const grant of [null, { ...f.session, expiresAt: time(10) }, { ...f.session, actorId: undefined }]) {
    await assert.rejects(f.run()(grant, f.request), /RECORDING_SCOPE_DENIED/);
  }
  assert.deepEqual(f.lookups, []);
});

test("enforces valid UTC timestamps, maximum duration, and no future ranges", async () => {
  const f = fixture();
  for (const patch of [
    { fromInclusive: time(5) }, { toExclusive: time(8) }, { fromInclusive: time(8), toExclusive: time(11) },
    { fromInclusive: "2026-02-30T00:00:00Z" }, { fromInclusive: "2026-11-27" },
  ]) {
    await assert.rejects(f.run()(f.session, { ...f.request, ...patch }), /RECORDING_SELECTION_INVALID/);
  }
  assert.deepEqual(f.lookups, []);
});

for (const [name, mutate] of [
  ["partial coverage", (link) => { link.recording.ends_at = time(4); }],
  ["unapproved source system", (link) => { link.recording.source_system = "other"; }],
  ["wrong recording scope", (link) => { link.recording.site_id = "other"; }],
  ["unsupported retrieval capability", (link) => { link.recording.retrieval_capability = "DEEP_LINK"; }],
  ["wrong evidence", (link) => { link.evidence.id = "other"; }],
  ["wrong linked recording", (link) => { link.evidence.recordingReferenceId = "other"; }],
  ["wrong linked event", (link) => { link.evidence.eventId = "other"; }],
  ["cross-site event", (link) => { link.event.siteId = "other"; }],
  ["event on exclusive boundary", (link) => { link.event.occurredAt = time(5); }],
]) {
  test(`rejects ${name} from the lookup`, async () => {
    const f = fixture();
    mutate(f.link);
    await assert.rejects(f.run()(f.session, f.request), /RECORDING_RANGE_UNAVAILABLE/);
    assert.deepEqual(f.audits, []);
  });
}

test("denies expired or unknown retention", async () => {
  const f = fixture();
  for (const until of [time(10), null]) {
    f.link.recording.retention_available_until = until;
    await assert.rejects(f.run()(f.session, f.request), /RECORDING_AUTHORIZATION_EXPIRED/);
  }
  assert.deepEqual(f.audits, []);
});

test("denies missing lookup and masks dependency failure", async () => {
  const f = fixture();
  await assert.rejects(f.run({ lookupLinkedRecording: async () => null })(f.session, f.request), /RECORDING_RANGE_UNAVAILABLE/);
  await assert.rejects(f.run({ lookupLinkedRecording: async () => { throw new Error("private"); } })(f.session, f.request),
    { message: "RECORDING_LOOKUP_UNAVAILABLE" });
});

test("fails closed if audit is rejected or unavailable", async () => {
  const f = fixture();
  for (const writer of [async () => false, async () => { throw new Error("private"); }]) {
    await assert.rejects(f.run({ writeAccessAudit: writer })(f.session, f.request), { message: "RECORDING_ACCESS_AUDIT_UNAVAILABLE" });
  }
});

test("rechecks expiry while awaiting lookup and audit", async () => {
  const f = fixture();
  await assert.rejects(f.run({ lookupLinkedRecording: async () => { f.advanceTo(20); return f.link; } })(f.session, f.request),
    /RECORDING_AUTHORIZATION_EXPIRED/);
  assert.deepEqual(f.audits, []);
  f.advanceTo(10);
  await assert.rejects(f.run({ writeAccessAudit: async () => { f.advanceTo(20); return true; } })(f.session, f.request),
    /RECORDING_AUTHORIZATION_EXPIRED/);
});
