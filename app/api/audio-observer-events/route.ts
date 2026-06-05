import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const audioEventTypes = [
  "prolonged_crying_indicator",
  "distress_sound_indicator",
  "scream_indicator",
  "repeated_distress_indicator",
  "unusual_noise_indicator",
  "crowd_noise_spike",
  "argument_indicator",
  "impact_sound_indicator",
  "emergency_sound_indicator"
] as const;

const createSchema = z.object({
  action: z.literal("create_mock"),
  site_id: z.string().uuid().optional().nullable(),
  kindergarten_id: z.string().uuid().optional().nullable(),
  camera_id: z.string().uuid().optional().nullable(),
  event_type: z.enum(audioEventTypes),
  severity: z.enum(["info", "low", "medium", "high", "urgent", "critical"]).default("medium"),
  confidence: z.coerce.number().min(0).max(1).default(0.62),
  notes: z.string().trim().optional().nullable()
});

const reviewSchema = z.object({
  action: z.literal("review"),
  id: z.string().uuid(),
  review_status: z.enum(["reviewing", "confirmed", "dismissed", "escalated", "false_positive", "needs_more_data"]),
  notes: z.string().trim().optional().nullable()
});

const schema = z.discriminatedUnion("action", [createSchema, reviewSchema]);

const actionText: Record<string, string> = {
  prolonged_crying_indicator: "בדיקה אם מדובר בבכי ממושך שדורש תשומת לב.",
  distress_sound_indicator: "בדיקה אם הצליל מצביע על מצוקה אפשרית.",
  scream_indicator: "בדיקה אנושית של אינדיקציה לצעקה.",
  repeated_distress_indicator: "בדיקה של דפוס מצוקה חוזר.",
  unusual_noise_indicator: "בדיקה אם הרעש חריג לשגרת המקום.",
  crowd_noise_spike: "בדיקה של עליית רעש קבוצתית חריגה.",
  argument_indicator: "בדיקה זהירה של אינדיקציה לוויכוח.",
  impact_sound_indicator: "בדיקה אם נשמע קול חבטה או נפילה אפשרית.",
  emergency_sound_indicator: "בדיקה מיידית של אינדיקציית חירום אפשרית."
};

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["admin", "manager", "owner"]);
    const payload = schema.parse(await request.json());
    const supabase = await createClient();

    if (payload.action === "create_mock") {
      const kindergartenId = profile.role === "admin" ? payload.kindergarten_id ?? null : profile.garden_id;
      if (!kindergartenId && !payload.site_id) return fail("יש לבחור גן או אתר Observer.", 422);
      if (profile.role !== "admin" && payload.kindergarten_id && payload.kindergarten_id !== profile.garden_id) return fail("אין הרשאה לגן הזה.", 403);
      if (payload.camera_id) {
        const camera = await supabase.from("camera_streams" as any).select("id, garden_id").eq("id", payload.camera_id).single();
        if (camera.error || !camera.data) return fail("מקור השמע לא נמצא.", 404);
        if (kindergartenId && camera.data.garden_id !== kindergartenId) return fail("מקור השמע אינו משויך לגן שנבחר.", 403);
        if (profile.role !== "admin" && camera.data.garden_id !== profile.garden_id) return fail("אין הרשאה למקור השמע הזה.", 403);
      }
      const row = {
        site_id: payload.site_id ?? null,
        kindergarten_id: kindergartenId,
        camera_id: payload.camera_id ?? null,
        event_type: payload.event_type,
        severity: payload.severity,
        confidence: payload.confidence,
        review_status: "pending_review",
        recommended_action: actionText[payload.event_type],
        notes: payload.notes ?? "אירוע שמע mock בלבד. אין speech-to-text ואין מסקנה אוטומטית.",
        audio_source_type: "mock",
        audio_window_metadata: { mock: true, raw_audio_stored: false, speech_to_text: false },
        keyword_config: { future_ready: true, speech_to_text_enabled: false, phrase_detection_enabled: false },
        metadata: { mock: true, human_review_required: true, parent_visible: false, no_voice_identification: true }
      };
      const result = await supabase.from("audio_observer_events" as any).insert(row).select("*").single();
      if (result.error || !result.data) {
        console.error("[audio-observer-create-mock]", result.error);
        return fail("לא ניתן ליצור אירוע שמע mock כרגע.", 500);
      }
      return ok({ event: result.data });
    }

    const existing = await supabase.from("audio_observer_events" as any).select("*").eq("id", payload.id).single();
    if (existing.error || !existing.data) return fail("אירוע השמע לא נמצא.", 404);
    if (profile.role !== "admin" && existing.data.kindergarten_id !== profile.garden_id) return fail("אין הרשאה לאירוע הזה.", 403);
    const update = await supabase
      .from("audio_observer_events" as any)
      .update({
        review_status: payload.review_status,
        reviewed_by: profile.id,
        reviewed_at: new Date().toISOString(),
        notes: payload.notes ?? existing.data.notes,
        updated_at: new Date().toISOString(),
        metadata: { ...(existing.data.metadata ?? {}), reviewed_by_human: true, no_automatic_accusation: true }
      })
      .eq("id", payload.id)
      .select("*")
      .single();
    if (update.error || !update.data) return fail("לא ניתן לשמור review לאירוע השמע.", 500);
    return ok({ event: update.data });
  } catch (error) {
    return handleRouteError(error);
  }
}
