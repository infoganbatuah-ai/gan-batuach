import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { buildDvrGatewayStatus, createDvrPlaybackSession, type DvrGatewayEventRow } from "@/lib/domain/digital-observer/dvr-gateway";
import {
  EDGE_PLAYBACK_SOURCE_COLUMNS, resolveEdgePlaybackSource, type EdgePlaybackSourceRow,
} from "@/lib/domain/digital-observer/edge-playback-source";
import { issueGatewayPlaybackGrant } from "@/lib/domain/gateway-device-enrollment";
import { edgePlaybackOrigin, localPlaybackAllowed } from "@/lib/domain/digital-observer/edge-playback-origin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// These Observer tables predate the generated Database type. Keep the selected
// shape explicit until the canonical generated schema includes them.
type ObserverRouteTable<Row> = {
  Row: Row;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: [];
};
type ObserverRouteDatabase = Database & {
  public: {
    Tables: {
      observer_intelligence_signals: ObserverRouteTable<DvrGatewayEventRow & { observer_site_id: string }>;
      digital_observer_camera_sources: ObserverRouteTable<EdgePlaybackSourceRow>;
    };
  };
};
type ObserverRouteClient = SupabaseClient<ObserverRouteDatabase>;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sessionSchema = z.object({
  observer_site_id: z.string().uuid(),
  camera_source_id: z.string().uuid().optional(),
  channel: z.coerce.number().int().min(1).max(64).optional(),
  mode: z.enum(["live", "playback"]).default("live"),
  token: z.string().trim().max(512).optional()
});

