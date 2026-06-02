import { z } from "zod";
import { createCrudHandlers } from "@/lib/crud-route";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { procedureSchema } from "@/lib/validation";

export const { GET, POST } = createCrudHandlers({
  table: "mandatory_procedures",
  read: "documents:write",
  write: "documents:write",
  schema: procedureSchema,
  defaultOrder: "created_at"
});

const patchSchema = procedureSchema.partial().extend({ id: z.string().uuid() });

export async function PATCH(request: Request) {
  try {
    const { profile } = await requireRole(["admin"]);
    const { id, ...payload } = patchSchema.parse(await request.json());
    const supabase = createAdminClient();
    const { data: before } = await supabase.from("mandatory_procedures").select("*").eq("id", id).single();
    const { data, error } = await supabase.from("mandatory_procedures").update(payload).eq("id", id).select("*").single();
    if (error) return fail(error.message, 400);
    await supabase.from("audit_logs").insert({ actor_id: profile.id, actor_role: "admin", entity_type: "mandatory_procedures", entity_id: id, action: "update_procedure", before_data: before ?? null, after_data: data });
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
