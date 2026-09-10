import type { SupabaseClient } from "@supabase/supabase-js";

export type GuardianRelationship = "mother" | "father" | "parent" | "guardian" | "foster_parent" | "legal_representative";

export async function guardianChildIds(supabase: SupabaseClient, guardianProfileId: string) {
  const result = await supabase.from("child_guardian_links").select("permanent_child_file_id,access_scope,valid_until")
    .eq("guardian_profile_id", guardianProfileId).eq("status", "active").eq("legal_authority", true);
  if (result.error) throw new Error(result.error.message);
  const now = Date.now();
  return (result.data ?? []).filter(row => {
    const scope = row.access_scope as Record<string, unknown> | null;
    return scope?.profile === true && (!row.valid_until || new Date(row.valid_until as string).getTime() > now);
  }).map(row => row.permanent_child_file_id as string);
}

export async function guardianCanAccessChild(supabase: SupabaseClient, guardianProfileId: string, childFileId: string) {
  const result = await supabase.from("child_guardian_links").select("id,access_scope,valid_until")
    .eq("guardian_profile_id", guardianProfileId).eq("permanent_child_file_id", childFileId)
    .eq("status", "active").eq("legal_authority", true).maybeSingle();
  if (result.error) throw new Error(result.error.message);
  if (!result.data) return false;
  const scope = result.data.access_scope as Record<string, unknown> | null;
  return scope?.profile === true && (!result.data.valid_until || new Date(result.data.valid_until as string).getTime() > Date.now());
}

export async function ensurePrimaryGuardianLink(supabase: SupabaseClient, input: { childFileId: string; guardianProfileId: string; source: string }) {
  const result = await supabase.from("child_guardian_links").upsert({
    permanent_child_file_id: input.childFileId,
    guardian_profile_id: input.guardianProfileId,
    relationship_type: "parent",
    is_primary: true,
    legal_authority: true,
    status: "active",
    verified_at: new Date().toISOString(),
    source: input.source
  }, { onConflict: "permanent_child_file_id,guardian_profile_id" });
  if (result.error) throw new Error(result.error.message);
}
