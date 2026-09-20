import { fail, handleRouteError, ok } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { getOperationalRoleContext } from "@/lib/management/operational-role";
import { getManagementGardenContext } from "@/lib/management/garden-context";
import { createClient } from "@/lib/supabase/server";
import { staffShiftSchema } from "@/lib/validation";

export async function GET() {
  try {
    const session = await getSessionProfile();
    if (!session.user || !session.profile) return fail("נדרשת התחברות.", 401);
    const supabase = await createClient();
    if (session.profile.role === "staff") {
      const access = await getOperationalRoleContext(["staff"]);
      if (!access.allowed) return access.response;
      const employment = access.employment!;
      const { data, error } = await supabase.from("staff_shifts" as never).select("id,staff_id,garden_id,employment_id,classroom_id,shift_date,planned_start,planned_end,actual_start,actual_end,status,total_minutes,approved_at,review_reason" as never)
        .eq("garden_id", employment.garden_id).eq("staff_id", employment.staff_id).order("shift_date", { ascending: false }).limit(120);
      if (error) return fail("לא ניתן לטעון משמרות.", 503);
      return ok(data);
    }
    const access = await getManagementGardenContext();
    if (!access.allowed) return access.response;
    const { data, error } = await supabase.from("staff_shifts" as never).select("id,staff_id,garden_id,employment_id,classroom_id,shift_date,planned_start,planned_end,actual_start,actual_end,status,total_minutes,approved_at,review_reason" as never)
      .eq("garden_id", access.gardenId).order("shift_date", { ascending: false }).limit(120);
    if (error) return fail("לא ניתן לטעון משמרות.", 503);
    return ok(data);
  } catch (error) { return handleRouteError(error); }
}

export async function POST(request: Request) {
  try {
    const access = await getManagementGardenContext();
    if (!access.allowed) return access.response;
    const input = staffShiftSchema.parse(await request.json());
    if (input.garden_id !== access.gardenId) return fail("אין הרשאה למשמרת בגן אחר.", 403);
    const supabase = await createClient();
    const { data, error } = input.classroom_id
      ? await supabase.rpc("management_schedule_staff_shift" as never, {
        p_staff_id: input.staff_id, p_garden_id: input.garden_id, p_shift_date: input.shift_date,
        p_start: input.planned_start, p_end: input.planned_end, p_classroom_id: input.classroom_id
      } as never)
      : await supabase.rpc("schedule_staff_employment_shift" as never, {
        target_staff_id: input.staff_id, target_garden_id: input.garden_id, target_shift_date: input.shift_date,
        target_start: input.planned_start, target_end: input.planned_end
      } as never);
    if (error) return fail(error.message === "staff_scheduling_conflict" ? "לעובד/ת יש משמרת חופפת במועד זה." : "לא ניתן לשמור משמרת או שההעסקה אינה פעילה.", error.message === "staff_scheduling_conflict" ? 409 : 400);
    return ok(data);
  } catch (error) { return handleRouteError(error); }
}
