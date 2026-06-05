import { z } from "zod";
import {
  buildCorrelationTimeline,
  calculateCorrelationConfidence,
  inferCorrelationSeverity,
  type CorrelationSource
} from "@/lib/domain/multi-camera-correlation-engine";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const sourceTypes = ["ai_camera_event", "audio_observer_event", "safety_incident", "pickup_event", "watch_request_event", "camera_health", "mock"] as const;
const correlationTypes = ["multi_camera_timeline", "cross_camera_confirmation", "audio_video_correlation", "pickup_path_correlation", "watch_request_correlation", "safety_event_correlation", "camera_health_correlation", "mock_correlation"] as const;
const statuses = ["reviewing", "confirmed", "dismissed", "escalated", "false_positive", "needs_more_data"] as const;

const sourceSchema = z.object({
  source_type: z.enum(sourceTypes),
  source_id: z.string().uuid(),
  camera_id: z.string().uuid().optional().nullable(),
  zone_id: z.string().uuid().optional().nullable(),
  event_time: z.string().optional().nullable(),
  confidence: z.coerce.number().min(0).max(1).optional().nullable(),
  title: z.string().optional().nullable(),
  severity: z.string().optional().nullable()
});

const payloadSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create_mock_correlation"),
    kindergarten_id: z.string().uuid(),
    observer_site_id: z.string().uuid().optional().nullable(),
    correlation_type: z.enum(correlationTypes).default("multi_camera_timeline"),
    sources: z.array(sourceSchema).min(1)
  }),
  z.object({
    action: z.literal("review"),
    id: z.string().uuid(),
    status: z.enum(statuses),
    review_notes: z.string().trim().optional().nullable()
  })
]);

async function assertCameraScope(supabase: any, kindergartenId: string, cameraId: string) {
  const camera = await supabase.from("camera_streams").select("id, garden_id, kindergarten_id").eq("id", cameraId).single();
  if (camera.error || !camera.data) return "מצלמה לא נמצאה.";
  if (camera.data.garden_id !== kindergartenId && camera.data.kindergarten_id !== kindergartenId) return "מצלמה אינה משויכת לגן שנבחר.";
  return null;
}

async function assertZoneScope(supabase: any, kindergartenId: string, zoneId: string) {
  const zone = await supabase.from("camera_zones").select("id, kindergarten_id").eq("id", zoneId).single();
  if (zone.error || !zone.data) return "אזור מצלמה לא נמצא.";
  if (zone.data.kindergarten_id !== kindergartenId) return "אזור המצלמה אינו משויך לגן שנבחר.";
  return null;
}

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["admin", "manager", "owner"]);
    const payload = payloadSchema.parse(await request.json());
    const supabase = isAdminClientConfigured() ? createAdminClient() : await createClient();

    if (payload.action === "review") {
      const existing = await supabase.from("observer_correlated_events" as any).select("*").eq("id", payload.id).single();
      if (existing.error || !existing.data) return fail("האירוע המקושר לא נמצא.", 404);
      if (profile.role !== "admin" && existing.data.kindergarten_id !== profile.garden_id) return fail("אין הרשאה לאירוע הזה.", 403);
      const result = await supabase.from("observer_correlated_events" as any).update({
        status: payload.status,
        review_notes: payload.review_notes ?? existing.data.review_notes,
        reviewed_by: profile.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: { ...(existing.data.metadata ?? {}), reviewed_by_human: true, no_identity_tracking: true }
      }).eq("id", payload.id).select("*").single();
      if (result.error || !result.data) return fail("שמירת review נכשלה.", 500);
      return ok({ event: result.data });
    }

    if (profile.role !== "admin" && payload.kindergarten_id !== profile.garden_id) return fail("אין הרשאה לגן הזה.", 403);
    for (const source of payload.sources) {
      if (source.camera_id) {
        const cameraError = await assertCameraScope(supabase, payload.kindergarten_id, source.camera_id);
        if (cameraError) return fail(cameraError, 403);
      }
      if (source.zone_id) {
        const zoneError = await assertZoneScope(supabase, payload.kindergarten_id, source.zone_id);
        if (zoneError) return fail(zoneError, 403);
      }
    }

    const sources = payload.sources as CorrelationSource[];
    const timeline = buildCorrelationTimeline(sources);
    const correlation = calculateCorrelationConfidence(sources);
    const times = timeline.map((item) => item.event_time).filter(Boolean).map((value) => new Date(value as string).getTime()).filter(Number.isFinite);
    const eventResult = await supabase.from("observer_correlated_events" as any).insert({
      observer_site_id: payload.observer_site_id ?? null,
      kindergarten_id: payload.kindergarten_id,
      correlation_type: payload.correlation_type,
      severity: inferCorrelationSeverity(sources),
      confidence: correlation.confidence,
      status: "open",
      start_time: times.length ? new Date(Math.min(...times)).toISOString() : new Date().toISOString(),
      end_time: times.length ? new Date(Math.max(...times)).toISOString() : null,
      entry_zone_id: correlation.zoneIds[0] ?? null,
      destination_zone_id: correlation.zoneIds[correlation.zoneIds.length - 1] ?? null,
      involved_camera_ids: correlation.cameraIds,
      involved_zone_ids: correlation.zoneIds,
      timeline_summary: timeline,
      confidence_factors: correlation.factors,
      metadata: {
        mock: true,
        correlation_only: true,
        no_identity_tracking: true,
        no_biometric_tracking: true,
        no_child_profiling: true,
        no_staff_profiling: true,
        human_review_required: true
      }
    }).select("*").single();
    if (eventResult.error || !eventResult.data) return fail("יצירת אירוע מקושר נכשלה: " + (eventResult.error?.message ?? ""), 400);

    const links = timeline.map((item) => ({
      correlated_event_id: eventResult.data.id,
      source_type: item.source_type,
      source_id: item.source_id,
      observer_site_id: payload.observer_site_id ?? null,
      kindergarten_id: payload.kindergarten_id,
      camera_id: item.camera_id,
      zone_id: item.zone_id,
      event_time: item.event_time,
      confidence: sources.find((source) => source.source_id === item.source_id)?.confidence ?? null,
      sequence_order: item.order,
      metadata: { mock: true, event_correlation_only: true, no_identity_tracking: true }
    }));
    const linkResult = await supabase.from("observer_correlated_event_links" as any).insert(links).select("*");
    if (linkResult.error) return fail("אירוע נוצר אך קישור ה-timeline נכשל: " + linkResult.error.message, 500);
    return ok({ event: eventResult.data, links: linkResult.data ?? [] });
  } catch (error) {
    return handleRouteError(error);
  }
}
