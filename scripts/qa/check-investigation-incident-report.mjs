import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { loadTs } from "./digital-guard-test-loader.mjs";

const { buildInvestigationIncidentReport } = loadTs("lib/domain/digital-observer/investigation-incident-report.ts");
const uuid = (number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const [ownerId, siteId, sourceId, incidentId, eventId, evidenceId, foreignId] = Array.from({ length: 7 }, (_, index) => uuid(index + 1));
const time = "2026-09-06T10:00:00.000Z";
const path = `/api/digital-observer/event-clips/${evidenceId}/media?kind=clip`;
const exists = { eventId, sourceId, observedAt: time, timeBasis: "SOURCE_OBSERVATION", evidenceState: "AVAILABLE", evidenceId };
const reconstruction = { incidentId, groups: [{ observations: [exists] }], partialSearch: true, capped: false, omittedObservations: 0 };

class SafeHttpError extends Error {
  constructor(code, status) { super(code); this.status = status; }
}

function fixture() {
  const state = { active: true, ownerId, auditAccepted: true, privateMode: false, evidenceState: "AVAILABLE", audits: [], searches: 0 };
  const site = { id: siteId, name: "private-name@example.invalid", owner_profile_id: ownerId, site_type: "home", timezone: "UTC" };
  const dataClient = { from(table) {
    assert.equal(table, "digital_observer_camera_sources");
    return { select: () => ({ eq: (field, value) => {
      assert.equal(field, "observer_site_id");
      assert.equal(value, siteId);
      return { order: async () => ({ data: [{ id: sourceId, observer_site_id: siteId, display_name: "private camera",
        location_label: "private address", metadata: { credential: "private" } }] }) };
    } }) };
  } };
  const query = { observerSiteId: siteId, fromInclusive: "2026-09-06T00:00:00Z", toExclusive: "2026-09-07T00:00:00Z", cameraSourceIds: [] };
  const body = { observer_site_id: siteId, question: "תקרית פרטית", cursor: 0, limit: 20 };
  const actualPolicy = loadTs("lib/domain/digital-observer/investigation-history-policy.ts");
  const { POST } = loadTs("app/api/digital-observer/investigation/route.ts", {
    "@/lib/api": {
      ok: (data, status = 200) => Response.json({ data }, { status }),
      fail: (error, status = 400) => Response.json({ error }, { status }),
      SafeHttpError,
      handleSafeRouteError: (error) => {
        if (!(error instanceof SafeHttpError)) throw error;
        return Response.json({ error: error.message }, { status: error.status });
      },
    },
    "@/lib/domain/digital-observer/access": {
      getDigitalObserverApiUser: async () => state.active ? { user: { id: state.ownerId }, profile: { id: state.ownerId }, supabase: dataClient } : null,
      getObserverSiteAccess: async (_client, _profile, selectedSite) => selectedSite === siteId
        ? { ...site, vision_privacy_mode: state.privateMode ? "skeleton_only" : "standard" } : null,
    },
    "@/lib/domain/digital-observer/admin-access": { hasCurrentObserverAdmin: async () => false },
    "@/lib/domain/event-engine/guard-journal-search": actualPolicy,
    "@/lib/domain/digital-observer/commercial-billing-service": { assertCommercialEntitlement: async () => undefined },
    "@/lib/supabase/admin": { createAdminClient: () => ({}) },
    "@/lib/domain/digital-observer/investigation-query": {
      compileInvestigationQuery: ({ cursor, limit }) => ({ status: "READY", query: { ...query, cursor, limit } }),
      validateInvestigationQuery: (value) => ({ valid: true, query: value }),
    },
    "@/lib/domain/digital-observer/investigation-search-service": {
      searchDigitalObserverInvestigation: async ({ db, query: compiled }) => {
        assert.equal(db, dataClient);
        state.searches++;
        return {
          query, events: [], incidents: compiled.cursor === 0 ? [{ id: incidentId, siteId,
            timeline: [{ eventId, evidenceState: state.evidenceState, verifiedObservation: {
              cameraId: sourceId, occurredAt: time, timeBasis: "SOURCE_OBSERVATION",
              evidencePath: path, evidenceId, label: "name@example.invalid",
            } }] }] : [],
          grounding: { incidentIds: [incidentId], eventIds: [eventId], evidenceIds: [evidenceId] },
          pagination: { cursor: compiled.cursor, limit: compiled.limit, nextCursor: 20 }, coverage: { scanCapReached: false },
        };
      },
    },
    "@/lib/security/audit-log-service": {
      firstForwardedIp: () => null,
      writeAuditEventAcknowledged: async (entry) => { state.audits.push(entry); return state.auditAccepted; },
    },
  });
  async function send(overrides = {}, headers = { "content-type": "application/json", origin: "https://observer.example.invalid" }) {
    return POST(new Request("https://observer.example.invalid/api/digital-observer/investigation", {
      method: "POST", headers, body: JSON.stringify({ ...body, ...overrides }),
    }));
  }
  async function preview() {
    const response = await send();
    return (await response.json()).data.reportPreviews[0];
  }
  return { state, send, preview };
}

function requestFor(preview) {
  return { incident_id: preview.incidentId, content_sha256: preview.contentSha256 };
}

test("route rebuilds the authorized page before returning a private JSON attachment with acknowledged audit", async () => {
  const f = fixture();
  const preview = await f.preview();
  assert.equal(f.state.audits.length, 0);
  const response = await f.send({ report: requestFor(preview) });
  assert.equal(response.status, 200);
  assert.equal(f.state.searches, 2);
  assert.equal(f.state.audits.length, 1);
  assert.match(response.headers.get("content-disposition"), /^attachment/);
  assert.match(response.headers.get("cache-control"), /no-store/);
  const document = await response.json();
  assert.equal(document.content_sha256, preview.contentSha256);
  assert.equal(document.report.version, "observer-incident-observations-v1");
  assert.deepEqual(document.report.observations[0], { event_id: eventId, source_id: sourceId,
    time_utc: time, time_basis: "SOURCE_OBSERVATION", evidence_state: "AVAILABLE", evidence_id: evidenceId });
  assert.doesNotMatch(JSON.stringify(document), /https?:|\/api\/|@|private|credential|תקרית/);
  assert.equal(f.state.audits[0].metadata.content_sha256, document.content_sha256);
  assert.equal(f.state.audits[0].actorProfileId, ownerId);
});

test("route rejects expired session, non-owner, wrong site, restricted history and cross-site request before export", async () => {
  const f = fixture();
  const report = requestFor(await f.preview());
  f.state.active = false;
  assert.equal((await f.send({ report })).status, 401);
  f.state.active = true;
  f.state.ownerId = foreignId;
  assert.equal((await f.send({ report })).status, 403);
  assert.equal(await f.preview(), undefined);
  f.state.ownerId = ownerId;
  assert.equal((await f.send({ report, observer_site_id: foreignId })).status, 403);
  f.state.privateMode = true;
  assert.equal((await f.send({ report })).status, 403);
  f.state.privateMode = false;
  assert.equal((await f.send({ report }, { "content-type": "application/json", "sec-fetch-site": "cross-site" })).status, 403);
  assert.equal((await f.send({ report }, { "content-type": "application/json", origin: "https://other.example.invalid" })).status, 403);
  assert.equal(f.state.audits.length, 0);
});

test("route rejects stale evidence, changed pagination or audit failure with no downloadable response", async () => {
  const f = fixture();
  const report = requestFor(await f.preview());
  assert.equal((await f.send({ report, cursor: 20 })).status, 409);
  f.state.evidenceState = "EXPIRED";
  assert.equal((await f.send({ report })).status, 409);
  assert.equal(f.state.audits.length, 0);
  const expiredReport = requestFor(await f.preview());
  const response = await f.send({ report: expiredReport });
  const expired = (await response.json()).report.observations[0];
  assert.equal(expired.evidence_state, "EXPIRED");
  assert.equal(expired.evidence_id, null);
  f.state.auditAccepted = false;
  const denied = await f.send({ report: expiredReport });
  assert.equal(denied.status, 503);
  assert.equal(denied.headers.get("content-disposition"), null);
});

test("report sorts observations deterministically and omits missing evidence references", () => {
  const missing = { ...exists, eventId: uuid(30), evidenceState: "UNAVAILABLE", evidenceId,
    sourceLabel: "private", evidencePath: path, timeBasis: "STORED_TIME_ONLY" };
  const build = (observations) => buildInvestigationIncidentReport({
    siteId, pagination: { cursor: 0, limit: 20 }, reconstruction: { ...reconstruction, groups: [{ observations }] },
  });
  const first = build([missing, exists]);
  assert.deepEqual(first, build([exists, missing]));
  assert.equal(first.report.observations[1].evidence_id, null);
  assert.notEqual(first.content_sha256, build([exists]).content_sha256);
  const canonical = (value) => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
  assert.equal(first.content_sha256, createHash("sha256").update(JSON.stringify(canonical(first.report))).digest("hex"));
  assert.equal(build(Array.from({ length: 26 }, (_, index) => ({ ...exists, eventId: uuid(index + 50) }))), null);
});
