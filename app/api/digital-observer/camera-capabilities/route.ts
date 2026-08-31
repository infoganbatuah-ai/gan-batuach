import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { discoverCameraCapabilities } from "@/lib/domain/digital-observer/guard-engine";

const schema = z.object({ camera_source_id: z.string().uuid() });

export async function POST(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const payload = schema.parse(await request.json());
    const supabase = session.supabase as any;
    const result = await supabase.from("digital_observer_camera_sources")
      .select("id,observer_site_id,display_name,location_label,capabilities,metadata,source_mode")
      .eq("id", payload.camera_source_id).maybeSingle();
    if (result.error || !result.data) return fail("המצלמה לא נמצאה.", 404);
    const site = await getObserverSiteAccess(supabase, session.profile, result.data.observer_site_id);
    if (!site) return fail("אין הרשאה לגשת למצלמה הזו.", 403);
    const manifest = discoverCameraCapabilities({
      cameraId: result.data.id,
      cameraZoneName: result.data.location_label || result.data.display_name,
      capabilities: result.data.capabilities,
      metadata: result.data.metadata,
      sourceMode: result.data.source_mode
    });
    return ok({ manifest, message: "יכולות המצלמה מופו לפי הדיווח הזמין מהמקור. יכולות פיזיות יופעלו רק דרך Gateway מאומת." });
  } catch (error) { return handleRouteError(error); }
}
