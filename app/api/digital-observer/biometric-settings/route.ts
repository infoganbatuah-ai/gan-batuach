import { randomUUID } from "node:crypto";
import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";

const schema = z.object({
  observer_site_id: z.string().uuid(),
  action: z.enum(["enable_setup", "disable_setup"]),
  explicit_consent: z.boolean().default(false)
});

async function auditSiteBiometricConsent(supabase: any, input: {
  siteId: string;
  profileId: string;
  enabled: boolean;
}) {
  const { error } = await supabase.from("observer_capability_audit_events" as any).insert({
    event_key: `site-biometric-${input.enabled ? "enabled" : "disabled"}-${randomUUID()}`,
    event_type: input.enabled ? "consent_recorded" : "consent_revoked",
    vertical_key: "home_observer",
    capability_key: "face_recognition",
    actor_profile_id: input.profileId,
    status: "success",
    reason: input.enabled
      ? "Site owner explicitly enabled consent-gated biometric setup. Matching remains disabled until per-person consent and a verified local model are present."
      : "Site owner disabled biometric setup. Matching is disabled for the site.",
    metadata: {
      observer_site_id: input.siteId,
      consent_scope: "site_biometric_setup",
      biometric_setup_enabled: input.enabled,
      biometric_matching_active: false,
      per_person_consent_required: true,
      local_verified_model_required: true
    }
  });
  if (error) throw error;
}

export async function POST(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const payload = schema.parse(await request.json());
    const supabase = session.supabase as any;
    const site = await getObserverSiteAccess(supabase, session.profile, payload.observer_site_id, { manage: true });
    if (!site) return fail("אין הרשאה לעדכן את הגדרות הביומטריה באתר.", 403);
    if (payload.action === "enable_setup" && !payload.explicit_consent) {
      return fail("נדרשת הסכמה מפורשת להפעלת מסלול הביומטריה באתר.", 422);
    }
    if (payload.action === "enable_setup" && ((site as any).vision_privacy_mode === "skeleton_only" || (site as any).business_handles_children)) {
      return fail("זיהוי פנים חסום באתר המטפל בילדים. באתר זה מותר ניתוח שלד ותנועה בלבד.", 403);
    }

    const enabled = payload.action === "enable_setup";
    const now = new Date().toISOString();
    const metadata = site.metadata && typeof site.metadata === "object" ? site.metadata : {};
    const { error: siteError } = await supabase.from("observer_sites" as any).update({
      metadata: {
        ...metadata,
        biometric_setup_consent: enabled,
        biometric_setup_consent_at: enabled ? now : null,
        biometric_setup_consent_version: "site-and-person-v1",
        biometric_matching_requested: enabled,
        biometric_matching_active: false,
        biometric_matching_block_reason: enabled ? "verified_local_matching_model_and_person_profiles_required" : "site_consent_disabled"
      },
      updated_at: now
    }).eq("id", site.id);
    if (siteError) return fail("לא ניתן לשמור את הרשאת הביומטריה.", 400);

    await auditSiteBiometricConsent(supabase, { siteId: site.id, profileId: session.profile.id, enabled });
    return ok({
      biometric_setup_enabled: enabled,
      biometric_matching_active: false,
      message: enabled
        ? "הכנת הביומטריה הופעלה. כעת מוסיפים כל אדם בהסכמה; התאמת זהות תתחיל רק לאחר מודל מקומי מאומת."
        : "הכנת הביומטריה כובתה באתר. לא מתבצעת התאמת זהות."
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
