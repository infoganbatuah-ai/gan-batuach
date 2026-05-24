import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  status: z.enum(["open", "in_progress", "waiting_approval", "done", "overdue", "rejected"]),
  completion_comment: z.string().optional(),
  rejection_reason: z.string().optional(),
  proof_files: z.array(z.string()).optional()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireUser();
    const { id } = await params;
    const payload = schema.parse(await request.json());
    const supabase = await createClient();
    const { data: task } = await supabase.from("tasks" as any).select("id, assigned_to, garden_id").eq("id", id).maybeSingle();
    if (!task) return fail("המשימה לא נמצאה", 404);
    if (profile.role !== "admin" && task.assigned_to && task.assigned_to !== profile.id) return fail("אין הרשאה לעדכן משימה זו", 403);
    const patch: Record<string, unknown> = {
      status: payload.status,
      completion_comment: payload.completion_comment ?? null,
      rejection_reason: payload.rejection_reason ?? null,
      proof_files: payload.proof_files ?? [],
      completed_by: payload.status === "done" ? profile.id : null,
      completed_at: payload.status === "done" ? new Date().toISOString() : null,
      waiting_approval_at: payload.status === "waiting_approval" ? new Date().toISOString() : null
    };
    const { data, error } = await supabase.from("tasks" as any).update(patch).eq("id", id).select("*").single();
    if (error) {
      console.error("[task-status]", error);
      return fail("לא ניתן לעדכן משימה כרגע", 400);
    }
    await supabase.from("audit_logs" as any).insert({ actor_id: profile.id, actor_role: profile.role, garden_id: task.garden_id, entity_type: "tasks", entity_id: id, action: "update_task_status", after_data: patch });
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
