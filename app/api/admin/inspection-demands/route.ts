import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  action: z.enum(["demand", "notify_inspector", "notify_kindergarten", "cancel", "override_complete"]),
  garden_id: z.string().uuid(),
  inspection_id: z.string().uuid().optional(),
  reason: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["admin"]);
    const payload = schema.parse(await request.json());
    const supabase = createAdminClient();
    if ((payload.action === "cancel" || payload.action === "override_complete") && !payload.reason) return fail("חובה להזין סיבה.", 422);
    const { data: garden } = await supabase.from("gardens").select("id, name, manager_id, owner_profile_id, inspector_id").eq("id", payload.garden_id).single();
    if (!garden) return fail("הגן לא נמצא.", 404);
    const now = new Date().toISOString();
    if (payload.action === "demand") {
      const dueAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase.from("required_inspections").insert({ garden_id: payload.garden_id, inspector_id: garden.inspector_id, due_at: dueAt, status: "required", countdown_day: 5 }).select("*").single();
      if (error) return fail("לא ניתן לדרוש פיקוח.", 400);
      await supabase.from("notifications").insert([{ garden_id: payload.garden_id, recipient_id: garden.inspector_id, recipient_role: "inspector", title: "דרישת פיקוח", body: `נדרש לבצע פיקוח בגן ${garden.name}`, entity_type: "required_inspection", entity_id: data.id }].filter((row) => row.recipient_id));
      return ok(data, 201);
    }
    if (payload.action === "notify_inspector" || payload.action === "notify_kindergarten") {
      const rows = payload.action === "notify_inspector"
        ? [{ recipient_id: garden.inspector_id, recipient_role: "inspector" }]
        : [{ recipient_id: garden.manager_id, recipient_role: "manager" }, { recipient_id: garden.owner_profile_id, recipient_role: "owner" }];
      await supabase.from("notifications").insert(rows.filter((row) => row.recipient_id).map((row) => ({ garden_id: payload.garden_id, ...row, title: "תזכורת פיקוח", body: `יש לבצע/להשלים פיקוח עבור ${garden.name}`, entity_type: "garden", entity_id: payload.garden_id })));
      return ok({ notified: true });
    }
    if (payload.action === "cancel") {
      await supabase.from("required_inspections").update({ status: "cancelled", updated_at: now }).eq("garden_id", payload.garden_id).neq("status", "done");
      await supabase.from("audit_logs").insert({ actor_id: profile.id, actor_role: "admin", garden_id: payload.garden_id, entity_type: "required_inspections", action: "cancel_inspection_demand", after_data: { reason: payload.reason } });
      return ok({ cancelled: true });
    }
    if (payload.action === "override_complete") {
      await supabase.from("audit_logs").insert({ actor_id: profile.id, actor_role: "admin", garden_id: payload.garden_id, entity_type: "inspections", entity_id: payload.inspection_id ?? null, action: "admin_mark_inspection_completed", after_data: { reason: payload.reason } });
      if (payload.inspection_id) await supabase.from("inspections").update({ status: "done", completed_at: now, manually_completed: true, override_reason: payload.reason }).eq("id", payload.inspection_id);
      await supabase.from("required_inspections").update({ status: "done", updated_at: now }).eq("garden_id", payload.garden_id).neq("status", "done");
      return ok({ completed: true });
    }
    return ok({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
