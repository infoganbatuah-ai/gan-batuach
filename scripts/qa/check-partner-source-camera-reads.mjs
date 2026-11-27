import assert from "node:assert/strict";
import test from "node:test";
import { readCameraModel } from "../../review-only/partner-source-authorization/camera-read-model.mjs";

const now = Date.parse("2026-11-27T10:00:00Z");

function fixture() {
  const current = { tenantId: "tenant", siteId: "site", sourceId: "camera-a", siteEpoch: 3, sourceEpoch: 2 };
  const principal = { accountId: "account", mode: "source_restricted", active: true, siteAuthorized: true,
    tenantId: current.tenantId, siteId: current.siteId, permissions: ["cameras.read", "camera_health.read"] };
  const grant = { ...current, accountId: principal.accountId, revokedAt: null, expiresAt: now + 60_000,
    permissions: ["cameras.read"] };
  const rows = ["camera-a", "camera-b"].map((id) => ({
    id, siteId: current.siteId, displayName: id, locationLabel: "fixture",
    healthStatus: "healthy", lastSeenAt: "2026-11-27T09:59:00Z", privateLocator: "synthetic-private-field",
    productLink: "/fixture", includesIncident: true,
  }));
  const sourceQueries = [];
  const siteQueries = [];
  const dependencies = { principal, grant, current, now,
    readSource: async (query) => {
      sourceQueries.push(query);
      return rows.find(({ id, siteId }) => id === query.sourceId && siteId === query.siteId);
    },
    readSite: async (request) => {
      siteQueries.push(request);
      return { data: rows.map(({ id }) => id), pagination: { next_cursor: "legacy-cursor" } };
    },
  };
  return { sourceQueries, siteQueries, dependencies,
    read: (request) => readCameraModel({ ...dependencies, request: { siteId: current.siteId, ...request } }),
  };
}

test("missing or stale source authority stops all queries while Site mode preserves its existing reader and cursor", async () => {
  const { read, dependencies, sourceQueries, siteQueries } = fixture();
  const originalGrant = dependencies.grant;
  dependencies.grant = null;
  await assert.rejects(read({ operation: "inventory" }), /SOURCE_GRANT_DENIED/);
  dependencies.grant = { ...originalGrant, sourceEpoch: originalGrant.sourceEpoch - 1 };
  await assert.rejects(read({ operation: "detail", sourceId: "camera-a" }), /SOURCE_GRANT_DENIED/);
  assert.equal(sourceQueries.length, 0);
  assert.equal(siteQueries.length, 0);
  dependencies.principal.mode = "site";
  dependencies.grant = null;
  const request = { operation: "inventory", cursor: "old-site-cursor", limit: 10 };
  assert.deepEqual(await read(request), { data: ["camera-a", "camera-b"], pagination: { next_cursor: "legacy-cursor" } });
  assert.deepEqual(siteQueries, [{ siteId: "site", ...request }]);
});

test("inventory and detail bind the query to the granted source before selection with no sibling or continuation", async () => {
  const { read, sourceQueries, siteQueries } = fixture();
  const camera = { id: "camera-a", display_name: "camera-a", location_label: "fixture" };
  assert.deepEqual(await read({ operation: "inventory" }), { data: [camera], pagination: { limit: 1, next_cursor: null } });
  assert.deepEqual(await read({ operation: "detail", sourceId: "camera-a" }), { camera });
  const query = { tenantId: "tenant", siteId: "site", sourceId: "camera-a", siteEpoch: 3, sourceEpoch: 2,
    columns: ["id", "siteId", "displayName", "locationLabel"] };
  assert.deepEqual(sourceQueries, [query, query]);
  assert.deepEqual(await read({ operation: "inventory", sourceId: "camera-b" }), { data: [], pagination: { limit: 1, next_cursor: null } });
  await assert.rejects(read({ operation: "detail", sourceId: "camera-b" }), /CAMERA_NOT_FOUND/);
  for (const cursor of ["legacy-cursor", "1", "", null]) await assert.rejects(read({ operation: "inventory", cursor }), /PAGE_DENIED/);
  await assert.rejects(read({ operation: "inventory", limit: 0 }), /PAGE_DENIED/);
  assert.equal(sourceQueries.length, 2);
  assert.equal(siteQueries.length, 0);
});

test("health needs a separate permission, while mixed resources, media and links cannot enter the restricted query path", async () => {
  const { read, dependencies, sourceQueries, siteQueries } = fixture();
  await assert.rejects(read({ operation: "health" }), /OPERATION_DENIED/);
  for (const operation of ["incidents", "evidence", "evidence.media", "archive", "deep-link", "product-link"]) {
    dependencies.grant.permissions.push(operation);
    await assert.rejects(read({ operation, sourceId: "camera-a" }), /OPERATION_DENIED/);
  }
  assert.equal(sourceQueries.length, 0);
  dependencies.grant.permissions.push("camera_health.read");
  dependencies.principal.permissions.pop();
  await assert.rejects(read({ operation: "health" }), /OPERATION_DENIED/);
  dependencies.principal.permissions.push("camera_health.read");
  assert.deepEqual(await read({ operation: "health" }), {
    data: [{ camera_id: "camera-a", health_status: "healthy", last_seen_at: "2026-11-27T09:59:00Z" }],
    pagination: { limit: 1, next_cursor: null },
  });
  assert.equal(sourceQueries.length, 1);
  assert.deepEqual(sourceQueries[0].columns, ["id", "siteId", "healthStatus", "lastSeenAt"]);
  assert.equal(siteQueries.length, 0);
});

test("an unexpected row or scoped reader error never sends data through the broader Site reader", async () => {
  const { read, dependencies, siteQueries } = fixture();
  dependencies.readSource = async () => ({ id: "camera-b", siteId: "site", displayName: "sibling" });
  assert.deepEqual(await read({ operation: "inventory" }), { data: [], pagination: { limit: 1, next_cursor: null } });
  await assert.rejects(read({ operation: "detail", sourceId: "camera-a" }), /CAMERA_NOT_FOUND/);
  dependencies.readSource = async () => { throw new Error("FIXTURE_READER_UNAVAILABLE"); };
  await assert.rejects(read({ operation: "inventory" }), /FIXTURE_READER_UNAVAILABLE/);
  assert.equal(siteQueries.length, 0);
});
