import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  source: z.enum(["complaint", "incident"]),
  id: z.string().uuid(),
  action: z.enum(["reply", "assign", "mark_urgent", "change_status", "close", "create_task"]),
  message: z.string().optional(),
  assigned_to: z.string().uuid().optional(),
  status: z.string().optional(),
  resolution: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["admin"]);
    const payload = schema.parse(await request.json());
    const supabase = createAdminClient();
    const table = payload.source === "complaint" ? "complaints" : "incident_reports";
    const { data: current, error: currentError } = await supabase.from(table).select("*").eq("id", payload.id).single();
    if (currentError || !current) return fail("הדיווח לא נמצא.", 404);

    const timelineEntry = { at: new Date().toISOString(), by: profile.id, action: payload.action, message: payload.message ?? payload.resolution ?? null };
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (payload.action === "reply") {
      if (payload.source === "complaint") patch.last_response_at = new Date().toISOString();
      patch.internal_notes = [current.internal_notes, payload.message].filter(Boolean).join("\n");
    }
    if (payload.action === "assign") patch.assigned_to = payload.assigned_to ?? profile.id;
    if (payload.action === "mark_urgent") {
      if (payload.source === "complaint") patch.urgent = true;
      patch.severity = "critical";
    }
    if (payload.action === "change_status") patch.status = payload.status ?? "in_progress";
    if (payload.action === "close") {
      patch.status = "closed";
      patch.resolution = payload.resolution ?? payload.message ?? "נסגר על ידי אדמין";
      if (payload.source === "complaint") patch.closed_at = new Date().toISOString();
    }
    patch.status_history = [...(Array.isArray(current.status_history) ? current.status_history : []), timelineEntry];

    const { data, error } = await supabase.from(table).update(patch).eq("id", payload.id).select("*").single();
    if (error) return fail("שמירת הפעולה נכשלה: " + error.message, 400);

    if (payload.action === "create_task") {
      await supabase.from("tasks").insert({
        garden_id: current.garden_id,
        title: `טיפול בדיווח: ${current.subject ?? current.title ?? "דיווח"}`,
        description: payload.message ?? current.description ?? "משימת טיפול מדיווח",
        assigned_to: payload.assigned_to ?? current.assigned_to ?? current.assigned_inspector_id ?? null,
        priority: current.severity ?? "medium",
        status: "open",
        task_type: "report_followup"
      });
    }

    await supabase.from("audit_logs").insert({ actor_id: profile.id, actor_role: "admin", garden_id: current.garden_id, entity_type: table, entity_id: payload.id, action: `report_${payload.action}`, after_data: patch });
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
