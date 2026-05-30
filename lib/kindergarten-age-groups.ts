export type KindergartenAgeGroup = {
  id?: string;
  label: string;
  age_range?: string | null;
  monthly_fee?: number | null;
  show_price_public?: boolean | null;
  capacity?: number | null;
  source: "fee_group" | "garden_settings" | "framework";
};

export async function getKindergartenAgeGroups(supabase: any, gardenId?: string | null, garden?: any): Promise<KindergartenAgeGroup[]> {
  if (!gardenId && !garden) return [];
  const feeGroups = gardenId
    ? await supabase.from("kindergarten_fee_groups" as any).select("id, group_name, age_range, monthly_fee, show_price_public, capacity, active").eq("garden_id", gardenId).eq("active", true).order("group_name")
    : { data: [] };

  const fromFeeGroups = ((feeGroups.data ?? []) as any[])
    .filter((group) => group.group_name)
    .map((group) => ({
      id: group.id,
      label: group.group_name,
      age_range: group.age_range,
      monthly_fee: group.monthly_fee,
      show_price_public: group.show_price_public,
      capacity: group.capacity,
      source: "fee_group" as const
    }));
  if (fromFeeGroups.length) return fromFeeGroups;

  const ageSettings = Array.isArray(garden?.ages) ? garden.ages : [];
  const fromGardenSettings = ageSettings
    .filter(Boolean)
    .map((label: string) => ({ label, age_range: null, monthly_fee: null, source: "garden_settings" as const }));
  if (fromGardenSettings.length) return fromGardenSettings;

  if (garden?.framework_type) {
    return [{ label: String(garden.framework_type), age_range: null, monthly_fee: null, source: "framework" }];
  }

  return [];
}

export function formatAgeGroups(groups: KindergartenAgeGroup[]) {
  if (!groups.length) return "הגן עדיין לא הגדיר קבוצות גיל";
  return groups.map((group) => group.age_range ? `${group.label} (${group.age_range})` : group.label).join(", ");
}

export function formatPublicPriceRange(groups: KindergartenAgeGroup[]) {
  const visiblePrices = groups
    .filter((group) => group.show_price_public && Number(group.monthly_fee ?? 0) > 0)
    .map((group) => Number(group.monthly_fee ?? 0));
  if (!visiblePrices.length) return "מחיר יוצג לאחר פנייה לגן";
  return `החל מ־₪${Math.min(...visiblePrices).toLocaleString("he-IL")} לחודש`;
}
