import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type ObserverAccessProfile = {
  id: string;
  role?: string | null;
};

export async function getObserverSiteAccess(
  supabase: SupabaseClient,
  profile: ObserverAccessProfile,
  observerSiteId: string,
  options: { manage?: boolean; billing?: boolean } = {}
) {
  const { data: site } = await supabase
    .from("observer_sites" as any)
    .select("id,name,site_type,owner_profile_id,garden_id,monitoring_enabled,metadata")
    .eq("id", observerSiteId)
    .maybeSingle();

  if (!site || site.site_type === "kindergarten" || site.garden_id) return null;
  if (profile.role === "admin" || site.owner_profile_id === profile.id) return site;

  const allowedRoles = options.billing
    ? ["owner", "admin", "billing"]
    : options.manage
      ? ["owner", "admin", "operator"]
      : ["owner", "admin", "operator", "viewer", "billing"];
  const { data: membership } = await supabase
    .from("observer_site_memberships" as any)
    .select("id,member_role")
    .eq("observer_site_id", observerSiteId)
    .eq("profile_id", profile.id)
    .eq("active", true)
    .in("member_role", allowedRoles)
    .maybeSingle();

  return membership ? site : null;
}

export function safeObserverReturnPath(value?: string | null) {
  if (!value || !value.startsWith("/digital-observer") || value.startsWith("//")) {
    return "/digital-observer/dashboard";
  }
  return value;
}
