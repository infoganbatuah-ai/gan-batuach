import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { aiCameraEventSchema, titleForAiCameraEvent } from "@/lib/domain/ai-digital-observer";

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["admin"]);
    const payload = aiCameraEventSchema.parse(await request.json());
    const supabase = isAdminClientConfigured() ? createAdminClient() : await createClient();
    const title = payload.title ?? titleForAiCameraEvent(payload.event_type);
    const { data: event, error } = await supabase.from("ai_camera_events" as any).insert({
      kindergarten_id: payload.kindergarten_id,
      camera_id: payload.camera_id ?? null,
      child_id: payload.child_id ?? null,
      staff_id: payload.staff_id ?? null,
      event_type: payload.event_type,
      severity: payload.severity,
      title,
      description: payload.description ?? "אירוע mock של התצפיתן הדיגיטלי. נדרש review אנושי לפני הסלמה.",
      confidence_score: payload.confidence_score ?? null,
      snapshot_url: payload.snapshot_url || null,
      clip_url: payload.clip_url || null,
      detected_entities: payload.detected_entities,
      metadata: { ...payload.metadata, source: "mock_admin", human_review_required: true },
      is_demo: payload.is_demo ?? true,
      created_at: new Date().toISOString()
    }).select("*").single();
    if (error) return fail("יצירת אירוע תצפיתן נכשלה: " + error.message, 400);

    if (["high", "urgent", "critical"].includes(payload.severity)) {
      const { data: recipients } = await supabase.from("profiles" as any).select("id, role, garden_id").or(`role.eq.admin,garden_id.eq.${payload.kindergarten_id}`);
      const rows = ((recipients ?? []) as any[])
        .filter((recipient) => recipient.role === "admin" || ["manager", "owner"].includes(recipient.role))
        .map((recipient) => ({
          garden_id: payload.kindergarten_id,
          kindergarten_id: payload.kindergarten_id,
          recipient_id: recipient.id,
          recipient_profile_id: recipient.id,
          recipient_role: recipient.role,
          title: "אירוע תצפיתן דורש review",
          body: title,
          message: title,
          entity_type: "ai_camera_event",
          entity_id: event.id,
          action_url: recipient.role === "admin" ? "/dashboard/admin/ai-events" : "/dashboard/garden/ai-events",
          created_by: profile.id,
          metadata: { ai_camera_event_id: event.id, severity: payload.severity, human_review_required: true }
        }));
      if (rows.length) await supabase.from("notifications" as any).insert(rows);
    }

    await supabase.from("audit_logs" as any).insert({
      actor_id: profile.id,
      actor_role: profile.role,
      garden_id: payload.kindergarten_id,
      entity_type: "ai_camera_events",
      entity_id: event.id,
      action: "create_mock_ai_camera_event",
      after_data: { event_type: payload.event_type, severity: payload.severity }
    });
    return ok({ event }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
