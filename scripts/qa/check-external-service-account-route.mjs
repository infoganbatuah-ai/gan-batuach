import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./digital-guard-test-loader.mjs";

const { DigitalObserverServerClient } = loadTs("packages/digital-observer-sdk/src/index.ts");
const { hashEnterpriseCredential } = loadTs("lib/domain/digital-observer/enterprise-identity.ts");
const uuid = (n) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const [org, otherOrg, partnerOrg, site, otherSite, camera, anotherCamera, service, evidence] = Array.from({ length: 9 }, (_, i) => uuid(i + 1));
const siblingEvidence = uuid(19);
const mixedIncident = uuid(21);
const credential = "dosvc_local_fixture_only_not_a_real_account";
const pepper = "synthetic-local-pepper";
const base = "https://observer.example.invalid/api/digital-observer/external/v1";

function fixture() {
  const state = {
    expires: new Date(Date.now() + 60_000).toISOString(),
    credentialRevoked: null, accountRevoked: null, credentialExpiry: undefined, accountExpiry: undefined,
    partnerStatus: "sandbox", mappingPartnerId: uuid(18), partnerOwnerOrg: partnerOrg, customerStatus: "active", partnerLinked: true,
    accountOrg: org, siteOrg: org, siteIds: [site], cameraReads: 0, auditWrites: 0,
    permissions: ["camera.live.view", "events.view", "evidence.view"], cameraRows: null,
  };
  const data = (table) => {
    switch (table) {
      case "digital_observer_service_account_credentials": return [{
        id: uuid(11), service_account_id: service, credential_hash: hashEnterpriseCredential(credential, pepper),
        expires_at: state.credentialExpiry ?? state.expires, revoked_at: state.credentialRevoked,
      }];
      case "digital_observer_service_accounts": return [{
        id: service, organization_id: state.accountOrg, account_status: "active", all_sites: false,
        permissions: state.permissions, expires_at: state.accountExpiry ?? state.expires, revoked_at: state.accountRevoked,
      }];
      case "digital_observer_service_account_sites": return state.siteIds.map((observer_site_id) => ({ service_account_id: service, observer_site_id }));
      case "observer_sites": return [
        { id: site, digital_observer_organization_id: state.siteOrg, garden_id: null, site_type: "home" },
        { id: otherSite, digital_observer_organization_id: otherOrg, garden_id: null, site_type: "home" },
      ];
      case "digital_observer_partner_service_accounts": return state.accountOrg === partnerOrg ? [{
        partner_id: state.mappingPartnerId, service_account_id: service, access_kind: "customer_resources", partner_customer_id: uuid(12),
        digital_observer_partner_customers: { partner_id: uuid(18), customer_organization_id: org, customer_status: state.customerStatus,
          digital_observer_partners: { organization_id: state.partnerOwnerOrg, partner_status: state.partnerStatus } },
      }] : [];
      case "digital_observer_partner_customer_sites":
        return state.partnerLinked ? [{ partner_customer_id: uuid(12), observer_site_id: site }] : [];
      case "digital_observer_camera_sources":
        state.cameraReads++;
        return state.cameraRows ?? [camera, anotherCamera].map((id) => ({ id, observer_site_id: site, source_mode: "demo" }));
      case "digital_observer_event_clips": return [
        { id: evidence, observer_site_id: site, camera_source_id: camera, signal_id: uuid(15), clip_status: "available",
          storage_bucket: "fixture-private", storage_path: "never-return" },
        { id: siblingEvidence, observer_site_id: site, camera_source_id: anotherCamera, signal_id: uuid(20), clip_status: "available",
          storage_bucket: "sibling-private", storage_path: "never-return" },
      ];
      case "observer_correlated_events": return [{
        id: mixedIncident, observer_site_id: site, primary_camera_source_id: camera,
        involved_camera_ids: [camera, anotherCamera], related_event_ids: [uuid(15), uuid(20)],
        timeline_summary: { observations: 2 },
      }];
      case "digital_observer_external_api_request_receipts": return [];
      default: throw Error(`unexpected read ${table}`);
    }
  };

  const admin = {
    from(table) {
      const filters = [];
      let operation = "read";
      let columns = [];
      const rows = () => {
        const matches = data(table).filter((row) => filters.every((predicate) => predicate(row)));
        if (table !== "digital_observer_camera_sources") return matches;
        return matches.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => columns.includes(key))));
      };
      const builder = {
        select(value) { columns = value.split(","); return this; },
        eq(key, value) { filters.push((row) => row[key] === value); return this; },
        is(key, value) { return this.eq(key, value); },
        neq(key, value) { filters.push((row) => row[key] !== value); return this; },
        gte() { return this; }, order() { return this; }, range() { return this; }, limit() { return this; },
        insert() { operation = "insert"; if (table === "digital_observer_enterprise_audit_events") state.auditWrites++; return this; },
        update() { operation = "update"; return this; },
        async maybeSingle() { return { data: rows()[0] ?? null, error: null }; },
        async single() {
          assert.equal(table, "digital_observer_external_api_request_receipts");
          assert.equal(operation, "insert");
          return { data: { id: uuid(14) }, error: null };
        },
        then(resolve) {
          return resolve(operation === "read" ? { data: rows(), count: 0, error: null } : { data: null, error: null });
        },
      };
      return builder;
    },
    async rpc(name) {
      assert.equal(name, "record_digital_observer_external_api_usage");
      return { error: null };
    },
  };

  const route = loadTs("app/api/digital-observer/external/v1/[...segments]/route.ts", {
    process: { env: { DIGITAL_OBSERVER_ENTERPRISE_CREDENTIAL_PEPPER: pepper } },
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/lib/domain/digital-observer/commercial-billing-service": { assertCommercialEntitlement: async () => undefined },
    "./commercial-billing-service": { assertCommercialEntitlement: async () => undefined },
    "./webhook-security": {},
    "@/lib/domain/digital-observer/investigation-search-service": {},
    "@/lib/domain/digital-observer/watch-rule-service": {},
    "@/lib/domain/digital-observer/storage-contract.mjs": { createSupabaseStorageBackend: () => assert.fail("media signer should stay unused") },
    "@/lib/supabase/admin": { createAdminClient: () => admin, isAdminClientConfigured: () => true },
  });
  const client = new DigitalObserverServerClient({ baseUrl: base, credential, fetch: async (url, init) => {
    const request = new Request(url, init);
    const segments = new URL(url).pathname.split("/").slice(5);
    return route[request.method](request, { params: Promise.resolve({ segments }) });
  } });
  return { client, state };
}

