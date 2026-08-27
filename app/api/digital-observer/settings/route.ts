import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";

const schema = z.object({
  observer_site_id: z.string().uuid(),
  schedule_mode: z.enum(["24_7", "night_only", "business_hours", "custom_schedule", "event_only"]),
  quiet_start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  quiet_end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  in_app: z.boolean().default(true),
  email: z.boolean().default(false),
  push: z.boolean().default(false),
  sms: z.boolean().default(false),
  whatsapp: z.boolean().default(false),
  monitoring_consent: z.boolean().default(false),
  safe_action_consent: z.boolean().default(false),
  model_improvement_consent: z.boolean().default(false)
});

export async function GET(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const observerSiteId = new URL(request.url).searchParams.get("observer_site_id");
    if (!observerSiteId) return fail("חסר מזהה אתר.", 422);
    const site = await getObserverSiteAccess(session.supabase as any, session.profile, observerSiteId);
    if (!site) return fail("אין הרשאה לצפות בהגדרות האתר.", 403);
    const [profileResult, baselineResult] = await Promise.all([
      (session.supabase as any).from("observer_site_learning_profiles").select("learning_status,learning_maturity,baseline_version,confidence_level,anomaly_readiness_score,routine_confidence,updated_at").eq("observer_site_id", observerSiteId).maybeSingle(),
      (session.supabase as any).from("site_behavior_baselines").select("baseline_value,confidence_level,learning_maturity,anomaly_readiness_score,last_calibrated_at,updated_at").eq("observer_site_id", observerSiteId).eq("baseline_type", "normal_camera_activity").maybeSingle()
    ]);
    return ok({
      monitoring_enabled: site.monitoring_enabled === true,
      observer_runtime_status: site.observer_runtime_status ?? "setup",
      consents: {
        monitoring: site.metadata?.observer_monitoring_consent === true,
        safe_actions: site.metadata?.observer_safe_action_consent === true,
        model_improvement: site.metadata?.model_improvement_consent === true,
        model_improvement_scope: site.metadata?.model_improvement_scope ?? null,
        raw_video_model_training_allowed: false
      },
      learning_profile: profileResult.data ?? null,
      camera_activity_baseline: baselineResult.data ?? null
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const { profile, supabase: sessionSupabase } = session;
    const supabase = sessionSupabase as any;
    const payload = schema.parse(await request.json());
    const site = await getObserverSiteAccess(supabase, profile, payload.observer_site_id, { manage: true });
    if (!site) return fail("אין הרשאה לעדכן את הגדרות האתר.", 403);
    const now = new Date().toISOString();
    const existingMetadata = site.metadata && typeof site.metadata === "object" ? site.metadata : {};
    const { error: consentError } = await supabase.from("observer_sites" as any).update({
      monitoring_enabled: payload.monitoring_consent,
      observer_runtime_status: payload.monitoring_consent ? "learning_readiness" : "setup",
      learning_started_at: payload.monitoring_consent ? (site.learning_started_at ?? now) : null,
      metadata: {
        ...existingMetadata,
        observer_monitoring_consent: payload.monitoring_consent,
        observer_monitoring_consent_at: payload.monitoring_consent ? now : null,
        observer_safe_action_consent: payload.safe_action_consent,
        observer_safe_action_consent_at: payload.safe_action_consent ? now : null,
        model_improvement_consent: payload.model_improvement_consent,
        model_improvement_consent_at: payload.model_improvement_consent ? now : null,
        model_improvement_consent_version: "deidentified-insights-v1",
        model_improvement_scope: "deidentified_insights_only",
        raw_video_model_training_allowed: false,
        physical_actions_require_confirmation: true
      },
      updated_at: now
    }).eq("id", payload.observer_site_id);
    if (consentError) return fail("לא ניתן לשמור את הרשאות התצפיתן.", 400);
    if (payload.monitoring_consent) await supabase.rpc("initialize_digital_observer_learning" as any, { requested_site_id: payload.observer_site_id });
    const { error: scheduleError } = await supabase.from("observer_monitoring_schedules" as any).upsert({
      observer_site_id: payload.observer_site_id,
      schedule_mode: payload.schedule_mode,
      timezone: "Asia/Jerusalem",
      schedule: { mode: payload.schedule_mode, quiet_hours: { start: payload.quiet_start, end: payload.quiet_end } },
      status: "draft",
      updated_at: now
    }, { onConflict: "observer_site_id" });
    if (scheduleError) return fail("לא ניתן לשמור את לוח הניטור.", 400);

    const channels = [
      ["in_app", payload.in_app, "mock"],
      ["email", payload.email, "mock"],
      ["push", payload.push, "mock"],
      ["sms", payload.sms, "disabled"],
      ["whatsapp", payload.whatsapp, "disabled"]
    ] as const;
    for (const [channel, enabled, providerMode] of channels) {
      const existing = await supabase.from("observer_alert_channel_settings" as any)
        .select("id")
        .eq("observer_site_id", payload.observer_site_id)
        .eq("member_profile_id", profile.id)
        .eq("channel", channel)
        .maybeSingle();
      const row = {
        observer_site_id: payload.observer_site_id,
        member_profile_id: profile.id,
        recipient_name: profile.full_name,
        channel,
        severity_levels: ["high", "urgent", "critical"],
        enabled,
        package_allowed: channel === "in_app" || channel === "email" || channel === "push",
        provider_mode: providerMode,
        metadata: { production_send_disabled: true },
        updated_at: now
      };
      if (existing.data?.id) await supabase.from("observer_alert_channel_settings" as any).update(row).eq("id", existing.data.id);
      else await supabase.from("observer_alert_channel_settings" as any).insert(row);
    }
    return ok({ saved: true, monitoring_enabled: payload.monitoring_consent, safe_actions_enabled: payload.safe_action_consent, model_improvement_enabled: payload.model_improvement_consent, production_send_enabled: false, message: "ההגדרות וההסכמות נשמרו. פעולות פיזיות עדיין דורשות אישור מיידי." });
  } catch (error) {
    return handleRouteError(error);
  }
}
