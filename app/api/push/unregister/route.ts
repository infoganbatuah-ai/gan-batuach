import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { unregisterPushDevice } from "@/lib/domain/push-service";
import { getDigitalObserverApiUser } from "@/lib/domain/digital-observer/access";

const schema = z.object({
  device_token: z.string().min(1).optional(),
  device_id: z.string().min(1).optional()
}).refine((value) => Boolean(value.device_token || value.device_id), "device selector required");

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization");
    const bearerSession = authorization?.startsWith("Bearer ")
      ? await getDigitalObserverApiUser(request)
      : null;
    // An explicit Authorization header cannot fall back to a different
    // browser cookie account when its token is invalid or unsupported.
    if (authorization !== null && !bearerSession) return fail("נדרש אימות מחדש.", 401);
    const cookieSession = bearerSession ? null : await requireUser();
    const profile = bearerSession?.profile ?? cookieSession!.profile;
    const payload = schema.parse(await request.json());
    const supabase = bearerSession?.supabase ?? await createClient();
    const result = await unregisterPushDevice(supabase as Parameters<typeof unregisterPushDevice>[0], profile.id, payload.device_token ?? null, payload.device_id ?? null);
    if (!result.ok) {
      console.error("[push-unregister] failed", { profile_id: profile.id, role: profile.role, error: result.error });
      return fail("ביטול רישום המכשיר להתראות נכשל.", 500);
    }
    return ok({ devices: result.rows });
  } catch (error) {
    return handleRouteError(error);
  }
}
