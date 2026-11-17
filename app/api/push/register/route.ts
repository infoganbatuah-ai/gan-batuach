import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { registerPushDevice } from "@/lib/domain/push-service";
import { getDigitalObserverApiUser } from "@/lib/domain/digital-observer/access";

const schema = z.object({
  platform: z.enum(["web", "android", "ios"]),
  device_token: z.string().min(8),
  device_id: z.string().optional(),
  expected_profile_id: z.string().uuid().optional(),
  app_version: z.string().optional(),
  metadata: z.object({
    source: z.enum(["fcm_web", "digital_observer_fcm", "digital_observer_native"])
  }).catchall(z.unknown())
});

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization");
    const bearerSession = authorization?.startsWith("Bearer ")
      ? await getDigitalObserverApiUser(request)
      : null;
    // A supplied Authorization header must stand on its own. Falling back to
    // a different cookie session could register this token to the wrong user.
    if (authorization !== null && !bearerSession) return fail("נדרש אימות מחדש.", 401);
    const cookieSession = bearerSession ? null : await requireUser();
    const profile = bearerSession?.profile ?? cookieSession!.profile;
    const payload = schema.parse(await request.json());
    // A native callback may race a web account switch. This is a session
    // consistency check, not proof of the app bundle or device identity.
    if (payload.expected_profile_id && payload.expected_profile_id !== profile.id)
      return fail("נדרש אימות מחדש.", 403);
    const supabase = bearerSession?.supabase ?? await createClient();
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
      console.error("[push-register] failed", { profile_id: profile.id, role: profile.role, platform: payload.platform, error: result.error });
      return fail("רישום המכשיר להתראות נכשל.", 500);
    }
    return ok({ device: result.device });
  } catch (error) {
    return handleRouteError(error);
  }
}
