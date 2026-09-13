import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getOperationalRoleContext } from "@/lib/management/operational-role";
import { createClient } from "@/lib/supabase/server";

const createSchema = z.object({
  garden_id: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(4000).nullable().optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  due_at: z.string().datetime().nullable().optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium")
}).strict();

export async function GET(request: Request) {
  try {
    const access = await getOperationalRoleContext(["admin", "network_manager", "manager", "owner", "staff", "inspector"]);
    if (!access.allowed) return access.response;
    const gardenId = new URL(request.url).searchParams.get("garden_id");
    if (gardenId && !z.string().uuid().safeParse(gardenId).success) return fail("גן לא תקין", 400);
    const supabase = await createClient();
    let query = supabase.from("tasks")
      .select("id,garden_id,title,description,assigned_to,assigned_role,created_by,due_at,status,priority,task_type,source_entity_type,source_entity_id,completed_at,cancelled_at,created_at,updated_at")
      .order("created_at", { ascending: false }).limit(160);
    if (gardenId) query = query.eq("garden_id", gardenId);
    const { data, error } = await query;
    if (error) return fail("טעינת המשימות נכשלה", 400);
    return ok(data ?? []);
  } catch (error) { return handleRouteError(error); }
}

export async function POST(request: Request) {
  try {
    const access = await getOperationalRoleContext(["admin", "network_manager", "manager", "owner"]);
    if (!access.allowed) return access.response;
    const payload = createSchema.parse(await request.json());
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_management_task" as never, {
      p_garden_id: payload.garden_id ?? null,
      p_title: payload.title,
      p_description: payload.description ?? null,
      p_assigned_to: payload.assigned_to ?? null,
      p_due_at: payload.due_at ?? null,
      p_priority: payload.priority
    } as never);
    if (error) return fail(error.message, error.code === "42501" ? 403 : 400);
    return ok(data, 201);
  } catch (error) { return handleRouteError(error); }
}