async function requireSiteAccess(request: Request, observerSiteId: string) {
  const session = await getDigitalObserverApiUser(request);
  if (!session) return { error: fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401) };

  const site = await getObserverSiteAccess(session.supabase, session.profile, observerSiteId);
  if (!site) return { error: fail("אין הרשאה לצפות באתר הזה.", 403) };
  return { session, site };
}
async function loadReviewedEvents(supabase: ObserverRouteClient, observerSiteId: string): Promise<DvrGatewayEventRow[]> {
  const { data, error } = await supabase
    .from("observer_intelligence_signals")
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

    if (!access.session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const events = await loadReviewedEvents(access.session.supabase as unknown as ObserverRouteClient, observerSiteId);
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

    const qa = process.env.OBSERVER_QA_BUDGET_ENABLED === "1";
    if (qa && (!payload.camera_source_id || payload.mode !== "live" ||
      process.env.VERCEL_ENV === "production" || new URL(request.url).origin !== "https://observer-qa.ganbatuach.com")) {
      return fail("QA playback is unavailable.", 403);
    }

    if (payload.camera_source_id) {
      if (!access.session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
      const { data: source, error } = await (access.session.supabase as unknown as ObserverRouteClient)
        .from("digital_observer_camera_sources")
        .select(EDGE_PLAYBACK_SOURCE_COLUMNS)
        .eq("id", payload.camera_source_id)
        .eq("observer_site_id", payload.observer_site_id)
        .single();
      if (error || !source) return fail("מקור המצלמה אינו זמין באתר הזה.", 404);
      const binding = resolveEdgePlaybackSource(source);
      if (binding.status === "mode_denied") return fail("מקור המצלמה אינו זמין באתר הזה.", 404);
      if (binding.status === "not_online") return fail("מקור המצלמה אינו זמין לצפייה כרגע.", 409);
      if (binding.status === "stream_unmapped") return fail("מיפוי השידור של מקור המצלמה אינו תואם.", 409);
      if (binding.status === "profile_unmapped") return fail("סוג רכיב ה־Edge אינו תואם למקור.", 409);
      const secret = process.env.VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET || "";
      if (binding.status === "gateway_unmapped" || (!qa && !secret)) return fail("זהות רכיב ה־Edge אינה זמינה.", 503);
      const { gatewayId, streamId, profile } = binding;
      const enrollment = await createAdminClient().from("video_gateway_device_enrollments")
        .select("id,observer_site_id,gateway_id,status,lifecycle_state,deployment_profile")
        .eq("gateway_id", gatewayId).eq("observer_site_id", payload.observer_site_id)
        .eq("status", "delivered").maybeSingle();
      if (enrollment.error || !enrollment.data || enrollment.data.lifecycle_state !== "ACTIVE")
        return fail("שיוך ה־Gateway לאתר אינו פעיל.", 409);
      if (enrollment.data.deployment_profile !== profile)
        return fail("סוג רכיב ה־Edge אינו תואם למקור.", 409);
      if (qa) {
        const port = Number(process.env.OBSERVER_QA_ISSUER_PORT);
        const key = process.env.OBSERVER_QA_ISSUER_KEY || "";
        const runId = process.env.OBSERVER_QA_RUN_ID || "";
        const expectedSha = process.env.OBSERVER_QA_BUILD_SHA || "";
        if (!Number.isInteger(port) || port < 1024 || port > 65535 || !/^[a-f0-9]{64}$/.test(key) ||
          !/^[a-zA-Z0-9_-]{1,80}$/.test(runId) || !/^[a-f0-9]{40}$/.test(expectedSha)) {
          return fail("QA playback is unavailable.", 503);
        }
        // The viewer has already been checked against the active site and source.
        // The isolated issuer re-authenticates the session and checks its own registry.
        const { data } = await access.session.supabase.auth.getSession();
        if (!data.session?.access_token) return fail("QA playback is unavailable.", 401);
        try {
          const issued = await fetch(`http://127.0.0.1:${port}/internal/issue`, {
            method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(3000),
            headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
            body: JSON.stringify({ session: data.session.access_token, runId, sourceId: source.id,
              siteId: payload.observer_site_id, gatewayId, streamId, profile, expectedSha })
          });
          if (!issued.ok) return fail("QA playback is unavailable.", 403);
          const result = await issued.json();
          if (typeof result.path !== "string" || !result.path.startsWith("/qa/")) return fail("QA playback is unavailable.", 503);
          const url = new URL(result.path, "https://observer-qa.ganbatuach.com");
          const path = `/qa/${runId}/`;
          if (result.sha !== expectedSha || url.origin !== "https://observer-qa.ganbatuach.com" ||
            ![path + `general/${source.id}/index.m3u8`, path + `ch1/${source.id}/index.m3u8`].includes(url.pathname) ||
            !/^\?r=[a-zA-Z0-9_-]{43}$/.test(url.search) || url.hash) return fail("QA playback is unavailable.", 503);
          const response = ok({ playback: { hls_url: url.href, qa_build_sha: expectedSha }, expires_in_seconds: 30 });
          response.headers.set("cache-control", "no-store");
          return response;
        } catch { return fail("QA playback is unavailable.", 503); }
      }
      const remoteOrigin = edgePlaybackOrigin(gatewayId, process.env.OBSERVER_PLAYBACK_EDGE_ORIGINS_JSON);
      const localAllowed = localPlaybackAllowed(request.url, process.env.NODE_ENV);
      if (!remoteOrigin && !localAllowed) return fail("גישה מרחוק ל־Edge טרם הוגדרה.", 503);
      const grant = issueGatewayPlaybackGrant({
        gateway_id: gatewayId,
        observer_site_id: payload.observer_site_id,
        camera_source_id: source.id,
        gateway_stream_id: streamId
      }, secret);
      const requestedLocalPort = Number(source.metadata?.connector_local_port);
      const localPlaybackPort = profile === "SOFTWARE_CONNECTOR"
        ? Number.isInteger(requestedLocalPort) && requestedLocalPort >= 1024 && requestedLocalPort <= 65535 ? requestedLocalPort : 18083
        : 18082;
      return ok({
        camera_source_id: source.id,
        mode: payload.mode,
        provider: "custom",
        status: "authorized",
        playback: {
          claim_url: remoteOrigin ? `${remoteOrigin}/playback/claim` : `http://127.0.0.1:${localPlaybackPort}/playback/claim`,
          allowed_origin: remoteOrigin || `http://127.0.0.1:${localPlaybackPort}`,
          grant
        },
        expires_in_seconds: 45,
        private_source_hidden: true
      });
    }

    if (!payload.channel) return fail("חסר ערוץ או מקור מצלמה.", 422);
    // The legacy channel-only contract has no enrolled Edge/Site binding and
    // can return local gateway URLs. Never hand it to a remote viewer.
    if (!localPlaybackAllowed(request.url, process.env.NODE_ENV))
      return fail("צפייה מרחוק דורשת מקור מצלמה המשויך לרכיב Edge מאושר.", 503);

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
