import { requireRole } from "@/lib/auth";
import { canParentViewCamera, getCameraGardenId, resolveParentCameraScope } from "@/lib/domain/parent-camera-access";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { fail, handleRouteError, ok } from "@/lib/api";

export async function GET() {
  try {
    const { profile } = await requireRole(["parent"]);
    const userSupabase = await createClient();
    const supabase = isAdminClientConfigured() ? createAdminClient() : userSupabase;
    const scope = await resolveParentCameraScope(supabase as any, profile as any);
    if (!scope.kindergartenIds.length) return ok([]);

    const selectColumns = "id, garden_id, kindergarten_id, name, area, age_group, class_group, camera_type, source_type, protocol, status, active, parent_view_allowed, parent_viewing_allowed, hls_playback_url, sample_hls_url, webrtc_playback_url, video_gateway_stream_id, gateway_stream_id, viewing_hours, last_health_check_at";
    const [byGardenId, byKindergartenId] = await Promise.all([
      supabase.from("camera_streams" as any).select(selectColumns).in("garden_id", scope.kindergartenIds),
      supabase.from("camera_streams" as any).select(selectColumns).in("kindergarten_id", scope.kindergartenIds)
    ]);
    if ((byGardenId as any).error) console.error("Parent cameras API garden_id query failed", (byGardenId as any).error);
    if ((byKindergartenId as any).error) console.error("Parent cameras API kindergarten_id query failed", (byKindergartenId as any).error);
    const cameras = [...(((byGardenId as any).data ?? []) as any[]), ...(((byKindergartenId as any).data ?? []) as any[])]
      .filter((camera, index, all) => camera?.id && all.findIndex((item) => item?.id === camera.id) === index);
    const decisions = await Promise.all(cameras.map((camera) => canParentViewCamera(supabase as any, profile.id, camera.id)));
    const allowedIds = new Set(decisions.filter((decision) => decision.allowed).map((decision) => decision.diagnostics.camera_id));
    return ok(cameras.filter((camera) => allowedIds.has(camera.id)).map((camera) => ({ ...camera, camera_garden_id: getCameraGardenId(camera) })));
  } catch (error) {
    return handleRouteError(error);
  }
}
