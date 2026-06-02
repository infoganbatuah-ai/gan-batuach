import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { aiCameraReviewActionSchema } from "@/lib/domain/ai-digital-observer";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireRole(["admin", "manager", "owner", "inspector"]);
    const { id } = await context.params;
    const payload = aiCameraReviewActionSchema.parse(await request.json());
    const supabase = isAdminClientConfigured() ? createAdminClient() : await createClient();
    const { data: event, error: eventError } = await supabase.from("ai_camera_events" as any).select("*").eq("id", id).single();
    if (eventError || !event) return fail("אירוע תצפיתן לא נמצא.", 404);
    if (profile.role !== "admin" && profile.garden_id !== (event as any).kindergarten_id) {
      if (profile.role !== "inspector") return fail("אין הרשאה לאירוע הזה.", 403);
      const { data: garden } = await supabase.from("gardens" as any).select("id").eq("id", (event as any).kindergarten_id).eq("inspector_id", profile.id).maybeSingle();
      if (!garden) return fail("אין הרשאה לאירוע הזה.", 403);
    }

    const status = payload.action === "review" ? "reviewing" : payload.action === "confirm" ? "confirmed" : payload.action === "dismiss" ? "dismissed" : "escalated";
    const patch: Record<string, unknown> = {
      status,
      review_notes: payload.review_notes ?? null,
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
      escalated_to_role: payload.action === "escalate" ? "admin_inspector" : null
    };
    const { data, error } = await supabase.from("ai_camera_events" as any).update(patch).eq("id", id).select("*").single();
    if (error) return fail("עדכון אירוע תצפיתן נכשל: " + error.message, 400);
    await supabase.from("audit_logs" as any).insert({
      actor_id: profile.id,
      actor_role: profile.role,
      garden_id: (event as any).kindergarten_id,
      entity_type: "ai_camera_events",
      entity_id: id,
      action: `ai_camera_event_${payload.action}`,
      after_data: patch
    });
    return ok({ event: data });
  } catch (error) {
    return handleRouteError(error);
  }
}
