import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";

const createSchema = z.object({
  action: z.literal("create"),
  observer_site_id: z.string().uuid(),
  display_name: z.string().trim().min(2).max(100),
  relationship_label: z.string().trim().max(80).optional().default(""),
  access_class: z.enum(["household_resident", "authorized_visitor", "service_provider", "other"]).default("authorized_visitor"),
  consent_confirmed: z.boolean().default(false),
  notify_on_detection: z.boolean().default(false),
  camera_source_ids: z.array(z.string().uuid()).min(1).max(64).default([])
});
const deleteSchema = z.object({ action: z.literal("delete"), id: z.string().uuid() });
const revokeSchema = z.object({ action: z.literal("revoke_consent"), id: z.string().uuid() });
const schema = z.discriminatedUnion("action", [createSchema, revokeSchema, deleteSchema]);

async function writeBiometricAudit(supabase: any, input: {
  eventType: "consent_recorded" | "consent_revoked" | "biometric_reference_deleted";
  profileId: string;
  observerSiteId: string;
  personId: string;
  cameraSourceIds?: string[];
  reason: string;
}) {
  const now = new Date().toISOString();
  const { error } = await supabase.from("observer_capability_audit_events" as any).insert({
    event_key: `known-person-${input.eventType}-${input.personId}-${now}`,
    event_type: input.eventType,
    vertical_key: "home_observer",
    capability_key: "face_recognition",
    actor_profile_id: input.profileId,
    status: "success",
    reason: input.reason,
    metadata: {
      observer_site_id: input.observerSiteId,
      known_person_id: input.personId,
      camera_source_ids: input.cameraSourceIds ?? [],
      biometric_processing_active: false,
      no_biometric_reference_returned: true
    }
  });
  if (error) throw error;
}

export async function POST(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const { profile, supabase: sessionSupabase } = session;
    const supabase = sessionSupabase as any;
    const payload = schema.parse(await request.json());

    if (payload.action === "create") {
      const site = await getObserverSiteAccess(supabase, profile, payload.observer_site_id, { manage: true });
      if (!site) return fail("אין הרשאה להוסיף אדם לאתר.", 403);
      if ((site as any).vision_privacy_mode === "skeleton_only" || (site as any).business_handles_children) {
        return fail("זיהוי פנים חסום באתר המטפל בילדים. באתר זה נעשה שימוש בניתוח שלד ותנועה בלבד.", 403);
      }
      if ((site as any).metadata?.biometric_setup_consent !== true) {
        return fail("יש להפעיל תחילה את הרשאת הביומטריה באתר לפני הוספת אדם מוכר.", 412);
      }
      if (!payload.consent_confirmed) return fail("נדרשת הסכמה מפורשת של האדם לפני קישורו למצלמות.", 422);

      const cameraSourceIds = [...new Set(payload.camera_source_ids)];
      const { data: scopedSources, error: scopedSourcesError } = await supabase
        .from("digital_observer_camera_sources" as any)
        .select("id")
        .eq("observer_site_id", site.id)
        .in("id", cameraSourceIds);
      if (scopedSourcesError || (scopedSources?.length ?? 0) !== cameraSourceIds.length) {
        return fail("אחת המצלמות שנבחרו אינה שייכת לאתר הזה.", 403);
      }

      const { data, error } = await supabase.from("digital_observer_known_people" as any).insert({
        observer_site_id: payload.observer_site_id,
        display_name: payload.display_name,
        relationship_label: payload.relationship_label || null,
        consent_status: "approved",
        recognition_status: "readiness",
        camera_scope: cameraSourceIds,
        notify_on_detection: payload.notify_on_detection,
        created_by: profile.id,
        metadata: {
          image_pending: true,
          access_class: payload.access_class,
          biometric_processing_active: false,
          explicit_consent_recorded: true,
          camera_scope_confirmed: true
        }
      }).select("id,display_name,relationship_label,consent_status,recognition_status,notify_on_detection").single();
      if (error) return fail("לא ניתן לשמור את האדם המוכר.", 400);
      await writeBiometricAudit(supabase, {
        eventType: "consent_recorded",
        profileId: profile.id,
        observerSiteId: payload.observer_site_id,
        personId: data.id,
        cameraSourceIds,
        reason: "Explicit consent recorded for the selected camera scope; biometric recognition remains disabled until a verified runtime is separately provisioned."
      });
      return ok({ person: data, message: "האדם נשמר במצב מוכנות. זיהוי פנים אינו פעיל ללא תמונה, הסכמה וחיבור AI מאושר." }, 201);
    }

    const { data: person } = await supabase.from("digital_observer_known_people" as any)
      .select("id,observer_site_id")
      .eq("id", payload.id)
      .maybeSingle();
    if (!person) return fail("האדם לא נמצא.", 404);
    const site = await getObserverSiteAccess(supabase, profile, person.observer_site_id, { manage: true });
    if (!site) return fail("אין הרשאה למחוק את הרשומה.", 403);

    if (payload.action === "revoke_consent") {
      const now = new Date().toISOString();
      const { error } = await supabase.from("digital_observer_known_people" as any).update({
        consent_status: "revoked",
        recognition_status: "disabled",
        image_storage_path: null,
        biometric_reference: null,
        last_confirmed_at: now,
        metadata: {
          biometric_processing_active: false,
          biometric_reference_deleted: true,
          explicit_consent_revoked_at: now,
          requires_fresh_explicit_consent: true
        },
        updated_at: now
      }).eq("id", payload.id);
      if (error) return fail("לא ניתן לבטל את ההסכמה.", 400);
      await writeBiometricAudit(supabase, {
        eventType: "consent_revoked",
        profileId: profile.id,
        observerSiteId: person.observer_site_id,
        personId: payload.id,
        reason: "Explicit consent revoked; recognition disabled and local biometric references cleared."
      });
      await writeBiometricAudit(supabase, {
        eventType: "biometric_reference_deleted",
        profileId: profile.id,
        observerSiteId: person.observer_site_id,
        personId: payload.id,
        reason: "Biometric reference pointers cleared after consent revocation."
      });
      return ok({ revoked: true, message: "ההסכמה בוטלה. זיהוי נשאר כבוי והפניות ביומטריות הוסרו." });
    }

    const { error } = await supabase.from("digital_observer_known_people" as any).delete().eq("id", payload.id);
    if (error) return fail("לא ניתן למחוק את הרשומה.", 400);
    await writeBiometricAudit(supabase, {
      eventType: "biometric_reference_deleted",
      profileId: profile.id,
      observerSiteId: person.observer_site_id,
      personId: payload.id,
      reason: "Known person record deleted by an authorized site manager."
    });
    return ok({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
