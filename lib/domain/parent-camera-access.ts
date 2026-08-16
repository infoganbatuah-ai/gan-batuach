import type { SupabaseClient } from "@supabase/supabase-js";

type QueryResult = { data?: any[] | null; error?: any };
type ParentProfile = { id: string; garden_id?: string | null; email?: string | null; role?: string | null };

export type ParentCameraAccessDecision = {
  allowed: boolean;
  reason: string;
  diagnostics: {
    parent_profile_found: boolean;
    parent_profile_id: string | null;
    parent_email: string | null;
    parent_records_found: any[];
    linked_children_found: any[];
    child_garden_ids: string[];
    direct_parent_garden_ids: string[];
    profile_garden_ids: string[];
    final_allowed_garden_ids: string[];
    fallback_parent_garden_ids: string[];
    direct_kindergarten_assignment_found: boolean;
    child_relation_found: boolean;
    camera_found: boolean;
    camera_id: string | null;
    camera_name: string | null;
    camera_garden_id: string | null;
    camera_garden_id_fields: {
      garden_id: string | null;
      kindergarten_id: string | null;
    };
    parent_view_allowed: boolean | null;
    parent_viewing_allowed: boolean | null;
    parent_viewing_enabled: boolean;
    active: boolean | null;
    status: string | null;
    sample_hls_url_exists: boolean;
    hls_playback_url_exists: boolean;
    webrtc_playback_url_exists: boolean;
    gateway_stream_id_exists: boolean;
    final_allow: boolean;
    deny_reason: string | null;
  };
};

