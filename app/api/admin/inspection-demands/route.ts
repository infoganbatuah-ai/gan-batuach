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
      if (error) {
        console.error("[inspection-demands:demand]", { garden_id: payload.garden_id, error: error.message });
        return fail("לא ניתן לדרוש פיקוח כרגע. נסו שוב או בדקו שיוך פקח לגן.", 400);
      }
      const notificationRows = [{ garden_id: payload.garden_id, recipient_id: garden.inspector_id, recipient_role: "inspector", title: "דרישת פיקוח", body: `נדרש לבצע פיקוח בגן ${garden.name}`, entity_type: "required_inspection", entity_id: data.id }].filter((row) => row.recipient_id);
      if (notificationRows.length) {
        const notification = await supabase.from("notifications").insert(notificationRows);
        if (notification.error) {
          console.error("[inspection-demands:demand-notification]", { garden_id: payload.garden_id, error: notification.error.message });
          return fail("דרישת הפיקוח נוצרה, אך ההתראה לפקח לא נשלחה. פתחו את רשימת הפיקוחים ובדקו שיוך פקח.", 500);
        }
      }
      return ok({ ...data, notification_sent: notificationRows.length > 0 }, 201);
    }
    if (payload.action === "notify_inspector" || payload.action === "notify_kindergarten") {
      const rows = payload.action === "notify_inspector"
        ? [{ recipient_id: garden.inspector_id, recipient_role: "inspector" }]
        : [{ recipient_id: garden.manager_id, recipient_role: "manager" }, { recipient_id: garden.owner_profile_id, recipient_role: "owner" }];
      const notificationRows = rows.filter((row) => row.recipient_id).map((row) => ({ garden_id: payload.garden_id, ...row, title: "תזכורת פיקוח", body: `יש לבצע/להשלים פיקוח עבור ${garden.name}`, entity_type: "garden", entity_id: payload.garden_id }));
      if (!notificationRows.length) return fail("לא נמצא נמען מתאים להתראת פיקוח. בדקו שיוך מנהלת/בעלים/פקח לגן.", 422);
      const notification = await supabase.from("notifications").insert(notificationRows).select("id");
      if (notification.error) {
        console.error("[inspection-demands:notify]", { garden_id: payload.garden_id, action: payload.action, error: notification.error.message });
        return fail("לא ניתן לשלוח התראת פיקוח כרגע.", 500);
      }
      return ok({ notified: true, notification_count: notification.data?.length ?? 0 });
    }
    if (payload.action === "cancel") {
      const update = await supabase.from("required_inspections").update({ status: "cancelled", updated_at: now }).eq("garden_id", payload.garden_id).neq("status", "done").select("id");
      if (update.error) {
        console.error("[inspection-demands:cancel]", { garden_id: payload.garden_id, error: update.error.message });
        return fail("לא ניתן לבטל דרישת פיקוח כרגע.", 500);
      }
      const audit = await supabase.from("audit_logs").insert({ actor_id: profile.id, actor_role: "admin", garden_id: payload.garden_id, entity_type: "required_inspections", action: "cancel_inspection_demand", after_data: { reason: payload.reason, affected_count: update.data?.length ?? 0 } });
      if (audit.error) console.error("[inspection-demands:cancel-audit]", { garden_id: payload.garden_id, error: audit.error.message });
      return ok({ cancelled: true, affected_count: update.data?.length ?? 0 });
    }
    if (payload.action === "override_complete") {
      if (payload.inspection_id) {
        const inspectionUpdate = await supabase.from("inspections").update({ status: "done", completed_at: now, manually_completed: true, override_reason: payload.reason }).eq("id", payload.inspection_id).select("id").maybeSingle();
        if (inspectionUpdate.error) {
          console.error("[inspection-demands:override-inspection]", { garden_id: payload.garden_id, inspection_id: payload.inspection_id, error: inspectionUpdate.error.message });
          return fail("לא ניתן לסמן את דוח הפיקוח כהושלם.", 500);
        }
      }
      const requiredUpdate = await supabase.from("required_inspections").update({ status: "done", updated_at: now }).eq("garden_id", payload.garden_id).neq("status", "done").select("id");
      if (requiredUpdate.error) {
        console.error("[inspection-demands:override-required]", { garden_id: payload.garden_id, error: requiredUpdate.error.message });
        return fail("לא ניתן לעדכן את דרישות הפיקוח של הגן.", 500);
      }
      const audit = await supabase.from("audit_logs").insert({ actor_id: profile.id, actor_role: "admin", garden_id: payload.garden_id, entity_type: "inspections", entity_id: payload.inspection_id ?? null, action: "admin_mark_inspection_completed", after_data: { reason: payload.reason, affected_required_count: requiredUpdate.data?.length ?? 0 } });
      if (audit.error) console.error("[inspection-demands:override-audit]", { garden_id: payload.garden_id, error: audit.error.message });
      return ok({ completed: true, affected_required_count: requiredUpdate.data?.length ?? 0 });
    }
    return ok({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
