import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { aiCameraEventSchema, titleForAiCameraEvent } from "@/lib/domain/ai-digital-observer";
import { assessSafetyIncident } from "@/lib/domain/safety-incident-framework";

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["admin"]);
    const payload = aiCameraEventSchema.parse(await request.json());
    const supabase = isAdminClientConfigured() ? createAdminClient() : await createClient();
    const safety = assessSafetyIncident(payload.event_type, payload.confidence_score ?? 0.72);
    const title = payload.title ?? safety?.title ?? titleForAiCameraEvent(payload.event_type);
    const severity = safety?.severity ?? payload.severity;
    const { data: event, error } = await supabase.from("ai_camera_events" as any).insert({
      kindergarten_id: payload.kindergarten_id,
      camera_id: payload.camera_id ?? null,
      child_id: payload.child_id ?? null,
      staff_id: payload.staff_id ?? null,
      event_type: payload.event_type,
      severity,
      title,
      description: payload.description ?? safety?.description ?? "אירוע mock של התצפיתן הדיגיטלי. נדרש review אנושי לפני הסלמה.",
      confidence_score: payload.confidence_score ?? null,
      snapshot_url: payload.snapshot_url || null,
      clip_url: payload.clip_url || null,
      safety_category: safety?.safety_category ?? "general",
      review_priority: safety?.review_priority ?? 3,
      recommended_action: safety?.recommended_action ?? "בדיקה אנושית לפני כל פעולה",
      evidence_timeline: [],
      evidence_notes: null,
      detected_entities: payload.detected_entities,
      shadow_mode: true,
      requires_human_review: true,
      parent_visible: false,
      detector_provider: "local_mock",
      detector_mode: "shadow",
      metadata: { ...payload.metadata, ...(safety?.metadata ?? {}), source: "mock_admin", shadow_mode: true, requires_human_review: true, parent_visible: false },
      is_demo: payload.is_demo ?? true,
      created_at: new Date().toISOString()
    }).select("*").single();
    if (error) return fail("יצירת אירוע תצפיתן נכשלה: " + error.message, 400);

    if (["high", "urgent", "critical"].includes(severity)) {
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
          metadata: { ai_camera_event_id: event.id, severity, human_review_required: true, parent_notification_policy: "confirmed_workflow_only" }
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
      after_data: { event_type: payload.event_type, severity, safety_category: safety?.safety_category ?? null }
    });
    return ok({ event }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
