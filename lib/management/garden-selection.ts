export type ManagementGarden = { id: string; name: string; relationshipRole: "owner" | "manager"; isDefault: boolean };

export function chooseActiveGarden(gardens: ManagementGarden[], requestedId: string | null, legacyDefaultId: string | null) {
  if (requestedId) return gardens.find(garden => garden.id === requestedId) ?? null;
  const explicitDefault = gardens.find(garden => garden.isDefault);
  if (explicitDefault) return explicitDefault;
  if (legacyDefaultId) {
    const legacy = gardens.find(garden => garden.id === legacyDefaultId);
    if (legacy) return legacy;
  }
  return gardens.length === 1 ? gardens[0] : null;
}
