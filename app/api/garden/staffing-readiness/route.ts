import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getManagementGardenContext } from "@/lib/management/garden-context";
import { createClient } from "@/lib/supabase/server";

const querySchema = z.object({ classroom_id: z.string().uuid(), date: z.string().date().optional(), child_delta: z.coerce.number().int().min(-1000).max(1000).default(0) });

export async function GET(request: Request) {
  try {
    const access = await getManagementGardenContext();
    if (!access.allowed) return access.response;
    const url = new URL(request.url);
    const query = querySchema.parse({ classroom_id: url.searchParams.get("classroom_id"), date: url.searchParams.get("date") ?? undefined, child_delta: url.searchParams.get("child_delta") ?? 0 });
    const supabase = await createClient();
    const room = await supabase.from("classrooms" as never).select("id").eq("id", query.classroom_id).eq("garden_id", access.gardenId).maybeSingle();
    if (!room.data) return fail("הכיתה לא נמצאה בגן שנבחר", 404);
    const [current, projected] = await Promise.all([
      supabase.rpc("evaluate_classroom_staffing" as never, { target_classroom_id: query.classroom_id, evaluation_date: query.date ?? new Date().toISOString().slice(0,10), projected_child_delta: 0 } as never),
      supabase.rpc("evaluate_classroom_staffing" as never, { target_classroom_id: query.classroom_id, evaluation_date: query.date ?? new Date().toISOString().slice(0,10), projected_child_delta: query.child_delta } as never)
    ]);
    if (current.error || projected.error) return fail("לא ניתן לחשב את מוכנות כוח האדם", 409);
    return ok({ garden_id: access.gardenId, current_compliance: current.data, projected_compliance: projected.data });
  } catch (error) { return handleSafeRouteError(error); }
}
