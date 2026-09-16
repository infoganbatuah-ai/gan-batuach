import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getOperationalRoleContext } from "@/lib/management/operational-role";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  action: z.enum(["start", "submit", "complete", "block", "reject", "reopen", "cancel"]),
  note: z.string().max(2000).nullable().optional()
}).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await getOperationalRoleContext(["admin", "network_manager", "manager", "owner", "staff", "inspector"]);
    if (!access.allowed) return access.response;
    const { id } = await params;
    if (!z.string().uuid().safeParse(id).success) return fail("משימה לא תקינה", 400);
    const payload = schema.parse(await request.json());
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("transition_management_task" as never, {
      p_task_id: id, p_action: payload.action, p_note: payload.note ?? null
    } as never);
    if (error) return fail(error.message, error.code === "42501" ? 403 : error.code === "P0002" ? 404 : 409);
    return ok(data);
  } catch (error) { return handleRouteError(error); }
}