function uniq(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

function isTruthyFlag(value: unknown) {
  return value === true || value === 1 || value === "1" || String(value).toLowerCase() === "true" || String(value).toLowerCase() === "yes";
}

function cameraDebugLogsEnabled() {
  return process.env.NODE_ENV !== "production";
}

function log(label: string, payload: Record<string, unknown>) {
  if (!cameraDebugLogsEnabled()) return;
  console.info(`Parent camera access: ${label}`, payload);
}

async function safeQuery(label: string, run: () => any) {
  try {
    const result = await run();
    if (result.error && cameraDebugLogsEnabled()) console.info(`Parent camera access optional query failed: ${label}`, result.error);
    return result.error ? [] : (result.data ?? []);
  } catch (error) {
    if (cameraDebugLogsEnabled()) console.info(`Parent camera access optional query failed: ${label}`, error);
    return [];
  }
}

export async function resolveParentCameraScope(supabase: SupabaseClient<any, any, any>, profile: { id: string; garden_id?: string | null; email?: string | null }) {
  const parentByProfile = await safeQuery("parents.profile_id", () => supabase.from("parents" as any).select("id, garden_id, profile_id, full_name, email").eq("profile_id", profile.id));
  const parentByUser = await safeQuery("parents.user_id", () => supabase.from("parents" as any).select("id, garden_id, user_id, full_name, email").eq("user_id", profile.id));
  const parentRows = [...parentByProfile, ...parentByUser]
    .filter((row, index, all) => all.findIndex((item) => item.id === row.id) === index);
  const parentIds = uniq(parentRows.map((parent) => parent.id));
  const parentKindergartenLinks = await safeQuery("parent_kindergarten_links", () => supabase
    .from("parent_kindergarten_links" as any)
    .select("id, parent_id, parent_profile_id, garden_id, kindergarten_id, status")
    .or(`parent_profile_id.eq.${profile.id}${parentIds.length ? `,parent_id.in.(${parentIds.join(",")})` : ""}`)
    .in("status", ["pending", "active"]));

  const children = parentIds.length
    ? await safeQuery("children.primary_parent_id", () => supabase.from("children" as any).select("id, full_name, garden_id, primary_parent_id, gardens(id, name, city)").in("primary_parent_id", parentIds))
    : [];
  const childGardenIds = uniq(children.map((child: any) => child.garden_id));
  const directParentGardenIds = uniq(parentRows.map((parent) => parent.garden_id));
  const linkedGardenIds = uniq(parentKindergartenLinks.flatMap((link: any) => [link.garden_id, link.kindergarten_id]));
  const profileGardenIds = uniq([profile.garden_id]);
  const kindergartenIds = uniq([...childGardenIds, ...directParentGardenIds, ...linkedGardenIds, ...profileGardenIds]);

  log("resolved", {
    parentProfileId: profile.id,
    parentRecordIds: parentIds,
    childIds: children.map((child: any) => child.id),
    childKindergartenIds: childGardenIds,
    directParentGardenIds,
    linkedGardenIds,
    profileGardenIds,
    finalAllowedGardenIds: kindergartenIds
  });

  return { parentRows, parentIds, children, childGardenIds, directParentGardenIds, profileGardenIds, kindergartenIds };
}

export function getCameraGardenId(camera: any) {
  return (camera?.garden_id ?? camera?.kindergarten_id ?? null) as string | null;
}

export function cameraParentViewingAllowed(camera: any) {
  return isTruthyFlag(camera?.parent_viewing_allowed) || isTruthyFlag(camera?.parent_view_allowed);
}

export function cameraHasParentPlayableSource(camera: any) {
  return Boolean(camera?.sample_hls_url || camera?.hls_playback_url || camera?.webrtc_playback_url || camera?.gateway_stream_id || camera?.video_gateway_stream_id);
}

export function cameraStatusAllowsParent(camera: any) {
  const status = String(camera?.status ?? "").toLowerCase();
  return camera?.active !== false && camera?.active !== "false" && camera?.active !== 0 && !["disabled", "deleted"].includes(status);
}

export function cameraCanBeListedForParent(camera: any) {
  const status = String(camera?.status ?? "").toLowerCase();
  return cameraStatusAllowsParent(camera) && (cameraHasParentPlayableSource(camera) || ["pending_gateway", "pending", "connected", "online"].includes(status));
}

function buildDecision(profile: ParentProfile | null, scope: Awaited<ReturnType<typeof resolveParentCameraScope>> | null, camera: any, reason: string, allowed = false): ParentCameraAccessDecision {
  const cameraGardenId = getCameraGardenId(camera);
  const diagnostics = {
    parent_profile_found: Boolean(profile),
    parent_profile_id: profile?.id ?? null,
    parent_email: profile?.email ?? null,
    parent_records_found: scope?.parentRows ?? [],
    linked_children_found: scope?.children ?? [],
    child_garden_ids: scope?.childGardenIds ?? [],
    direct_parent_garden_ids: scope?.directParentGardenIds ?? [],
    profile_garden_ids: scope?.profileGardenIds ?? [],
    final_allowed_garden_ids: scope?.kindergartenIds ?? [],
    fallback_parent_garden_ids: scope ? uniq([...(scope.parentRows ?? []).map((parent: any) => parent.garden_id), profile?.garden_id]) : [],
    direct_kindergarten_assignment_found: Boolean((scope?.directParentGardenIds?.length ?? 0) || (scope?.profileGardenIds?.length ?? 0)),
    child_relation_found: Boolean(scope?.children?.length),
    camera_found: Boolean(camera),
    camera_id: camera?.id ?? null,
    camera_name: camera?.name ?? null,
    camera_garden_id: cameraGardenId,
    camera_garden_id_fields: {
      garden_id: camera?.garden_id ?? null,
      kindergarten_id: camera?.kindergarten_id ?? null
    },
    parent_view_allowed: camera?.parent_view_allowed ?? null,
    parent_viewing_allowed: camera?.parent_viewing_allowed ?? null,
    parent_viewing_enabled: cameraParentViewingAllowed(camera),
    active: camera?.active ?? null,
    status: camera?.status ?? null,
    sample_hls_url_exists: Boolean(camera?.sample_hls_url),
    hls_playback_url_exists: Boolean(camera?.hls_playback_url),
    webrtc_playback_url_exists: Boolean(camera?.webrtc_playback_url),
    gateway_stream_id_exists: Boolean(camera?.gateway_stream_id || camera?.video_gateway_stream_id),
    final_allow: allowed,
    deny_reason: allowed ? null : reason
  };
  return { allowed, reason, diagnostics };
}

export function evaluateParentCameraAccess(profile: ParentProfile, scope: Awaited<ReturnType<typeof resolveParentCameraScope>>, camera: any): ParentCameraAccessDecision {
  if (!profile?.id) return buildDecision(null, scope, camera, "parent_profile_not_found");
  if (!camera?.id) return buildDecision(profile, scope, camera, "camera_not_found");

  const cameraGardenId = getCameraGardenId(camera);
  if (!cameraGardenId) return buildDecision(profile, scope, camera, "camera_has_no_garden_id");
  if (!scope.kindergartenIds.length) return buildDecision(profile, scope, camera, "parent_not_linked_to_kindergarten");
  if (!scope.kindergartenIds.includes(cameraGardenId)) return buildDecision(profile, scope, camera, "parent_camera_garden_mismatch");
  if (!cameraParentViewingAllowed(camera)) return buildDecision(profile, scope, camera, "parent_viewing_not_enabled");
  if (!cameraStatusAllowsParent(camera)) return buildDecision(profile, scope, camera, "camera_inactive_or_disabled");
  if (!cameraCanBeListedForParent(camera)) return buildDecision(profile, scope, camera, "camera_has_no_parent_playback_source");

  return buildDecision(profile, scope, camera, "allowed", true);
}

export async function canParentViewCamera(supabase: SupabaseClient<any, any, any>, parentProfileId: string, cameraId: string) {
  const profileResult = await supabase.from("profiles" as any).select("id, email, garden_id, role").eq("id", parentProfileId).maybeSingle();
  if (profileResult.error) {
    if (cameraDebugLogsEnabled()) console.info("Parent camera access profile query failed", { parentProfileId, error: profileResult.error });
    return buildDecision(null, null, null, "parent_profile_query_failed");
  }
  const profile = profileResult.data as ParentProfile | null;
  if (!profile) return buildDecision(null, null, null, "parent_profile_not_found");

  const cameraResult = await supabase
    .from("camera_streams" as any)
    .select("id, garden_id, kindergarten_id, name, area, status, active, parent_view_allowed, parent_viewing_allowed, sample_hls_url, hls_playback_url, webrtc_playback_url, gateway_stream_id, video_gateway_stream_id")
    .eq("id", cameraId)
    .maybeSingle();
  if (cameraResult.error) {
    if (cameraDebugLogsEnabled()) console.info("Parent camera access camera query failed", { parentProfileId, cameraId, error: cameraResult.error });
    return buildDecision(profile, null, null, "camera_query_failed");
  }
  if (!cameraResult.data) return buildDecision(profile, null, null, "camera_not_found");

  const scope = await resolveParentCameraScope(supabase, profile);
  const decision = evaluateParentCameraAccess(profile, scope, cameraResult.data);
  if (cameraDebugLogsEnabled()) {
    console.info("Parent camera access decision", {
      parentProfileId,
      cameraId,
      allowed: decision.allowed,
      reason: decision.reason,
      parentRecordIds: decision.diagnostics.parent_records_found.map((parent: any) => parent.id),
      childIds: decision.diagnostics.linked_children_found.map((child: any) => child.id),
      childGardenIds: decision.diagnostics.child_garden_ids,
      directParentGardenIds: decision.diagnostics.direct_parent_garden_ids,
      profileGardenIds: decision.diagnostics.profile_garden_ids,
      finalAllowedGardenIds: decision.diagnostics.final_allowed_garden_ids,
      cameraGardenId: decision.diagnostics.camera_garden_id
    });
  }
  return decision;
}
