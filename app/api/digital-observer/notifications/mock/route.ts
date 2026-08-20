import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getObserverSiteAccess, requireDigitalObserverUser } from "@/lib/domain/digital-observer/access";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ observer_site_id: z.string().uuid(), channel: z.enum(["in_app", "push", "email", "sms", "whatsapp", "voice"]) });

export async function POST(request: Request) {
  try {
    const { profile } = await requireDigitalObserverUser();
    const payload = schema.parse(await request.json());
    const supabase = await createClient();
    const site = await getObserverSiteAccess(supabase, profile, payload.observer_site_id, { manage: true });
    if (!site) return fail("אין הרשאה לבדוק התראה באתר.", 403);
    const { data, error } = await supabase.from("digital_observer_notification_deliveries" as any).insert({
      observer_site_id: payload.observer_site_id,
      recipient_profile_id: profile.id,
      channel: payload.channel,
      severity: "info",
      provider_mode: "mock",
      delivery_status: "mocked",
      attempt_count: 1,
      sent_at: new Date().toISOString(),
      metadata: { qa_test: true, no_external_message_sent: true }
    }).select("id,channel,provider_mode,delivery_status,sent_at").single();
    if (error) return fail("לא ניתן לשמור בדיקת התראה מדומה.", 400);
    return ok({ delivery: data, external_message_sent: false, message: "הבדיקה נרשמה בתוך המערכת בלבד." }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
