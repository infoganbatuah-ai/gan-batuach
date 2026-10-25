import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import {
  authorizedMobileDestination,
  DIGITAL_OBSERVER_MOBILE_RUNTIME_CONTRACT,
  parseMobileLink,
  type MobileLinkKind
} from "@/lib/domain/digital-observer/mobile-runtime";

const linkSchema = z.object({ url: z.string().url().max(2_048) });
const mobileSitePageSize = 25;
const maxMobileSiteCandidates = 100;

const resourceTable: Record<Exclude<MobileLinkKind, "investigation">, string> = {
  camera: "digital_observer_camera_sources",
  event: "observer_intelligence_signals",
  incident: "observer_correlated_events",
  evidence: "digital_observer_event_clips",
  notification: "digital_observer_notification_deliveries"
};

function configuredOrigins(request: Request) {
  const origins = new Set<string>([new URL(request.url).origin]);
  for (const value of [process.env.NEXT_PUBLIC_APP_URL, process.env.CAPACITOR_SERVER_URL]) {
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol === "https:") origins.add(url.origin);
    } catch {
      // Invalid optional configuration is not promoted into the allowlist.
    }
  }
  return [...origins];
}

export async function GET(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    // RLS may expose more than 25 Sites to an owner or administrator. Never
    // treat the first page as a complete authorization set: a saved Site on
    // a later page would otherwise be mistaken for a revoked Site.
    const candidates: Array<{ id: string; name: string; timezone: string | null }> = [];
    for (let offset = 0; offset <= maxMobileSiteCandidates; offset += mobileSitePageSize) {
      const { data, error } = await session.supabase
        .from("observer_sites" as never)
        .select("id,name,timezone")
        .is("garden_id", null)
        .neq("site_type", "kindergarten")
        .eq("active", true)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, Math.min(offset + mobileSitePageSize - 1, maxMobileSiteCandidates));
      if (error || !Array.isArray(data)) return fail("לא ניתן לטעון את סביבת המובייל.", 503);
      // One extra row is a sentinel. Return no partial list when the ceiling
      // is exceeded, so the phone cannot infer a missing Site was revoked.
      if (offset === maxMobileSiteCandidates && data.length) {
        return fail("רשימת האתרים גדולה ממגבלת האימות למובייל.", 503);
      }
      candidates.push(...data as typeof candidates);
      if (data.length < mobileSitePageSize) break;
    }

    const authorized = [];
    for (const candidate of candidates) {
      const site = await getObserverSiteAccess(session.supabase, session.profile, candidate.id);
      if (site) authorized.push(candidate);
    }
    return ok({
      contract: DIGITAL_OBSERVER_MOBILE_RUNTIME_CONTRACT,
      sites: authorized,
      session: { active: true, profile_id: session.profile.id },
      sms_authentication: "disabled",
      sensitive_local_cache: false,
      checked_at: new Date().toISOString()
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const payload = linkSchema.parse(await request.json());
    let link;
    try {
      link = parseMobileLink(payload.url, configuredOrigins(request));
    } catch {
      return fail("קישור המובייל אינו מאושר.", 400);
    }
    const site = await getObserverSiteAccess(session.supabase, session.profile, link.observerSiteId);
    if (!site) return fail("אין הרשאה לאתר המבוקש.", 403);

    if (link.kind !== "investigation") {
      const { data, error } = await session.supabase
        .from(resourceTable[link.kind] as never)
        .select("id,observer_site_id")
        .eq("id", link.resourceId!)
        .eq("observer_site_id", link.observerSiteId)
        .maybeSingle();
      if (error || !data) return fail("המשאב אינו זמין או שאינו מורשה.", 404);
    }

    return ok({
      contract: DIGITAL_OBSERVER_MOBILE_RUNTIME_CONTRACT,
      authorized: true,
      destination: authorizedMobileDestination(link),
      kind: link.kind
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
