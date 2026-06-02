import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { getParentFamilyContext } from "@/lib/domain/parent-family";
import { getParentRequestRecipients } from "@/lib/domain/parent-request-routing";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { profile } = await requireRole(["parent"]);
    const supabase = await createClient();
    const url = new URL(request.url);
    const childId = url.searchParams.get("child_id");
    if (!childId) return fail("child_id is required", 422);
    const family = await getParentFamilyContext(supabase as any, profile);
    const enrollment = family.enrollments.find((item: any) => item.child_id === childId || item.permanent_child_file_id === childId);
    if (!enrollment?.garden_id) return fail("אין הרשאה לילד או שלא נמצא גן משויך", 403);
    const garden = family.gardens.find((item: any) => item.id === enrollment.garden_id);
    const recipients = await getParentRequestRecipients(supabase as any, enrollment.garden_id);
    return ok({
      child_id: childId,
      child_name: enrollment.full_name,
      garden_id: enrollment.garden_id,
      garden_name: garden?.name ?? "גן ילדים",
      recipients
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
