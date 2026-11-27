export function guardHistoryPrivacyRestricted(site: {
  site_type?: unknown;
  garden_id?: unknown;
  business_handles_children?: unknown;
  vision_privacy_mode?: unknown;
}) {
  return (site.site_type !== "home" && site.site_type !== "business") ||
    Boolean(site.garden_id) || site.business_handles_children === true ||
    site.vision_privacy_mode === "skeleton_only";
}
