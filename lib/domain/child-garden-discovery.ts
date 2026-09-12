import type { SupabaseClient } from "@supabase/supabase-js";
import { guardianCanAccessChild } from "@/lib/management/family-link";

export type DiscoveryFilters = { city?: string | null; query?: string | null; evaluationDate?: string | null };

/** Canonical GB-M14 matching boundary. It does not mutate capacity or enrollment state. */
export async function findEligibleGardensForChild(
  supabase: SupabaseClient,
  parentProfileId: string,
  childFileId: string,
  filters: DiscoveryFilters = {}
) {
  if (!await guardianCanAccessChild(supabase, parentProfileId, childFileId)) {
    return { kind: "denied" as const, matches: [] };
  }
  const result = await supabase.rpc("find_child_garden_matches" as never, {
    target_child_file_id: childFileId,
    target_city: filters.city?.trim() || null,
    target_query: filters.query?.trim() || null,
    evaluation_date: filters.evaluationDate || new Date().toISOString().slice(0, 10)
  } as never);
  if (result.error) return { kind: "error" as const, error: result.error, matches: [] };
  return { kind: "ok" as const, matches: (result.data ?? []) as Array<Record<string, unknown>> };
}