test("signed SDK enters the actual v1 route; a camera filter narrows results but does not become a source grant", async () => {
  const { client, state } = fixture();
  const all = await client.cameras(site);
  const filtered = await client.request(`/cameras?site_id=${site}&camera_id=${camera}`);
  assert.deepEqual(all.data.map((row) => row.id), [camera, anotherCamera]);
  assert.deepEqual(filtered.data.map((row) => row.id), [camera]);
  await assert.rejects(client.cameras(otherSite), { status: 403 });
  const clip = await client.evidence(site, evidence);
  assert.equal(clip.evidence.id, evidence);
  assert.equal(clip.evidence.media_embedded, false);
  assert.doesNotMatch(JSON.stringify(clip), /fixture-private|never-return/);
  assert(state.auditWrites >= 3);
});

test("a delegated service account's camera filter does not narrow a later v1 evidence read", async () => {
  const { client, state } = fixture();
  state.accountOrg = partnerOrg;
  const selected = await client.request(`/cameras?site_id=${site}&camera_id=${camera}`);
  assert.deepEqual(selected.data.map(({ id }) => id), [camera]);
  const sibling = await client.evidence(site, siblingEvidence);
  assert.equal(sibling.evidence.camera_id, anotherCamera);
  assert.equal(sibling.evidence.media_embedded, false);
  assert.doesNotMatch(JSON.stringify(sibling), /sibling-private|never-return/);
  state.partnerLinked = false;
  await assert.rejects(client.evidence(site, siblingEvidence), { status: 403 });
});

