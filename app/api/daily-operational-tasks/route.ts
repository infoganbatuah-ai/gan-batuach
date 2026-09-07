import { z } from "zod";
import { handleRouteError, ok } from "@/lib/api";
import { getOperationalRoleContext } from "@/lib/management/operational-role";
import { createClient } from "@/lib/supabase/server";

const completeSchema = z.object({
  operational_task_id: z.string().uuid(),
  garden_id: z.string().uuid().optional(),
  completed_for_date: z.string().optional(),
  notes: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const access = await getOperationalRoleContext(["manager", "owner", "staff"]);
    if (!access.allowed) return access.response;
    const { profile } = access.session;
    const payload = completeSchema.parse(await request.json());
    const supabase = await createClient();
    const { data, error } = await supabase.from("daily_task_completions").upsert({
      operational_task_id: payload.operational_task_id,
      garden_id: payload.garden_id ?? profile.garden_id,
      completed_by: profile.id,
      completed_by_role: profile.role,
      completed_for_date: payload.completed_for_date ?? new Date().toISOString().slice(0, 10),
      notes: payload.notes ?? null,
      status: "done"
    }, { onConflict: "operational_task_id,completed_for_date,completed_by" }).select("*").single();
    if (error) throw new Error(error.message);
    return ok(data, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
