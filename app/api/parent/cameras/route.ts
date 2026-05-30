import { requireRole } from "@/lib/auth";
import { getParentCameraListForProfile } from "@/lib/domain/parent-camera-list";
import { createClient } from "@/lib/supabase/server";
import { handleRouteError, ok } from "@/lib/api";

export async function GET() {
  try {
    const { profile } = await requireRole(["parent"]);
    const supabase = await createClient();
    const result = await getParentCameraListForProfile(supabase as any, profile);
    return ok({
      cameras: result.cameras,
      debug: result.debug,
      scope: {
        parentRecordIds: result.scope.parentIds,
        childIds: result.scope.children.map((child: any) => child.id),
        childGardenIds: result.scope.childGardenIds,
        directParentGardenIds: result.scope.directParentGardenIds,
        profileGardenIds: result.scope.profileGardenIds,
        allowedKindergartenIds: result.scope.kindergartenIds
      }
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
