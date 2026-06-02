import { z } from "zod";
import { createCrudHandlers } from "@/lib/crud-route";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { inspectionFormSchema } from "@/lib/validation";

export const { GET, POST } = createCrudHandlers({
  table: "inspection_forms",
  read: "inspections:read",
  write: "inspection_forms:write",
  schema: inspectionFormSchema,
  defaultOrder: "created_at"
});

const patchSchema = inspectionFormSchema.partial().extend({ id: z.string().uuid() });

export async function PATCH(request: Request) {
  try {
    const permission = await requirePermission("inspection_forms:write");
    if (!permission.allowed) return fail("Forbidden", 403);
    const { id, ...payload } = patchSchema.parse(await request.json());
    const supabase = await createClient();
    const { data, error } = await supabase.from("inspection_forms").update(payload).eq("id", id).select("*").single();
    if (error) return fail(error.message, 400);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
