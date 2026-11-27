import assert from "node:assert/strict";
import test from "node:test";
import { sourceRecordingFlowFixture } from "./source-recording-flow-fixture.mjs";

test("source proof joins the matching Event and Evidence before acknowledged audit and synthetic delivery", async () => {
  const flow = sourceRecordingFlowFixture();
  assert.equal(flow.mayServe("anonymous"), false);
  const result = await flow.authorize();
  assert.deepEqual(result.range, [flow.selection.fromInclusive, flow.selection.toExclusive]);
  assert.equal(flow.mayServe(result.token), true);
  const [{ table, row, columns }] = flow.audit;
  assert.equal(table, "immutable_audit_events");
  assert.equal(columns, "id");
  assert.equal(row.target_id, flow.selection.evidenceId);
  assert.equal(row.metadata.event_id, flow.eventId);
  assert.equal(row.metadata.tenant_id, flow.scope.tenantId);
  assert.equal(row.metadata.observer_site_id, flow.scope.siteId);
  assert.equal(row.camera_id, flow.scope.sourceId);
  assert.doesNotMatch(JSON.stringify(row), /fixture-private-recording|fixture-recorder|token/);
  await assert.rejects(flow.authorize(), /RECORDING_RANGE_UNAVAILABLE/);
});

test("foreign tenant, Site, source, actor and Event cannot trigger audit or delivery", async () => {
  const flow = sourceRecordingFlowFixture();
  for (const field of ["tenantId", "siteId", "sourceId", "actorId"]) {
    await assert.rejects(flow.authorize({ ...flow.session, [field]: "foreign" }),
      /RECORDING_(SCOPE_DENIED|SELECTION_UNAVAILABLE)/);
  }
  await assert.rejects(flow.authorize({ ...flow.session, expiresAt: flow.selection.toExclusive }), /RECORDING_SCOPE_DENIED/);
  await assert.rejects(flow.authorize(flow.session, "unrelated"), /RECORDING_SELECTION_UNAVAILABLE/);
  assert.deepEqual(flow.audit, []);
  const { token } = await flow.authorize();
  assert.equal(flow.mayServe(token, { ...flow.session, siteId: "foreign" }), false);
  assert.equal(flow.mayServe(token, { ...flow.session, sourceId: "foreign" }), false);
});

test("exact time is insufficient if the actual archive anchor differs from Evidence", async () => {
  const flow = sourceRecordingFlowFixture({ archiveAnchor: Buffer.from("unrelated-synthetic-anchor") });
  await assert.rejects(flow.authorize(), /RECORDING_LOOKUP_UNAVAILABLE/);
  assert.deepEqual(flow.audit, []);
  assert.equal(flow.mayServe("arbitrary"), false);
});

test("refusal to acknowledge the audit never issues a permit", async () => {
  const flow = sourceRecordingFlowFixture({ auditAccepted: false });
  await assert.rejects(flow.authorize(), /RECORDING_ACCESS_AUDIT_UNAVAILABLE/);
  assert.equal(flow.audit.length, 1);
  assert.equal(flow.mayServe("arbitrary"), false);
});

test("proof expiry and revocation stop both new claims and existing synthetic delivery", async () => {
  const expiring = sourceRecordingFlowFixture();
  const { token } = await expiring.authorize();
  expiring.advanceMs(38_000);
  assert.equal(expiring.mayServe(token), false);
  const expired = sourceRecordingFlowFixture();
  expired.advanceMs(38_000);
  await assert.rejects(expired.authorize(), /RECORDING_LOOKUP_UNAVAILABLE/);
  assert.deepEqual(expired.audit, []);

  const revoked = sourceRecordingFlowFixture();
  const active = await revoked.authorize();
  revoked.revoke();
  assert.equal(revoked.mayServe(active.token), false);
  await assert.rejects(revoked.authorize(), /RECORDING_RANGE_UNAVAILABLE/);
});
