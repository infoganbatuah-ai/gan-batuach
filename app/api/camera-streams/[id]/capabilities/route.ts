import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { discoverCameraCapabilities } from "@/lib/domain/digital-observer/guard-engine";
import { probeCameraCapabilities } from "@/lib/domain/digital-observer/camera-gateway-adapter";
import { createClient } from "@/lib/supabase/server";

type CameraRow = {
  id: string; garden_id?: string | null; name?: string | null; area?: string | null;
  test_site_type?: string | null; system_type?: string | null;
  metadata?: Record<string, unknown> | null;
};

function synthetic(camera: CameraRow) {
  return Boolean(camera.test_site_type || camera.metadata?.qa_demo || camera.metadata?.synthetic || String(camera.name ?? "").includes("[DEMO]"));
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireRole(["manager", "owner"]);
    const { id } = await params;
    const supabase = await createClient();
    const { data, error } = await supabase.from("camera_streams")
      .select("id,garden_id,name,area,status,health_status,system_type,source_type,metadata,test_site_type")
      .eq("id", id).eq("garden_id", profile.garden_id ?? "").maybeSingle();
    const camera = data as unknown as CameraRow | null;
    if (error || !camera) return fail("המצלמה לא נמצאה או אינה משויכת לגן שלך.", 404);
    const manifest = synthetic(camera)
      ? discoverCameraCapabilities({ cameraId: camera.id, cameraZoneName: camera.area || camera.name,
          capabilities: { ptz: true, twoWayAudio: true, siren: true, lighting: true },
          metadata: { synthetic: true }, sourceMode: "demo" })
      : discoverCameraCapabilities({ cameraId: camera.id, cameraZoneName: camera.area || camera.name,
          metadata: camera.metadata, capabilities: camera.metadata?.capabilities as Record<string, unknown> | undefined,
          sourceMode: camera.system_type });
    if (!synthetic(camera)) {
      try {
        const live = await probeCameraCapabilities(camera.id);
        return ok({ manifest: { ...live.manifest, cameraZoneName: manifest.cameraZoneName }, message: "היכולות אומתו מול ה-Gateway." });
      } catch {
        return ok({ manifest, message: "הוצג מידע שמור בלבד. אין בכך אימות להפעלת חומרה." });
      }
    }
    return ok({ manifest, message: "מצלמת הדמו מוכנה לבדיקה בטוחה של כל פעולות השליטה." });
  } catch (error) { return handleRouteError(error); }
}
