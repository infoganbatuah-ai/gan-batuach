type GardenRow = { garden_id?: unknown; kindergarten_id?: unknown; status?: unknown };

function gardenId(row: GardenRow) {
  const value = row.garden_id ?? row.kindergarten_id;
  return typeof value === "string" ? value : "";
}

export function parentTrustGardenIds(family: { links: GardenRow[]; enrollments: GardenRow[]; gardenIds: string[]; sourceUnavailable: boolean }) {
  if (family.sourceUnavailable) return [];
  const active = [...family.links, ...family.enrollments]
    .filter((row) => ["active", "approved"].includes(String(row.status)))
    .map(gardenId).filter(Boolean);
  const ids = [...new Set(active)].filter((id) => family.gardenIds.includes(id));
  return ids;
}

export function resolveParentTrustGarden(requested: string | null | undefined, eligible: string[]) {
  if (requested) return eligible.includes(requested) ? requested : null;
  return eligible.length === 1 ? eligible[0] : null;
}

export function belongsToParentTrustGarden(row: { garden_id?: unknown } | null, gardenId: string, globalAllowed = false) {
  return Boolean(row && (row.garden_id === gardenId || (globalAllowed && row.garden_id == null)));
}
