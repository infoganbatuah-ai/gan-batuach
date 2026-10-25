import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { registerPushDevice } from "@/lib/domain/push-service";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";

const observerSources = new Set(["digital_observer_native", "digital_observer_fcm"]);
const siteIdSchema = z.string().uuid();

function observerPushSiteClaim(metadata: Record<string, unknown>) {
  const source = metadata.source;
  const hasSite = Object.hasOwn(metadata, "observer_site_id");
  const observerSource = typeof source === "string" && observerSources.has(source);
  if (!observerSource && !hasSite) return null;
  const siteId = siteIdSchema.safeParse(metadata.observer_site_id);
  if (!observerSource || !siteId.success) return { invalid: true as const };
  return { invalid: false as const, siteId: siteId.data };
}

const schema = z.object({
  platform: z.enum(["web", "android", "ios"]),
  device_token: z.string().min(8),
  device_id: z.string().optional(),
  app_version: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export async function POST(request: Request) {
  try {
    const hasBearer = request.headers.get("authorization")?.startsWith("Bearer ") ?? false;
    const bearerSession = hasBearer
      ? await getDigitalObserverApiUser(request)
      : null;
    if (hasBearer && !bearerSession) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const cookieSession = bearerSession ? null : await requireUser();
    const profile = bearerSession?.profile ?? cookieSession!.profile;
    const payload = schema.parse(await request.json());
    const supabase = bearerSession?.supabase ?? await createClient();
    const observerClaim = observerPushSiteClaim(payload.metadata ?? {});
    if (hasBearer && !observerClaim) return fail("רישום Push לתצפיתן דורש מקור ואתר מאושרים.", 400);
    if (observerClaim) {
      if (observerClaim.invalid) return fail("רישום Push לאתר דורש מזהה אתר תקין ומקור מאושר.", 400);
      if (!payload.device_id?.trim()) return fail("רישום Push לתצפיתן דורש מזהה התקנה.", 400);
      // A client-supplied site label is never authority. Recheck the current
      // Observer session and manage access before the token upsert.
      const observer = bearerSession ?? await getDigitalObserverApiUser(request);
      if (!observer || observer.profile.id !== profile.id) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
      const site = await getObserverSiteAccess(observer.supabase, observer.profile, observerClaim.siteId, { manage: true });
      if (!site || site.id !== observerClaim.siteId || site.active !== true) return fail("אין הרשאה לרשום Push באתר הזה.", 403);
    }
    const result = await registerPushDevice(supabase as Parameters<typeof registerPushDevice>[0], {
      profileId: profile.id,
      role: profile.role,
      platform: payload.platform,
      deviceToken: payload.device_token,
      deviceId: payload.device_id ?? null,
      appVersion: payload.app_version ?? null,
      metadata: payload.metadata ?? {}
    });
    if (!result.ok) {
      if (result.conflict) return fail("המכשיר כבר משויך או בוטל; נדרש ביטול ורישום מורשה מחדש.", 409);
      console.error("[push-register] failed", { profile_id: profile.id, role: profile.role, platform: payload.platform, error: result.error });
      return fail("רישום המכשיר להתראות נכשל.", 500);
    }
    return ok({ device: result.device });
  } catch (error) {
    return handleRouteError(error);
  }
}
