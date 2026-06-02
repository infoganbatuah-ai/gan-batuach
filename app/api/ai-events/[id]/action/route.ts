import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  action: z.enum(["handled", "false_positive", "assign_inspector", "create_task", "add_note"]),
  assigned_to: z.string().uuid().optional(),
  note: z.string().optional()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireRole(["admin", "inspector"]);
    const { id } = await params;
    const payload = schema.parse(await request.json());
    const supabase = createAdminClient();
    const { data: event, error: eventError } = await supabase.from("ai_events").select("*").eq("id", id).single();
    if (eventError || !event) return fail("אירוע AI לא נמצא.", 404);

    const patch: Record<string, unknown> = {};
    if (payload.action === "handled") {
      patch.status = "done";
      patch.handled_by = profile.id;
      patch.handled_at = new Date().toISOString();
      patch.handled_note = payload.note ?? "טופל";
    }
    if (payload.action === "false_positive") {
      patch.status = "done";
      patch.true_positive = false;
      patch.handled_by = profile.id;
      patch.handled_at = new Date().toISOString();
      patch.false_positive_reason = payload.note ?? "סומן כזיהוי שגוי";
    }
    if (payload.action === "assign_inspector") patch.assigned_to = payload.assigned_to ?? profile.id;
    if (payload.action === "add_note") patch.notes = [event.notes, payload.note].filter(Boolean).join("\n");

    let task = null;
    if (payload.action === "create_task") {
      const { data } = await supabase.from("tasks").insert({
        garden_id: event.garden_id,
        title: `טיפול באירוע AI: ${event.event_type}`,
        description: payload.note ?? "אירוע תצפיתן דיגיטלי דורש בדיקה",
        assigned_to: payload.assigned_to ?? event.assigned_to ?? event.handled_by ?? null,
        priority: event.severity ?? "medium",
        status: "open",
        task_type: "ai_event"
      }).select("*").single();
      task = data;
    }

    const { data, error } = Object.keys(patch).length ? await supabase.from("ai_events").update(patch).eq("id", id).select("*").single() : { data: event, error: null };
    if (error) return fail("עדכון אירוע AI נכשל: " + error.message, 400);
    await supabase.from("audit_logs").insert({ actor_id: profile.id, actor_role: profile.role, garden_id: event.garden_id, entity_type: "ai_events", entity_id: id, action: `ai_event_${payload.action}`, after_data: { ...patch, task_id: task?.id ?? null } });
    return ok({ event: data, task });
  } catch (error) {
    return handleRouteError(error);
  }
}
