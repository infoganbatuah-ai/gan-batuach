import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { createDigitalObserverAdminDataClient, hasObserverAdminClaim } from "@/lib/domain/digital-observer/admin-access";
import { guardHistoryPrivacyRestricted } from "@/lib/domain/event-engine/guard-journal-search";
import { compileInvestigationQuery, validateInvestigationQuery, type InvestigationCameraResource } from "@/lib/domain/digital-observer/investigation-query";
import { searchDigitalObserverInvestigation } from "@/lib/domain/digital-observer/investigation-search-service";
import type { InvestigationSource } from "@/lib/domain/digital-observer/investigation-results";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  observer_site_id: z.string().uuid(),
  question: z.string().trim().min(2).max(500),
  camera_source_id: z.string().uuid().optional(),
  cursor: z.number().int().min(0).max(500).optional(),
  limit: z.number().int().min(1).max(25).optional()
}).strict();

type CameraRow = {
  id: string;
  observer_site_id: string;
  display_name: string | null;
  location_label: string | null;
  camera_stream_id: string | null;
  metadata: Record<string, unknown> | null;
};

function textList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function resourcesFor(rows: CameraRow[]): InvestigationCameraResource[] {
  return rows.map((camera) => {
    const metadata = camera.metadata && typeof camera.metadata === "object" ? camera.metadata : {};
    const zoneName = typeof metadata.zone_name === "string"
      ? metadata.zone_name
      : typeof metadata.zone_label === "string"
        ? metadata.zone_label
        : camera.location_label;
    return {
      id: camera.id,
      observerSiteId: camera.observer_site_id,
      name: camera.display_name ?? camera.location_label ?? `מצלמה ${camera.id.slice(0, 8)}`,
      locationLabel: camera.location_label,
      streamId: camera.camera_stream_id,
      aliases: [
        ...textList(metadata.aliases),
        ...(typeof metadata.gateway_stream_id === "string" ? [metadata.gateway_stream_id] : []),
        ...(typeof metadata.channel === "number" || typeof metadata.channel === "string" ? [`ערוץ ${String(metadata.channel)}`] : [])
      ],
      zones: zoneName ? [{ id: typeof metadata.zone_id === "string" ? metadata.zone_id : null, name: zoneName, aliases: typeof metadata.zone_type === "string" ? [metadata.zone_type] : [] }] : []
    };
  });
}

export async function POST(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const payload = requestSchema.parse(await request.json());
    const observerAdmin = hasObserverAdminClaim(session.user.app_metadata);
    const dataClient = observerAdmin ? createDigitalObserverAdminDataClient() : session.supabase;
    const site = observerAdmin
      ? (await dataClient.from("observer_sites" as never)
        .select("id,name,site_type,garden_id,timezone,business_handles_children,vision_privacy_mode")
        .eq("id", payload.observer_site_id).is("garden_id", null).neq("site_type", "kindergarten").maybeSingle()).data
      : await getObserverSiteAccess(session.supabase, session.profile, payload.observer_site_id, { manage: false });
    if (!site) return fail("אין הרשאה לחקור את האתר הזה.", 403);
    if (guardHistoryPrivacyRestricted(site)) return fail("חקירת היסטוריית מצלמות אינה זמינה באתר הזה תחת מדיניות הפרטיות הנוכחית.", 403);

    const camerasResult = await dataClient.from("digital_observer_camera_sources" as never)
      .select("id,observer_site_id,display_name,location_label,camera_stream_id,metadata")
      .eq("observer_site_id", payload.observer_site_id).order("created_at");
    if (camerasResult.error) return fail("לא ניתן לקרוא כרגע את מקורות המצלמות המורשים.", 503);
    const cameraRows = (camerasResult.data ?? []) as unknown as CameraRow[];
    const resources = resourcesFor(cameraRows);
    const compilation = compileInvestigationQuery({
      question: payload.question,
      context: {
        observerSiteId: payload.observer_site_id,
        timeZone: String(site.timezone ?? "Asia/Jerusalem"),
        cameras: resources
      },
      explicitCameraSourceId: payload.camera_source_id,
      cursor: payload.cursor,
      limit: payload.limit
    });
    if (compilation.status !== "READY" || !compilation.query) {
      return ok({
        status: compilation.status,
        compilation,
        result: null,
        debug: observerAdmin ? { question: payload.question, compiler: compilation.compilerVersion, resourceCount: resources.length, retrievalExecuted: false } : null
      });
    }
    const validation = validateInvestigationQuery(compilation.query);
    if (!validation.valid || !validation.query) return fail("תוכנית החיפוש לא עברה אימות עצמאי.", 422, { errors: validation.errors });
    const sources: InvestigationSource[] = cameraRows.map((camera) => ({
      id: camera.id,
      observer_site_id: camera.observer_site_id,
      display_name: camera.display_name,
      location_label: camera.location_label,
      camera_stream_id: camera.camera_stream_id
    }));
    const result = await searchDigitalObserverInvestigation({ db: dataClient, query: validation.query, sources });
    return ok({
      status: "READY",
      compilation,
      result,
      debug: observerAdmin ? {
        question: payload.question,
        compiler: compilation.compilerVersion,
        query: validation.query,
        resolvedCameraIds: validation.query.cameraSourceIds,
        retrieved: { incidents: result.incidents.length, events: result.events.length },
        grounding: result.grounding,
        queryLatencyMs: result.queryLatencyMs
      } : null
    });
  } catch (error) {
    return handleSafeRouteError(error);
  }
}
