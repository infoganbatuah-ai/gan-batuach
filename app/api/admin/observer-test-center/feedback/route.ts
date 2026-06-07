import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  action: z.enum(["review", "replay"]),
  event_source: z.enum(["ai_camera_event", "audio_observer_event", "observer_correlated_event"]),
  event_id: z.string().uuid(),
  outcome: z.enum(["correct_detection", "missed_detection", "false_positive", "false_negative", "uncertain"]).optional(),
  reviewer_note: z.string().optional(),
  observer_recommendation: z.string().optional(),
  confidence_at_review: z.coerce.number().min(0).max(1).optional()
});

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["admin"]);
    const payload = schema.parse(await request.json());
    const admin = createAdminClient();

    if (payload.action === "replay") {
      const replay = await admin.from("observer_event_replay_logs" as any).insert({
        event_source: payload.event_source,
        event_id: payload.event_id,
        requested_by: profile.id,
        replay_status: "mock_ready",
        no_raw_media_exposed: true,
        replay_payload: { mode: "review_only", raw_media_exposed: false, no_action_taken: true }
      }).select("*").single();
      if (replay.error) return fail("Replay לא נשמר", 400);
      return ok({ replay: replay.data });
    }

    if (!payload.outcome) return fail("יש לבחור תוצאת בדיקה", 422);
    const review = await admin.from("observer_ground_truth_reviews" as any).insert({
      event_source: payload.event_source,
      event_id: payload.event_id,
      reviewed_by: profile.id,
      outcome: payload.outcome,
      observer_recommendation: payload.observer_recommendation ?? null,
      reviewer_note: payload.reviewer_note ?? null,
      confidence_at_review: payload.confidence_at_review ?? null,
      updates_learning_profile: true,
      no_action_taken: true,
      metadata: { human_review_required: true, autonomous_action: false }
    }).select("*").single();
    if (review.error) return fail("Feedback לא נשמר", 400);

    if (payload.event_source === "ai_camera_event") {
      await admin.from("ai_camera_events" as any).update({
        ground_truth_outcome: payload.outcome,
        ground_truth_reviewed_by: profile.id,
        ground_truth_reviewed_at: new Date().toISOString(),
        review_outcome: payload.outcome === "false_positive" ? "false_positive" : payload.outcome === "correct_detection" ? "valid_detection" : "needs_more_data"
      }).eq("id", payload.event_id);
    }

    return ok({ review: review.data });
  } catch (error) {
    return handleRouteError(error);
  }
}
