import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { buildDvrGatewayStatus, createDvrPlaybackSession, type DvrGatewayEventRow } from "@/lib/domain/digital-observer/dvr-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sessionSchema = z.object({
  observer_site_id: z.string().uuid(),
  channel: z.coerce.number().int().min(1).max(64),
  mode: z.enum(["live", "playback"]).default("live"),
  token: z.string().trim().max(512).optional()
});

async function requireSiteAccess(request: Request, observerSiteId: string) {
  const session = await getDigitalObserverApiUser(request);
  if (!session) return { error: fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401) };

  const site = await getObserverSiteAccess(session.supabase as any, session.profile, observerSiteId);
  if (!site) return { error: fail("אין הרשאה לצפות באתר הזה.", 403) };
  return { session, site };
}

async function loadReviewedEvents(supabase: any, observerSiteId: string): Promise<DvrGatewayEventRow[]> {
  const { data, error } = await supabase
    .from("observer_intelligence_signals" as any)
    .select("id,camera_id,camera_source_id,signal_type,severity,confidence,review_status,recommended_action,created_at,reviewed_at,resolved_at")
    .eq("observer_site_id", observerSiteId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return [];
  return data ?? [];
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const observerSiteId = url.searchParams.get("observer_site_id");
    if (!observerSiteId) return fail("חסר מזהה אתר.", 422);

    const access = await requireSiteAccess(request, observerSiteId);
    if (access.error) return access.error;

    const events = await loadReviewedEvents((access.session as any).supabase, observerSiteId);
    return ok(await buildDvrGatewayStatus(observerSiteId, events));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = sessionSchema.parse(await request.json());
    const access = await requireSiteAccess(request, payload.observer_site_id);
    if (access.error) return access.error;

    return ok(await createDvrPlaybackSession({
      observerSiteId: payload.observer_site_id,
      channel: payload.channel,
      mode: payload.mode,
      token: payload.token
    }));
  } catch (error) {
    return handleRouteError(error);
  }
}