test("a Site-scoped incident exposes secondary provenance in both list and direct lookup", async () => {
  const { client, state } = fixture();
  state.accountOrg = partnerOrg;
  state.permissions.push("incidents.manage");
  const listed = await client.incidents(site);
  assert.equal(listed.data.length, 1);
  assert.equal(listed.data[0].primary_camera_source_id, camera);
  assert.deepEqual(listed.data[0].involved_camera_ids, [camera, anotherCamera]);
  assert.deepEqual(listed.data[0].related_event_ids, [uuid(15), uuid(20)]);
  const detail = await client.request(`/incidents/${mixedIncident}?site_id=${site}`);
  assert.deepEqual(detail.incident, listed.data[0]);
  assert.deepEqual(detail.incident.timeline_summary, { observations: 2 });
});

test("the SDK v1 health page recognizes an unassigned channel without returning assignment metadata", async () => {
  const { client, state } = fixture();
  state.accountOrg = partnerOrg;
  const lastSeen = new Date().toISOString();
  const freshRow = { observer_site_id: site, source_mode: "live", status: "connected", health_status: "healthy", last_seen_at: lastSeen };
  state.cameraRows = [
    { ...freshRow, id: camera, metadata: { channel_assignment: "CHANNEL_EMPTY", private_fixture: "never-return" } },
    { ...freshRow, id: anotherCamera, metadata: { physical_camera_attached: true, private_fixture: "never-return" } },
  ];
  const health = await client.cameraHealth(site);
  assert.equal(health.api_version, "2026-10-19.v1");
  assert.equal(health.data.length, 2);
  const [empty, assigned] = health.data;
  assert.deepEqual([empty.id, empty.status, empty.health_status], [camera, "unassigned", "unknown"]);
  assert.deepEqual([assigned.id, assigned.status, assigned.health_status], [anotherCamera, "connected", "healthy"]);
  assert.doesNotMatch(JSON.stringify(health), /metadata|private_fixture|CHANNEL_EMPTY|physical_camera_attached|never-return/);
});

test("expired, invalid-expiry and revoked service credentials/accounts are denied before camera access", async () => {
  const expired = "2000-01-01T00:00:00Z";
  for (const patch of [
    { credentialExpiry: expired }, { credentialExpiry: "infinity" }, { credentialRevoked: expired },
    { accountExpiry: expired }, { accountExpiry: "unusable" }, { accountRevoked: expired },
  ]) {
    const { client, state } = fixture();
    Object.assign(state, patch);
    await assert.rejects(client.cameraHealth(site), { status: 401 });
    assert.equal(state.cameraReads, 0);
  }
});

test("partner delegation only applies to its current customer organization's linked Site", async () => {
  const { client, state } = fixture();
  state.accountOrg = partnerOrg;
  assert.equal((await client.cameras(site)).data.length, 2);
  const successfulReads = state.cameraReads;
  state.siteOrg = otherOrg;
  await assert.rejects(client.cameras(site), { status: 403 });
  state.siteOrg = org;
  state.partnerLinked = false;
  await assert.rejects(client.cameras(site), { status: 403 });
  state.partnerLinked = true;
  state.customerStatus = "suspended";
  await assert.rejects(client.cameras(site), { status: 403 });
  state.customerStatus = "active";
  state.partnerOwnerOrg = otherOrg;
  await assert.rejects(client.cameras(site), { status: 403 });
  state.partnerOwnerOrg = partnerOrg;
  state.mappingPartnerId = uuid(19);
  await assert.rejects(client.cameras(site), { status: 403 });
  assert.equal(state.cameraReads, successfulReads);
});

test("Evidence permission remains separate and unrecognized archive paths cannot alias Evidence routes", async () => {
  const { client, state } = fixture();
  for (const path of [`/archive?site_id=${site}`, `/evidence/${evidence}/archive?site_id=${site}`,
    `/evidence/${evidence}/media/extra?site_id=${site}`]) {
    await assert.rejects(client.request(path), { status: 404 });
  }
  assert.equal(state.auditWrites, 0);
  state.permissions = ["camera.live.view"];
  await assert.rejects(client.evidence(site, evidence), { status: 403 });
});
