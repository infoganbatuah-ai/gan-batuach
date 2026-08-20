import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { createClient } from "@/lib/supabase/server";

const createSchema = z.object({
  action: z.literal("create"),
  observer_site_id: z.string().uuid(),
  display_name: z.string().trim().min(2).max(100),
  relationship_label: z.string().trim().max(80).optional().default(""),
  consent_confirmed: z.boolean().default(false),
  notify_on_detection: z.boolean().default(false)
});
const deleteSchema = z.object({ action: z.literal("delete"), id: z.string().uuid() });
const schema = z.discriminatedUnion("action", [createSchema, deleteSchema]);

export async function POST(request: Request) {
  try {
    const session = await getDigitalObserverApiUser();
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const { profile } = session;
    const payload = schema.parse(await request.json());
    const supabase = await createClient();

    if (payload.action === "create") {
      const site = await getObserverSiteAccess(supabase, profile, payload.observer_site_id, { manage: true });
      if (!site) return fail("אין הרשאה להוסיף אדם לאתר.", 403);
      const { data, error } = await supabase.from("digital_observer_known_people" as any).insert({
        observer_site_id: payload.observer_site_id,
        display_name: payload.display_name,
        relationship_label: payload.relationship_label || null,
        consent_status: payload.consent_confirmed ? "approved" : "pending",
        recognition_status: "readiness",
        notify_on_detection: payload.notify_on_detection,
        created_by: profile.id,
        metadata: { image_pending: true, biometric_processing_active: false, explicit_consent_recorded: payload.consent_confirmed }
      }).select("id,display_name,relationship_label,consent_status,recognition_status,notify_on_detection").single();
      if (error) return fail("לא ניתן לשמור את האדם המוכר.", 400);
      return ok({ person: data, message: "האדם נשמר במצב מוכנות. זיהוי פנים אינו פעיל ללא תמונה, הסכמה וחיבור AI מאושר." }, 201);
    }

    const { data: person } = await supabase.from("digital_observer_known_people" as any)
      .select("id,observer_site_id")
      .eq("id", payload.id)
      .maybeSingle();
    if (!person) return fail("האדם לא נמצא.", 404);
    const site = await getObserverSiteAccess(supabase, profile, person.observer_site_id, { manage: true });
    if (!site) return fail("אין הרשאה למחוק את הרשומה.", 403);
    const { error } = await supabase.from("digital_observer_known_people" as any).delete().eq("id", payload.id);
    if (error) return fail("לא ניתן למחוק את הרשומה.", 400);
    return ok({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
