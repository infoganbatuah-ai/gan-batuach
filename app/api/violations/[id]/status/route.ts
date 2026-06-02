import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  status: z.enum(["open", "in_progress", "waiting_approval", "done", "overdue", "rejected"]),
  note: z.string().max(1000).optional()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireRole(["admin", "inspector", "manager", "owner"]);
    const { id } = await params;
    const payload = schema.parse(await request.json());
    const supabase = await createClient();

    const { data: violation, error: violationError } = await supabase
      .from("violations" as any)
      .select("id, garden_id, status, correction_note")
      .eq("id", id)
      .maybeSingle();

    if (violationError) return fail("לא ניתן לטעון את הליקוי: " + violationError.message, 400);
    if (!violation) return fail("הליקוי לא נמצא או שאין הרשאה לצפות בו.", 404);

    let allowed = profile.role === "admin";
    if ((profile.role === "manager" || profile.role === "owner") && profile.garden_id === violation.garden_id) allowed = true;
    if (profile.role === "inspector") {
      const { count, error } = await supabase
        .from("gardens" as any)
        .select("id", { count: "exact", head: true })
        .eq("id", violation.garden_id)
        .eq("inspector_id", profile.id);
      if (error) return fail("לא ניתן לבדוק שיוך פקח לגן: " + error.message, 400);
      allowed = (count ?? 0) > 0;
    }

    if (!allowed) return fail("אין הרשאה לעדכן ליקוי זה.", 403);

    const patch: Record<string, unknown> = {
      status: payload.status,
      correction_note: payload.note ?? violation.correction_note ?? null
    };
    if (payload.status === "done") {
      patch.approved_by = profile.id;
      patch.approved_at = new Date().toISOString();
    }

    const { data: updated, error: updateError } = await supabase
      .from("violations" as any)
      .update(patch)
      .eq("id", id)
      .select("id, status, garden_id, correction_note, approved_at")
      .single();

    if (updateError || !updated) {
      return fail("סטטוס הליקוי לא נשמר: " + (updateError?.message ?? "לא התקבלה רשומה מעודכנת"), 400);
    }

    await supabase.from("audit_logs").insert({
      actor_id: profile.id,
      actor_role: profile.role,
      garden_id: violation.garden_id,
      entity_type: "violations",
      entity_id: id,
      action: "update_violation_status",
      before_data: { status: violation.status },
      after_data: { status: updated.status, note: payload.note ?? null }
    } as any);

    return ok(updated);
  } catch (error) {
    return handleRouteError(error);
  }
}
