import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { unregisterPushDevice } from "@/lib/domain/push-service";
import { getDigitalObserverApiUser, getDigitalObserverPushRevocationUser } from "@/lib/domain/digital-observer/access";

const schema = z.object({
  device_token: z.string().min(8).optional(),
  device_id: z.string().trim().min(1).optional(),
  source: z.enum(["digital_observer_native", "digital_observer_fcm"]).optional(),
  observer_site_id: z.string().uuid().optional()
});

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    const hasBearer = request.headers.get("authorization")?.startsWith("Bearer ") ?? false;
    const bearerSession = hasBearer ? await getDigitalObserverPushRevocationUser(request) : null;
    if (hasBearer && !bearerSession) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const scopedSession = payload.source
      ? bearerSession ?? await getDigitalObserverPushRevocationUser(request) : null;
    if (payload.source && !scopedSession) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const cookieSession = bearerSession || scopedSession ? null : await requireUser();
    const profile = bearerSession?.profile ?? scopedSession?.profile ?? cookieSession!.profile;
    const observer = bearerSession ?? scopedSession ?? await getDigitalObserverApiUser(request);
    if (!payload.device_token && !payload.device_id) return fail("נדרש מזהה מכשיר או token לביטול רישום.", 400);
    if (Boolean(payload.source) !== Boolean(payload.observer_site_id) || ((observer || hasBearer) && !payload.source)) {
      return fail("ביטול רישום לתצפיתן דורש מקור ואתר מדויקים.", 400);
    }
    if (payload.source) {
      // Revoking one's own row remains possible after Site access is lost;
      // this does not authorize a new registration or read any other row.
      if (!scopedSession || scopedSession.profile.id !== profile.id) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    }
    const supabase = scopedSession?.supabase ?? bearerSession?.supabase ?? await createClient();
    const scope = payload.source && payload.observer_site_id
      ? { source: payload.source, siteId: payload.observer_site_id }
      : undefined;
    const result = await unregisterPushDevice(supabase as Parameters<typeof unregisterPushDevice>[0],
      profile.id, payload.device_token ?? null, payload.device_id ?? null, scope);
    if (!result.ok || (scope && !result.confirmed)) {
      console.error("[push-unregister] failed", { profile_id: profile.id, role: profile.role,
        error: result.error ?? "PUSH_REVOCATION_UNCONFIRMED" });
      return fail("ביטול רישום המכשיר להתראות נכשל.", 500);
    }
    return ok({ devices: result.rows, ...(scope ? { confirmed: true, profile_id: profile.id } : {}) });
  } catch (error) {
    return handleRouteError(error);
  }
}
