const operationPermission = {
  inventory: "cameras.read",
  detail: "cameras.read",
  health: "camera_health.read",
};
const inventoryColumns = ["id", "siteId", "displayName", "locationLabel"];
const healthColumns = ["id", "siteId", "healthStatus", "lastSeenAt"];

function ownsCurrentSource(grant, current) {
  return current && grant.tenantId === current.tenantId && grant.siteId === current.siteId &&
    grant.sourceId === current.sourceId && grant.siteEpoch === current.siteEpoch && grant.sourceEpoch === current.sourceEpoch;
}

// This model assumes verified session/account, Site, grant and ownership facts
// supplied by trusted readers. It performs no persistence or runtime routing.
export async function readCameraModel({ principal, grant, current, request, now, readSource, readSite }) {
  if (!principal.active || !principal.siteAuthorized || request.siteId !== principal.siteId) throw new Error("SITE_DENIED");
  if (principal.mode === "site") return readSite(request);
  if (principal.mode !== "source_restricted" || !grant || grant.accountId !== principal.accountId ||
    grant.tenantId !== principal.tenantId || grant.siteId !== principal.siteId || grant.revokedAt !== null ||
    !Number.isFinite(grant.expiresAt) || !(now < grant.expiresAt) || !ownsCurrentSource(grant, current)) {
    throw new Error("SOURCE_GRANT_DENIED");
  }

  const { operation, sourceId, cursor, limit = 1 } = request;
  if (!Object.hasOwn(operationPermission, operation)) throw new Error("OPERATION_DENIED");
  const required = operation === "health" ? ["cameras.read", operationPermission.health] : [operationPermission[operation]];
  if (!required.every((permission) => principal.permissions.includes(permission) && grant.permissions.includes(permission))) {
    throw new Error("OPERATION_DENIED");
  }
  // Exactly one granted source fits the initial page. No incoming continuation
  // is accepted, including a cursor issued in the wider Site mode.
  if (cursor !== undefined || !Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("PAGE_DENIED");
  const pagination = { limit, next_cursor: null };
  if (operation === "detail" && sourceId !== grant.sourceId) throw new Error("CAMERA_NOT_FOUND");
  if (sourceId !== undefined && sourceId !== grant.sourceId) return { data: [], pagination };

  const row = await readSource({
    tenantId: grant.tenantId, siteId: grant.siteId, sourceId: grant.sourceId,
    siteEpoch: grant.siteEpoch, sourceEpoch: grant.sourceEpoch,
    columns: operation === "health" ? healthColumns : inventoryColumns,
  });
  if (!row || row.id !== grant.sourceId || row.siteId !== grant.siteId) {
    if (operation === "detail") throw new Error("CAMERA_NOT_FOUND");
    return { data: [], pagination };
  }
  if (operation === "health") {
    return { data: [{ camera_id: row.id, health_status: row.healthStatus, last_seen_at: row.lastSeenAt }],
      pagination };
  }
  const camera = { id: row.id, display_name: row.displayName, location_label: row.locationLabel };
  return operation === "detail" ? { camera } : { data: [camera], pagination };
}
