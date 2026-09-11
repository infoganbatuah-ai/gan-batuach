import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { chooseActiveGarden, type ManagementGarden } from "@/lib/management/garden-selection";

export const ACTIVE_GARDEN_COOKIE = "gb_active_garden";

export async function resolveManagementGardenContext(profile: { id: string; garden_id?: string | null }) {
  const supabase = await createClient();
  const result = await supabase.rpc("management_gardens_for_current_user");
  if (result.error) return { available: false as const, gardens: [] as ManagementGarden[], activeGarden: null };
  const gardens = ((result.data ?? []) as Array<Record<string, unknown>>).map(row => ({
    id: String(row.garden_id),
    name: String(row.garden_name || "גן ללא שם"),
    relationshipRole: row.relationship_role === "owner" ? "owner" as const : "manager" as const,
    isDefault: row.is_default === true
  }));
  const cookieStore = await cookies();
  const requestedId = cookieStore.get(ACTIVE_GARDEN_COOKIE)?.value ?? null;
  return { available: true as const, gardens, activeGarden: chooseActiveGarden(gardens, requestedId, profile.garden_id ?? null) };
}
