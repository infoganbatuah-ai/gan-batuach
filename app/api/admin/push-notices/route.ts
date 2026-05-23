import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleRouteError, ok } from "@/lib/api";

const schema = z.object({
  garden_id: z.string().uuid().optional(),
  recipient_role: z.enum(["admin", "inspector", "manager", "staff", "parent"]),
  title: z.string().min(2),
  body: z.string().min(2)
});

export async function POST(request: Request) {
  try {
    await requireRole(["admin"]);
    const payload = schema.parse(await request.json());
    const supabase = createAdminClient();
    const query = supabase.from("profiles").select("id, role, garden_id").eq("role", payload.recipient_role).eq("active", true);
    if (payload.garden_id) query.eq("garden_id", payload.garden_id);
    const { data: recipients, error } = await query;
    if (error) throw new Error(error.message);
    const rows = (recipients ?? []).map((recipient: any) => ({
      garden_id: payload.garden_id ?? recipient.garden_id,
      recipient_id: recipient.id,
      recipient_role: recipient.role,
      title: payload.title,
      body: payload.body
    }));
    const { data, error: insertError } = await supabase.from("notifications").insert(rows as any).select("*");
    if (insertError) throw new Error(insertError.message);
    return ok(data, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
