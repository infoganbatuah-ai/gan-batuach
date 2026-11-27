import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { createSourceRecordingReference } from "../../lib/domain/digital-observer/storage-contract.mjs";

const stubs = new Map([
  ["server-only", "export {};"],
  ["@/lib/auth", "export async function getSessionProfile() { throw new Error('Unexpected auth lookup'); }"],
  ["@/lib/supabase/admin", "export function createAdminClient() { return globalThis[Symbol.for('observer.audit.qa.client')](); }"],
]);
registerHooks({
  resolve(specifier, context, next) {
    const stub = stubs.get(specifier);
    if (stub) return { url: `data:text/javascript,${encodeURIComponent(stub)}`, shortCircuit: true };
    if (specifier === "@/lib/security/audit-log-service") {
      return next(new URL("../../lib/security/audit-log-service.ts", import.meta.url).href, context);
    }
    if (specifier === "./recording-range-retrieval" && context.parentURL?.endsWith("/recording-range-audit.ts")) {
      return next(`${specifier}.ts`, context);
    }
    return next(specifier, context);
  },
});

const { createAuditedRecordingRangeAdapter } = await import("../../lib/domain/digital-observer/recording-range-audit.ts");
const { writeAuditEvent } = await import("../../lib/security/audit-log-service.ts");
const time = (minute) => new Date(Date.UTC(2026, 10, 27, 10, minute)).toISOString();
const uuid = (index) => `${String(index).padStart(8, "0")}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`;

function fixture({ respond = (row) => Response.json({ id: row.id }, { status: 201 }) } = {}) {
  const scope = { tenantId: uuid(1), siteId: uuid(2), sourceId: uuid(3) };
  const session = { ...scope, actorId: uuid(4), expiresAt: time(30) };
  const selection = { ...scope, eventId: uuid(5), evidenceId: uuid(6), fromInclusive: time(3), toExclusive: time(5) };
  const recording = createSourceRecordingReference({
    ...scope, cameraSourceId: scope.sourceId, sourceSystem: "fixture-dvr", referenceId: "private-archive-reference",
    recordingId: "private-archive-locator", startsAt: time(0), endsAt: time(9), retentionAvailableUntil: time(35),
  });
  const link = {
    recording,
    event: { ...scope, id: selection.eventId, occurredAt: time(4) },
    evidence: { ...scope, id: selection.evidenceId, eventId: selection.eventId, recordingReferenceId: recording.reference_id },
  };
  const writes = [];
  let reads = 0;
  let clock = Date.parse(time(20));

  globalThis[Symbol.for("observer.audit.qa.client")] = () => createClient("https://audit.example.invalid", "synthetic-service-role", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (target, init) => {
      const request = new Request(target, init);
      const url = new URL(request.url);
      assert.equal(url.hostname, "audit.example.invalid");
      assert.equal(url.pathname, "/rest/v1/immutable_audit_events");
      assert.equal(request.method, "POST");
      const row = await request.json();
      writes.push({ row, columns: url.searchParams.get("select"), prefer: request.headers.get("prefer") });
      return respond(row);
    } },
  });

  const prepare = createAuditedRecordingRangeAdapter({
    source: { ...scope, sourceSystem: "fixture-dvr" }, now: () => clock,
    lookupLinkedRecording: async () => { reads++; return link; },
  });
  return { session, selection, prepare, writes, readCount: () => reads, setTime: (minute) => { clock = Date.parse(time(minute)); } };
}

test("requires an exact persisted row receipt and records only product scope and authorized range", async () => {
  const f = fixture();
  const handle = await f.prepare(f.session, f.selection);
  assert.equal(handle.recordingId, "private-archive-locator");
  assert.equal(f.writes.length, 1);
  const { row, columns, prefer } = f.writes[0];
  assert.equal(columns, "id");
  assert.match(prefer, /return=representation/);
  assert.match(row.id, /^[a-f0-9-]{36}$/);
  assert.equal(row.event_type, "observer_recording_range_authorized");
  assert.equal(row.actor_profile_id, f.session.actorId);
  assert.equal(row.target_id, f.selection.evidenceId);
  assert.equal(row.camera_id, f.selection.sourceId);
  assert.deepEqual(row.metadata, {
    tenant_id: f.selection.tenantId, observer_site_id: f.selection.siteId, event_id: f.selection.eventId,
    range_from_inclusive: time(3), range_to_exclusive: time(5), confirmed_scope_at: time(20),
  });
  assert.doesNotMatch(JSON.stringify(row), /private-archive|fixture-dvr|synthetic-service-role/);
});

test("fails closed on database rejection, missing return data, or wrong row identity", async () => {
  for (const respond of [
    () => Response.json({ code: "42501", message: "internal-db-detail" }, { status: 403 }),
    () => new Response(null, { status: 204 }),
    () => Response.json({ id: uuid(7) }, { status: 201 }),
    () => { throw new Error("internal-transport-detail"); },
  ]) {
    const f = fixture({ respond });
    await assert.rejects(f.prepare(f.session, f.selection), { message: "RECORDING_ACCESS_AUDIT_UNAVAILABLE" });
    assert.equal(f.writes.length, 1);
  }
});

test("denies foreign scope and expired sessions before any archive lookup or audit write", async () => {
  const f = fixture();
  for (const key of ["tenantId", "siteId", "sourceId"]) {
    await assert.rejects(f.prepare({ ...f.session, [key]: uuid(7) }, f.selection), /RECORDING_SCOPE_DENIED/);
    await assert.rejects(f.prepare(f.session, { ...f.selection, [key]: uuid(7) }), /RECORDING_SCOPE_DENIED/);
  }
  f.setTime(30);
  await assert.rejects(f.prepare(f.session, f.selection), /RECORDING_SCOPE_DENIED/);
  assert.equal(f.readCount(), 0);
  assert.deepEqual(f.writes, []);
});

test("refuses an unrecognized actor identifier without writing an audit row", async () => {
  const f = fixture();
  await assert.rejects(f.prepare({ ...f.session, actorId: "not-a-canonical-id" }, f.selection),
    /RECORDING_ACCESS_AUDIT_UNAVAILABLE/);
  assert.deepEqual(f.writes, []);
});

test("a session expiring before write acknowledgment receives no range handle", async () => {
  const f = fixture({ respond: (row) => {
    f.setTime(30);
    return Response.json({ id: row.id }, { status: 201 });
  } });
  await assert.rejects(f.prepare(f.session, f.selection), /RECORDING_AUTHORIZATION_EXPIRED/);
  assert.equal(f.writes.length, 1);
});

test("legacy audit remains a best-effort insert without a returning requirement", async () => {
  const f = fixture({ respond: () => new Response(null, { status: 201 }) });
  await writeAuditEvent({ eventType: "legacy", eventCategory: "observer", metadata: { token: "redact-me" } });
  const { row, columns, prefer } = f.writes[0];
  assert.equal(row.id, undefined);
  assert.equal(columns, null);
  assert.doesNotMatch(prefer ?? "", /return=representation/);
  assert.deepEqual(row.metadata, { token: "[redacted]" });
});
