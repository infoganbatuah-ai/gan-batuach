import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  signal_id: z.string().uuid(),
  review_status: z.enum(["reviewing", "confirmed", "dismissed", "resolved", "escalated"]),
  note: z.string().trim().max(1000).optional().default("")
});

export async function POST(request: Request) {
  try {
    const { profile } = await requireUser();
    const payload = schema.parse(await request.json());
    const supabase = await createClient();
    const { data: signal } = await supabase.from("observer_intelligence_signals" as any)
      .select("id,observer_site_id,review_status,metadata")
      .eq("id", payload.signal_id)
      .maybeSingle();
    if (!signal?.observer_site_id) return fail("האירוע לא נמצא או אינו שייך למוצר העצמאי.", 404);
    const site = await getObserverSiteAccess(supabase, profile, signal.observer_site_id, { manage: true });
    if (!site) return fail("אין הרשאה לסקור את האירוע.", 403);

    const now = new Date().toISOString();
    const { data: review, error: reviewError } = await supabase.from("observer_signal_reviews" as any).insert({
      signal_id: signal.id,
      reviewer_id: profile.id,
      reviewer_role: profile.role === "admin" ? "admin" : "observer_site_owner",
      review_status: payload.review_status,
      review_note: payload.note || null,
      recommended_next_step: payload.review_status === "escalated" ? "בדיקה אנושית והסלמה לפי נוהל האתר" : null,
      metadata: { product: "digital_observer", no_automatic_accusation: true }
    }).select("id,review_status,created_at").single();
    if (reviewError) return fail("לא ניתן לשמור את ביקורת האירוע.", 400);

    const { data: updated, error } = await supabase.from("observer_intelligence_signals" as any).update({
      review_status: payload.review_status,
      reviewed_at: now,
      resolved_at: payload.review_status === "resolved" ? now : null,
      metadata: { ...(signal.metadata ?? {}), reviewed_in_digital_observer: true }
    }).eq("id", signal.id).select("id,review_status,reviewed_at,resolved_at").single();
    if (error) return fail("הביקורת נשמרה אך סטטוס האירוע לא עודכן.", 409);
    return ok({ review, signal: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}
