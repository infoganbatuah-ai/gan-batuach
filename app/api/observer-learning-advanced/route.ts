import { z } from "zod";
import { calculateLearningCalibration } from "@/lib/domain/advanced-learning-engine";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const baselineTypes = [
  "normal_occupancy_patterns",
  "normal_movement_patterns",
  "normal_activity_levels",
  "normal_active_hours",
  "normal_pickup_patterns",
  "normal_staff_presence",
  "normal_camera_activity",
  "normal_zone_usage"
] as const;

const sourceTypes = ["ai_camera_event", "audio_observer_event", "pickup_event", "watch_request", "safety_incident", "camera_health", "mock"] as const;
const outcomes = ["confirmed", "dismissed", "false_positive", "escalated", "valid_detection", "needs_more_data"] as const;

const payloadSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create_mock_baseline"),
    kindergarten_id: z.string().uuid(),
    baseline_type: z.enum(baselineTypes),
    confidence_level: z.coerce.number().min(0).max(1).default(0.18),
    anomaly_readiness_score: z.coerce.number().min(0).max(1).default(0.12)
  }),
  z.object({
    action: z.literal("record_feedback"),
    kindergarten_id: z.string().uuid(),
    camera_id: z.string().uuid().optional().nullable(),
    zone_id: z.string().uuid().optional().nullable(),
    source_type: z.enum(sourceTypes).default("mock"),
    source_id: z.string().uuid().optional().nullable(),
    event_type: z.string().trim().min(2).default("mock_reviewed_event"),
    review_outcome: z.enum(outcomes)
  })
]);

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["admin", "manager", "owner"]);
    const payload = payloadSchema.parse(await request.json());
    const supabase = isAdminClientConfigured() ? createAdminClient() : await createClient();
    if (profile.role !== "admin" && profile.garden_id !== payload.kindergarten_id) return fail("אין הרשאה לגן הזה.", 403);

    if (payload.action === "create_mock_baseline") {
      const row = {
        kindergarten_id: payload.kindergarten_id,
        baseline_type: payload.baseline_type,
        baseline_value: { status: "mock_baseline_created", no_autonomous_decisions: true },
        confidence_level: payload.confidence_level,
        anomaly_readiness_score: payload.anomaly_readiness_score,
        learning_maturity: payload.confidence_level >= 0.45 ? "calibrated" : "learning",
        source_summary: { source: "manual_mock", human_review_required: true },
        metadata: { site_level_only: true, no_child_profiling: true, no_staff_scoring: true },
        last_calibrated_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      const existing = await supabase
        .from("site_behavior_baselines" as any)
        .select("id")
        .eq("kindergarten_id", payload.kindergarten_id)
        .eq("baseline_type", payload.baseline_type)
        .maybeSingle();
      const result = existing.data?.id
        ? await supabase.from("site_behavior_baselines" as any).update(row).eq("id", existing.data.id).select("*").single()
        : await supabase.from("site_behavior_baselines" as any).insert(row).select("*").single();
      if (result.error || !result.data) return fail("שמירת baseline נכשלה: " + (result.error?.message ?? ""), 400);
      return ok({ baseline: result.data });
    }

    if (payload.camera_id) {
      const camera = await supabase.from("camera_streams" as any).select("id, garden_id").eq("id", payload.camera_id).single();
      if (camera.error || !camera.data) return fail("מצלמה לא נמצאה.", 404);
      if (camera.data.garden_id !== payload.kindergarten_id) return fail("המצלמה אינה משויכת לגן שנבחר.", 403);
    }
    if (payload.zone_id) {
      const zone = await supabase.from("camera_zones" as any).select("id, kindergarten_id, camera_id").eq("id", payload.zone_id).single();
      if (zone.error || !zone.data) return fail("אזור מצלמה לא נמצא.", 404);
      if (zone.data.kindergarten_id !== payload.kindergarten_id) return fail("האזור אינו משויך לגן שנבחר.", 403);
    }

    const [currentProfile, feedbackCount] = await Promise.all([
      supabase.from("kindergarten_learning_profiles" as any).select("*").eq("kindergarten_id", payload.kindergarten_id).maybeSingle(),
      supabase.from("learning_feedback_signals" as any).select("id", { count: "exact", head: true }).eq("kindergarten_id", payload.kindergarten_id)
    ]);
    const calibration = calculateLearningCalibration({
      currentConfidence: currentProfile.data?.confidence_level,
      currentReadiness: currentProfile.data?.anomaly_readiness_score,
      existingFeedbackCount: feedbackCount.count ?? 0,
      reviewOutcome: payload.review_outcome
    });
    const now = new Date().toISOString();
    const feedback = await supabase.from("learning_feedback_signals" as any).insert({
      kindergarten_id: payload.kindergarten_id,
      camera_id: payload.camera_id ?? null,
      zone_id: payload.zone_id ?? null,
      source_type: payload.source_type,
      source_id: payload.source_id ?? null,
      event_type: payload.event_type,
      review_outcome: payload.review_outcome,
      confidence_delta: calibration.confidenceDelta,
      confidence_after: calibration.confidenceAfter,
      maturity_after: calibration.maturityAfter,
      anomaly_readiness_after: calibration.anomalyReadinessAfter,
      metadata: { mock_learning: true, no_autonomous_action: true, human_review_required: true }
    }).select("*").single();
    if (feedback.error || !feedback.data) return fail("שמירת learning feedback נכשלה: " + (feedback.error?.message ?? ""), 400);
    const profileUpdate = await supabase.from("kindergarten_learning_profiles" as any).upsert({
      kindergarten_id: payload.kindergarten_id,
      learning_status: "collecting_baseline",
      learning_started_at: currentProfile.data?.learning_started_at ?? now,
      baseline_version: "v1_advanced_mock",
      confidence_level: calibration.confidenceAfter,
      anomaly_readiness_score: calibration.anomalyReadinessAfter,
      learning_maturity: calibration.maturityAfter,
      confidence_trends: {
        latest_outcome: payload.review_outcome,
        latest_delta: calibration.confidenceDelta,
        latest_source: payload.source_type,
        updated_at: now
      },
      metadata: {
        ...(currentProfile.data?.metadata ?? {}),
        advanced_learning: true,
        site_level_only: true,
        no_child_profiling: true,
        no_staff_scoring: true,
        no_autonomous_decisions: true
      },
      updated_at: now
    }, { onConflict: "kindergarten_id" }).select("*").single();
    if (profileUpdate.error || !profileUpdate.data) return fail("עדכון פרופיל הלמידה נכשל: " + (profileUpdate.error?.message ?? ""), 400);

    if (payload.camera_id) {
      await supabase.from("camera_learning_profiles" as any).upsert({
        camera_id: payload.camera_id,
        kindergarten_id: payload.kindergarten_id,
        confidence_adjustments: { latest_outcome: payload.review_outcome, latest_delta: calibration.confidenceDelta },
        learning_maturity: calibration.maturityAfter,
        anomaly_readiness_score: calibration.anomalyReadinessAfter,
        metadata: { mock_learning: true, no_raw_video: true },
        last_calibrated_at: now,
        updated_at: now
      }, { onConflict: "camera_id" });
    }
    if (payload.zone_id) {
      await supabase.from("zone_learning_profiles" as any).upsert({
        zone_id: payload.zone_id,
        kindergarten_id: payload.kindergarten_id,
        camera_id: payload.camera_id ?? null,
        confidence_adjustments: { latest_outcome: payload.review_outcome, latest_delta: calibration.confidenceDelta },
        learning_maturity: calibration.maturityAfter,
        anomaly_readiness_score: calibration.anomalyReadinessAfter,
        metadata: { mock_learning: true, zone_level_only: true },
        last_calibrated_at: now,
        updated_at: now
      }, { onConflict: "zone_id" });
    }
    return ok({ feedback: feedback.data, learningProfile: profileUpdate.data });
  } catch (error) {
    return handleRouteError(error);
  }
}
