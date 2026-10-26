// This narrower registration gate mirrors the review-only database trigger.
// General Observer manage access also permits global administrators and
// organization permissions; neither proves this installation's Site binding.
type PushRegistrationDatabase = {
  // The proposed trigger is not represented in generated client types yet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

type RegistrationSite = {
  id: string;
  active: boolean;
  site_type: string;
  garden_id: string | null;
  owner_profile_id: string | null;
};

export async function getObserverPushRegistrationSite(
  db: PushRegistrationDatabase, profileId: string, requestedSiteId: string
): Promise<RegistrationSite | null> {
  if (!profileId || !requestedSiteId) return null;
  const siteResult = await db.from("observer_sites")
    .select("id,active,site_type,garden_id,owner_profile_id")
    .eq("id", requestedSiteId).maybeSingle();
  const site = siteResult.data as RegistrationSite | null;
  if (siteResult.error || !site || site.id !== requestedSiteId || site.active !== true
    || typeof site.site_type !== "string" || site.site_type === "kindergarten"
    || site.garden_id !== null) return null;
  if (site.owner_profile_id === profileId) return site;
  const membership = await db.from("observer_site_memberships")
    .select("id,member_role").eq("observer_site_id", requestedSiteId)
    .eq("profile_id", profileId).eq("active", true)
    .in("member_role", ["owner", "admin", "operator"]).maybeSingle();
  return membership.error || !membership.data ? null : site;
}
