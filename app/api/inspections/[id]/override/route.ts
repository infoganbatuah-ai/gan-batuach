import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  reason: z.string().min(3),
  notes: z.string().optional()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireRole(["admin"]);
    const { id } = await params;
    const payload = schema.parse(await request.json());
    const supabase = createAdminClient();
    const { data: inspection, error: inspectionError } = await supabase.from("inspections").select("id, garden_id").eq("id", id).single();
    if (inspectionError || !inspection) return fail("ביקורת לא נמצאה.", 404);

    const completedAt = new Date().toISOString();
    const { error } = await supabase.from("inspections").update({
      status: "done",
      completed_at: completedAt,
      manually_completed: true,
      override_reason: payload.reason,
      override_notes: payload.notes ?? null,
      performed_by_user: profile.id,
      performed_by_role: "admin"
    }).eq("id", id);
    if (error) return fail("לא ניתן לסמן ביקורת כהושלמה.", 400);

    await supabase.from("inspection_overrides").insert({
      inspection_id: id,
      garden_id: inspection.garden_id,
      reason: payload.reason,
      notes: payload.notes ?? null,
      created_by: profile.id
    });
    await supabase.from("audit_logs").insert({
      actor_id: profile.id,
      actor_role: "admin",
      performed_by_user: profile.id,
      performed_by_role: "admin",
      garden_id: inspection.garden_id,
      entity_type: "inspections",
      entity_id: id,
      action: "admin_override_inspection_completed",
      after_data: { reason: payload.reason, notes: payload.notes ?? null, completed_at: completedAt }
    });

    return ok({ id, status: "done", manually_completed: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
