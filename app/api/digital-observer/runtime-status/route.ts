import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";

export const dynamic = "force-dynamic";

const querySchema = z.object({ observer_site_id: z.string().uuid() });
const connectedStatuses = ["connected", "healthy", "online", "active"];
const openStatuses = ["needs_review", "reviewing", "escalated"];

export async function GET(request: Request) {
  try {
    const { observer_site_id: observerSiteId } = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const site = await getObserverSiteAccess(session.supabase as any, session.profile, observerSiteId);
    if (!site) return fail("אין הרשאה לאתר הזה.", 403);

    const supabase = session.supabase as any;
    const [sources, latestSignal, openSignals, latestBaseline] = await Promise.all([
      supabase.from("digital_observer_camera_sources").select("id,status,health_status").eq("observer_site_id", observerSiteId),
      supabase.from("observer_intelligence_signals").select("created_at").eq("observer_site_id", observerSiteId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("observer_intelligence_signals").select("id", { count: "exact", head: true }).eq("observer_site_id", observerSiteId).in("review_status", openStatuses),
      supabase.from("site_behavior_baselines").select("updated_at").eq("observer_site_id", observerSiteId).order("updated_at", { ascending: false }).limit(1).maybeSingle()
    ]);
    if (sources.error || latestSignal.error || openSignals.error || latestBaseline.error) throw new Error("OBSERVER_RUNTIME_STATUS_QUERY_FAILED");

    const cameras = sources.data ?? [];
    const connectedCameraCount = cameras.filter((camera: Record<string, unknown>) => connectedStatuses.includes(String(camera.status ?? camera.health_status))).length;
    return ok({
      checked_at: new Date().toISOString(),
      camera_count: cameras.length,
      connected_camera_count: connectedCameraCount,
      open_event_count: openSignals.count ?? 0,
      last_event_at: latestSignal.data?.created_at ?? null,
      last_learning_at: latestBaseline.data?.updated_at ?? null
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
