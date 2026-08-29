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
  app_version: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export async function POST(request: Request) {
  try {
    const bearerSession = request.headers.get("authorization")?.startsWith("Bearer ")
      ? await getDigitalObserverApiUser(request)
      : null;
    const cookieSession = bearerSession ? null : await requireUser();
    const profile = bearerSession?.profile ?? cookieSession!.profile;
    const payload = schema.parse(await request.json());
    const supabase = bearerSession?.supabase ?? await createClient();
    const result = await registerPushDevice(supabase as any, {
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
