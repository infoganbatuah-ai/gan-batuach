import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fail, handleRouteError, ok } from "@/lib/api";

export async function GET(request: Request) {
  try {
    await requireRole(["parent"]);
    const parentId = new URL(request.url).searchParams.get("parent_id");
    if (!parentId) return fail("parent_id is required", 422);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("parent_camera_permissions")
      .select("id,parent_id,camera_stream_id,garden_id,allowed,valid_from,valid_until,reason,created_at,camera_streams(id,garden_id,kindergarten_id,name,area,age_group,class_group,camera_type,source_type,protocol,status,active,parent_view_allowed,parent_viewing_allowed,hls_playback_url,sample_hls_url,webrtc_playback_url,video_gateway_stream_id,gateway_stream_id,viewing_hours,last_health_check_at)")
      .eq("parent_id", parentId)
      .eq("allowed", true);
    if (error) return fail(error.message, 400);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
