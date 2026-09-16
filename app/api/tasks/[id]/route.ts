import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getOperationalRoleContext } from "@/lib/management/operational-role";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  assigned_to: z.string().uuid().nullable(),
  due_at: z.string().datetime().nullable(),
  priority: z.enum(["low", "medium", "high", "critical"])
}).strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await getOperationalRoleContext(["admin", "network_manager", "manager", "owner"]);
    if (!access.allowed) return access.response;
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) return fail("משימה לא תקינה", 400);
    const payload = schema.parse(await request.json());
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("update_management_task" as never, {
      p_task_id: id,
      p_assigned_to: payload.assigned_to,
      p_due_at: payload.due_at,
      p_priority: payload.priority
    } as never);
    if (error) return fail(error.message, error.code === "42501" ? 403 : error.code === "P0002" ? 404 : 409);
    return ok(data);
  } catch (error) { return handleRouteError(error); }
}
