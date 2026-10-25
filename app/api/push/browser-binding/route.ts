import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverPushRevocationUser } from "@/lib/domain/digital-observer/access";

const deviceReferenceSchema = z.string().uuid();
const metadataSchema = z.object({
  source: z.literal("digital_observer_fcm"),
  observer_site_id: z.string().uuid()
});

// Read-only legacy recovery. An owner may learn only the exact Site of their
// own active browser installation, even after its Observer Site access ends.
export async function GET(request: Request) {
  try {
    const deviceId = deviceReferenceSchema.safeParse(new URL(request.url).searchParams.get("device_id"));
    if (!deviceId.success) return fail("מזהה ההתקנה אינו תקין.", 400);
    const session = await getDigitalObserverPushRevocationUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const { data, error } = await session.supabase.from("push_device_tokens" as never)
      .select("metadata")
      .eq("profile_id", session.profile.id)
      .eq("device_id", deviceId.data)
      .eq("platform", "web")
      .eq("is_active", true)
      .contains("metadata", { source: "digital_observer_fcm" })
      .limit(2);
    if (error || !Array.isArray(data)) return fail("לא ניתן לאמת את רישום ההתראות.", 503);
    const rows = data as Array<{ metadata: unknown }>;
    if (rows.length !== 1) return fail("לא נמצא שיוך יחיד ומאומת להתקנה.", rows.length ? 409 : 404);
    const metadata = metadataSchema.safeParse(rows[0].metadata);
    if (!metadata.success) return fail("שיוך ההתראות אינו תקין.", 409);
    const response = ok({ confirmed: true, profile_id: session.profile.id,
      device_id: deviceId.data, observer_site_id: metadata.data.observer_site_id });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
