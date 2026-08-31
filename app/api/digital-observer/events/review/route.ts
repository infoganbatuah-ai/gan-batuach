import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { observerEventMediaState } from "@/lib/domain/digital-observer/event-evidence";

const schema = z.object({
  signal_id: z.string().uuid(),
  review_status: z.enum(["reviewing", "confirmed", "dismissed", "resolved", "escalated"]),
  note: z.string().trim().max(1000).optional().default("")
});

export async function POST(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const { profile, supabase: sessionSupabase } = session;
    const supabase = sessionSupabase as any;
    const payload = schema.parse(await request.json());
    const { data: signal } = await supabase.from("observer_intelligence_signals" as any)
      .select("id,observer_site_id,camera_id,review_status,metadata")
      .eq("id", payload.signal_id)
      .maybeSingle();
    if (!signal?.observer_site_id) return fail("האירוע לא נמצא או אינו שייך למוצר העצמאי.", 404);
    const site = await getObserverSiteAccess(supabase, profile, signal.observer_site_id, { manage: true });
    if (!site) return fail("אין הרשאה לסקור את האירוע.", 403);

    if (["confirmed", "dismissed", "resolved"].includes(payload.review_status)) {
      const reference = signal.metadata?.camera_source_id ?? signal.camera_id;
      if (!reference) return fail("לא ניתן לאשר אירוע ללא מקור וראיות. אפשר להעבירו לבדיקה טכנית.", 422);
      const { data: camera } = await supabase.from("digital_observer_camera_sources")
        .select("id").eq("id", reference).eq("observer_site_id", signal.observer_site_id).maybeSingle();
      const { data: clip } = await supabase.from("digital_observer_event_clips")
        .select("id,camera_source_id,clip_status,captured_at,delete_after,retention_hours,metadata")
        .eq("signal_id", signal.id).eq("observer_site_id", signal.observer_site_id).maybeSingle();
      if (!camera || clip?.camera_source_id !== camera.id || observerEventMediaState(clip) !== "available") {
        return fail("לא ניתן לאשר אירוע ללא תמונה וסרטון בתוקף. אפשר להעבירו לבדיקה אנושית.", 422);
      }
    }

    const now = new Date().toISOString();
    const { data: review, error: reviewError } = await supabase.from("observer_signal_reviews" as any).insert({
      signal_id: signal.id,
      reviewer_id: profile.id,
      reviewer_role: profile.role === "admin" ? "admin" : "observer_site_owner",
      review_status: payload.review_status,
      review_note: payload.note || null,
      recommended_next_step: payload.review_status === "escalated" ? "בדיקה אנושית והסלמה לפי נוהל האתר" : null,
      metadata: { product: "digital_observer", no_automatic_accusation: true, decision_policy_version: "evidence-review-v1", identity_authorization_changed: false, physical_action_executed: false }
    }).select("id,review_status,created_at").single();
    if (reviewError) return fail("לא ניתן לשמור את ביקורת האירוע.", 400);

    const { data: updated, error } = await supabase.from("observer_intelligence_signals" as any).update({
      review_status: payload.review_status,
      reviewed_at: now,
      resolved_at: payload.review_status === "resolved" ? now : null,
      metadata: { ...(signal.metadata ?? {}), reviewed_in_digital_observer: true }
    }).eq("id", signal.id).select("id,review_status,reviewed_at,resolved_at").single();
    if (error) return fail("הביקורת נשמרה אך סטטוס האירוע לא עודכן.", 409);
    const feedbackResult = await supabase.rpc("record_digital_observer_feedback" as any, {
      requested_signal_id: signal.id,
      requested_outcome: payload.review_status,
      requested_note: payload.note || null
    });
    return ok({
      review,
      signal: updated,
      feedback_recorded: !feedbackResult.error,
      message: payload.review_status === "dismissed"
        ? "האירוע סומן כתקין עבור דפוס זה. הוא לא הוגדר כמותר באופן גורף."
        : "הביקורת נשמרה ותשמש לכיול מבוקר של התצפיתן."
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
