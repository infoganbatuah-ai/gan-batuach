import type { SupabaseClient } from "@supabase/supabase-js";
import { kindergartenAgeGroups, type KindergartenAgeGroupKey } from "@/lib/domain/kindergarten-onboarding";
import { guardianCanAccessChild } from "@/lib/management/family-link";

export type DiscoveryFilters = {
  city?: string | null;
  query?: string | null;
  ageGroup?: KindergartenAgeGroupKey;
  evaluationDate?: string | null;
};

export function discoveryAgeGroup(value: unknown): KindergartenAgeGroupKey | undefined {
  return kindergartenAgeGroups.find(({ key }) => key === value)?.key;
}

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
  if (result.error?.code === "22023" && result.error.message === "child_discovery_birth_date_required") {
    return { kind: "birth_date_required" as const, matches: [] };
  }
  if (result.error) return { kind: "error" as const, error: result.error, matches: [] };
  const matches = (result.data ?? []) as Array<Record<string, unknown>>;
  const ageGroup = filters.ageGroup;
  // Narrow the Garden list using classrooms already matched to this Child.
  // The canonical Garden status, capacity and enrollment context still apply.
  return {
    kind: "ok" as const,
    matches: ageGroup ? matches.filter(({ matching_classrooms }) =>
      Array.isArray(matching_classrooms) && matching_classrooms.some((room) => room?.age_group_key === ageGroup)
    ) : matches
  };
}
