import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { createObserverEngine, tenantTypeForCamera } from "@/lib/domain/observer-engine";

const schema = z.object({
  candidate_id: z.string().uuid(),
  outcome: z.enum(["known", "unknown", "dismissed"]),
  display_name: z.string().trim().max(100).optional().default(""),
  relationship_label: z.string().trim().max(80).optional().default(""),
  explicit_consent: z.boolean().default(false)
});

export async function POST(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const { profile, supabase: sessionSupabase } = session;
    const supabase = sessionSupabase as any;
    const payload = schema.parse(await request.json());

    const { data: candidate, error: candidateError } = await supabase
      .from("digital_observer_identity_candidates" as any)
      .select("id,observer_site_id,candidate_status")
      .eq("id", payload.candidate_id)
      .maybeSingle();
    if (candidateError || !candidate) return fail("המועמד לזיהוי לא נמצא או ששכבת הלמידה טרם הופעלה.", 404);

    const site = await getObserverSiteAccess(supabase, profile, candidate.observer_site_id, { manage: true });
    if (!site) return fail("אין הרשאה לסקור את המועמד הזה.", 403);
    if (tenantTypeForCamera(site) !== "STANDARD") return fail("מסלול הזיהוי הביומטרי אינו זמין באתר זה.", 403);
    createObserverEngine("STANDARD");
    if ((site as any).vision_privacy_mode === "skeleton_only" || (site as any).business_handles_children) {
      return fail("זיהוי פנים חסום באתר המטפל בילדים. באתר זה התצפיתן משתמש בשלד ובדפוסי תנועה בלבד.", 403);
    }
    if (!["observing", "ready_for_review"].includes(String(candidate.candidate_status))) {
      return fail("המועמד כבר נבדק.", 409);
    }

    const { data, error } = await supabase.rpc("review_digital_observer_identity_candidate" as any, {
      requested_candidate_id: payload.candidate_id,
      requested_outcome: payload.outcome,
      requested_display_name: payload.display_name || null,
      requested_relationship_label: payload.relationship_label || null,
      requested_explicit_consent: payload.explicit_consent
    });
    if (error) {
      const message = String(error.message || "");
      if (message.includes("EXPLICIT_CONSENT_REQUIRED")) return fail("נדרשת הסכמה מפורשת לפני שמירת אדם מוכר.", 422);
      if (message.includes("KNOWN_PERSON_NAME_REQUIRED")) return fail("יש להזין שם לאדם המוכר.", 422);
      if (message.includes("BIOMETRIC_REVIEW_BLOCKED")) return fail("זיהוי פנים חסום באתר זה.", 403);
      return fail("לא ניתן לשמור את החלטת הזיהוי.", 400);
    }

    return ok({
      review: data,
      message: payload.outcome === "known"
        ? "האדם נוסף לרשימת המוכרים במצב מוכנות. זיהוי ביומטרי חי עדיין כבוי."
        : payload.outcome === "unknown"
          ? "האדם סומן כלא מוכר עבור האתר הזה. לא בוצעה פעולה אוטומטית."
          : "המועמד הוסר מתור הבדיקה."
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
