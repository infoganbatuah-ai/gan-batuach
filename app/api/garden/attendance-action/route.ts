import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getOperationalRoleContext } from "@/lib/management/operational-role";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  child_id: z.string().uuid(),
  action: z.enum(["check_in", "check_out", "mark_absent", "correct_to_present"]),
  reason: z.string().max(500).optional()
});

export async function POST(request: Request) {
  try {
    const access = await getOperationalRoleContext(["manager", "owner", "staff"]);
    if (!access.allowed) return access.response;
    const { profile } = access.session;
    if (!profile.garden_id) return fail("לא נמצא גן משויך למשתמש", 422);

    const payload = schema.parse(await request.json());
    if (payload.action === "check_out") return fail("שחרור ילד מחייב בחירת מורשה איסוף ואישור צוות במסך האיסוף.", 422);
    const supabase = await createClient();
    const result = payload.action === "check_in"
      ? await supabase.rpc("management_child_arrival", {
          p_garden_id: profile.garden_id,
          p_child_id: payload.child_id
        })
      : await supabase.rpc("management_child_absence", {
          p_garden_id: profile.garden_id,
          p_child_id: payload.child_id,
          p_action: payload.action,
          p_reason: payload.reason ?? null
        });
    if (result.error) return fail("רישום הגעת הילד נכשל או שאין הרשאה מתאימה.", result.error.code === "42501" ? 403 : 409);
    return ok({ attendance: result.data });
  } catch (error) {
    return handleRouteError(error);
  }
}
