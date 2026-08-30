import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const observerSiteId = z.string().uuid().parse(new URL(request.url).searchParams.get("observer_site_id"));
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const site = await getObserverSiteAccess(session.supabase as any, session.profile, observerSiteId);
    if (!site) return fail("אין הרשאה לצפות במצב החיבור באתר הזה.", 403);

    const [sources, enrollment] = await Promise.all([
      session.supabase
        .from("digital_observer_camera_sources" as any)
        .select("status,health_status,last_health_check_at")
        .eq("observer_site_id", observerSiteId)
        .in("connector_type", ["dvr", "nvr"]),
      (createAdminClient() as any)
        .from("video_gateway_device_enrollments")
        .select("status,updated_at")
        .eq("observer_site_id", observerSiteId)
        .eq("status", "delivered")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    ]);
    if (sources.error) throw new Error(sources.error.message);
    const rows = sources.data ?? [];
    const latestHealth = rows
      .map((row: any) => String(row.last_health_check_at ?? ""))
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;
    const connected = rows.filter((row: any) => row.status === "connected" && row.health_status === "healthy").length;

    return ok({
      camera_count: rows.length,
      connected_camera_count: connected,
      offline_camera_count: Math.max(0, rows.length - connected),
      gateway_enrolled: Boolean(enrollment.data),
      checked_at: latestHealth,
      truthful_status: connected > 0 ? "connected" : enrollment.data ? "enrolled_waiting_for_discovery" : "not_enrolled"
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
