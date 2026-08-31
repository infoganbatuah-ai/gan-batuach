import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { buildDvrGatewayStatus, type DvrGatewayEventRow } from "@/lib/domain/digital-observer/dvr-gateway";
import { playbackRequestSchema } from "@/lib/domain/digital-observer/playback-request";
import { digitalObserverCameraIsConnected } from "@/lib/domain/digital-observer/camera-live-status";
import { issueGatewayPlaybackGrant } from "@/lib/domain/gateway-device-enrollment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const payload = playbackRequestSchema.parse(await request.json());
    const access = await requireSiteAccess(request, payload.observer_site_id);
    if (access.error) return access.error;

    if (payload.camera_source_id) {
      const { data: source, error } = await (access.session as any).supabase
        .from("digital_observer_camera_sources")
        .select("id,observer_site_id,status,health_status,metadata")
        .eq("id", payload.camera_source_id)
        .eq("observer_site_id", payload.observer_site_id)
        .single();
      if (error || !source) return fail("מקור המצלמה אינו זמין באתר הזה.", 404);
      if (!digitalObserverCameraIsConnected(source)) return fail("ערוץ ה-DVR אינו מחובר כרגע.", 409);
      const gatewayStreamId = String(source.metadata?.gateway_stream_id || "").trim();
      if (!gatewayStreamId) return fail("למקור המצלמה עדיין אין מזהה Gateway.", 409);
      const gatewayId = String(source.metadata?.gateway_id || "").trim();
      const secret = process.env.VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET || "";
      if (!gatewayId || !secret) return fail("זהות ה-Gateway המקומי אינה זמינה.", 503);
      const grant = issueGatewayPlaybackGrant({
        gateway_id: gatewayId,
        observer_site_id: payload.observer_site_id,
        camera_source_id: source.id,
        gateway_stream_id: gatewayStreamId
      }, secret);
      return ok({
        camera_source_id: source.id,
        mode: payload.mode,
        provider: "custom",
        status: "authorized",
        playback: {
          claim_url: "http://127.0.0.1:18082/playback/claim",
          transport: "local_gateway",
          remote_route_configured: false,
          grant
        },
        expires_in_seconds: 45,
        private_source_hidden: true
      });
    }

    return fail("חסר מקור מצלמה מאומת.", 422);
  } catch (error) {
    return handleRouteError(error);
  }
}
