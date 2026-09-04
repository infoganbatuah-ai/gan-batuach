import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { eventJournalService } from "@/lib/domain/event-engine/event-journal-service";
import { guardJournalQuerySchema, guardQueryClarification } from "@/lib/domain/digital-observer/guard-chat-query";
import { guardContextForSite, guardHistoryPrivacyRestricted, searchGuardJournal } from "@/lib/domain/event-engine/guard-journal-search";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const url = new URL(request.url);
    const siteId = url.searchParams.get("observer_site_id");
    if (!siteId) return fail("חסר מזהה אתר.", 422);
    const site = await getObserverSiteAccess(session.supabase as any, session.profile, siteId);
    if (!site) return fail("אין הרשאה לאתר הזה.", 403);
    if (guardHistoryPrivacyRestricted(site)) return fail("חיפוש היסטורי זה אינו זמין באתר עם ילדים, במצב שלדים בלבד או כאשר סוג האתר אינו מזוהה, עד להתאמת מסנן פרטיות ייעודי. לא נקראו אירועי זיהוי.", 403);
    if (url.searchParams.has("query")) {
      try {
        const input = guardJournalQuerySchema.parse(JSON.parse(url.searchParams.get("query")!));
        const cameras = await (session.supabase as any).from("digital_observer_camera_sources")
          .select("id,observer_site_id,camera_stream_id,display_name,location_label,metadata").eq("observer_site_id", site.id);
        if (cameras.error) return fail("לא ניתן לקרוא כרגע את מקורות היומן.", 503);
        const result = await searchGuardJournal(session.supabase, input, guardContextForSite(site, cameras.data ?? []), cameras.data ?? []);
        return ok({ ...result, count: result.events.length, grouped: true });
      } catch (error) {
        if (error instanceof Error && error.message === "GUARD_JOURNAL_UNAVAILABLE") return fail("לא ניתן לקרוא כרגע את היומן.", 503);
        return fail(guardQueryClarification(error), 422);
      }
    }
    const requestedLimit = Number(url.searchParams.get("limit") || 100);
    const limit = Number.isFinite(requestedLimit) ? Math.min(200, Math.max(1, Math.floor(requestedLimit))) : 100;
    const events = await eventJournalService.getDashboardEvents(session.supabase as any, { observerSiteId: siteId, limit });
    return ok({ events, count: events.length, source: "observer_intelligence_signals", grouped: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
