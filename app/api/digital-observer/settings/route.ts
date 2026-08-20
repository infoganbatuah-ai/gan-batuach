import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  observer_site_id: z.string().uuid(),
  schedule_mode: z.enum(["24_7", "night_only", "business_hours", "custom_schedule", "event_only"]),
  quiet_start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  quiet_end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  in_app: z.boolean().default(true),
  email: z.boolean().default(false),
  push: z.boolean().default(false),
  sms: z.boolean().default(false),
  whatsapp: z.boolean().default(false)
});

export async function POST(request: Request) {
  try {
    const { profile } = await requireUser();
    const payload = schema.parse(await request.json());
    const supabase = await createClient();
    const site = await getObserverSiteAccess(supabase, profile, payload.observer_site_id, { manage: true });
    if (!site) return fail("אין הרשאה לעדכן את הגדרות האתר.", 403);
    const now = new Date().toISOString();
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
    return ok({ saved: true, production_send_enabled: false, message: "ההגדרות נשמרו. ערוצי חוץ נשארו כבויים עד חיבור ספק מאושר." });
  } catch (error) {
    return handleRouteError(error);
  }
}
