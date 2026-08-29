import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { preparePushForNotification } from "@/lib/domain/push-service";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

const schema = z.object({ observer_site_id: z.string().uuid() });

export async function POST(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const { profile, supabase: sessionSupabase } = session;
    const supabase = sessionSupabase as any;
    const payload = schema.parse(await request.json());
    const site = await getObserverSiteAccess(supabase, profile, payload.observer_site_id, { manage: true });
    if (!site) return fail("אין הרשאה לבדוק Push באתר הזה.", 403);
    if (!isAdminClientConfigured()) return fail("חסרה תצורת שרת מאובטחת לשליחת Push.", 503);
    const admin = createAdminClient() as any;

    const pushResult = await preparePushForNotification(admin, {
      profileId: profile.id,
      category: "observer_alert",
      title: "בדיקת Push — תצפיתן דיגיטלי",
      body: "החיבור הושלם בהצלחה. התראות התצפיתן פעילות במכשיר הזה.",
      actionUrl: "/digital-observer/alerts",
      deepLinkType: "observer_event",
      critical: true,
      metadata: { observer_site_id: payload.observer_site_id, source: "digital_observer_live_push_test" }
    });
    const sent = pushResult.logs.some((log: any) => ["sent", "delivered", "opened"].includes(log.status));

    await admin.from("digital_observer_notification_deliveries" as any).insert({
      observer_site_id: payload.observer_site_id,
      recipient_profile_id: profile.id,
      channel: "push",
      severity: "info",
      provider_mode: "live",
      delivery_status: sent ? "sent" : "failed",
      attempt_count: 1,
      sent_at: sent ? new Date().toISOString() : null,
      failure_reason: sent ? null : pushResult.error || "No active FCM device received the test.",
      metadata: { qa_test: true, external_message_sent: sent, push_logs: pushResult.logs }
    });

    if (!sent) return fail(pushResult.error || "לא נמצא מכשיר FCM פעיל או שהשליחה נכשלה.", 502);
    return ok({ sent: true, logs: pushResult.logs, message: "התראת Push אמיתית נשלחה למכשיר." }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
