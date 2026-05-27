import type { SupabaseClient } from "@supabase/supabase-js";

type QueryResult = { data?: any[] | null; error?: any };

function uniq(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

function log(label: string, payload: Record<string, unknown>) {
  console.info(`Parent camera access: ${label}`, payload);
}

async function safeQuery(label: string, run: () => any) {
  try {
    const result = await run();
    if (result.error) console.info(`Parent camera access optional query failed: ${label}`, result.error);
    return result.error ? [] : (result.data ?? []);
  } catch (error) {
    console.info(`Parent camera access optional query failed: ${label}`, error);
    return [];
  }
}

export async function resolveParentCameraScope(supabase: SupabaseClient<any, any, any>, profile: { id: string; garden_id?: string | null; email?: string | null }) {
  const parentByProfile = await safeQuery("parents.profile_id", () => supabase.from("parents" as any).select("id, garden_id, profile_id, full_name, email").eq("profile_id", profile.id));
  const parentByUser = await safeQuery("parents.user_id", () => supabase.from("parents" as any).select("id, garden_id, user_id, full_name, email").eq("user_id", profile.id));
  const parentRows = [...parentByProfile, ...parentByUser].filter((row, index, all) => all.findIndex((item) => item.id === row.id) === index);
  const parentIds = uniq(parentRows.map((parent) => parent.id));

  const childQueries: any[] = [];
  if (parentIds.length) {
    childQueries.push(...await safeQuery("children.primary_parent_id", () => supabase.from("children" as any).select("id, full_name, garden_id, kindergarten_id, primary_parent_id, gardens(id, name, city)").in("primary_parent_id", parentIds)));
    childQueries.push(...await safeQuery("children.parent_id", () => supabase.from("children" as any).select("id, full_name, garden_id, kindergarten_id, parent_id, gardens(id, name, city)").in("parent_id", parentIds)));
    const childParentLinks = await safeQuery("child_parent_links", () => supabase.from("child_parent_links" as any).select("child_id, parent_id, children(id, full_name, garden_id, kindergarten_id, gardens(id, name, city))").in("parent_id", parentIds));
    childQueries.push(...childParentLinks.map((link: any) => link.children).filter(Boolean));
    const parentChildLinks = await safeQuery("parent_child_relations", () => supabase.from("parent_child_relations" as any).select("child_id, parent_id, children(id, full_name, garden_id, kindergarten_id, gardens(id, name, city))").in("parent_id", parentIds));
    childQueries.push(...parentChildLinks.map((link: any) => link.children).filter(Boolean));
  }

  const children = childQueries.filter((child, index, all) => child?.id && all.findIndex((item) => item?.id === child.id) === index);
  const childGardenIds = uniq(children.map((child) => child.garden_id ?? child.kindergarten_id));
  const parentGardenIds = uniq([...parentRows.map((parent) => parent.garden_id), profile.garden_id]);
  const kindergartenIds = childGardenIds.length ? childGardenIds : parentGardenIds;

  log("resolved", {
    parentProfileId: profile.id,
    parentRecordIds: parentIds,
    childIds: children.map((child) => child.id),
    childKindergartenIds: childGardenIds,
    fallbackKindergartenIds: childGardenIds.length ? [] : parentGardenIds
  });

  return { parentRows, parentIds, children, childGardenIds, kindergartenIds };
}

export function cameraParentViewingAllowed(camera: any) {
  return camera?.parent_viewing_allowed === true || camera?.parent_view_allowed === true;
}

export function cameraHasParentPlayableSource(camera: any) {
  return Boolean(camera?.sample_hls_url || camera?.hls_playback_url || camera?.webrtc_playback_url || camera?.gateway_stream_id || camera?.video_gateway_stream_id);
}
