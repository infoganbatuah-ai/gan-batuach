import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  form_id: z.string().uuid(),
  inspector_id: z.string().uuid().nullable().optional(),
  garden_id: z.string().uuid().nullable().optional(),
  monthly_schedule: z.boolean().default(true)
});

export async function POST(request: Request) {
  try {
    await requireRole(["admin"]);
    const payload = schema.parse(await request.json());
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("inspection_form_assignments" as any).upsert({ ...payload, active: true }, { onConflict: "form_id,inspector_id,garden_id" }).select("*").single();
    if (error) return fail(error.message, 400);
    return ok(data, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
