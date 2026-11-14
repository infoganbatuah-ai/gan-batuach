import { randomUUID } from "node:crypto";
import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { queueAuthorizedDelivery } from "@/lib/domain/digital-observer/notification-delivery-service";
import { actionIntentDraft } from "@/lib/domain/digital-observer/notification-orchestration";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const schema = z.object({ observer_site_id: z.string().uuid() }).strict();

export async function POST(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const payload = schema.parse(await request.json());
    const site = await getObserverSiteAccess(session.supabase, session.profile, payload.observer_site_id, { manage: true });
    if (!site) return fail("אין הרשאה לבדוק Push באתר הזה.", 403);
    if (!isAdminClientConfigured()) return fail("חסרה תצורת שרת מאובטחת לבדיקת חוזה Push.", 503);
    const admin = createAdminClient() as any;

    const draft = actionIntentDraft({
      siteId: payload.observer_site_id,
      sourceId: randomUUID(),
      sourceProvenance: "HUMAN_AUTHORIZED",
      actionType: "notify",
      requestedBy: session.profile.id,
      severity: "info",
      proposedAction: { purpose: "push_contract_test", external_delivery_authorized: false }
    });
    const intentResult = await admin.from("digital_observer_action_intents").insert({
      ...draft,
      intent_status: "authorized",
      authorized_by: session.profile.id,
      policy_snapshot: { production_provider_activation_authorized: false, external_delivery_authorized: false }
    }).select("id").single();
    if (intentResult.error || !intentResult.data) return fail("לא ניתן לשמור את בדיקת חוזה Push.", 503);
    const queued = await queueAuthorizedDelivery(admin, {
      actionIntentId: intentResult.data.id,
      observerSiteId: payload.observer_site_id,
      recipientProfileId: session.profile.id,
      channel: "push",
      severity: "info",
      priority: 1,
      title: "בדיקת Push — תצפיתן דיגיטלי",
      body: "בדיקת החוזה נרשמה. לא נשלחה הודעה לספק חיצוני.",
      productPath: "/digital-observer/settings",
      ttlSeconds: 600
    });
    return ok({ delivery: queued.delivery, external_message_sent: false, provider_mode: queued.delivery.provider_mode,
      message: "בדיקת חוזה Push נרשמה ללא שליחה חיצונית. הפעלת ספק Production דורשת אישור בעלים נפרד." }, 201);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("DELIVERY_")) return fail(error.message, 409);
    return handleRouteError(error);
  }
}
