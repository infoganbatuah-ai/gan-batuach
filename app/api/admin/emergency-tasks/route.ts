import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleRouteError, ok } from "@/lib/api";
import { emergencyTaskSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    await requireRole(["admin"]);
    const payload = emergencyTaskSchema.parse(await request.json());
    const supabase = createAdminClient();
    const { data: gardens, error } = payload.garden_id
      ? await supabase.from("gardens").select("id, manager_id").eq("id", payload.garden_id)
      : await supabase.from("gardens").select("id, manager_id").eq("status", "active");
    if (error) throw new Error(error.message);
    const rows = (gardens ?? []).map((garden: any) => ({
      garden_id: garden.id,
      title: payload.title,
      description: payload.description,
      assigned_to: garden.manager_id,
      due_at: payload.due_at,
      task_type: "emergency",
      priority: payload.priority,
      status: "open"
    }));
    const { data, error: insertError } = await supabase.from("tasks").insert(rows as any).select("*");
    if (insertError) throw new Error(insertError.message);
    return ok(data, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
