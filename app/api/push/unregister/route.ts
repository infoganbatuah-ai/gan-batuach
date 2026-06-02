import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { unregisterPushDevice } from "@/lib/domain/push-service";

const schema = z.object({
  device_token: z.string().optional(),
  device_id: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const { profile } = await requireUser();
    const payload = schema.parse(await request.json());
    const supabase = await createClient();
    const result = await unregisterPushDevice(supabase as any, profile.id, payload.device_token ?? null, payload.device_id ?? null);
    if (!result.ok) {
      console.error("[push-unregister] failed", { profile_id: profile.id, role: profile.role, error: result.error });
      return fail("ביטול רישום המכשיר להתראות נכשל.", 500);
    }
    return ok({ devices: result.rows });
  } catch (error) {
    return handleRouteError(error);
  }
}
