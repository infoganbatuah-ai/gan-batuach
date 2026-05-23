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
      .select("*, camera_streams(*)")
      .eq("parent_id", parentId)
      .eq("allowed", true);
    if (error) return fail(error.message, 400);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
