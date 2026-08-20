import { requireRole } from "@/lib/auth";
import { getParentCameraListForProfile } from "@/lib/domain/parent-camera-list";
import { createClient } from "@/lib/supabase/server";
import { handleRouteError, ok } from "@/lib/api";

export async function GET(request: Request) {
  try {
    const { profile } = await requireRole(["parent"]);
    const supabase = await createClient();
    const result = await getParentCameraListForProfile(supabase as any, profile);
    const url = new URL(request.url);
    const allowDebug = url.searchParams.get("debug") === "1" && (process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_SANDBOX_MODE === "true");
    const payload: Record<string, unknown> = {
      cameras: result.cameras,
      meta: {
        cameras_count: result.cameras.length,
        has_kindergarten_assignment: result.scope.kindergartenIds.length > 0
      }
    };
    if (allowDebug) {
      payload.debug = {
        candidateCameraCount: result.debug.candidateCamerasCount,
        allowedCameraCount: result.debug.allowedCamerasCount,
        deniedCameraCount: Math.max(0, result.debug.candidateCamerasCount - result.debug.allowedCamerasCount)
      };
      payload.scope = {
        parentRecordCount: result.scope.parentIds.length,
        childCount: result.scope.children.length,
        allowedKindergartenCount: result.scope.kindergartenIds.length
      };
    }
    return ok(payload);
  } catch (error) {
    return handleRouteError(error);
  }
}
